import {
  resolveLocale,
  type PluginFrontendApi,
  type WebPreviewContextAction,
  type WebPreviewContextMenu,
  type WebPreviewState,
} from "@pal/contracts";
import { createBrowserMenu, createMenuItem } from "./browser-menu";
const messages = {
  en: {
    title: "Page actions",
    failed: "Could not complete page action",
    openFailed: "Could not open page",
    back: "Back",
    forward: "Forward",
    reload: "Reload",
    cut: "Cut",
    copy: "Copy",
    paste: "Paste",
    "select-all": "Select all",
    "open-link": "Open link in new tab",
    "open-link-background": "Open link in background tab",
    "external-link": "Open in external browser",
    "copy-link": "Copy link address",
    "open-image": "Open image in new tab",
    "copy-image": "Copy image",
    "copy-image-address": "Copy image address",
    inspect: "Inspect",
  },
  zh: {
    title: "网页操作",
    failed: "网页操作失败",
    openFailed: "无法打开网页",
    back: "后退",
    forward: "前进",
    reload: "刷新",
    cut: "剪切",
    copy: "复制",
    paste: "粘贴",
    "select-all": "全选",
    "open-link": "在新标签页打开链接",
    "open-link-background": "在后台标签页打开链接",
    "external-link": "在系统浏览器打开",
    "copy-link": "复制链接地址",
    "open-image": "在新标签页打开图片",
    "copy-image": "复制图片",
    "copy-image-address": "复制图片地址",
    inspect: "检查元素",
  },
};
function dictionary(locale: string) {
  return messages[
    resolveLocale(locale, Object.keys(messages)) as keyof typeof messages
  ];
}
function group(action: WebPreviewContextAction): string {
  if (action.includes("link")) return "link";
  if (action.includes("image")) return "image";
  if (["cut", "copy", "paste", "select-all"].includes(action)) return "edit";
  return action === "inspect" ? "inspect" : "navigation";
}
/** Native context targets stay in the host; this controller owns only the shared Menu presentation. */
export function createPageContextMenu(
  api: PluginFrontendApi,
  element: HTMLElement,
  locale: string,
  overlay: (open: boolean, image?: string) => Promise<void>,
  changed: (state: WebPreviewState) => void,
) {
  let text = dictionary(locale);
  let current: WebPreviewContextMenu | undefined;
  let generation = 0;
  let seen = "";
  const render = createBrowserMenu(
    element,
    () => void close(),
    () => text.title,
  );
  async function close(dismiss = true) {
    const previous = current;
    current = undefined;
    ++generation;
    render(null);
    await overlay(false);
    if (dismiss && previous) {
      try {
        await api.webPreview.command({
          type: "context-dismiss",
          token: previous.token,
        });
      } catch {
        /* closed or revoked */
      }
    }
  }
  async function execute(
    menu: WebPreviewContextMenu,
    action: WebPreviewContextAction,
  ) {
    if (current !== menu) return;
    current = undefined;
    const version = ++generation;
    render(null);
    try {
      changed(
        await api.webPreview.command({
          type: "context-action",
          token: menu.token,
          action,
        }),
      );
    } catch {
      await api.toast
        .show({ level: "error", text: text.failed })
        .catch(() => {});
    } finally {
      if (generation === version) await overlay(false);
    }
  }
  async function present(menu: WebPreviewContextMenu) {
    const version = ++generation;
    current = menu;
    element.replaceChildren();
    let previousGroup = "";
    for (const action of menu.actions) {
      const nextGroup = group(action.id);
      if (previousGroup && previousGroup !== nextGroup) {
        const separator = document.createElement("div");
        separator.className = "mu-menu-separator";
        separator.setAttribute("role", "separator");
        element.append(separator);
      }
      previousGroup = nextGroup;
      element.append(
        createMenuItem(
          text[action.id],
          () => void execute(menu, action.id),
          !action.enabled,
        ),
      );
    }
    let image: string | undefined;
    try {
      image = await api.webPreview.capture();
    } catch {
      /* A menu can still close when capture is unavailable. */
    }
    if (generation !== version || current !== menu) return;
    await overlay(true, image);
    if (generation !== version || current !== menu) return;
    render({ x: menu.x, y: menu.y });
    element
      .querySelector<HTMLButtonElement>("button:not(:disabled)")
      ?.focus({ preventScroll: true });
  }
  const dismiss = (event: PointerEvent) => {
    if (current && !element.contains(event.target as Node)) void close();
  };
  document.addEventListener("pointerdown", dismiss);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && current) void close();
  });
  window.addEventListener("blur", () => {
    if (current) void close();
  });
  return {
    update(state: WebPreviewState, locale: string) {
      text = dictionary(locale);
      const menu = state.contextMenu;
      if (current && current.token !== menu?.token) void close(false);
      if (menu && menu.token !== seen) {
        seen = menu.token;
        void present(menu);
      }
    },
  };
}
/** Single-tab mode delegates new pages to the plugin's existing scoped open command. */
export function createPageOpenRequests(
  api: PluginFrontendApi,
  locale: () => string,
) {
  let running = false;
  let revision = 0;
  let pending: WebPreviewState["openRequests"] = [];
  const consumed = new Set<string>();
  return async (state: WebPreviewState) => {
    pending = state.openRequests ?? [];
    ++revision;
    if (running) return;
    running = true;
    try {
      while (true) {
        const next = pending.find((request) => !consumed.has(request.id));
        if (!next) return;
        consumed.add(next.id);
        if (consumed.size > 64)
          consumed.delete(consumed.values().next().value!);
        try {
          const before = revision;
          const claimed = await api.webPreview.command({
            type: "open-request",
            id: next.id,
          });
          if (revision === before) pending = claimed.openRequests ?? [];
          if (claimed.openRequest)
            await api.commands.execute("modera.browser.open", {
              url: claimed.openRequest.url,
            });
        } catch {
          await api.toast
            .show({
              level: "error",
              text: dictionary(locale()).openFailed,
            })
            .catch(() => {});
        }
      }
    } finally {
      running = false;
    }
  };
}
