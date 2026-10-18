import {
  resolveLocale,
  type WebPreviewState,
  type WebPreviewCommand,
} from "@pal/contracts";
import { setIcon } from "./browser-menu";
const messages = {
  en: {
    blank: "New tab",
    close: "Close",
    tabs: "Open pages",
    multiple: "Multiple tabs",
    failure: "Could not change tab mode",
    discard: "Close other tabs?",
    detail: "Other pages will be closed. Unsaved page input may be lost.",
  },
  zh: {
    blank: "新标签页",
    close: "关闭",
    tabs: "打开的网页",
    multiple: "多标签页",
    failure: "无法切换标签模式",
    discard: "关闭其他标签页？",
    detail: "其他网页将关闭，网页中未提交的输入可能丢失。",
  },
};
export function createBrowserTabs(
  root: HTMLElement,
  locale: string,
  execute: (command: WebPreviewCommand) => Promise<void>,
) {
  let text =
    messages[
      resolveLocale(locale, Object.keys(messages)) as keyof typeof messages
    ];
  let signature = "";
  return {
    messages: () => text,
    language(locale: string) {
      text =
        messages[
          resolveLocale(locale, Object.keys(messages)) as keyof typeof messages
        ];
      signature = "";
    },
    paint(state: WebPreviewState) {
      root.hidden = state.multipleTabs === false;
      root.setAttribute("aria-label", text.tabs);
      const next = JSON.stringify([state.tabs, state.activeTab, text]);
      if (next === signature) return;
      signature = next;
      root.replaceChildren();
      for (const tab of state.tabs ?? []) {
        const container = document.createElement("div");
        container.className =
          "browser-tab" + (tab.id === state.activeTab ? " selected" : "");
        const select = document.createElement("button");
        select.setAttribute("role", "tab");
        select.setAttribute(
          "aria-selected",
          String(tab.id === state.activeTab),
        );
        select.title = tab.url || text.blank;
        const icon = document.createElement("span");
        setIcon(icon, tab.loading ? "RefreshCw" : "Globe", 16);
        const title = document.createElement("span");
        title.className = "browser-tab-title";
        title.textContent =
          tab.title || (tab.url ? new URL(tab.url).hostname : text.blank);
        select.append(icon, title);
        select.onclick = () => void execute({ type: "tab-select", id: tab.id });
        const close = document.createElement("button");
        close.className = "browser-tab-close";
        close.setAttribute("aria-label", `${text.close} ${title.textContent}`);
        setIcon(close, "X", 14);
        close.onclick = () => void execute({ type: "tab-close", id: tab.id });
        container.append(select, close);
        root.append(container);
      }
    },
  };
}
