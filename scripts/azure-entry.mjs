#!/usr/bin/env node
/** Container entry: apply DB migrations, then start the Nitro server. */
import { existsSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { migrate } from "./migrate.mjs";

const port = String(process.env.PORT || process.env.WEBSITES_PORT || "8080");
process.env.PORT = port;
process.env.NITRO_PORT = port;
process.env.HOST = "0.0.0.0";
process.env.NITRO_HOST = "0.0.0.0";

try {
  await migrate();
} catch (e) {
  console.error("[entry] migration failed — refusing to start:", e?.message || e);
  process.exit(1);
}
const entry = resolve(process.cwd(), ".output/server/index.mjs");
if (!existsSync(entry)) {
  console.error("[entry] .output/server/index.mjs missing — was the image built?");
  process.exit(1);
}
await import(pathToFileURL(entry).href);
