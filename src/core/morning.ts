import { monthKey } from './budget';
import { runConversation, summarize } from './orchestrator';
import { authorName } from './prompt';
import type { ChatProvider, Member, Message, Room, Settings } from './types';

/** 朝会の結果を入れる会議室のID（アプリ側で自動的に作る） */
export const MORNING_ROOM_ID = 'morning';
export const MORNING_ROOM_TITLE = '☀️ 朝会';

/** アプリからサーバーへ送る材料。APIキーは含めない */
export type SyncState = {
  members: Member[];
  userProfile: string;
  rooms: { id: string; title: string; latestSummary?: string; recent: string[] }[];
  updatedAt: string;
};

const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n) + '…' : s);

/**
 * サーバーに送る材料を作る。料金と通信量を抑えるため、
 * 最近動いた会議室だけ・各室の直近の発言だけを短くして送る
 */
export function buildSyncState(
  members: Member[],
  rooms: Room[],
  messages: Message[],
  userProfile: string,
  now: Date,
  opts = { maxRooms: 6, recentPerRoom: 6, days: 7 },
): SyncState {
  const since = now.getTime() - opts.days * 24 * 60 * 60 * 1000;
  const lastAt = (roomId: string) =>
    messages.filter((m) => m.roomId === roomId).reduce((t, m) => Math.max(t, Date.parse(m.createdAt) || 0), 0);
  const active = rooms
    .filter((r) => r.id !== MORNING_ROOM_ID)
    .map((r) => ({ r, at: lastAt(r.id) }))
    .filter((x) => x.at >= since)
    .sort((a, b) => b.at - a.at)
    .slice(0, opts.maxRooms);
  return {
    members,
    userProfile,
    rooms: active.map(({ r }) => ({
      id: r.id,
      title: r.title,
      latestSummary: r.latestSummary ? clip(r.latestSummary, 400) : undefined,
      recent: messages
        .filter((m) => m.roomId === r.id && m.kind === 'chat')
        .slice(-opts.recentPerRoom)
        .map((m) => `${authorName(m.authorId, members)}：${clip(m.text, 160)}`),
    })),
    updatedAt: now.toISOString(),
  };
}

const WEEK = ['日', '月', '火', '水', '木', '金', '土'];

/** 日本時間の「11月7日(土)」 */
export function jstDateLabel(d: Date): string {
  const j = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return `${j.getUTCMonth() + 1}月${j.getUTCDate()}日(${WEEK[j.getUTCDay()]})`;
}

/** 朝会の議題（AIたちへの最初の投げかけ） */
export function buildMorningTopic(state: SyncState, now: Date): string {
  const lines = [`（進行役より）おはようございます。${jstDateLabel(now)}の朝会です。`];
  if (state.rooms.length === 0) {
    lines.push('この1週間、会議室での動きはありませんでした。');
  } else {
    lines.push('最近の会議室の様子です。');
    for (const r of state.rooms) {
      lines.push(`■ ${r.title}`);
      if (r.latestSummary) lines.push(`要約：${r.latestSummary}`);
      for (const s of r.recent) lines.push(`・${s}`);
    }
  }
  lines.push(
    '',
    '一人ずつ、①気になっている進み具合や引っかかり ②今日ユーザーにおすすめしたい一歩、を自分の担当の視点で話してください。',
    'ユーザーは今この場にいません。後で読むので、呼びかける形で書いてください。',
  );
  // 「@名前」があると司会が指名と受け取り、その人しか話さなくなるので外す
  return lines.join('\n').replace(/[@＠]/g, '');
}

export type MorningDeps = {
  provider: ChatProvider;
  now?: () => Date;
  newId?: () => string;
  /** サーバー側の月の上限（円）。超えたら朝会を開かない */
  budgetJpy: number;
  usdJpy?: number;
};

/**
 * 朝会を1回開く。全員が1回ずつ話し、最後にまとめ役が要約する。
 * pastMessages はサーバーに残っている過去の朝会（料金計算に使う）
 */
export async function runMorningMeeting(state: SyncState, pastMessages: Message[], deps: MorningDeps): Promise<Message[]> {
  const now = deps.now ?? (() => new Date());
  const newId = deps.newId ?? (() => `m-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`);
  const at = now();
  const members = state.members.length ? state.members : [];
  const room: Room = {
    id: MORNING_ROOM_ID,
    title: MORNING_ROOM_TITLE,
    memberIds: members.map((m) => m.id),
    createdAt: at.toISOString(),
    depth: 'quick',
  };
  const settings: Settings = {
    providerMode: 'openrouter',
    monthlyBudgetJpy: deps.budgetJpy,
    usdJpy: deps.usdJpy ?? 150,
    maxRounds: 1,
    historyLimit: 20,
    warnRatio: 0.8,
    userProfile: state.userProfile,
    morningUrl: '',
  };
  const topic = buildMorningTopic(state, at);
  const opening: Message = {
    id: newId(),
    roomId: room.id,
    authorId: 'system',
    text: `☀️ ${jstDateLabel(at)}の朝会`,
    createdAt: at.toISOString(),
    kind: 'notice',
  };
  // AIには議題の全文を渡す（画面には短い見出しだけ出す）
  const promptTopic: Message = { ...opening, id: newId(), authorId: 'user', text: topic, kind: 'chat' };
  const out: Message[] = [opening];
  const deps2 = { provider: deps.provider, members, settings, now, newId };
  const month = pastMessages.filter((m) => m.createdAt.startsWith(monthKey(at.toISOString())));
  for await (const m of runConversation(room, topic, [promptTopic], month, deps2)) out.push(m);
  if (out.some((m) => m.kind === 'chat')) {
    try {
      out.push(await summarize(room, [promptTopic, ...out], deps2));
    } catch (e) {
      out.push({ ...opening, id: newId(), text: `要約に失敗しました: ${(e as Error).message}`, createdAt: now().toISOString() });
    }
  }
  return out;
}
