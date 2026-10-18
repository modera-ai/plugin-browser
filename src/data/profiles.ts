import { readFile, readdir, mkdtemp, copyFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { homedir, tmpdir } from "node:os";
import { createHash } from "node:crypto";
export interface ImportSource {
  id: string;
  name: string;
  profile: string;
  account: string;
  directory: string;
  root: string;
  passwords: number;
  cookies: number;
  bookmarks: number;
  note: string;
}
export interface Bookmark {
  favicon?: string;
  folder?: string;
  title: string;
  url: string;
}
export function bookmarksFromJson(value: unknown): Bookmark[] {
  const found: Bookmark[] = [];
  const visit = (item: unknown, folder = "") => {
    if (!item || typeof item !== "object") return;
    const node = item as Record<string, unknown>;
    if (
      node.type === "url" &&
      typeof node.url === "string" &&
      /^https?:\/\//i.test(node.url)
    )
      found.push({
        title: String(node.name || node.url),
        url: node.url,
        ...(folder ? { folder } : {}),
      });
    if (Array.isArray(node.children))
      node.children.forEach((child) =>
        visit(
          child,
          node.type === "folder" && node.name
            ? [folder, String(node.name)].filter(Boolean).join("/")
            : folder,
        ),
      );
  };
  const roots = (value as { roots?: Record<string, unknown> })?.roots;
  if (roots)
    Object.values(roots).forEach((root) => {
      if (
        root &&
        typeof root === "object" &&
        Array.isArray((root as any).children)
      )
        (root as any).children.forEach((child: unknown) => visit(child));
    });
  return found;
}
export async function bookmarkFile(path: string) {
  return bookmarksFromJson(JSON.parse(await readFile(path, "utf8")));
}
/** Copy only on explicit scan/import. Include WAL to retain recent committed rows. */
export async function rows(
  path: string,
  sql: string,
): Promise<Record<string, unknown>[]> {
  const dir = await mkdtemp(join(tmpdir(), "modera-import-"));
  try {
    await copyFile(path, join(dir, "data"));
    for (const suffix of ["-wal", "-shm"])
      await copyFile(path + suffix, join(dir, "data") + suffix).catch(() => {});
    const { DatabaseSync } = await import("node:sqlite");
    const db = new DatabaseSync(join(dir, "data"), { readOnly: true });
    try {
      const statement = db.prepare(sql);
      statement.setReadBigInts(true);
      return statement
        .all()
        .map((row) =>
          Object.fromEntries(
            Object.entries(row).map(([key, value]) => [
              key,
              typeof value === "bigint"
                ? value <= BigInt(Number.MAX_SAFE_INTEGER) &&
                  value >= BigInt(Number.MIN_SAFE_INTEGER)
                  ? Number(value)
                  : value.toString()
                : value,
            ]),
          ),
        );
    } finally {
      db.close();
    }
  } finally {
    await rm(dir, {
      recursive: true,
      force: true,
      maxRetries: 5,
      retryDelay: 100,
    });
  }
}
export async function scanProfiles(): Promise<ImportSource[]> {
  const base = process.env.LOCALAPPDATA ?? join(homedir(), "AppData", "Local");
  const homes =
    process.platform === "win32"
      ? [
          ["Google Chrome", join(base, "Google/Chrome/User Data")],
          ["Microsoft Edge", join(base, "Microsoft/Edge/User Data")],
          ["Chromium", join(base, "Chromium/User Data")],
        ]
      : process.platform === "darwin"
        ? [
            [
              "Google Chrome",
              join(homedir(), "Library/Application Support/Google/Chrome"),
            ],
            [
              "Microsoft Edge",
              join(homedir(), "Library/Application Support/Microsoft Edge"),
            ],
          ]
        : [
            ["Google Chrome", join(homedir(), ".config/google-chrome")],
            ["Chromium", join(homedir(), ".config/chromium")],
          ];
  const result: ImportSource[] = [];
  for (const [name, root] of homes as [string, string][]) {
    for (const profile of await readdir(root, { withFileTypes: true }).catch(
      () => [],
    )) {
      if (
        !profile.isDirectory() ||
        !/^(Default|Profile \d+)$/.test(profile.name)
      )
        continue;
      const directory = join(root, profile.name);
      let account = "",
        note = "";
      try {
        const p = JSON.parse(
          await readFile(join(directory, "Preferences"), "utf8"),
        );
        account = p.account_info?.[0]?.email ?? "";
      } catch {}
      const count = async (file: string, table: string) => {
        try {
          return Number(
            (
              await rows(
                join(directory, file),
                `SELECT count(*) AS count FROM ${table}`,
              )
            )[0]?.count ?? 0,
          );
        } catch {
          note =
            "部分数据库不可读，请关闭源浏览器后重试 / Close the source browser and retry";
          return 0;
        }
      };
      const passwords = await count("Login Data", "logins"),
        cookies = await count("Network/Cookies", "cookies");
      const bookmarks = (
        await bookmarkFile(join(directory, "Bookmarks")).catch(() => [])
      ).length;
      result.push({
        id: createHash("sha256").update(directory).digest("hex").slice(0, 20),
        name,
        root,
        directory,
        profile: profile.name,
        account,
        passwords,
        cookies,
        bookmarks,
        note,
      });
    }
  }
  return result;
}
