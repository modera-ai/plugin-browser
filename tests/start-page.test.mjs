import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const require = createRequire(new URL("../../../modera/modera-app/package.json", import.meta.url));
const { buildSync } = require("esbuild");
const compiled = buildSync({ entryPoints: [resolve("src/start-page.ts")], bundle: true, platform: "node", format: "esm", write: false });
const { startPageUrl } = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString("base64")}`);

test("configured start pages accept hostnames and preserve explicit web addresses", () => {
  assert.equal(startPageUrl("baidu.com"), "https://baidu.com/");
  assert.equal(startPageUrl(" example.com/path?q=1 "), "https://example.com/path?q=1");
  assert.equal(startPageUrl("localhost:3000"), "http://localhost:3000/");
  assert.equal(startPageUrl("127.0.0.1:8080"), "http://127.0.0.1:8080/");
  assert.equal(startPageUrl("[::1]:3000"), "http://[::1]:3000/");
  assert.equal(startPageUrl("http://example.com/"), "http://example.com/");
});

test("invalid optional preferences leave the panel blank without throwing", () => {
  for (const value of ["", "  ", undefined, {}, "not a URL", "https://", "javascript:alert(1)", "file:///private", "https://user:pass@example.com/"]) {
    assert.equal(startPageUrl(value), "", String(value));
  }
});
