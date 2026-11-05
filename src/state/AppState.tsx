import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { budgetStatus, monthKey, spentJpy, type BudgetStatus } from '../core/budget';
import { DEFAULT_MEMBERS } from '../core/defaultMembers';
import { runConversation, summarize } from '../core/orchestrator';
import { createMockProvider, createOpenRouterProvider } from '../core/providers';
import { DEFAULT_SETTINGS, type Member, type Message, type Room, type Settings } from '../core/types';
import { loadApiKey, loadData, saveApiKey, saveData, type PersistedData } from './storage';

const newId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

function initialData(): PersistedData {
  const now = new Date().toISOString();
  return {
    version: 1,
    members: DEFAULT_MEMBERS,
    rooms: [{ id: 'lobby', title: '雑談ルーム', memberIds: DEFAULT_MEMBERS.map((m) => m.id), createdAt: now }],
    messages: [],
    settings: DEFAULT_SETTINGS,
  };
}

type AppState = {
  ready: boolean;
  data: PersistedData;
  apiKey: string;
  /** 会話が進行中の会議室ID */
  busyRoomId: string | null;
  spentThisMonth: number;
  budget: BudgetStatus;
  createRoom(title: string, memberIds: string[]): string;
  renameRoom(id: string, title: string): void;
  deleteRoom(id: string): void;
  updateMember(m: Member): void;
  resetMembers(): void;
  updateSettings(patch: Partial<Settings>): void;
  setApiKey(key: string): Promise<void>;
  send(roomId: string, text: string): Promise<void>;
  askStatus(roomId: string): Promise<void>;
  stop(): void;
};

const Ctx = createContext<AppState | null>(null);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [data, setData] = useState<PersistedData>(initialData);
  const [apiKey, setApiKeyState] = useState('');
  const [busyRoomId, setBusy] = useState<string | null>(null);
  const dataRef = useRef(data);
  dataRef.current = data;
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    (async () => {
      const [saved, key] = await Promise.all([loadData(), loadApiKey()]);
      if (saved) setData({ ...initialData(), ...saved, settings: { ...DEFAULT_SETTINGS, ...saved.settings } });
      setApiKeyState(key);
      setReady(true);
    })();
  }, []);

  useEffect(() => {
    if (ready) saveData(data).catch(() => {});
  }, [data, ready]);

  const update = useCallback((fn: (d: PersistedData) => PersistedData) => setData((d) => fn(d)), []);
  const appendMessage = useCallback((m: Message) => update((d) => ({ ...d, messages: [...d.messages, m] })), [update]);

  const provider = useMemo(
    () => (data.settings.providerMode === 'openrouter' ? createOpenRouterProvider(apiKey) : createMockProvider()),
    [data.settings.providerMode, apiKey],
  );

  const spentThisMonth = spentJpy(data.messages, monthKey(new Date().toISOString()), data.settings.usdJpy);
  const budget = budgetStatus(spentThisMonth, data.settings);

  const send = useCallback(
    async (roomId: string, text: string) => {
      const d = dataRef.current;
      const room = d.rooms.find((r) => r.id === roomId);
      if (!room || busyRoomId) return;
      const userMsg: Message = { id: newId(), roomId, authorId: 'user', text, createdAt: new Date().toISOString(), kind: 'chat' };
      appendMessage(userMsg);
      const ac = new AbortController();
      abortRef.current = ac;
      setBusy(roomId);
      try {
        const history = [...d.messages.filter((m) => m.roomId === roomId), userMsg];
        for await (const m of runConversation(room, text, history, d.messages, {
          provider,
          members: d.members,
          settings: d.settings,
          signal: ac.signal,
        })) {
          appendMessage(m);
        }
      } finally {
        setBusy(null);
        abortRef.current = null;
      }
    },
    [appendMessage, busyRoomId, provider],
  );

  const askStatus = useCallback(
    async (roomId: string) => {
      const d = dataRef.current;
      const room = d.rooms.find((r) => r.id === roomId);
      if (!room || busyRoomId) return;
      const ac = new AbortController();
      abortRef.current = ac;
      setBusy(roomId);
      try {
        const s = await summarize(room, d.messages.filter((m) => m.roomId === roomId), {
          provider,
          members: d.members,
          settings: d.settings,
          signal: ac.signal,
        });
        update((x) => ({
          ...x,
          messages: [...x.messages, s],
          rooms: x.rooms.map((r) => (r.id === roomId ? { ...r, latestSummary: s.text } : r)),
        }));
      } catch (e) {
        if (!ac.signal.aborted) {
          appendMessage({
            id: newId(),
            roomId,
            authorId: 'system',
            text: `要約に失敗しました: ${(e as Error).message}`,
            createdAt: new Date().toISOString(),
            kind: 'notice',
          });
        }
      } finally {
        setBusy(null);
        abortRef.current = null;
      }
    },
    [appendMessage, busyRoomId, provider, update],
  );

  const value: AppState = {
    ready,
    data,
    apiKey,
    busyRoomId,
    spentThisMonth,
    budget,
    createRoom(title, memberIds) {
      const id = newId();
      update((d) => ({ ...d, rooms: [{ id, title, memberIds, createdAt: new Date().toISOString() }, ...d.rooms] }));
      return id;
    },
    renameRoom(id, title) {
      update((d) => ({ ...d, rooms: d.rooms.map((r) => (r.id === id ? { ...r, title } : r)) }));
    },
    deleteRoom(id) {
      update((d) => ({ ...d, rooms: d.rooms.filter((r) => r.id !== id), messages: d.messages.filter((m) => m.roomId !== id) }));
    },
    updateMember(m) {
      update((d) => ({ ...d, members: d.members.map((x) => (x.id === m.id ? m : x)) }));
    },
    resetMembers() {
      update((d) => ({ ...d, members: DEFAULT_MEMBERS }));
    },
    updateSettings(patch) {
      update((d) => ({ ...d, settings: { ...d.settings, ...patch } }));
    },
    async setApiKey(key) {
      await saveApiKey(key);
      setApiKeyState(key);
    },
    send,
    askStatus,
    stop() {
      abortRef.current?.abort();
    },
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp must be used inside AppStateProvider');
  return v;
}

/** 会議室内のメッセージ（新しい順でなく時系列） */
export function useRoomMessages(roomId: string): Message[] {
  const { data } = useApp();
  return useMemo(() => data.messages.filter((m) => m.roomId === roomId), [data.messages, roomId]);
}

export type { Room };
