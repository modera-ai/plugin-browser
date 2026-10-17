import { afterEach, expect, it } from "vitest";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { BrowserDataActions } from "../src/data/actions";
import { bookmarksFromJson } from "../src/data/profiles";
import type { PluginContext } from "@pal/contracts";
const roots: string[] = [];
afterEach(async () => {
  for (const root of roots.splice(0))
    await rm(root, {
      recursive: true,
      force: true,
      maxRetries: 5,
      retryDelay: 100,
    });
});
it("preserves nested bookmark paths, restores flattened imports and edits group membership", async () => {
  const root = await mkdtemp(join(tmpdir(), "df-groups-"));
  roots.push(root);
  const host = {
    pluginId: "test",
    storagePath: root,
    signal: new AbortController().signal,
    grantedPermissions: new Set(),
    localData: {
      protect: async (v: string) => v,
      unprotect: async (v: string) => v,
      cookies: async () => [],
      setCookie: async () => {},
    },
  } as PluginContext;
  const data = new BrowserDataActions(host);
  const imported = bookmarksFromJson({
    roots: {
      bookmark_bar: {
        children: [
          {
            type: "folder",
            name: "Work",
            children: [
              {
                type: "folder",
                name: "Project",
                children: [
                  { type: "url", name: "Page", url: "https://example.com/" },
                ],
              },
            ],
          },
        ],
      },
    },
  });
  expect(imported[0]?.folder).toBe("Work/Project");
  await data.store.addBookmarks([
    { title: "old", url: "https://example.com/" },
  ]);
  await data.store.addBookmarks(imported);
  await data.store.addBookmarks(imported);
  expect(await data.store.bookmarks()).toHaveLength(1);
  const item = (await data.store.bookmarks())[0]!;
  expect(item.folder).toBe("Work/Project");
  await data.act({
    id: "saveBookmark",
    value: JSON.stringify({ ...item, title: "Renamed", folder: "Personal" }),
  });
  const page = (await data.act({
    id: "dataSummary",
    value: JSON.stringify({ folder: "Personal" }),
  })) as any;
  expect(page.bookmarks[0].title).toBe("Renamed");
  await expect(
    data.act({
      id: "saveBookmark",
      value: JSON.stringify({ url: "javascript:alert(1)", title: "bad" }),
    }),
  ).rejects.toThrow();
  await data.store.renameFolder("Personal", "Archive/Personal");
  expect((await data.store.bookmarks())[0]?.folder).toBe("Archive/Personal");
  await data.act({
    id: "removeSelected",
    value: JSON.stringify({ kind: "bookmarks", ids: [item.id] }),
  });
  expect(await data.store.bookmarks()).toHaveLength(0);
});
it("paginates and removes visits and imports cookie exports without returning secret values", async () => {
  const root = await mkdtemp(join(tmpdir(), "df-history-"));
  roots.push(root);
  const stored: unknown[] = [];
  const host = {
    pluginId: "test",
    storagePath: root,
    signal: new AbortController().signal,
    grantedPermissions: new Set(),
    localData: {
      protect: async (v: string) => v,
      unprotect: async (v: string) => v,
      cookies: async () => [],
      setCookie: async (v: unknown) => {
        stored.push(v);
      },
    },
  } as PluginContext;
  const data = new BrowserDataActions(host);
  for (let i = 0; i < 103; i++)
    await data.store.recordVisit(`https://example.com/${i}`, `Page ${i}`);
  expect(await data.act({ id: "history" })).toHaveLength(100);
  expect(await data.act({ id: "history", value: '{"page":1}' })).toHaveLength(
    3,
  );
  await data.act({ id: "removeHistory", value: '{"all":true}' });
  expect(await data.store.history()).toEqual([]);
  const path = join(root, "cookies.json");
  await writeFile(
    path,
    JSON.stringify({
      cookies: [
        {
          domain: "example.com",
          path: "/",
          name: "session",
          value: "fixture-secret",
          secure: true,
          httpOnly: true,
        },
        { url: "file:///bad", name: "bad", value: "x" },
      ],
    }),
  );
  const result = await data.act({
    id: "importCookieJson",
    value: JSON.stringify({ path }),
  });
  expect(result).toEqual({ imported: 1, skipped: 1 });
  expect(stored).toHaveLength(1);
  expect(JSON.stringify(result)).not.toContain("fixture-secret");
});
