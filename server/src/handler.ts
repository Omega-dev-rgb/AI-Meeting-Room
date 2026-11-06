import { createOpenRouterProvider } from '../../src/core/providers';
import { runMorningMeeting, type SyncState } from '../../src/core/morning';
import type { ChatProvider, Message } from '../../src/core/types';

/** Cloudflare KV のうち使う部分だけ（テストで差し替えられるように） */
export type KVLike = {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
};

export type Env = {
  MEETING: KVLike;
  OPENROUTER_API_KEY: string;
  MEETING_TOKEN: string;
  /** サーバー側の月の上限（円）。未設定なら300円 */
  BUDGET_JPY?: string;
};

const KEEP_MESSAGES = 300;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } });

/** 合言葉の確認（長さが違っても時間差が出にくい比べ方） */
export function tokenMatches(given: string, expected: string): boolean {
  if (!expected) return false;
  let diff = given.length ^ expected.length;
  for (let i = 0; i < Math.max(given.length, expected.length); i++) {
    diff |= (given.charCodeAt(i) || 0) ^ (expected.charCodeAt(i) || 0);
  }
  return diff === 0;
}

async function readMessages(env: Env): Promise<Message[]> {
  const raw = await env.MEETING.get('messages');
  return raw ? (JSON.parse(raw) as Message[]) : [];
}

/** 朝会を開いて保存する。毎朝の自動実行と「今すぐ朝会」の両方から呼ぶ */
export async function runAndStore(env: Env, provider?: ChatProvider, now = () => new Date()): Promise<Message[]> {
  const raw = await env.MEETING.get('state');
  if (!raw) return [];
  const state = JSON.parse(raw) as SyncState;
  const past = await readMessages(env);
  const created = await runMorningMeeting(state, past, {
    provider: provider ?? createOpenRouterProvider(env.OPENROUTER_API_KEY),
    budgetJpy: Number(env.BUDGET_JPY) || 300,
    now,
  });
  await env.MEETING.put('messages', JSON.stringify([...past, ...created].slice(-KEEP_MESSAGES)));
  return created;
}

/** アプリからの通信の受け口 */
export async function handle(req: Request, env: Env, provider?: ChatProvider): Promise<Response> {
  const url = new URL(req.url);
  if (url.pathname === '/health') return json({ ok: true });
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!tokenMatches(token, env.MEETING_TOKEN)) return json({ error: '合言葉が違います' }, 401);

  if (req.method === 'PUT' && url.pathname === '/state') {
    const body = (await req.json()) as SyncState;
    if (!Array.isArray(body?.members) || !Array.isArray(body?.rooms)) return json({ error: '形式が違います' }, 400);
    await env.MEETING.put('state', JSON.stringify(body));
    return json({ ok: true });
  }
  if (req.method === 'GET' && url.pathname === '/messages') {
    const since = url.searchParams.get('since') ?? '';
    const all = await readMessages(env);
    return json({ messages: all.filter((m) => m.createdAt > since) });
  }
  if (req.method === 'POST' && url.pathname === '/run') {
    const created = await runAndStore(env, provider);
    if (created.length === 0) return json({ error: 'まだアプリから材料が届いていません' }, 409);
    return json({ messages: created });
  }
  return json({ error: 'not found' }, 404);
}
