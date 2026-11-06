import { handle, runAndStore, type Env } from './handler';

/** Cloudflare Workers の入口。fetch＝アプリからの通信、scheduled＝毎朝の自動実行 */
export default {
  fetch(req: Request, env: Env): Promise<Response> {
    return handle(req, env);
  },
  async scheduled(_event: unknown, env: Env, ctx: { waitUntil(p: Promise<unknown>): void }): Promise<void> {
    ctx.waitUntil(runAndStore(env));
  },
};
