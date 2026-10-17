import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { createHash } from "node:crypto";
import type { PluginContext } from "@pal/plugin-sdk";
import {
  scanProfiles,
  bookmarkFile,
  rows,
  type ImportSource,
} from "./profiles";
import { BrowserStore } from "./store";
import { profileKey, decryptValue } from "./decrypt";
/** CSV parser accepts quoted commas/newlines and escaped quotes from browser exports. */
export function parsePasswordCsv(text: string) {
  const table: string[][] = [];
  let row: string[] = [],
    cell = "",
    quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else quoted = !quoted;
    } else if (c === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((c === "\n" || c === "\r") && !quoted) {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      if (row.some(Boolean)) table.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (quoted) throw new Error("Invalid CSV quotation");
  row.push(cell);
  if (row.some(Boolean)) table.push(row);
  const header =
    table.shift()?.map((s) =>
      s
        .replace(/^\uFEFF/, "")
        .trim()
        .toLowerCase(),
    ) ?? [];
  const url = header.indexOf("url"),
    user = header.indexOf("username"),
    password = header.indexOf("password");
  if (url < 0 || user < 0 || password < 0)
    throw new Error("CSV requires url, username and password columns");
  return table.map((r) => ({
    origin: r[url] ?? "",
    username: r[user] ?? "",
    password: r[password] ?? "",
  }));
}
export class BrowserDataActions {
  readonly store: BrowserStore;
  private sources = new Map<string, ImportSource>();
  constructor(private host: PluginContext) {
    this.store = new BrowserStore(host);
  }
  async act(action: { id: string; value?: string }, signal = this.host.signal) {
    signal.throwIfAborted();
    const value = action.value ? JSON.parse(action.value) : {};
    if (action.id === "renameFolder") {
      await this.store.renameFolder(String(value.from), String(value.to));
      return { ok: true };
    }
    if (action.id === "removeSelected") {
      if (
        !["bookmarks", "passwords"].includes(value.kind) ||
        !Array.isArray(value.ids) ||
        value.ids.length > 50
      )
        throw new Error("Invalid selection");
      for (const id of value.ids) {
        signal.throwIfAborted();
        await this.store.remove(value.kind, String(id));
      }
      return { ok: true };
    }
    if (action.id === "saveBookmark") {
      await this.store.saveBookmark({
        ...(value.id ? { id: String(value.id) } : {}),
        title: String(value.title || value.url),
        url: String(value.url),
        folder: String(value.folder ?? ""),
      });
      return { ok: true };
    }
    if (action.id === "savePassword") {
      await this.store.addPasswords([
        {
          ...(value.id ? { id: String(value.id) } : {}),
          origin: String(value.origin),
          username: String(value.username),
          password: String(value.password),
        },
      ]);
      return { ok: true };
    }
    if (action.id === "history") {
      return (await this.store.history())
        .filter((x) =>
          (x.title + " " + x.url)
            .toLowerCase()
            .includes(String(value.query ?? "").toLowerCase()),
        )
        .slice(
          Math.max(0, Number(value.page) || 0) * 100,
          Math.max(0, Number(value.page) || 0) * 100 + 100,
        );
    }
    if (action.id === "removeHistory") {
      await this.store.removeHistory(
        value.all === true
          ? null
          : Array.isArray(value.ids)
            ? value.ids.map(String)
            : [],
      );
      return { ok: true };
    }
    if (action.id === "importCookieJson") {
      if (!this.host.localData) throw new Error("Browser storage unavailable");
      if ((await stat(String(value.path))).size > 10000000)
        throw new Error("Import file too large");
      const parsed = JSON.parse(await readFile(String(value.path), "utf8"));
      const list = Array.isArray(parsed) ? parsed : parsed.cookies;
      if (!Array.isArray(list) || list.length > 10000)
        throw new Error("Expected a cookie array");
      let imported = 0,
        skipped = 0;
      for (const c of list) {
        signal.throwIfAborted();
        try {
          const domain = String(c.domain ?? "");
          const url = c.url
            ? String(c.url)
            : `${c.secure ? "https" : "http"}://${domain.replace(/^\./, "")}${c.path || "/"}`;
          const u = new URL(url);
          if (
            !["http:", "https:"].includes(u.protocol) ||
            u.username ||
            u.password ||
            typeof c.name !== "string" ||
            typeof c.value !== "string"
          )
            throw new Error();
          const expiry = Number(c.expirationDate ?? c.expires);
          await this.host.localData.setCookie({
            url,
            name: c.name,
            value: c.value,
            path: String(c.path || "/"),
            ...(domain ? { domain } : {}),
            secure: !!c.secure,
            httpOnly: !!c.httpOnly,
            ...(Number.isFinite(expiry) && expiry > 0
              ? { expirationDate: expiry }
              : {}),
            sameSite: ["strict", "lax", "no_restriction"].includes(c.sameSite)
              ? c.sameSite
              : "unspecified",
          });
          imported++;
        } catch {
          skipped++;
        }
      }
      return { imported, skipped };
    }
    if (action.id === "scanBrowsers") {
      const sources = await scanProfiles();
      this.sources = new Map(sources.map((s) => [s.id, s]));
      return sources.map(({ root, directory, ...source }) => source);
    }
    if (action.id === "dataSummary") {
      const passwords = await this.store.passwords(),
        bookmarks = await this.store.bookmarks();
      const query = String(value.query ?? "").toLowerCase();
      const page = Math.max(0, Number(value.page) || 0);
      return {
        folders: [
          ...new Set(
            bookmarks.flatMap((b) => {
              const parts = (b.folder ?? "").split("/");
              return parts.map((_, i) => parts.slice(0, i + 1).join("/"));
            }),
          ),
        ].sort(),
        passwordCount: passwords.length,
        bookmarkCount: bookmarks.length,
        cookieCount: (await this.host.localData?.cookies())?.length ?? 0,
        passwords: passwords
          .filter((p) =>
            (p.origin + " " + p.username).toLowerCase().includes(query),
          )
          .slice(page * 50, page * 50 + 50)
          .map(({ password, ...p }) => p),
        bookmarks: bookmarks
          .filter(
            (b) =>
              value.folder === undefined ||
              (b.folder ?? "") === value.folder ||
              (value.folder && b.folder?.startsWith(value.folder + "/")),
          )
          .filter((b) =>
            (b.title + " " + b.url + " " + (b.folder ?? ""))
              .toLowerCase()
              .includes(query),
          )
          .slice(page * 50, page * 50 + 50),
      };
    }
    if (action.id === "revealPassword")
      return (
        (await this.store.passwords()).find((p) => p.id === value.id)
          ?.password ?? ""
      );
    if (action.id === "removePassword" || action.id === "removeBookmark") {
      await this.store.remove(
        action.id === "removePassword" ? "passwords" : "bookmarks",
        String(value.id),
      );
      return { ok: true };
    }
    if (action.id === "importPasswordCsv") {
      const path = String(value.path);
      if ((await stat(path)).size > 10_000_000)
        throw new Error("Import file too large");
      const parsed = parsePasswordCsv(await readFile(path, "utf8"));
      const items = parsed.filter((item) => {
        try {
          return (
            ["http:", "https:"].includes(new URL(item.origin).protocol) &&
            !!item.password
          );
        } catch {
          return false;
        }
      });
      signal.throwIfAborted();
      await this.store.addPasswords(items);
      return { imported: items.length, skipped: parsed.length - items.length };
    }
    if (action.id === "importSelected") {
      const source = this.sources.get(String(value.source));
      if (!source) throw new Error("Scan and select a browser profile first");
      const result = {
        passwords: 0,
        cookies: 0,
        bookmarks: 0,
        skipped: 0,
        notes: [] as string[],
      };
      if (value.bookmarks) {
        const items = await bookmarkFile(join(source.directory, "Bookmarks"));
        signal.throwIfAborted();
        await this.store.addBookmarks(items);
        result.bookmarks = items.length;
      }
      let key: Buffer | undefined;
      if (value.passwords || value.cookies)
        try {
          key = await profileKey(source.root);
        } catch {
          /* Plaintext cookies can still be imported without a key. */
        }
      if (value.passwords) {
        const list = await rows(
          join(source.directory, "Login Data"),
          "SELECT origin_url, username_value, password_value FROM logins",
        );
        const imported = [];
        for (const item of list) {
          signal.throwIfAborted();
          try {
            if (!key) throw new Error();
            const password = (
              await decryptValue(
                Buffer.from(item.password_value as Uint8Array),
                key,
              )
            ).toString("utf8");
            const origin = new URL(String(item.origin_url)).origin;
            if (!/^https?:/.test(origin) || !password) throw new Error();
            imported.push({
              origin,
              username: String(item.username_value),
              password,
            });
          } catch {
            result.skipped++;
          }
        }
        signal.throwIfAborted();
        await this.store.addPasswords(imported);
        result.passwords = imported.length;
      }
      if (value.cookies) {
        const list = await rows(
          join(source.directory, "Network/Cookies"),
          "SELECT host_key, name, value, encrypted_value, path, expires_utc, is_secure, is_httponly, samesite FROM cookies",
        );
        for (const item of list) {
          signal.throwIfAborted();
          try {
            let plain = String(item.value ?? "");
            const domain = String(item.host_key);
            if (!plain) {
              if (!key) throw new Error();
              let data = await decryptValue(
                Buffer.from(item.encrypted_value as Uint8Array),
                key,
              );
              const hash = createHash("sha256").update(domain).digest();
              if (data.subarray(0, 32).equals(hash)) data = data.subarray(32);
              plain = data.toString("utf8");
            }
            if (!this.host.localData) throw new Error();
            const expiration =
              Number(item.expires_utc) / 1_000_000 - 11644473600;
            await this.host.localData.setCookie({
              url: `${item.is_secure ? "https" : "http"}://${domain.replace(/^\./, "")}${item.path || "/"}`,
              name: String(item.name),
              value: plain,
              ...(domain.startsWith(".") ? { domain } : {}),
              path: String(item.path || "/"),
              secure: !!item.is_secure,
              httpOnly: !!item.is_httponly,
              ...(expiration > 0 ? { expirationDate: expiration } : {}),
              sameSite:
                item.samesite === 2
                  ? "strict"
                  : item.samesite === 1
                    ? "lax"
                    : item.samesite === 0 && item.is_secure
                      ? "no_restriction"
                      : "unspecified",
            });
            result.cookies++;
          } catch {
            result.skipped++;
          }
        }
      }
      if (result.skipped)
        result.notes.push(
          "部分数据被浏览器加密保护或无法读取，未导入；密码可使用浏览器导出 CSV / Some protected or unreadable records were skipped; use CSV for passwords",
        );
      return result;
    }
    throw new Error("Unknown browser settings action");
  }
}
