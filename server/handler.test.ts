import { describe, expect, it } from 'vitest';
import { DEFAULT_MEMBERS } from '../src/core/defaultMembers';
import { buildMorningTopic, buildSyncState, jstDateLabel, MORNING_ROOM_ID } from '../src/core/morning';
import { createMockProvider } from '../src/core/providers';
import type { Message, Room } from '../src/core/types';
import { handle, tokenMatches, type Env } from './src/handler';

function memoryKV() {
  const m = new Map<string, string>();
  return { get: async (k: string) => m.get(k) ?? null, put: async (k: string, v: string) => void m.set(k, v), m };
}
const env = (): Env & { MEETING: ReturnType<typeof memoryKV> } => ({ MEETING: memoryKV(), OPENROUTER_API_KEY: 'x', MEETING_TOKEN: 'secret-123' });
const req = (method: string, path: string, body?: unknown, token = 'secret-123') =>
  new Request(`https://example.com${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });

const now = new Date('2026-11-06T22:00:00Z'); // 日本時間 11/7(土) 7:00
const rooms: Room[] = [
  { id: 'lobby', title: '雑談ルーム', memberIds: ['claude'], createdAt: '', latestSummary: '■ 今の論点\n- 朝会' },
  { id: 'old', title: '昔の部屋', memberIds: ['claude'], createdAt: '' },
  { id: MORNING_ROOM_ID, title: '朝会', memberIds: ['claude'], createdAt: '' },
];
const msgs: Message[] = [
  { id: '1', roomId: 'lobby', authorId: 'user', kind: 'chat', text: '@クロ 朝会どう？', createdAt: '2026-11-06T10:00:00Z' },
  { id: '2', roomId: 'old', authorId: 'user', kind: 'chat', text: '古い話', createdAt: '2026-10-01T10:00:00Z' },
  { id: '3', roomId: MORNING_ROOM_ID, authorId: 'claude', kind: 'chat', text: '前の朝会', createdAt: '2026-11-06T09:00:00Z' },
];

describe('朝会の材料と議題', () => {
  it('最近動いた会議室だけを送り、朝会ルーム自体は含めない', () => {
    const s = buildSyncState(DEFAULT_MEMBERS, rooms, msgs, '育休中', now);
    expect(s.rooms.map((r) => r.id)).toEqual(['lobby']);
    expect(s.rooms[0].recent).toEqual(['あなた：@クロ 朝会どう？']);
    expect(s.userProfile).toBe('育休中');
  });
  it('議題に日付と会議室の様子が入り、@は外す（指名扱いにしない）', () => {
    const topic = buildMorningTopic(buildSyncState(DEFAULT_MEMBERS, rooms, msgs, '', now), now);
    expect(jstDateLabel(now)).toBe('11月7日(土)');
    expect(topic).toContain('11月7日(土)の朝会');
    expect(topic).toContain('■ 雑談ルーム');
    expect(topic).not.toMatch(/[@＠]/);
  });
});

describe('朝会サーバー', () => {
  it('合言葉が違うと断る（/health は誰でも見られる）', async () => {
    const e = env();
    expect((await handle(req('GET', '/messages', undefined, 'wrong'), e)).status).toBe(401);
    expect((await handle(req('GET', '/health', undefined, ''), e)).status).toBe(200);
    expect(tokenMatches('a', '')).toBe(false);
  });
  it('材料が届く前の「今すぐ朝会」は 409', async () => {
    expect((await handle(req('POST', '/run'), env())).status).toBe(409);
  });
  it('材料を受け取り、朝会を開き、since 以降の発言を返す', async () => {
    const e = env();
    const state = buildSyncState(DEFAULT_MEMBERS, rooms, msgs, '育休中', now);
    expect((await handle(req('PUT', '/state', state), e)).status).toBe(200);
    const run = await handle(req('POST', '/run'), e, createMockProvider(0));
    const created = ((await run.json()) as { messages: Message[] }).messages;
    // お知らせ1 + 4人 + 要約1
    expect(created.map((m) => m.kind)).toEqual(['notice', 'chat', 'chat', 'chat', 'chat', 'summary']);
    expect(created.every((m) => m.roomId === MORNING_ROOM_ID)).toBe(true);
    const got = await handle(req('GET', '/messages?since=2000-01-01T00:00:00Z'), e);
    expect(((await got.json()) as { messages: Message[] }).messages).toHaveLength(6);
    const none = await handle(req('GET', `/messages?since=${encodeURIComponent('2999-01-01T00:00:00Z')}`), e);
    expect(((await none.json()) as { messages: Message[] }).messages).toHaveLength(0);
  });
});

describe('アプリ側の朝会の取り込み', () => {
  it('重複を除き、朝会ルームを作り、要約を引き継ぐ', async () => {
    const { mergeMorning } = await import('../src/core/morningClient');
    const incoming: Message[] = [
      { id: 'a', roomId: MORNING_ROOM_ID, authorId: 'claude', kind: 'chat', text: 'おはよう', createdAt: '2026-11-06T22:00:01Z' },
      { id: 'b', roomId: MORNING_ROOM_ID, authorId: 'chatgpt', kind: 'summary', text: '■ 次の一手', createdAt: '2026-11-06T22:00:02Z' },
    ];
    const base: Room[] = [{ id: 'lobby', title: '雑談', memberIds: [], createdAt: '' }];
    const r1 = mergeMorning(base, [], incoming, DEFAULT_MEMBERS, 'now');
    expect(r1.rooms[0]).toMatchObject({ id: MORNING_ROOM_ID, latestSummary: '■ 次の一手' });
    expect(r1.messages).toHaveLength(2);
    expect(r1.latest).toBe('2026-11-06T22:00:02Z');
    const r2 = mergeMorning(r1.rooms, r1.messages, incoming, DEFAULT_MEMBERS, 'now');
    expect(r2.messages).toHaveLength(2);
    expect(r2.rooms).toHaveLength(2);
  });
  it('サーバーのエラー文をそのまま伝える', async () => {
    const { createMorningClient } = await import('../src/core/morningClient');
    const c = createMorningClient('https://x.workers.dev/', 't', async () => ({ ok: false, status: 401, json: async () => ({ error: '合言葉が違います' }) }));
    await expect(c.runNow()).rejects.toThrow('合言葉が違います');
  });
});
