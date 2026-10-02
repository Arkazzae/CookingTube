import { AsyncLocalStorage } from "node:async_hooks";

// Bindings belong to a request, never to a shared mutable global.
const context = new AsyncLocalStorage<Cloudflare.Env>();
export const runWithCloudflare = <T>(env: Cloudflare.Env, run: () => T): T => context.run(env, run);
export const getCloudflare = () => context.getStore();
