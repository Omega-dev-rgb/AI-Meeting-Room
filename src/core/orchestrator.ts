import { budgetStatus, monthKey, spentJpy } from './budget';
import { parseMentions } from './mentions';
import { buildPrompt, buildSummaryPrompt } from './prompt';
import type { ChatProvider, Member, Message, Room, Settings } from './types';

/** 誰が何番目に話すかを決める（司会の役割） */
export function planTurns(room: Room, members: Member[], userText: string, maxRounds: number): string[] {
  const inRoom = members.filter((m) => room.memberIds.includes(m.id));
  const mentioned = parseMentions(userText, inRoom);
  // 指名があれば、指名された人だけが1回ずつ答える
  if (mentioned.length > 0) return mentioned;
  const rounds = Math.max(1, Math.min(maxRounds, 5));
  const order: string[] = [];
  for (let r = 0; r < rounds; r++) order.push(...inRoom.map((m) => m.id));
  return order;
}

export type RunDeps = {
  provider: ChatProvider;
  members: Member[];
  settings: Settings;
  now?: () => Date;
  newId?: () => string;
  signal?: AbortSignal;
};

let seq = 0;
const defaultId = () => `${Date.now().toString(36)}-${(seq++).toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

function notice(roomId: string, text: string, at: string, id: string): Message {
  return { id, roomId, authorId: 'system', text, createdAt: at, kind: 'notice' };
}

/**
 * ユーザーの投稿に続けて、AIメンバーが順番に発言する。
 * 1件できるごとに yield するので、画面はその都度タイムラインに追加できる。
 * allMessages は料金計算用（全会議室分）、history はこの会議室のログ（ユーザー投稿を含む）。
 */
export async function* runConversation(
  room: Room,
  userText: string,
  history: Message[],
  allMessages: Message[],
  deps: RunDeps,
): AsyncGenerator<Message> {
  const now = deps.now ?? (() => new Date());
  const newId = deps.newId ?? defaultId;
  const order = planTurns(room, deps.members, userText, deps.settings.maxRounds);
  const log = [...history];
  const ledger = [...allMessages];

  for (const memberId of order) {
    if (deps.signal?.aborted) return;
    const at = now().toISOString();
    const spent = spentJpy(ledger, monthKey(at), deps.settings.usdJpy);
    if (budgetStatus(spent, deps.settings) === 'stop') {
      yield notice(room.id, '今月の予算上限に達したので、会話を止めました。設定で予算を見直せます。', at, newId());
      return;
    }
    const me = deps.members.find((m) => m.id === memberId);
    if (!me) continue;
    const messages = buildPrompt(me, deps.members, room, log, deps.settings);
    let msg: Message;
    try {
      const res = await deps.provider.complete({ model: me.model, messages, maxTokens: 1500 }, deps.signal);
      msg = {
        id: newId(),
        roomId: room.id,
        authorId: me.id,
        text: res.text.trim() || '（……）',
        createdAt: now().toISOString(),
        kind: 'chat',
        usage: res.usage,
      };
    } catch (e) {
      if (deps.signal?.aborted) return;
      yield notice(room.id, `${me.name}の呼び出しに失敗しました: ${(e as Error).message}`, now().toISOString(), newId());
      continue;
    }
    log.push(msg);
    ledger.push(msg);
    yield msg;
  }
}

/** 「今どうなってる？」。まとめ役（先頭メンバー、なければ最初の参加者）のモデルで要約する */
export async function summarize(
  room: Room,
  history: Message[],
  deps: RunDeps,
  summarizerId = 'chatgpt',
): Promise<Message> {
  const now = deps.now ?? (() => new Date());
  const newId = deps.newId ?? defaultId;
  const inRoom = deps.members.filter((m) => room.memberIds.includes(m.id));
  const writer = inRoom.find((m) => m.id === summarizerId) ?? inRoom[0] ?? deps.members[0];
  const res = await deps.provider.complete(
    { model: writer.model, messages: buildSummaryPrompt(deps.members, room, history, deps.settings), maxTokens: 2000 },
    deps.signal,
  );
  return {
    id: newId(),
    roomId: room.id,
    authorId: writer.id,
    text: res.text.trim(),
    createdAt: now().toISOString(),
    kind: 'summary',
    usage: res.usage,
  };
}
