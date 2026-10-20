import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(new URL("../../../modera/modera-app/package.json", import.meta.url));
const { buildSync } = require("esbuild");
const compiled = buildSync({ entryPoints: [resolve("src/data/store.ts")], bundle: true, platform: "node", format: "esm", write: false });
const { BrowserStore } = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString("base64")}`);

test("history retains valid site icons and reads legacy records without icons", async () => {
  const storagePath = await mkdtemp(join(tmpdir(), "browser-favicon-"));
  try {
    await writeFile(join(storagePath, "history.json"), JSON.stringify([{ id: "legacy", url: "https://old.example/", title: "Old", visitedAt: 1 }]));
    const store = new BrowserStore({ storagePath });
    assert.equal((await store.history())[0].favicon, undefined);
    await store.recordVisit("https://example.com/", "Example", "https://example.com/icon.png");
    await store.recordVisit("https://example.com/", "Updated");
    assert.equal((await store.history())[0].favicon, "https://example.com/icon.png");
    await store.recordVisit("https://invalid.example/", "Invalid", "file:///private/icon.png");
    assert.equal((await store.history())[0].favicon, undefined);
  } finally {
    await rm(storagePath, { recursive: true, force: true });
  }
});
