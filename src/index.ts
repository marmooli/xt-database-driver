import { handleRequest } from "./http";
import { runScheduledUidSync } from "./scheduled";

export default {
  fetch(request: Request, env: Env): Promise<Response> {
    return handleRequest(request, env);
  },

  scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext): void {
    ctx.waitUntil(runScheduledUidSync(env));
  }
};
