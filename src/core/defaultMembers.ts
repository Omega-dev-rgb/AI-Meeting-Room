import type { Member } from './types';

/**
 * 仮置きのキャラ設定（2026-11-05 Emmett案）。アプリの「メンバー」画面から自由に変更できる。
 * モデルIDは OpenRouter の表記。提供状況や料金は変わるので、使う前に openrouter.ai/models で確認する。
 */
export const DEFAULT_MEMBERS: Member[] = [
  {
    id: 'chatgpt',
    name: 'ジーピー',
    vendor: 'chatgpt',
    persona: 'みんなに寄り添う、包容力のあるお姉さん的存在。相手の気持ちを受け止めてから話す。',
    role: 'まとめ役 兼 意見役。自分の意見や体験談も普通に話す。議論が散らかったときだけ論点を整理し、次に何を決めるかを示す。',
    model: 'openai/gpt-5-mini',
    memory: '',
  },
  {
    id: 'claude',
    name: 'クロ',
    vendor: 'claude',
    persona: '優しくて慎重。細かいところによく気付き、見落としやリスクをそっと指摘する。',
    role: 'チェック役。抜け漏れ・リスク・前提の確認を担当する。',
    model: 'anthropic/claude-haiku-4.5',
    memory: '',
  },
  {
    id: 'gemini',
    name: 'ジェミ',
    vendor: 'gemini',
    persona: 'よくはしゃぐ楽しいムードメーカー。アイデアを絶対に否定せず、まず乗っかる。',
    role: 'アイデア役。発想を広げ、面白い案を出す。',
    model: 'google/gemini-2.5-flash',
    memory: '',
  },
  {
    id: 'grok',
    name: 'グロック',
    vendor: 'grok',
    persona: '正直で少し皮肉が効いている。答えを濁さず、言いにくいこともはっきり言う。',
    role: '本音役。甘い見通しや矛盾にツッコミを入れる。',
    model: 'x-ai/grok-4.3',
    memory: '',
  },
];

export const VENDOR_LABEL: Record<Member['vendor'], string> = {
  chatgpt: 'ChatGPT',
  claude: 'Claude',
  gemini: 'Gemini',
  grok: 'Grok',
};

/**
 * モデルの候補（OpenRouter表記）。普段用は安く速い、本気用は賢いが高い。
 * 提供状況・料金は変わるので、本番接続時に openrouter.ai/models で確認して更新する。
 */
export const MODEL_PRESETS: Record<Member['vendor'], { casual: string; serious: string }> = {
  chatgpt: { casual: 'openai/gpt-5-mini', serious: 'openai/gpt-5' },
  claude: { casual: 'anthropic/claude-haiku-4.5', serious: 'anthropic/claude-sonnet-4.5' },
  gemini: { casual: 'google/gemini-2.5-flash', serious: 'google/gemini-2.5-pro' },
  // grok-4-fast / grok-4 は提供終了（2026-11 に 404）。xAI 推奨の 4.3 に統一
  grok: { casual: 'x-ai/grok-4.3', serious: 'x-ai/grok-4.3' },
};

export type PresetKind = 'casual' | 'serious' | 'custom';

export function presetOf(member: Member): PresetKind {
  const p = MODEL_PRESETS[member.vendor];
  if (member.model === p.casual) return 'casual';
  if (member.model === p.serious) return 'serious';
  return 'custom';
}

/** 提供終了したモデル → 代わりのモデル。保存済みのメンバー設定を読み込むときに置き換える */
export const RETIRED_MODELS: Record<string, string> = {
  'x-ai/grok-4-fast': 'x-ai/grok-4.3',
  'x-ai/grok-4': 'x-ai/grok-4.3',
};

/** 以前の初期設定のままの役割文 → 新しい役割文（オーナーが書き換えたものは触らない） */
const OLD_DEFAULT_ROLES: Record<string, string> = {
  'まとめ役。議論が散らかったら論点を整理し、次に何を決めるかを示す。': DEFAULT_MEMBERS[0].role,
};

/** 保存済みのメンバーを今の版に合わせる（モデルの置き換え・初期の役割文の更新） */
export function migrateMembers(members: Member[]): Member[] {
  return members.map((m) => ({
    ...m,
    model: RETIRED_MODELS[m.model] ?? m.model,
    role: OLD_DEFAULT_ROLES[m.role] ?? m.role,
  }));
}
