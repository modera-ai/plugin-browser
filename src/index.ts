import type { PluginManifest, PluginModule } from "@modera/plugin-sdk";
import { browserTools } from "./tools";
import { definitions } from "./definitions";
import { BrowserDataActions } from "./data/actions";
export const activate: PluginModule["activate"] = async (host) => {
  const data = new BrowserDataActions(host);
  return {
    tools: browserTools(host),
    settings: {
      timeoutMs: 120000,
      actions: [
        "renameFolder",
        "removeSelected",
        "saveBookmark",
        "savePassword",
        "history",
        "removeHistory",
        "importCookieJson",
        "scanBrowsers",
        "dataSummary",
        "importSelected",
        "importPasswordCsv",
        "revealPassword",
        "removePassword",
        "removeBookmark",
      ],
      async act(action, context) {
        context.signal.throwIfAborted();
        const result = await data.act(action, context.signal);
        if (
          ![
            "dataSummary",
            "scanBrowsers",
            "history",
            "revealPassword",
          ].includes(action.id)
        )
          host.invalidateUi?.();
        return result;
      },
    },
    ui: [
      {
        id: "modera.browser.preview",
        slot: "panel",
        accepts: "web",
        persistentSession: true,
        launcher: {
          multiple: true,
          title: "Browser",
          description: "Open a page in the sidebar",
          icon: "globe",
          locales: {
            "zh-CN": { title: "浏览器", description: "打开网页，浏览与收藏" },
          },
        },
        frontend: "browser",
        nativeCapabilities: ["web-preview"],
        requiredPermissions: ["network.fetch", "browser.control"],
        actions: ["bookmark", "visit"],
        async act(action) {
          const value = JSON.parse(action.value ?? "{}");
          if (action.id === "visit") {
            await data.store.recordVisit(
              String(value.url),
              String(value.title || value.url),
            );
            return;
          }
          await data.store.addBookmarks([
            { title: String(value.title ?? value.url), url: String(value.url) },
          ]);
        },
        async render(request, context) {
          let url = "";
          const payload = request.resource?.startsWith("{")
            ? (JSON.parse(request.resource) as {
                url?: string;
                automated?: boolean;
              })
            : undefined;
          const managed = payload?.automated === true;
          const initial = payload ? payload.url : request.resource;
          const resource =
            initial ||
            (managed
              ? ""
              : String(
                  (await host.config?.read(context.projectId))?.values
                    .startPage ?? "",
                ));
          if (resource) {
            const parsed = new URL(resource);
            if (
              !["http:", "https:"].includes(parsed.protocol) ||
              parsed.username ||
              parsed.password
            )
              throw new Error("Invalid preview URL");
            url = parsed.href;
          }
          const allBookmarks = await data.store.bookmarks();
          let size = 0;
          const bookmarks = allBookmarks.filter((item) => {
            size += JSON.stringify(item).length;
            return size < 200000;
          });
          return {
            title: url
              ? new URL(url).hostname
              : request.locale.startsWith("zh")
                ? "浏览器"
                : "Browser",
            data: {
              url,
              managed,
              bookmarks,
              bookmarkCount: allBookmarks.length,
            },
            children: [],
          };
        },
      },
    ],
  };
};
