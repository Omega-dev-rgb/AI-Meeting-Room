import { MORNING_ROOM_ID, MORNING_ROOM_TITLE, type SyncState } from './morning';
import type { Member, Message, Room } from './types';

type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body?: string }) => Promise<{
  ok: boolean;
  status: number;
  json(): Promise<any>;
}>;

/** 朝会サーバーとのやりとり（アプリ側） */
export function createMorningClient(baseUrl: string, token: string, fetchImpl: FetchLike = fetch as unknown as FetchLike) {
  const base = baseUrl.trim().replace(/\/+$/, '');
  const call = async (method: string, path: string, body?: unknown) => {
    const res = await fetchImpl(`${base}${path}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
    return data;
  };
  return {
    pushState: (state: SyncState) => call('PUT', '/state', state),
    fetchSince: async (since: string): Promise<Message[]> =>
      (await call('GET', `/messages?since=${encodeURIComponent(since)}`)).messages ?? [],
    runNow: async (): Promise<Message[]> => (await call('POST', '/run')).messages ?? [],
  };
}

/** サーバーから届いた朝会をアプリのデータに混ぜる（重複は除き、朝会ルームがなければ作る） */
export function mergeMorning(
  rooms: Room[],
  messages: Message[],
  incoming: Message[],
  members: Member[],
  now: string,
): { rooms: Room[]; messages: Message[]; latest?: string } {
  const have = new Set(messages.map((m) => m.id));
  const fresh = incoming.filter((m) => !have.has(m.id));
  const latest = incoming.reduce<string | undefined>((a, m) => (!a || m.createdAt > a ? m.createdAt : a), undefined);
  if (fresh.length === 0) return { rooms, messages, latest };
  const hasRoom = rooms.some((r) => r.id === MORNING_ROOM_ID);
  const nextRooms = hasRoom
    ? rooms
    : [{ id: MORNING_ROOM_ID, title: MORNING_ROOM_TITLE, memberIds: members.map((m) => m.id), createdAt: now, depth: 'quick' as const }, ...rooms];
  const lastSummary = [...fresh].reverse().find((m) => m.kind === 'summary');
  return {
    rooms: lastSummary ? nextRooms.map((r) => (r.id === MORNING_ROOM_ID ? { ...r, latestSummary: lastSummary.text } : r)) : nextRooms,
    messages: [...messages, ...fresh],
    latest,
  };
}
