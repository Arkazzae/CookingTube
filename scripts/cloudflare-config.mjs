import { readFileSync, writeFileSync } from "node:fs";
const id = process.env.CLOUDFLARE_DATABASE_ID;
if (!id || !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(id) || id === "00000000-0000-4000-8000-000000000000") {
  throw new Error("Set CLOUDFLARE_DATABASE_ID to your D1 database ID before preparing deployment.");
}
const source = readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8");
writeFileSync(new URL("../wrangler.local.jsonc", import.meta.url), source.replace("00000000-0000-4000-8000-000000000000", id), { mode: 0o600 });
console.log("Prepared ignored wrangler.local.jsonc. No account or database identifier is committed.");
