import { bookmarkView } from "./data/bookmark-view";
import { faviconUrl } from "./data/favicon";
import { normalizeBrowserUrl } from "@pal/contracts";
import { definePlugin, type PluginModule } from "@pal/plugin-sdk";
import manifest from "../plugin.json";
import { browserTools } from "./tools";
import { BrowserDataActions } from "./data/actions";
import { startPageUrl } from "./start-page";
export const activate: PluginModule["activate"] = async (host) => {
  const data = new BrowserDataActions(host);
  const tools = browserTools(host);
  const registered = await definePlugin((pal) => {
    for (const provider of manifest.declarations.provides.providers)
      pal.providers.register(provider);
    for (const declaration of manifest.declarations.provides.commands)
      pal.commands.register({
        ...declaration,
        visibility: declaration.visibility as "public" | "private",
        async run(raw, execution) {
          const input = raw as Record<string, any>;
          const context = execution.context;
          context.signal.throwIfAborted();
          const name = declaration.id.slice("modera.browser.".length);
          if (name.startsWith("tool.")) {
            const tool = tools.find(
              (tool) =>
                tool.definition.id ===
                "browser_" + name.slice(5).replaceAll("-", "_"),
            );
            if (!tool) throw new Error("Unknown browser operation");
            return tool.execute(raw, context);
          }
          if (name === "open" || name === "new-tab") {
            if (!host.panels) throw new Error("Panel navigation unavailable");
            const url = name === "open" ? normalizeBrowserUrl(input.url) : "";
            // A single-page link hands navigation to the destination panel.
            // The source command is cancelled when that panel takes focus.
            if (host.webPages && input.separatePanel !== true) {
              await host.webPages.execute(
                {
                  type: "create",
                  panel: "modera.browser.preview",
                  resource: JSON.stringify({
                    key: crypto.randomUUID(),
                    url,
                    automated: true,
                  }),
                  ...(url ? { url } : {}),
                },
                context,
              );
              return { opened: true };
            }
            await host.panels.open(
              "modera.browser.preview",
              JSON.stringify({ key: crypto.randomUUID(), url }),
              context,
            );
            return { opened: true };
          }
          if (name === "visit") {
            await data.store.recordVisit(
              normalizeBrowserUrl(input.url),
              input.title || input.url,
              faviconUrl(input.favicon),
            );
            return;
          }
          if (name === "bookmark") {
            const favicon = faviconUrl(input.favicon);
            if (input.operation === "remove") {
              if (!input.id) throw new Error("Bookmark required");
              await data.store.remove("bookmarks", input.id);
            } else if (input.operation === "save") {
              await data.store.saveBookmark({
                ...(input.id ? { id: input.id } : {}),
                title: input.title || input.url,
                url: normalizeBrowserUrl(input.url),
                folder: input.folder || "",
                ...(favicon ? { favicon } : {}),
              });
            } else
              await data.store.addBookmarks([
                {
                  title: input.title || input.url,
                  url: normalizeBrowserUrl(input.url),
                  ...(favicon ? { favicon } : {}),
                },
              ]);
            host.invalidateUi?.();
            return bookmarkView(data.store);
          }
          const result = await data.act(
            { id: input.operation, value: JSON.stringify(input.value) },
            context.signal,
          );
          context.signal.throwIfAborted();
          if (
            ![
              "dataSummary",
              "scanBrowsers",
              "history",
              "revealPassword",
            ].includes(input.operation)
          )
            host.invalidateUi?.();
          return result;
        },
      });
    pal.ui.register({
      id: "modera.browser.preview",
      slot: "ui.panel",
      persistentSession: true,
      launcher: {
        multiple: true,
        title: "Browser",
        description: "Browse web pages",
        icon: "globe",
        locales: { "zh-CN": { title: "浏览器", description: "浏览网页" } },
      },
      hostRenderer: "browser",
      restoreVersion: 1,
      nativeCapabilities: ["web-preview"],
      requiredPermissions: [
        "network.fetch",
        "browser.control",
        "workspace.read",
        "storage.read",
        "storage.write",
        "process.spawn",
      ],
      actionLimits: { maxValueChars: 4000, timeoutMs: 60000 },
      commands: [
        "modera.browser.open",
        "modera.browser.new-tab",
        "modera.browser.visit",
        "modera.browser.bookmark",
        "modera.browser.data",
      ],
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
            : startPageUrl(
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
        const bookmarks = await bookmarkView(data.store);
        return {
          title: url
            ? new URL(url).hostname
            : request.locale.startsWith("zh")
              ? "浏览器"
              : "Browser",
          data: {
            url,
            managed,
            ...bookmarks,
          },
          children: [],
        };
      },
    });
  }).activate(host);
  return {
    ...registered,
    settings: { timeoutMs: 120000, commands: ["modera.browser.data"] },
    tools: tools.map((tool) => ({
      ...tool,
      execute(input, context) {
        if (!host.commands) throw new Error("Host commands unavailable");
        return host
          .commands(context)
          .execute(
            "modera.browser.tool." +
              tool.definition.id.slice(8).replaceAll("_", "-"),
            input,
          );
      },
    })),
  };
};
