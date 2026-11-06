import { describe, expect, it } from 'vitest';
import { budgetStatus, formatJpy, spentJpy } from './budget';
import { DEFAULT_MEMBERS } from './defaultMembers';
import { parseMentions } from './mentions';
import { planTurns, runConversation, summarize } from './orchestrator';
import { buildPrompt } from './prompt';
import { createMockProvider, createOpenRouterProvider } from './providers';
import { DEFAULT_SETTINGS, type ChatProvider, type Message, type Room } from './types';

const room: Room = {
  id: 'r1',
  title: 'テスト会議',
  memberIds: DEFAULT_MEMBERS.map((m) => m.id),
  createdAt: '2026-11-05T00:00:00.000Z',
};
const msg = (p: Partial<Message>): Message => ({
  id: Math.random().toString(),
  roomId: 'r1',
  authorId: 'user',
  text: '',
  createdAt: '2026-11-05T00:00:00.000Z',
  kind: 'chat',
  ...p,
});
let ids = 0;
const deps = (provider: ChatProvider, settings = DEFAULT_SETTINGS) => ({
  provider,
  members: DEFAULT_MEMBERS,
  settings,
  now: () => new Date('2026-11-05T10:00:00.000Z'),
  newId: () => `id${ids++}`,
});

describe('parseMentions', () => {
  it('名前・ベンダー名・全角＠で指名でき、出現順に返す', () => {
    expect(parseMentions('@Grok と ＠クロ はどう思う？', DEFAULT_MEMBERS)).toEqual(['grok', 'claude']);
    expect(parseMentions('@gemini', DEFAULT_MEMBERS)).toEqual(['gemini']);
    expect(parseMentions('みんなどう？', DEFAULT_MEMBERS)).toEqual([]);
  });
});

describe('planTurns', () => {
  it('指名がなければ全員×周回数', () => {
    expect(planTurns(room, DEFAULT_MEMBERS, 'やあ', 2)).toEqual([
      'chatgpt', 'claude', 'gemini', 'grok', 'chatgpt', 'claude', 'gemini', 'grok',
    ]);
  });
  it('指名があれば指名された人だけ', () => {
    expect(planTurns(room, DEFAULT_MEMBERS, '@ジェミ どう？', 2)).toEqual(['gemini']);
  });
  it('会議室にいないメンバーは指名しても話さない', () => {
    const small = { ...room, memberIds: ['claude'] };
    expect(planTurns(small, DEFAULT_MEMBERS, '@Grok', 1)).toEqual(['claude']);
  });
});

describe('buildPrompt', () => {
  it('自分の発言は assistant、他人は名前付きで user にまとめ、最後は user で終わる', () => {
    const claude = DEFAULT_MEMBERS[1];
    const history = [
      msg({ authorId: 'user', text: 'こんにちは' }),
      msg({ authorId: 'chatgpt', text: 'やあ' }),
      msg({ authorId: 'claude', text: 'どうも' }),
    ];
    const turns = buildPrompt(claude, DEFAULT_MEMBERS, room, history, DEFAULT_SETTINGS);
    expect(turns[0].role).toBe('system');
    expect(turns[0].content).toContain('クロ');
    expect(turns[0].content).toContain('ジーピー');
    expect(turns[1]).toEqual({ role: 'user', content: '【あなた】こんにちは\n【ジーピー】やあ' });
    expect(turns[2]).toEqual({ role: 'assistant', content: 'どうも' });
    expect(turns.at(-1)?.role).toBe('user');
  });
  it('historyLimit を超えた古い発言は渡さない', () => {
    const history = Array.from({ length: 50 }, (_, i) => msg({ text: `m${i}` }));
    const turns = buildPrompt(DEFAULT_MEMBERS[0], DEFAULT_MEMBERS, room, history, { ...DEFAULT_SETTINGS, historyLimit: 5 });
    expect(turns[1].content).not.toContain('m44');
    expect(turns[1].content).toContain('m45');
  });
});

describe('budget', () => {
  it('当月分だけ集計し、8割で警告・10割で停止', () => {
    const ms = [
      msg({ usage: { inputTokens: 0, outputTokens: 0, costUsd: 20 }, createdAt: '2026-11-01T00:00:00Z' }),
      msg({ usage: { inputTokens: 0, outputTokens: 0, costUsd: 99 }, createdAt: '2026-10-31T00:00:00Z' }),
    ];
    const spent = spentJpy(ms, '2026-11', 150);
    expect(spent).toBe(3000);
    expect(budgetStatus(spent, DEFAULT_SETTINGS)).toBe('ok');
    expect(budgetStatus(4000, DEFAULT_SETTINGS)).toBe('warn');
    expect(budgetStatus(5000, DEFAULT_SETTINGS)).toBe('stop');
    expect(formatJpy(0.5)).toBe('0.50円');
    expect(formatJpy(1234.4)).toBe('1,234円');
  });
});

describe('runConversation', () => {
  it('モックで全員が順に発言する', async () => {
    const out: Message[] = [];
    const settings = { ...DEFAULT_SETTINGS, maxRounds: 1 };
    for await (const m of runConversation(room, 'テーマです', [msg({ text: 'テーマです' })], [], deps(createMockProvider(0), settings))) out.push(m);
    expect(out.map((m) => m.authorId)).toEqual(['chatgpt', 'claude', 'gemini', 'grok']);
    expect(out[3].text).toContain('（モック）');
  });

  it('モックは2周しても同じ人が同じ文を繰り返さない', async () => {
    const out: Message[] = [];
    for await (const m of runConversation(room, 'テーマ', [msg({ text: 'テーマ' })], [], deps(createMockProvider(0)))) out.push(m);
    expect(out).toHaveLength(8);
    for (let i = 0; i < 4; i++) expect(out[i].text).not.toBe(out[i + 4].text);
  });

  it('予算超過なら発言せず停止の通知を出す', async () => {
    const spentMsg = msg({ usage: { inputTokens: 0, outputTokens: 0, costUsd: 100 }, createdAt: '2026-11-02T00:00:00Z' });
    const out: Message[] = [];
    for await (const m of runConversation(room, 'やあ', [], [spentMsg], deps(createMockProvider(0)))) out.push(m);
    expect(out).toHaveLength(1);
    expect(out[0].kind).toBe('notice');
  });

  it('途中で予算を超えたらそこで止まる', async () => {
    const pricey: ChatProvider = {
      complete: async () => ({ text: 'x', usage: { inputTokens: 1, outputTokens: 1, costUsd: 20 } }),
    };
    const out: Message[] = [];
    // 1発言3000円 → 2人目で6000円になり、3人目の前に停止
    for await (const m of runConversation(room, 'やあ', [], [], deps(pricey))) out.push(m);
    expect(out.map((m) => m.kind)).toEqual(['chat', 'chat', 'notice']);
  });

  it('1人が失敗しても通知を出して次の人に進む', async () => {
    const flaky: ChatProvider = {
      complete: async (req) => {
        if (req.model.startsWith('anthropic')) throw new Error('boom');
        return { text: 'ok', usage: { inputTokens: 0, outputTokens: 0, costUsd: 0 } };
      },
    };
    const out: Message[] = [];
    for await (const m of runConversation(room, 'やあ', [], [], deps(flaky, { ...DEFAULT_SETTINGS, maxRounds: 1 }))) out.push(m);
    expect(out.map((m) => m.kind)).toEqual(['chat', 'notice', 'chat', 'chat']);
  });
});

describe('summarize', () => {
  it('まとめ役が書記として要約する', async () => {
    const s = await summarize(room, [msg({ text: 'a' })], deps(createMockProvider(0)));
    expect(s.kind).toBe('summary');
    expect(s.authorId).toBe('chatgpt');
    expect(s.text).toContain('■ 次の一手');
  });
});

describe('OpenRouter provider', () => {
  it('リクエストを組み立て、usage.cost を料金として使う', async () => {
    let sent: any;
    const p = createOpenRouterProvider('sk-test', async (url, init) => {
      sent = { url, init };
      return {
        ok: true,
        status: 200,
        json: async () => ({ choices: [{ message: { content: 'hi' } }], usage: { prompt_tokens: 10, completion_tokens: 2, cost: 0.0001 } }),
        text: async () => '',
      };
    });
    const r = await p.complete({ model: 'x/y', messages: [{ role: 'user', content: 'a' }], maxTokens: 50 });
    expect(sent.url).toBe('https://openrouter.ai/api/v1/chat/completions');
    expect(sent.init.headers.Authorization).toBe('Bearer sk-test');
    expect(JSON.parse(sent.init.body).model).toBe('x/y');
    expect(r).toEqual({ text: 'hi', usage: { inputTokens: 10, outputTokens: 2, costUsd: 0.0001 } });
  });
  it('キー未設定・HTTPエラーはわかりやすいエラーにする', async () => {
    await expect(createOpenRouterProvider('').complete({ model: 'a', messages: [], maxTokens: 1 })).rejects.toThrow('APIキー');
    const p = createOpenRouterProvider('k', async () => ({ ok: false, status: 401, json: async () => ({}), text: async () => 'bad key' }));
    await expect(p.complete({ model: 'a', messages: [], maxTokens: 1 })).rejects.toThrow('HTTP 401 bad key');
  });
});

describe('MODEL_PRESETS', () => {
  it('初期メンバーは全員「普段用」で、モデル変更で判定が変わる', async () => {
    const { presetOf, MODEL_PRESETS } = await import('./defaultMembers');
    for (const m of DEFAULT_MEMBERS) expect(presetOf(m)).toBe('casual');
    const c = DEFAULT_MEMBERS[1];
    expect(presetOf({ ...c, model: MODEL_PRESETS.claude.serious })).toBe('serious');
    expect(presetOf({ ...c, model: 'foo/bar' })).toBe('custom');
  });
});

describe('本物のAIでの確認で見つかった不具合（2026-11-06）', () => {
  it('本文が空の返事はエラーにする（要約の吹き出しが空で止まらないように）', async () => {
    const p = createOpenRouterProvider('k', async () => ({
      ok: true,
      status: 200,
      json: async () => ({ choices: [{ message: { content: '' }, finish_reason: 'length' }] }),
      text: async () => '',
    }));
    await expect(p.complete({ model: 'openai/gpt-5-mini', messages: [], maxTokens: 10 })).rejects.toThrow('本文が空');
  });
  it('gpt-5 系だけ考える量を少なめに指定する', async () => {
    const { reasoningOption } = await import('./providers');
    expect(reasoningOption('openai/gpt-5-mini')).toEqual({ reasoning: { effort: 'low', exclude: true } });
    expect(reasoningOption('anthropic/claude-haiku-4.5')).toEqual({});
    expect(reasoningOption('x-ai/grok-4.3')).toEqual({});
  });
  it('提供終了の Grok モデルと古い役割文を読み込み時に置き換える', async () => {
    const { migrateMembers } = await import('./defaultMembers');
    const old = DEFAULT_MEMBERS.map((m) => ({ ...m }));
    old[0].role = 'まとめ役。議論が散らかったら論点を整理し、次に何を決めるかを示す。';
    old[3].model = 'x-ai/grok-4-fast';
    old[1].role = '自分で書いた役割';
    const m = migrateMembers(old);
    expect(m[3].model).toBe('x-ai/grok-4.3');
    expect(m[0].role).toBe(DEFAULT_MEMBERS[0].role);
    expect(m[1].role).toBe('自分で書いた役割');
  });
  it('メンバーにユーザーの状況を自分のことにしないよう伝える', () => {
    const room: Room = { id: 'r', title: 't', memberIds: DEFAULT_MEMBERS.map((m) => m.id), createdAt: '' };
    const sys = buildPrompt(DEFAULT_MEMBERS[2], DEFAULT_MEMBERS, room, [], DEFAULT_SETTINGS)[0].content;
    expect(sys).toContain('自分の経験として語らない');
  });
});

describe('会話の深さ（じっくり／さくっと）', () => {
  const base: Room = { id: 'r', title: 't', memberIds: DEFAULT_MEMBERS.map((m) => m.id), createdAt: '' };
  it('初期値はじっくりで、理由や反対意見を求める', () => {
    const sys = buildPrompt(DEFAULT_MEMBERS[1], DEFAULT_MEMBERS, base, [], DEFAULT_SETTINGS)[0].content;
    expect(sys).toContain('3〜6文');
    expect(sys).toContain('反対意見');
  });
  it('さくっとでは短く返す', () => {
    const sys = buildPrompt(DEFAULT_MEMBERS[1], DEFAULT_MEMBERS, { ...base, depth: 'quick' }, [], DEFAULT_SETTINGS)[0].content;
    expect(sys).toContain('2〜3文');
    expect(sys).not.toContain('反対意見');
  });
});
