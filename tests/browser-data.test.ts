import { afterEach, expect, it, vi } from "vitest";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { createCipheriv, randomBytes } from "node:crypto";
import { decryptValue } from "../src/data/decrypt";
import {
  BrowserDataActions,
  parsePasswordCsv,
} from "../src/data/actions";
import type { PluginContext } from "@modera/contracts";
const roots: string[] = [];
it("decrypts supported Chromium ciphertext and reports App-Bound records", async () => {
  const key = randomBytes(32),
    iv = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([
    Buffer.from("v10"),
    iv,
    cipher.update("fixture-password"),
    cipher.final(),
    cipher.getAuthTag(),
  ]);
  expect((await decryptValue(encrypted, key)).toString()).toBe(
    "fixture-password",
  );
  await expect(decryptValue(Buffer.from("v20-protected"), key)).rejects.toThrow(
    "APP_BOUND_ENCRYPTION",
  );
});
afterEach(async () => {
  vi.unstubAllEnvs();
  for (const root of roots.splice(0))
    await rm(root, {
      recursive: true,
      force: true,
      maxRetries: 5,
      retryDelay: 100,
    });
});
it("parses exported passwords including quoted delimiters and multiline values", () => {
  expect(
    parsePasswordCsv(
      'name,url,username,password\nsite,https://example.com,"a,b","line1\nline2"',
    ),
  ).toEqual([
    {
      origin: "https://example.com",
      username: "a,b",
      password: "line1\nline2",
    },
  ]);
  expect(() => parsePasswordCsv("name,password\na,b")).toThrow("columns");
});
it.runIf(process.platform === "win32")(
  "scans fixture profiles, imports and deduplicates bookmarks, and keeps password plaintext out of summaries and files",
  async () => {
    const root = await mkdtemp(join(tmpdir(), "df-import-"));
    roots.push(root);
    vi.stubEnv("LOCALAPPDATA", root);
    const profile = join(root, "Google/Chrome/User Data/Default");
    await mkdir(join(profile, "Network"), { recursive: true });
    for (const [file, sql] of [
      [
        "Login Data",
        "CREATE TABLE logins (origin_url TEXT, username_value TEXT, password_value BLOB)",
      ],
      ["Network/Cookies", "CREATE TABLE cookies (name TEXT)"],
    ]) {
      const db = new DatabaseSync(join(profile, file!));
      db.exec(sql!);
      db.close();
    }
    await writeFile(
      join(profile, "Bookmarks"),
      JSON.stringify({
        roots: {
          bookmark_bar: {
            children: [
              { type: "url", url: "https://example.com", name: "Example" },
              { type: "url", url: "javascript:alert(1)", name: "Unsafe" },
            ],
          },
        },
      }),
    );
    const storage = join(root, "store");
    await mkdir(storage);
    const host: PluginContext = {
      pluginId: "test",
      storagePath: storage,
      signal: new AbortController().signal,
      grantedPermissions: new Set(),
      localData: {
        protect: async (text) => Buffer.from(text).toString("base64"),
        unprotect: async (text) => Buffer.from(text, "base64").toString(),
        cookies: async () => [],
        setCookie: async () => {},
      },
    };
    const service = new BrowserDataActions(host);
    const sources = (await service.act({ id: "scanBrowsers" })) as {
      id: string;
      bookmarks: number;
    }[];
    expect(sources[0]?.bookmarks).toBe(1);
    for (let i = 0; i < 2; i++)
      await service.act({
        id: "importSelected",
        value: JSON.stringify({ source: sources[0]!.id, bookmarks: true }),
      });
    const csv = join(root, "passwords.csv");
    await writeFile(
      csv,
      "url,username,password\nhttps://example.com/login,test,sensitive-fixture",
    );
    await service.act({
      id: "importPasswordCsv",
      value: JSON.stringify({ path: csv }),
    });
    const summary = (await service.act({ id: "dataSummary" })) as {
      passwords: { id: string }[];
      bookmarkCount: number;
    };
    expect(summary.bookmarkCount).toBe(1);
    expect(JSON.stringify(summary)).not.toContain("sensitive-fixture");
    expect(
      await readFile(join(storage, "passwords.enc"), "utf8"),
    ).not.toContain("sensitive-fixture");
    expect(
      await service.act({
        id: "revealPassword",
        value: JSON.stringify({ id: summary.passwords[0]!.id }),
      }),
    ).toBe("sensitive-fixture");
  },
);

it("reads Chromium microsecond timestamps without overflowing SQLite numbers", async () => {
  const { DatabaseSync } = await import("node:sqlite");
  const { rows } =
    await import("../src/data/profiles");
  const root = await mkdtemp(join(tmpdir(), "df-timestamp-"));
  roots.push(root);
  const path = join(root, "Cookies");
  const db = new DatabaseSync(path);
  db.exec(
    "CREATE TABLE cookies(expires_utc INTEGER, is_secure INTEGER); INSERT INTO cookies VALUES(13411625986029338, 0)",
  );
  db.close();
  const result = await rows(path, "SELECT * FROM cookies");
  expect(result[0]).toEqual({ expires_utc: "13411625986029338", is_secure: 0 });
});
