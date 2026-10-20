import { readFile, writeFile, rename, unlink } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import type { PluginContext } from "@pal/plugin-sdk";
import type { Bookmark } from "./profiles";
import { faviconUrl } from "./favicon";
export interface Password {
  id: string;
  origin: string;
  username: string;
  password: string;
}
export class BrowserStore {
  private queue = Promise.resolve();
  constructor(private host: PluginContext) {}
  async bookmarks(): Promise<(Bookmark & { id: string })[]> {
    try {
      return JSON.parse(
        await readFile(join(this.host.storagePath, "bookmarks.json"), "utf8"),
      );
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw e;
    }
  }
  async passwords(): Promise<Password[]> {
    try {
      if (!this.host.localData) throw new Error("Secure storage unavailable");
      return JSON.parse(
        await this.host.localData.unprotect(
          await readFile(join(this.host.storagePath, "passwords.enc"), "utf8"),
        ),
      );
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw e;
    }
  }
  private change(task: () => Promise<void>) {
    const next = this.queue.then(task);
    this.queue = next.catch(() => {});
    return next;
  }
  private async write(name: string, text: string) {
    const file = join(this.host.storagePath, name);
    const temp = file + ".tmp";
    await writeFile(temp, text, { mode: 0o600 });
    try {
      for (let attempt = 0; ; attempt++) {
        try {
          await rename(temp, file);
          break;
        } catch (error) {
          if (
            attempt >= 6 ||
            !["EPERM", "EBUSY", "EACCES"].includes(
              (error as NodeJS.ErrnoException).code ?? "",
            )
          )
            throw error;
          await new Promise((resolve) =>
            setTimeout(resolve, 20 * (attempt + 1)),
          );
        }
      }
    } finally {
      await unlink(temp).catch(() => {});
    }
  }
  async history(): Promise<
    { id: string; url: string; title: string; visitedAt: number; favicon?: string }[]
  > {
    try {
      return JSON.parse(
        await readFile(join(this.host.storagePath, "history.json"), "utf8"),
      );
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw e;
    }
  }
  recordVisit(url: string, title: string, icon?: string) {
    return this.change(async () => {
      const parsed = new URL(url);
      if (
        !["http:", "https:"].includes(parsed.protocol) ||
        parsed.username ||
        parsed.password
      )
        return;
      const favicon = faviconUrl(icon);
      const list = await this.history();
      const last = list[0];
      if (last?.url === url && Date.now() - last.visitedAt < 60000) {
        last.title = title;
        if (favicon) last.favicon = favicon;
        last.visitedAt = Date.now();
      } else
        list.unshift({ id: randomUUID(), url, title, visitedAt: Date.now(), ...(favicon ? { favicon } : {}) });
      await this.write("history.json", JSON.stringify(list.slice(0, 5000)));
    });
  }
  clearHistorySince(since: number, signal: AbortSignal) {
    if (!Number.isFinite(since) || since < 0)
      throw new Error("Invalid time range");
    return this.change(async () => {
      signal.throwIfAborted();
      const records = await this.history();
      signal.throwIfAborted();
      await this.write(
        "history.json",
        JSON.stringify(records.filter((item) => item.visitedAt < since)),
      );
    });
  }
  removeHistory(ids: string[] | null) {
    return this.change(async () => {
      await this.write(
        "history.json",
        JSON.stringify(
          ids ? (await this.history()).filter((x) => !ids.includes(x.id)) : [],
        ),
      );
    });
  }
  saveBookmark(item: Bookmark & { id?: string }) {
    return this.change(async () => {
      const url = new URL(item.url);
      if (
        !["http:", "https:"].includes(url.protocol) ||
        url.username ||
        url.password
      )
        throw new Error("Invalid bookmark URL");
      const list = await this.bookmarks();
      const old = list.find((x) => x.id === item.id);
      const favicon = faviconUrl(item.favicon);
      const value = {
        title: item.title.slice(0, 500),
        url: url.href,
        ...(favicon ? { favicon } : {}),
        folder: (item.folder ?? "")
          .split("/")
          .map((x) => x.trim())
          .filter(Boolean)
          .join("/")
          .slice(0, 300),
      };
      if (old) Object.assign(old, value);
      else list.push({ ...value, id: randomUUID() });
      await this.write("bookmarks.json", JSON.stringify(list));
    });
  }
  renameFolder(from: string, to: string) {
    return this.change(async () => {
      const target = to
        .split("/")
        .map((x) => x.trim())
        .filter(Boolean)
        .join("/");
      if (!from || !target || target.length > 300)
        throw new Error("Invalid folder");
      const list = await this.bookmarks();
      for (const item of list)
        if (item.folder === from || item.folder?.startsWith(from + "/"))
          item.folder = target + item.folder.slice(from.length);
      await this.write("bookmarks.json", JSON.stringify(list));
    });
  }
  addBookmarks(items: Bookmark[]) {
    return this.change(async () => {
      const list = await this.bookmarks();
      for (const item of items) {
        const url = new URL(item.url);
        if (!["http:", "https:"].includes(url.protocol)) continue;
        const old = list.find((row) => row.url === url.href && !row.folder);
        if (old && item.folder) old.folder = item.folder;
        if (
          !list.some(
            (row) =>
              row.url === url.href &&
              (row.folder ?? "") === (item.folder ?? ""),
          )
        )
          list.push({ ...item, url: url.href, id: randomUUID() });
      }
      await this.write("bookmarks.json", JSON.stringify(list));
    });
  }
  addPasswords(items: (Omit<Password, "id"> & { id?: string })[]) {
    return this.change(async () => {
      if (!this.host.localData) throw new Error("Secure storage unavailable");
      const list = await this.passwords();
      for (const item of items) {
        const origin = new URL(item.origin).origin;
        if (!/^https?:/.test(origin) || !item.password) continue;
        const old = list.find((row) =>
          item.id
            ? row.id === item.id
            : row.origin === origin && row.username === item.username,
        );
        if (old)
          Object.assign(old, {
            origin,
            username: item.username,
            password: item.password,
          });
        else list.push({ ...item, origin, id: randomUUID() });
      }
      await this.write(
        "passwords.enc",
        await this.host.localData.protect(JSON.stringify(list)),
      );
    });
  }
  remove(kind: "passwords" | "bookmarks", id: string) {
    return this.change(async () => {
      if (kind === "bookmarks")
        await this.write(
          "bookmarks.json",
          JSON.stringify(
            (await this.bookmarks()).filter((item) => item.id !== id),
          ),
        );
      else {
        if (!this.host.localData) throw new Error("Secure storage unavailable");
        await this.write(
          "passwords.enc",
          await this.host.localData.protect(
            JSON.stringify(
              (await this.passwords()).filter((item) => item.id !== id),
            ),
          ),
        );
      }
    });
  }
}
