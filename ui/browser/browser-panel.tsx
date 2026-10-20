import { readUiThemeTokens } from "@pal/ui/provider";
import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ArrowLeft,
  ArrowRight,
  ExternalLink,
  Globe,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Search,
  Star,
  X,
  Folder,
} from "@pal/ui/icons";
import { Input, Tooltip, CapsuleGroup, CapsuleButton } from "@pal/ui";
import { CameraIcon as Camera } from "@phosphor-icons/react/dist/csr/Camera";
import { CaretDoubleRightIcon as ChevronsRight } from "@phosphor-icons/react/dist/csr/CaretDoubleRight";
import type { PanelMenuRequest, WebPreviewCommand } from "@pal/contracts";
import {
  bookmarkTree,
  type Bookmark,
  type BookmarkNode,
  type BrowserProps,
} from "./types";
import { AnnotationEditor } from "./annotation-editor";
import { ExtensionsMenu } from "./extensions-menu";
import { ExtensionManager } from "./extension-manager";
import { MousePointer2 } from "lucide-react";
import { useStoreConfirmation } from "./use-store-confirmation";
import { messages } from "./messages";
import { useBrowser } from "./use-browser";
import { BrowserErrorPage } from "./error-page";
import { SiteIcon as TabIcon } from "./site-icon";
import {
  addressTarget,
  useAddressSuggestions,
} from "./use-address-suggestions";
import { BookmarkEditor } from "./bookmark-editor";
import { useBookmarkOverflow } from "./use-bookmark-overflow";
import {
  BrowserImportDialog,
  type BrowserDataCall,
} from "../../src/browser-import-dialog";
import { ClearDataDialog } from "./clear-data-dialog";
import { DeviceToolbar, deviceDefaults, type Device } from "./device-toolbar";
type MenuItem = PanelMenuRequest["items"][number];
const preference = "pal.browser.multiple-tabs";

function bookmarkIcon(
  node: BookmarkNode,
  tabs: { url: string; favicon?: string }[] = [],
) {
  const icon =
    node.favicon ?? tabs.find((tab) => tab.url === node.url)?.favicon;
  if (icon) return icon;
  try {
    if (node.url && /^https?:/.test(node.url))
      return new URL("/favicon.ico", node.url).href;
  } catch {}
}

export default function BrowserPanel({ api, snapshot, active }: BrowserProps) {
  const text = messages(snapshot.locale);
  const fail = useCallback(() => {
    void api.toast
      .show({ level: "error", text: messages(snapshot.locale).failed })
      .catch(() => {});
  }, [api, snapshot.locale]);
  const initial = snapshot.view.data as
    { url?: string; managed?: boolean; bookmarks?: Bookmark[] } | undefined;
  const { state, execute, command } = useBrowser(
    api,
    active,
    fail,
    initial?.url,
    initial?.managed,
  );
  const root = useRef<HTMLDivElement>(null),
    viewport = useRef<HTMLDivElement>(null);
  useStoreConfirmation(
    api,
    state.extensionStorePrompt,
    snapshot.locale,
    execute,
  );
  const [extensionsOpen, setExtensionsOpen] = useState(false);
  useEffect(() => {
    if (state.annotations?.focus) setExtensionsOpen(false);
  }, [state.annotations?.focus]);
  const [address, setAddress] = useState("");
  const addressFocused = useRef(false);
  const [deviceOpen, setDeviceOpen] = useState(() => {
    try {
      return localStorage.getItem("pal.browser.device-always") === "true";
    } catch {
      return false;
    }
  });
  const [device, setDevice] = useState<Device>(deviceDefaults);
  const [alwaysDevice, setAlwaysDevice] = useState(() => {
    try {
      return localStorage.getItem("pal.browser.device-always") === "true";
    } catch {
      return false;
    }
  });
  const deviceTabs = useRef(new Set<string>());
  useEffect(() => {
    if (state.activeTab && !deviceTabs.current.has(state.activeTab)) {
      deviceTabs.current.add(state.activeTab);
      if (alwaysDevice) setDeviceOpen(true);
    }
  }, [state.activeTab, alwaysDevice]);
  const [dataDialog, setDataDialog] = useState<"import" | "clear" | null>(null);
  const invokeData: BrowserDataCall = useCallback(
    (operation, value = {}) =>
      api.commands.execute("modera.browser.data", { operation, value }),
    [api],
  );
  const report = useCallback(
    (error: unknown) => {
      console.error("Browser action failed", error);
      fail();
    },
    [fail],
  );
  useEffect(() => {
    if (!active || !state.activeTab) return;
    const timer = setTimeout(
      () =>
        command({
          type: "device",
          enabled: deviceOpen,
          width: device.width,
          height: device.height,
          mobile: device.mobile,
          scale: device.scale,
        }),
      100,
    );
    return () => clearTimeout(timer);
  }, [active, state.activeTab, deviceOpen, device, command]);
  useEffect(() => {
    if (!active || !state.activeTab) return;
    command({
      type: "find-toolbar",
      open: false,
      dark: snapshot.theme?.mode === "dark",
    });
  }, [active, state.activeTab, snapshot.theme?.mode, command]);
  const openFind = () =>
    command({
      type: "find-toolbar",
      open: true,
      dark: snapshot.theme?.mode === "dark",
    });
  useEffect(() => {
    if (!active) return;
    const key = (event: KeyboardEvent) => {
      if (
        (event.ctrlKey || event.metaKey) &&
        event.key.toLowerCase() === "f" &&
        root.current?.contains(event.composedPath()[0] as Node)
      ) {
        event.preventDefault();
        openFind();
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [active, api, snapshot.theme?.mode, command]);
  const [bookmarks, setBookmarks] = useState(initial?.bookmarks ?? []);
  const addressSuggestions = useAddressSuggestions(
    invokeData,
    bookmarks,
    text.addressSearch,
    state.tabs,
  );
  const addressInput = useRef<HTMLInputElement>(null);
  const navigateAddress = (value: string) => {
    if (!value.trim()) return;
    addressSuggestions.setOpen(false);
    command({ type: "navigate", url: addressTarget(value) });
    addressInput.current?.blur();
    addressFocused.current = false;
  };
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    const refresh = () => {
      void api
        .snapshot()
        .then((next) => {
          if (!cancelled)
            setBookmarks(
              (next.view.data as { bookmarks?: Bookmark[] } | undefined)
                ?.bookmarks ?? [],
            );
        })
        .catch(() => {});
    };
    const stop = api.onChanged(refresh);
    refresh();
    return () => {
      cancelled = true;
      stop();
    };
  }, [api, active]);
  const bookmarkOpening = useRef(false);
  const bookmarkGeneration = useRef(0);
  const [editingBookmark, setEditingBookmark] = useState<{
    item: Bookmark;
    added: boolean;
  } | null>(null);
  const closeBookmark = () => {
    bookmarkGeneration.current++;
    setEditingBookmark(null);
  };
  useEffect(() => {
    if (!active) {
      bookmarkGeneration.current++;
      setEditingBookmark(null);
      setDataDialog(null);
      setExtensionsOpen(false);
      addressSuggestions.setOpen(false);
    }
  }, [active]);
  useEffect(
    () => () => {
      bookmarkGeneration.current++;
    },
    [],
  );
  const menu = useRef(0),
    pendingMenu = useRef(false),
    seenContext = useRef("");
  const latest = useRef({ state, active, extensionsOpen });
  latest.current = { state, active, extensionsOpen };
  const lastLayout = useRef("");
  const layout = useCallback(
    async (visibleOverride?: boolean) => {
      if (!root.current || !viewport.current) return;
      const panel = root.current.getBoundingClientRect(),
        box = viewport.current.getBoundingClientRect();
      const value = latest.current;
      const x = Math.max(0, Math.ceil(box.x - panel.x)),
        y = Math.max(0, Math.ceil(box.y - panel.y));
      const bounds = {
        x,
        y,
        width: Math.max(
          0,
          Math.min(Math.floor(box.width), Math.floor(panel.width) - x),
        ),
        height: Math.max(
          0,
          Math.min(Math.floor(box.height), Math.floor(panel.height) - y),
        ),
        visible:
          visibleOverride ??
          (value.active &&
            !value.extensionsOpen &&
            !!value.state.url &&
            (!value.state.error || value.state.error === "popup-blocked") &&
            box.width > 0 &&
            box.height > 0),
      };
      const key = JSON.stringify([panel.x, panel.y, bounds]);
      if (key === lastLayout.current) return;
      lastLayout.current = key;
      try {
        await api.webPreview.layout(bounds);
      } catch (error) {
        lastLayout.current = "";
        throw error;
      }
    },
    [api],
  );
  useLayoutEffect(() => {
    let frame = 0;
    const resize = () => {
      if (!frame)
        frame = requestAnimationFrame(() => {
          frame = 0;
          void layout().catch(() => {});
        });
    };
    const observer = new ResizeObserver(resize);
    observer.observe(root.current!);
    observer.observe(viewport.current!);
    const movement = new MutationObserver(resize);
    let node: Element | null = root.current;
    while (node) {
      movement.observe(node, {
        attributes: true,
        attributeFilter: ["style", "class"],
      });
      const parent = node.parentElement;
      if (parent) node = parent;
      else {
        const tree = node.getRootNode();
        node = tree instanceof ShadowRoot ? tree.host : null;
      }
    }
    window.addEventListener("resize", resize);
    window.addEventListener("scroll", resize, true);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      movement.disconnect();
      window.removeEventListener("resize", resize);
      window.removeEventListener("scroll", resize, true);
      void layout(false).catch(() => {});
    };
  }, [layout]);
  useLayoutEffect(() => {
    void layout().catch(() => {});
  }, [
    state.url,
    state.error,
    state.activeTab,
    state.multipleTabs,
    active,
    deviceOpen,
    device,
    bookmarks.length,
    extensionsOpen,
    layout,
  ]);
  useEffect(() => {
    if (!addressFocused.current) setAddress(state.url);
  }, [state.url, state.activeTab]);
  const visitFavicon = state.tabs?.find(
    (tab) => tab.id === state.activeTab,
  )?.favicon;
  const lastVisit = useRef("");
  useEffect(() => {
    if (!active || state.loading || state.error || !/^https?:/.test(state.url))
      return;
    const key = JSON.stringify([state.url, state.title, visitFavicon]);
    if (key === lastVisit.current) return;
    lastVisit.current = key;
    void api.commands
      .execute("modera.browser.visit", {
        url: state.url,
        title: state.title || state.url,
        ...(visitFavicon ? { favicon: visitFavicon } : {}),
      })
      .catch(() => {});
  }, [
    state.url,
    state.title,
    state.loading,
    state.error,
    visitFavicon,
    active,
    api,
  ]);
  const popup = useCallback(
    async (
      items: MenuItem[],
      x: number,
      y: number,
      options: Pick<PanelMenuRequest, "variant" | "width" | "maxHeight"> = {},
      onAction?: (action: string) => Promise<MenuItem[]>,
    ) => {
      const current = ++menu.current;
      pendingMenu.current = true;
      const tokens = root.current ? readUiThemeTokens(root.current) : {};
      try {
        const request = { x, y, items, tokens, ...options };
        const selected = await api.menu.show(
          request,
          onAction
            ? async (action) => {
                if (current !== menu.current || !latest.current.active) return;
                return { ...request, items: await onAction(action) };
              }
            : undefined,
        );
        return current === menu.current ? selected : null;
      } finally {
        if (current === menu.current) pendingMenu.current = false;
      }
    },
    [api],
  );
  const dismiss = useCallback(() => {
    ++menu.current;
    if (pendingMenu.current) {
      api.menu.dismiss();
      pendingMenu.current = false;
    }
  }, [api]);
  useEffect(() => {
    if (!active) dismiss();
    return dismiss;
  }, [active, dismiss]);
  useEffect(() => {
    const context = state.contextMenu;
    if (!active || !context || seenContext.current === context.token) return;
    seenContext.current = context.token;
    let cancelled = false;
    const items: MenuItem[] = [];
    let previousGroup = "";
    for (const action of context.actions) {
      const group = action.id.includes("link")
        ? "link"
        : action.id.includes("image")
          ? "image"
          : ["cut", "copy", "paste", "select-all"].includes(action.id)
            ? "edit"
            : action.id === "inspect"
              ? "inspect"
              : "navigation";
      if (previousGroup && group !== previousGroup)
        items.push({
          id: "separator:" + items.length,
          label: "",
          separator: true,
        });
      items.push({
        id: action.id,
        label: text[action.id],
        disabled: !action.enabled,
      });
      previousGroup = group;
    }
    void popup(items, context.x, context.y)
      .then(async (action) => {
        if (cancelled) return;
        await execute(
          action
            ? {
                type: "context-action",
                token: context.token,
                action: action as (typeof context.actions)[number]["id"],
              }
            : { type: "context-dismiss", token: context.token },
        );
      })
      .catch(() => {
        if (!cancelled) fail();
      });
    return () => {
      cancelled = true;
      dismiss();
    };
  }, [state.contextMenu?.token, active, popup, execute, dismiss, text, fail]);
  const openFolder = async (items: BookmarkNode[], anchor: HTMLElement) => {
    const stack: { nodes: BookmarkNode[]; page: number }[] = [];
    // Stay within the shared menu's 100-entry/200-character request bounds.
    const pageSize = 80;
    let nodes = items;
    let page = 0;
    while (latest.current.active) {
      const rect = anchor.getBoundingClientRect();
      const selected = await popup(
        [
          ...(stack.length ? [{ id: "back", label: text.back }] : []),
          ...nodes
            .slice(page * pageSize, (page + 1) * pageSize)
            .map((node, index) => {
              const label = (node.title || node.url || text.bookmarkFolder)
                .replace(/\s+/g, " ")
                .trim();
              return {
                id: String(page * pageSize + index),
                label:
                  label.length > 200
                    ? label.slice(0, 199).replace(/[\uD800-\uDBFF]$/, "") + "…"
                    : label,
                icon: node.children ? ("folder" as const) : ("globe" as const),
                image: node.children
                  ? undefined
                  : bookmarkIcon(node, state.tabs),
              };
            }),
          ...(page > 0
            ? [{ id: "previous", label: text.previousBookmarks }]
            : []),
          ...((page + 1) * pageSize < nodes.length
            ? [{ id: "next", label: text.nextBookmarks }]
            : []),
        ],
        rect.left,
        rect.bottom,
        {
          variant: "dropdown",
          width: 360,
          maxHeight: Math.max(
            80,
            Math.min(1200, Math.floor(window.innerHeight - rect.bottom - 24)),
          ),
        },
      );
      if (selected === null) return;
      if (selected === "previous" || selected === "next") {
        page += selected === "next" ? 1 : -1;
        continue;
      }
      if (selected === "back") {
        ({ nodes, page } = stack.pop()!);
        continue;
      }
      const node = nodes[Number(selected)];
      if (!node) return;
      if (node.children) {
        stack.push({ nodes, page });
        nodes = node.children;
        page = 0;
      } else {
        if (node.url) command({ type: "navigate", url: node.url });
        return;
      }
    }
  };
  const toggleTabs = async () => {
    const multiple = state.multipleTabs === false;
    const resources = !multiple
      ? (state.tabs ?? [])
          .filter((tab) => tab.id !== state.activeTab)
          .map(() =>
            JSON.stringify({ key: crypto.randomUUID(), automated: true }),
          )
      : [];
    await execute({
      type: "tabs-mode",
      multiple,
      ...(resources.length ? { resources } : {}),
    });
    try {
      localStorage.setItem(preference, String(multiple));
    } catch {}
  };
  const captureScreenshot = async () => {
    await execute({ type: "screenshot" });
    if (latest.current.active)
      await api.toast.show({
        key: "browser-screenshot",
        level: "success",
        text: text.copiedScreenshot,
        durationMs: 3000,
      });
  };
  const showMenu = async (anchor: HTMLElement) => {
    const rect = anchor.getBoundingClientRect();
    const checks = (checked: boolean, label: string) =>
      checked ? "✓ " + label : label;
    let zoom = state.zoomFactor ?? 1;
    const hasPage = !!state.url;
    const items = (): MenuItem[] => [
      {
        id: "multiple",
        label: checks(state.multipleTabs !== false, text.multiple),
      },
      { id: "group-tabs", label: "", separator: true },
      { id: "find", label: text.find, disabled: !hasPage },
      {
        id: "annotation",
        label: text.annotate,
        disabled: !hasPage,
        children: [
          { id: "annotation-element", label: text.annotateElement },
          { id: "annotation-region", label: text.annotateRegion },
        ],
      },
      { id: "extensions", label: text.extensions },
      { id: "group-zoom", label: "", separator: true },
      {
        id: "zoom",
        label: text.zoom,
        disabled: !hasPage,
        controls: {
          value: `${Math.round(zoom * 100)}%`,
          buttons: [
            { id: "zoom-out", label: text.zoomOut, disabled: zoom <= 0.25 },
            { id: "zoom-in", label: text.zoomIn, disabled: zoom >= 3 },
            {
              id: "zoom-reset",
              label: text.zoomReset,
              disabled: Math.abs(zoom - 1) < 0.001,
            },
          ],
        },
      },
      { id: "group-page", label: "", separator: true },
      {
        id: "device",
        label: text.device,
        children: [
          {
            id: "device-toggle",
            label: deviceOpen ? text.deviceHide : text.deviceShow,
          },
          {
            id: "device-always",
            label: checks(alwaysDevice, text.deviceAlways),
          },
        ],
      },
      { id: "screenshot", label: text.screenshot, disabled: !hasPage },
      { id: "group-data", label: "", separator: true },
      { id: "import", label: text.import },
      {
        id: "data",
        label: text.browsingData,
        children: [
          { id: "settings:bookmarks", label: text.bookmarks },
          { id: "settings:passwords", label: text.passwords },
          { id: "settings:history", label: text.history },
          { id: "settings:cookies", label: text.cookies },
        ],
      },
      {
        id: "clear",
        label: text.clearData,
      },
      {
        id: "tools",
        label: text.tools,
        children: [
          { id: "hard-reload", label: text.hardReload, disabled: !hasPage },
          { id: "devtools", label: text.devtools, disabled: !hasPage },
        ],
      },
      { id: "group-settings", label: "", separator: true },
      { id: "settings:settings", label: text.settings },
    ];
    const selected = await popup(
      items(),
      rect.right - 288,
      rect.bottom,
      { variant: "dropdown", width: 288 },
      async (action) => {
        try {
          const next = await execute({
            type: "zoom",
            factor:
              action === "zoom-reset"
                ? 1
                : Math.min(
                    3,
                    Math.max(0.25, zoom + (action === "zoom-in" ? 0.1 : -0.1)),
                  ),
          });
          zoom = next.zoomFactor ?? zoom;
        } catch {
          fail();
        }
        return items();
      },
    );
    if (!selected) return;
    if (selected === "annotation-element" || selected === "annotation-region") {
      await execute({
        type: "annotation-start",
        mode: selected === "annotation-region" ? "region" : "element",
      });
      return;
    }
    if (selected === "extensions") {
      setExtensionsOpen(true);
      await execute({ type: "extension-list" });
      return;
    }
    if (selected === "multiple") return toggleTabs();
    if (selected.startsWith("settings:"))
      return api.openSettings(
        selected === "settings:settings" ? "" : selected.slice(9),
      );
    if (selected === "device-toggle") {
      setDeviceOpen((value) => !value);
      return;
    }
    if (selected === "device-always") {
      const value = !alwaysDevice;
      setAlwaysDevice(value);
      try {
        localStorage.setItem("pal.browser.device-always", String(value));
      } catch {}
      return;
    }
    if (selected === "find") {
      openFind();
      return;
    }
    if (selected === "import" || selected === "clear") {
      const generation = ++bookmarkGeneration.current;
      const page = latest.current.state.activeTab;
      if (
        !latest.current.active ||
        generation !== bookmarkGeneration.current ||
        latest.current.state.activeTab !== page
      )
        return;
      setDataDialog(selected);
      return;
    }
    if (selected === "screenshot") return captureScreenshot();
    await execute({ type: selected as "hard-reload" | "devtools" });
  };

  const changeBookmark = async (
    input: Bookmark & { operation?: "save" | "remove" },
  ) => {
    const result = await api.commands.execute<{ bookmarks?: Bookmark[] }>(
      "modera.browser.bookmark",
      input,
    );
    if (result.bookmarks) setBookmarks(result.bookmarks);
    return result.bookmarks ?? [];
  };
  const savedBookmark = bookmarks.find((item) => item.url === state.url);
  const editBookmark = async (item?: Bookmark) => {
    if (bookmarkOpening.current || editingBookmark) return;
    bookmarkOpening.current = true;
    const generation = ++bookmarkGeneration.current;
    try {
      const previous = item ?? savedBookmark;
      let target = previous;
      if (!target) {
        const favicon = state.tabs?.find(
          (tab) => tab.id === state.activeTab,
        )?.favicon;
        const list = await changeBookmark({
          url: state.url,
          title: state.title || state.url,
          ...(favicon ? { favicon } : {}),
        });
        target = list.find((row) => row.url === state.url);
      }
      if (
        !target ||
        !latest.current.active ||
        generation !== bookmarkGeneration.current
      )
        return;
      dismiss();
      if (
        !latest.current.active ||
        generation !== bookmarkGeneration.current ||
        latest.current.state.activeTab !== state.activeTab
      )
        return;
      setEditingBookmark({ item: target, added: !previous });
    } finally {
      bookmarkOpening.current = false;
    }
  };
  const bookmarkContext = async (node: BookmarkNode, x: number, y: number) => {
    const selected = await popup(
      node.children
        ? [
            { id: "all", label: text.openAll },
            { id: "separator", label: "", separator: true },
            { id: "manage", label: text.manageBookmarks },
          ]
        : [
            { id: "open", label: text.open },
            { id: "new", label: text.openNew },
            { id: "separator", label: "", separator: true },
            { id: "edit", label: text.bookmarkEdit },
            { id: "remove", label: text.remove },
          ],
      x,
      y,
    );
    if (selected === "manage") return api.openSettings("bookmarks");
    if (selected === "all") {
      const visit = async (nodes: BookmarkNode[]) => {
        for (const entry of nodes) {
          if (!latest.current.active) return;
          if (entry.children) await visit(entry.children);
          else if (entry.url)
            await api.commands.execute("modera.browser.open", {
              url: entry.url,
            });
        }
      };
      return visit(node.children ?? []);
    }
    if (!node.url) return;
    const item = { ...node, url: node.url };
    if (selected === "open") command({ type: "navigate", url: node.url });
    if (selected === "new")
      await api.commands.execute("modera.browser.open", { url: node.url });
    if (selected === "edit") await editBookmark(item);
    if (selected === "remove")
      await changeBookmark({ ...item, operation: "remove" });
  };
  const tree = useMemo(() => bookmarkTree(bookmarks), [bookmarks]);
  const bookmarkOverflow = useBookmarkOverflow(tree);
  const button = (
    label: string,
    Icon: typeof Globe,
    onClick: () => void,
    disabled = false,
  ) => (
    <Tooltip content={label} side="top">
      <CapsuleButton
        type="button"
        aria-label={label}
        disabled={disabled}
        onClick={onClick}
      >
        <Icon size={16} />
      </CapsuleButton>
    </Tooltip>
  );
  const pageError = state.error && state.error !== "popup-blocked";
  return (
    <div className="browser-panel" ref={root}>
      {state.multipleTabs !== false && (
        <nav className="browser-tabs" role="tablist" aria-label={text.multiple}>
          {(state.tabs ?? []).map((tab) => (
            <div
              className={
                "browser-tab" + (tab.id === state.activeTab ? " selected" : "")
              }
              key={tab.id}
            >
              <Tooltip content={tab.url || text.blank} side="top">
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab.id === state.activeTab}
                  onClick={() => command({ type: "tab-select", id: tab.id })}
                >
                  <TabIcon key={tab.favicon} src={tab.favicon} />
                  <span>
                    {tab.title ||
                      (tab.url ? new URL(tab.url).hostname : text.blank)}
                  </span>
                </button>
              </Tooltip>
              {button(text.close, X, () =>
                command({ type: "tab-close", id: tab.id }),
              )}
            </div>
          ))}
          {button(text.blank, Plus, () => command({ type: "tab-create" }))}
        </nav>
      )}
      <form
        className="browser-toolbar"
        onSubmit={(event) => {
          event.preventDefault();
          navigateAddress(address);
        }}
      >
        <CapsuleGroup className="browser-toolbar-group browser-navigation">
          {button(
            text.back,
            ArrowLeft,
            () => command({ type: "back" }),
            !state.canGoBack,
          )}
          {button(
            text.forward,
            ArrowRight,
            () => command({ type: "forward" }),
            !state.canGoForward,
          )}
          <span className="browser-toolbar-divider" aria-hidden="true" />
          <Tooltip content={state.loading ? text.stop : text.reload} side="top">
            <CapsuleButton
              type="button"
              className={"browser-reload" + (state.loading ? " loading" : "")}
              aria-label={state.loading ? text.stop : text.reload}
              onClick={() =>
                command({ type: state.loading ? "stop" : "reload" })
              }
            >
              <RefreshCw className="browser-reload-icon" size={18} />
              {state.loading && <X className="browser-stop-icon" size={18} />}
            </CapsuleButton>
          </Tooltip>
        </CapsuleGroup>
        <Tooltip
          content={
            state.annotations?.selecting
              ? text.annotationElementHint
              : text.annotate
          }
          side="top"
        >
          <CapsuleButton
            type="button"
            className="browser-annotate-toggle"
            aria-label={text.annotate}
            aria-pressed={!!state.annotations?.selecting}
            disabled={!/^https?:/.test(state.url)}
            onClick={() =>
              command(
                state.annotations?.selecting
                  ? { type: "annotation-cancel" }
                  : { type: "annotation-start", mode: "element" },
              )
            }
          >
            <MousePointer2 size={16} />
          </CapsuleButton>
        </Tooltip>
        <div className="browser-address">
          <Globe size={16} />
          <Input
            ref={addressInput}
            className="browser-address-input"
            label={text.address}
            hideLabel
            value={address}
            placeholder={text.address}
            spellCheck={false}
            suggestions={active ? addressSuggestions.suggestions : undefined}
            filterSuggestions={false}
            inlineCompletion
            onSuggestionsOpenChange={addressSuggestions.setOpen}
            onSuggestionQueryChange={addressSuggestions.setQuery}
            onSuggestionSelect={navigateAddress}
            onFocus={(event) => {
              addressFocused.current = true;
              event.currentTarget.select();
            }}
            onBlur={() => {
              addressFocused.current = false;
            }}
            onChange={setAddress}
          />
          <Tooltip content={text.go} side="top">
            <button type="submit" className="browser-go" aria-label={text.go}>
              <ArrowRight size={18} />
            </button>
          </Tooltip>
        </div>
        <CapsuleGroup className="browser-toolbar-group browser-actions">
          <ExtensionsMenu
            extensions={state.extensions ?? []}
            available={state.extensionsAvailable !== false}
            text={text}
            execute={execute}
            fail={report}
            confirmRemove={(extension) =>
              api.dialog.confirm({
                title: text.extensionRemoveTitle,
                content: extension.name,
                confirmText: text.remove,
                tone: "danger",
              })
            }
            onManage={() => {
              command({ type: "annotation-cancel" });
              setExtensionsOpen(true);
            }}
            onVisitStore={() => {
              setExtensionsOpen(false);
              command({
                type: "navigate",
                url: "https://chromewebstore.google.com/",
              });
            }}
            onOpenChange={(open) => {
              if (open) command({ type: "extension-list" });
            }}
          />
          {button(
            text.screenshot,
            Camera,
            () => {
              void captureScreenshot().catch(report);
            },
            !/^https?:/.test(state.url),
          )}
          {button(
            text.external,
            ExternalLink,
            () => command({ type: "external" }),
            !/^https?:/.test(state.url),
          )}
          {state.multipleTabs === false &&
            button(text.blank, Plus, () => {
              void api.commands
                .execute("modera.browser.new-tab", {})
                .catch(fail);
            })}
          <Tooltip
            content={savedBookmark ? text.bookmarkEdit : text.bookmark}
            side="top"
          >
            <CapsuleButton
              type="button"
              aria-label={savedBookmark ? text.bookmarkEdit : text.bookmark}
              aria-pressed={!!savedBookmark}
              className="browser-bookmark-toggle"
              disabled={!/^https?:/.test(state.url)}
              onClick={() => void editBookmark().catch(fail)}
            >
              <Star size={18} weight={savedBookmark ? "fill" : "regular"} />
            </CapsuleButton>
          </Tooltip>
          <Tooltip content={text.menu} side="top">
            <CapsuleButton
              type="button"
              aria-label={text.menu}
              onClick={(event) => {
                void showMenu(event.currentTarget).catch(fail);
              }}
            >
              <MoreHorizontal size={18} />
            </CapsuleButton>
          </Tooltip>
        </CapsuleGroup>
      </form>
      {!!tree.length && (
        <nav
          ref={bookmarkOverflow.bar}
          className="browser-bookmarks"
          aria-label={text.bookmarks}
        >
          {tree.map((node, index) => (
            <Tooltip key={index} content={node.title} side="top">
              <button
                type="button"
                data-bookmark-item
                data-overflow={index >= bookmarkOverflow.visible || undefined}
                inert={index >= bookmarkOverflow.visible}
                aria-hidden={index >= bookmarkOverflow.visible || undefined}
                onContextMenu={(event) => {
                  event.preventDefault();
                  void bookmarkContext(
                    node,
                    event.clientX,
                    event.clientY,
                  ).catch(fail);
                }}
                onClick={(event) => {
                  if (node.children)
                    void openFolder(node.children, event.currentTarget).catch(
                      fail,
                    );
                  else if (node.url)
                    command({ type: "navigate", url: node.url });
                }}
              >
                {node.children ? (
                  <Folder size={14} />
                ) : (
                  <TabIcon
                    key={node.favicon ?? node.url}
                    src={bookmarkIcon(node, state.tabs)}
                  />
                )}
                <span>{node.title}</span>
              </button>
            </Tooltip>
          ))}
          <Tooltip content={text.moreBookmarks} side="top">
            <button
              type="button"
              className="browser-bookmarks-more"
              aria-label={text.moreBookmarks}
              aria-haspopup="menu"
              data-empty={bookmarkOverflow.visible >= tree.length || undefined}
              inert={bookmarkOverflow.visible >= tree.length}
              aria-hidden={bookmarkOverflow.visible >= tree.length || undefined}
              onClick={(event) => {
                void openFolder(
                  tree.slice(bookmarkOverflow.visible),
                  event.currentTarget,
                ).catch(fail);
              }}
            >
              <ChevronsRight size={16} />
            </button>
          </Tooltip>
        </nav>
      )}
      {deviceOpen && (
        <DeviceToolbar
          text={text}
          value={device}
          change={setDevice}
          close={() => setDeviceOpen(false)}
        />
      )}
      <div
        className="browser-viewport"
        style={
          deviceOpen
            ? {
                width: Math.min(device.width * device.scale, 8000),
                maxWidth: "100%",
                height: device.height * device.scale,
                maxHeight: "100%",
                flex: "0 1 auto",
                alignSelf: "center",
              }
            : undefined
        }
        ref={viewport}
      >
        {extensionsOpen && (
          <ExtensionManager
            extensions={state.extensions ?? []}
            available={state.extensionsAvailable !== false}
            text={text}
            execute={execute}
            fail={report}
            confirmRemove={(extension) =>
              api.dialog.confirm({
                title: text.extensionRemoveTitle,
                content: extension.name,
                confirmText: text.remove,
                tone: "danger",
              })
            }
            close={() => setExtensionsOpen(false)}
            onVisitStore={() => {
              setExtensionsOpen(false);
              command({
                type: "navigate",
                url: "https://chromewebstore.google.com/",
              });
            }}
          />
        )}
        {!extensionsOpen && pageError && (
          <BrowserErrorPage
            error={state.error}
            url={state.url}
            text={text}
            retry={() => command({ type: "reload" })}
          />
        )}
        {!extensionsOpen && !pageError && !state.url && (
          <div className="browser-empty">
            <Globe size={44} />
            <h1>{text.empty}</h1>
            <p>{text.hint}</p>
          </div>
        )}
      </div>
      {active && state.annotations?.selection && (
        <AnnotationEditor
          key={state.annotations.selection.token}
          selection={state.annotations.selection}
          viewport={viewport.current}
          text={text}
          fail={report}
          cancel={() => command({ type: "annotation-dismiss" })}
          remove={() => {
            if (state.annotations?.selection?.commentId)
              command({
                type: "annotation-remove",
                id: state.annotations.selection.commentId,
              });
          }}
          submit={async (comment) => {
            await execute({
              type: "annotation-submit",
              token: state.annotations!.selection!.token,
              comment,
            });
          }}
        />
      )}
      {dataDialog === "import" && (
        <BrowserImportDialog
          locale={snapshot.locale}
          invoke={invokeData}
          close={() => {
            setDataDialog(null);
          }}
          fail={report}
          notify={() => {
            void api.toast.show({ level: "success", text: text.imported });
          }}
        />
      )}
      {dataDialog === "clear" && (
        <ClearDataDialog
          text={text}
          close={() => {
            setDataDialog(null);
          }}
          fail={report}
          clear={async (value) => {
            await execute({
              type: "clear-data",
              cookies: value.cookies,
              cache: value.cache,
              downloads: value.downloads,
            });
            if (value.history)
              await invokeData("clearHistoryRange", { since: value.since });
            await api.toast.show({ level: "success", text: text.cleared });
          }}
        />
      )}
      {editingBookmark && (
        <BookmarkEditor
          item={editingBookmark.item}
          added={editingBookmark.added}
          folders={[
            ...new Set(
              bookmarks
                .map((item) => item.folder)
                .filter((folder): folder is string => !!folder),
            ),
          ]}
          text={text}
          close={closeBookmark}
          fail={fail}
          save={async (item) => {
            await changeBookmark({ ...item, operation: "save" });
          }}
          remove={async () => {
            await changeBookmark({
              ...editingBookmark.item,
              operation: "remove",
            });
          }}
        />
      )}
    </div>
  );
}
