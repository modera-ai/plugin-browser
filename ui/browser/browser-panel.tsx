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
import { CaretDoubleRightIcon as ChevronsRight } from "@phosphor-icons/react/dist/csr/CaretDoubleRight";
import type { PanelMenuRequest, WebPreviewCommand } from "@pal/contracts";
import {
  bookmarkTree,
  type Bookmark,
  type BookmarkNode,
  type BrowserProps,
} from "./types";
import { messages } from "./messages";
import { useBrowser } from "./use-browser";
import { BookmarkEditor } from "./bookmark-editor";
import { useBookmarkOverflow } from "./use-bookmark-overflow";
type MenuItem = PanelMenuRequest["items"][number];
const preference = "pal.browser.multiple-tabs";

function TabIcon({ src }: { src?: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  return src && !failed ? (
    <img
      className="browser-favicon"
      src={src}
      alt=""
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  ) : (
    <Globe size={16} />
  );
}
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
    viewport = useRef<HTMLDivElement>(null),
    findInput = useRef<HTMLInputElement>(null);
  const [address, setAddress] = useState("");
  const addressFocused = useRef(false);
  const [find, setFind] = useState(false),
    [mobile, setMobile] = useState(false);
  const [bookmarks, setBookmarks] = useState(initial?.bookmarks ?? []);
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
  const [modal, setModal] = useState(false);
  const [pageBackdrop, setPageBackdrop] = useState<string>();
  const bookmarkOpening = useRef(false);
  const bookmarkGeneration = useRef(0);
  const [editingBookmark, setEditingBookmark] = useState<{
    item: Bookmark;
    added: boolean;
  } | null>(null);
  const closeBookmark = () => {
    bookmarkGeneration.current++;
    setEditingBookmark(null);
    setModal(false);
  };
  useEffect(() => {
    if (!active) {
      bookmarkGeneration.current++;
      setPageBackdrop(undefined);
      setEditingBookmark(null);
      setModal(false);
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
  const latest = useRef({ state, active, modal });
  latest.current = { state, active, modal };
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
            !value.modal &&
            !!value.state.url &&
            value.state.error !== "page-crashed" &&
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
    let cancelled = false;
    void layout()
      .then(() => {
        if (!cancelled && !modal) setPageBackdrop(undefined);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [
    state.url,
    state.activeTab,
    state.multipleTabs,
    active,
    modal,
    mobile,
    find,
    bookmarks.length,
    layout,
  ]);
  useEffect(() => {
    if (!addressFocused.current) setAddress(state.url);
  }, [state.url, state.activeTab]);
  const lastVisit = useRef("");
  useEffect(() => {
    if (!active || state.loading || state.error || !/^https?:/.test(state.url))
      return;
    const key = state.url + state.title;
    if (key === lastVisit.current) return;
    lastVisit.current = key;
    void api.commands
      .execute("modera.browser.visit", {
        url: state.url,
        title: state.title || state.url,
      })
      .catch(() => {});
  }, [state.url, state.title, state.loading, state.error, active, api]);
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
      const tokens: Record<string, string> = {};
      const styles = root.current && getComputedStyle(root.current);
      if (styles)
        for (
          let i = 0;
          i < styles.length && Object.keys(tokens).length < 256;
          i++
        ) {
          const key = styles[i]!,
            value = styles.getPropertyValue(key);
          if (key.startsWith("--mu-") && value.length <= 500)
            tokens[key] = value;
        }
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
  const showMenu = async (anchor: HTMLElement) => {
    const rect = anchor.getBoundingClientRect();
    const checks = (checked: boolean, label: string) =>
      checked ? "✓ " + label : label;
    let zoom = state.zoomFactor ?? 1;
    const hasPage = !!state.url;
    const items = (): MenuItem[] => [
      { id: "find", label: text.find, disabled: !hasPage },
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
          { id: "desktop", label: checks(!mobile, text.desktop) },
          { id: "mobile", label: checks(mobile, text.mobile) },
        ],
      },
      { id: "screenshot", label: text.screenshot, disabled: !hasPage },
      { id: "group-data", label: "", separator: true },
      { id: "settings:import", label: text.import },
      { id: "settings:bookmarks", label: text.bookmarks },
      { id: "settings:passwords", label: text.passwords },
      { id: "settings:history", label: text.history },
      {
        id: "clear",
        label: text.clearData,
        children: [
          { id: "clear-cache", label: text.clearCache },
          { id: "clear-cookies", label: text.clearCookies },
        ],
      },
      {
        id: "tools",
        label: text.tools,
        children: [
          { id: "hard-reload", label: text.hardReload, disabled: !hasPage },
          { id: "devtools", label: text.devtools, disabled: !hasPage },
          { id: "settings:cookies", label: text.cookies },
        ],
      },
      { id: "group-settings", label: "", separator: true },
      {
        id: "multiple",
        label: checks(state.multipleTabs !== false, text.multiple),
      },
      { id: "settings:settings", label: text.settings },
    ];
    const selected = await popup(
      items(),
      rect.right - 320,
      rect.bottom,
      { variant: "dropdown", width: 320 },
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
    if (selected === "multiple") return toggleTabs();
    if (selected.startsWith("settings:"))
      return api.openSettings(
        selected === "settings:settings" ? "" : selected.slice(9),
      );
    if (selected === "mobile" || selected === "desktop") {
      setMobile(selected === "mobile");
      return;
    }
    if (selected === "find") {
      setFind(true);
      requestAnimationFrame(() => findInput.current?.focus());
      return;
    }
    if (selected === "clear-cache" || selected === "clear-cookies") {
      setModal(true);
      await layout(false);
      try {
        if (
          await api.dialog.confirm({
            title: text.clearTitle,
            content: text.clearHint,
          })
        )
          await execute({ type: selected });
      } finally {
        setModal(false);
      }
      return;
    }
    await execute({
      type: selected as "screenshot" | "hard-reload" | "devtools",
    });
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
      // Native views render above DOM dialogs. Keep a transient backdrop while the
      // same live page is occluded; never reload or replace the browser tab.
      const backdrop = state.url
        ? await api.webPreview.capture().catch(() => undefined)
        : undefined;
      if (
        !latest.current.active ||
        generation !== bookmarkGeneration.current ||
        latest.current.state.activeTab !== state.activeTab
      )
        return;
      setPageBackdrop(backdrop);
      setModal(true);
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
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
    >
      <Icon size={18} />
    </button>
  );
  const status = state.error
    ? state.error === "timeout"
      ? text.timeout
      : state.error === "page-crashed"
        ? text.crashed
        : state.error.includes("blocked")
          ? text.blocked
          : text.loadFailed
    : state.loading
      ? text.loading
      : "";
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
              <button
                type="button"
                role="tab"
                aria-selected={tab.id === state.activeTab}
                title={tab.url || text.blank}
                onClick={() => command({ type: "tab-select", id: tab.id })}
              >
                <TabIcon key={tab.favicon} src={tab.favicon} />
                <span>
                  {tab.title ||
                    (tab.url ? new URL(tab.url).hostname : text.blank)}
                </span>
              </button>
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
          const value = address.trim();
          if (value)
            command({
              type: "navigate",
              url: /^[a-z][a-z\d+.-]*:/i.test(value)
                ? value
                : "https://" + value,
            });
          addressFocused.current = false;
        }}
      >
        <div className="browser-toolbar-group browser-navigation">
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
          <button
            type="button"
            className={"browser-reload" + (state.loading ? " loading" : "")}
            title={state.loading ? text.stop : text.reload}
            aria-label={state.loading ? text.stop : text.reload}
            onClick={() => command({ type: state.loading ? "stop" : "reload" })}
          >
            <RefreshCw className="browser-reload-icon" size={18} />
            {state.loading && <X className="browser-stop-icon" size={18} />}
          </button>
        </div>
        <div className="browser-address">
          <Globe size={16} />
          <input
            value={address}
            placeholder={text.address}
            aria-label={text.address}
            spellCheck={false}
            onFocus={() => {
              addressFocused.current = true;
            }}
            onBlur={() => {
              addressFocused.current = false;
            }}
            onChange={(event) => setAddress(event.target.value)}
          />
          <button
            type="submit"
            className="browser-go"
            title={text.go}
            aria-label={text.go}
          >
            <ArrowRight size={18} />
          </button>
        </div>
        <div className="browser-toolbar-group browser-actions">
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
          <button
            type="button"
            title={savedBookmark ? text.bookmarkEdit : text.bookmark}
            aria-label={savedBookmark ? text.bookmarkEdit : text.bookmark}
            aria-pressed={!!savedBookmark}
            className="browser-bookmark-toggle"
            disabled={!/^https?:/.test(state.url)}
            onClick={() => void editBookmark().catch(fail)}
          >
            <Star size={18} weight={savedBookmark ? "fill" : "regular"} />
          </button>
          <button
            type="button"
            title={text.menu}
            aria-label={text.menu}
            onClick={(event) => {
              void showMenu(event.currentTarget).catch(fail);
            }}
          >
            <MoreHorizontal size={18} />
          </button>
        </div>
      </form>
      {!!tree.length && (
        <nav
          ref={bookmarkOverflow.bar}
          className="browser-bookmarks"
          aria-label={text.bookmarks}
        >
          {tree.map((node, index) => (
            <button
              type="button"
              key={index}
              title={node.title}
              data-bookmark-item
              data-overflow={index >= bookmarkOverflow.visible || undefined}
              inert={index >= bookmarkOverflow.visible}
              aria-hidden={index >= bookmarkOverflow.visible || undefined}
              onContextMenu={(event) => {
                event.preventDefault();
                void bookmarkContext(node, event.clientX, event.clientY).catch(
                  fail,
                );
              }}
              onClick={(event) => {
                if (node.children)
                  void openFolder(node.children, event.currentTarget).catch(
                    fail,
                  );
                else if (node.url) command({ type: "navigate", url: node.url });
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
          ))}
          <button
            type="button"
            className="browser-bookmarks-more"
            title={text.moreBookmarks}
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
        </nav>
      )}
      {!!status && (
        <div className="browser-status" role="status">
          {status}
        </div>
      )}
      {find && (
        <div className="browser-find">
          <Search size={16} />
          <input
            ref={findInput}
            placeholder={text.find}
            aria-label={text.find}
            onChange={(event) =>
              command({ type: "find", text: event.target.value })
            }
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                setFind(false);
                command({ type: "find", text: "" });
              }
            }}
          />
          {button(text.close, X, () => {
            setFind(false);
            command({ type: "find", text: "" });
          })}
        </div>
      )}
      <div
        className={"browser-viewport" + (mobile ? " mobile" : "")}
        ref={viewport}
      >
        {pageBackdrop && (
          <img
            className="browser-page-backdrop"
            src={pageBackdrop}
            alt=""
            aria-hidden="true"
          />
        )}
        {!state.url && (
          <div className="browser-empty">
            <Globe size={44} />
            <h1>{text.empty}</h1>
            <p>{text.hint}</p>
          </div>
        )}
      </div>
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
