import type { ChatProvider, CompletionRequest, CompletionResult } from './types';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

/** トークン数のざっくり推定（日本語は1文字≒1トークン強）。料金が返らないときの保険 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length * 1.1);
}

/** 料金が返らなかったときの推定単価（米ドル / 100万トークン）。軽量モデル想定で高めに見積もる */
const FALLBACK_PRICE = { input: 1, output: 5 };

export function estimateCostUsd(inputTokens: number, outputTokens: number): number {
  return (inputTokens * FALLBACK_PRICE.input + outputTokens * FALLBACK_PRICE.output) / 1_000_000;
}

type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body: string; signal?: AbortSignal }) => Promise<{
  ok: boolean;
  status: number;
  json(): Promise<any>;
  text(): Promise<string>;
}>;

/** OpenRouter: 1つのAPIキーで Claude / ChatGPT / Gemini / Grok を呼べる中継サービス */
export function createOpenRouterProvider(apiKey: string, fetchImpl: FetchLike = fetch as unknown as FetchLike): ChatProvider {
  return {
    async complete(req: CompletionRequest, signal?: AbortSignal): Promise<CompletionResult> {
      if (!apiKey) throw new Error('APIキーが未設定です（設定画面で登録してください）');
      const res = await fetchImpl(OPENROUTER_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'X-Title': 'AI Meeting Room',
        },
        body: JSON.stringify({
          model: req.model,
          messages: req.messages,
          max_tokens: req.maxTokens,
          usage: { include: true },
        }),
        signal,
      });
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status} ${body.slice(0, 200)}`);
      }
      const data = await res.json();
      const text: string = data?.choices?.[0]?.message?.content ?? '';
      const inputTokens: number =
        data?.usage?.prompt_tokens ?? estimateTokens(req.messages.map((m) => m.content).join(''));
      const outputTokens: number = data?.usage?.completion_tokens ?? estimateTokens(text);
      const cost = typeof data?.usage?.cost === 'number' ? data.usage.cost : estimateCostUsd(inputTokens, outputTokens);
      return { text, usage: { inputTokens, outputTokens, costUsd: cost } };
    },
  };
}

const MOCK_LINES: Record<string, string[]> = {
  chatgpt: [
    'みんなの意見、いい感じに出てきたね。いったん論点を整理すると「何を先に作るか」が鍵かな。',
    'なるほど、その気持ちわかるよ。じゃあ次は優先順位を一緒に決めようか。',
  ],
  claude: [
    '一点だけ気になったのですが、その前提は確認済みでしょうか。小さく試してからでも遅くないと思います。',
    '良い案だと思います。念のため、費用と時間の見積もりも添えておくと安心ですね。',
  ],
  gemini: [
    'それめっちゃ面白い！ついでにキャラごとにスタンプ作っちゃうのはどう！？',
    'わかる〜！その案に乗っかって、毎朝の朝会もやっちゃおうよ！',
  ],
  grok: [
    '正直に言うと、その計画はちょっと楽観的すぎ。締め切りを先に決めないと永遠に終わらないよ。',
    'はいはい盛り上がってるところ悪いけど、それ本当に毎日使う？',
  ],
};

/**
 * モック: APIキーなし・無料で画面の動きを確かめるための偽AI。
 * どのメンバーとして呼ばれたかは system プロンプト中の「中身は◯◯」から判定する。
 */
export function createMockProvider(delayMs = 400): ChatProvider {
  let n = 0;
  return {
    async complete(req: CompletionRequest, signal?: AbortSignal): Promise<CompletionResult> {
      await new Promise<void>((resolve, reject) => {
        const t = setTimeout(resolve, delayMs);
        signal?.addEventListener('abort', () => {
          clearTimeout(t);
          reject(new Error('aborted'));
        });
      });
      const sys = req.messages[0]?.content ?? '';
      let text: string;
      if (sys.includes('書記')) {
        text = '■ 今の論点\n- 何から作るか\n■ 決まったこと\n- なし（モックの要約です）\n■ 次の一手\n- 設定画面でAPIキーを登録して本物のAIで試す';
      } else {
        const vendor = (['chatgpt', 'claude', 'gemini', 'grok'] as const).find((v) =>
          sys.includes(`中身は${{ chatgpt: 'ChatGPT', claude: 'Claude', gemini: 'Gemini', grok: 'Grok' }[v]}`),
        );
        const lines = MOCK_LINES[vendor ?? 'chatgpt'];
        text = lines[n++ % lines.length] + '（モック）';
      }
      return { text, usage: { inputTokens: 0, outputTokens: 0, costUsd: 0 } };
    },
  };
}
