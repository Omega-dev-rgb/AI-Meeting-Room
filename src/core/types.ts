/** AIメンバーの提供元。表示色やアイコンの出し分けにも使う */
export type Vendor = 'chatgpt' | 'claude' | 'gemini' | 'grok';

export type Member = {
  id: string;
  name: string;
  vendor: Vendor;
  /** 性格・話し方 */
  persona: string;
  /** 会議室での担当 */
  role: string;
  /** OpenRouter のモデルID（例: anthropic/claude-haiku-4.5） */
  model: string;
  /** 既存チャットの要約や、ユーザーについて覚えておいてほしいこと */
  memory: string;
};

export type Usage = {
  inputTokens: number;
  outputTokens: number;
  /** 米ドル。OpenRouter が返す実額、なければ推定 */
  costUsd: number;
};

export type MessageKind = 'chat' | 'summary' | 'notice';

export type Message = {
  id: string;
  roomId: string;
  /** 'user' | 'system' | Member.id */
  authorId: string;
  text: string;
  createdAt: string;
  kind: MessageKind;
  usage?: Usage;
};

export type Room = {
  id: string;
  title: string;
  memberIds: string[];
  createdAt: string;
  /** 最新の「今どうなってる？」の結果 */
  latestSummary?: string;
};

export type ProviderMode = 'mock' | 'openrouter';

export type Settings = {
  providerMode: ProviderMode;
  monthlyBudgetJpy: number;
  /** 料金表示用の為替レート（円/ドル） */
  usdJpy: number;
  /** 1回の投稿に対して全員が何周話すか */
  maxRounds: number;
  /** AIに渡す直近メッセージ数（多いほど料金が上がる） */
  historyLimit: number;
  /** 予算の何割で警告するか */
  warnRatio: number;
  /** 全員に共有する「わたしについて」メモ */
  userProfile: string;
};

export const DEFAULT_SETTINGS: Settings = {
  providerMode: 'mock',
  monthlyBudgetJpy: 5000,
  usdJpy: 150,
  maxRounds: 2,
  historyLimit: 30,
  warnRatio: 0.8,
  userProfile: '',
};

/** AIに送る1件分のメッセージ（OpenAI互換形式） */
export type ChatTurn = { role: 'system' | 'user' | 'assistant'; content: string };

export type CompletionRequest = {
  model: string;
  messages: ChatTurn[];
  maxTokens: number;
};

export type CompletionResult = { text: string; usage: Usage };

/** AIの呼び出し口。本番は OpenRouter、開発・お試しはモック */
export interface ChatProvider {
  complete(req: CompletionRequest, signal?: AbortSignal): Promise<CompletionResult>;
}
