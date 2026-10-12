// @ts-nocheck -- legacy DOM controller, bundled alongside the typed tooltip adapter.
import { setTooltip } from './components/tooltips';
import { createBrowserMenu, createMenuItem, setIcon } from './components/browser-menu';
async function boot() {
const api = window.moderaPlugin;
const $ = (id) => document.getElementById(id);
for (const [id, icon] of Object.entries({back:"ArrowLeft",forward:"ArrowRight",reload:"RefreshCw",external:"ExternalLink",new:"Plus",go:"CornerDownLeft",bookmark:"Star","menu-button":"MoreHorizontal","find-close":"X"})) setIcon($(id), icon);
setIcon(document.querySelector(".address > span"), "Globe", 14);
setIcon(document.querySelector(".globe"), "Globe", 44);
const renderMenu = createBrowserMenu($("browser-menu"), () => void closeMenu());
// Mount before attaching legacy event handlers; subsequent updates retain the button.
for (const [id, text] of Object.entries({back:'Back',forward:'Forward',external:'Open externally',new:'New tab',go:'Go',reload:'Reload',bookmark:'Bookmark page','menu-button':'Browser menu'})) setTooltip($(id),text);
let state = { url: "", loading: false, error: "" };
let zh = false;
let menuOpen = false,
  lastVisit = "",
  bookmarkItems = [];
const label = (cn, en) => (zh ? cn : en);
const errors = {
  "popup-blocked": [
    "已阻止弹出窗口，请使用链接或地址栏打开页面。",
    "Popup blocked. Use a link or the address bar.",
  ],
  "navigation-blocked": [
    "仅支持 HTTP / HTTPS 网页。",
    "Only HTTP / HTTPS pages are supported.",
  ],
  "load-failed": [
    "网页加载失败，请检查地址或网络后重试。",
    "Page failed to load. Check the address or connection.",
  ],
  timeout: [
    "加载超时，可以点击刷新重试。",
    "Loading timed out. Reload to retry.",
  ],
  "page-crashed": [
    "网页进程已退出，可以点击刷新重试。",
    "Page process exited. Reload to retry.",
  ],
};
function paint(next) {
  state = next;
  $("empty").style.display = next.url ? "none" : "flex";
  if (
    !next.loading &&
    !next.error &&
    /^https?:/.test(next.url) &&
    lastVisit !== next.url + next.title
  ) {
    lastVisit = next.url + next.title;
    void api
      .action("visit", JSON.stringify({ url: next.url, title: next.title }))
      .catch(() => {});
  }

  if (document.activeElement !== $("url") && next.url)
    $("url").value = next.url;
  $("back").disabled = !next.canGoBack;
  $("forward").disabled = !next.canGoForward;
  $("external").disabled = !/^https?:/.test(next.url);
  setIcon($("reload"), next.loading ? "X" : "RefreshCw");
  setTooltip($("reload"), next.loading
    ? label("停止加载", "Stop loading")
    : label("刷新", "Reload"));
  const error = errors[next.error];
  $("status").className = next.error ? "error" : "";
  $("status").textContent = error
    ? error[zh ? 0 : 1]
    : next.error
      ? next.error
      : next.loading
        ? label("正在加载…", "Loading…")
        : "";
  void layout();
}
async function command(value) {
  try {
    paint(await api.webPreview.command(value));
  } catch {
    $("status").textContent = label(
      "操作失败，请检查网址或重新打开面板。",
      "Action failed. Check the URL or reopen the panel.",
    );
    $("status").className = "error";
  }
}
let lastBounds = "";
async function layout() {
  const box = $("viewport").getBoundingClientRect();
  const bounds = {
    x: Math.ceil(box.x),
    y: Math.ceil(box.y),
    width: Math.floor(box.width),
    height: Math.floor(box.height),
    visible: !!state.url && state.error !== "page-crashed" && !menuOpen,
  };
  const key = JSON.stringify(bounds);
  if (key === lastBounds) return;
  lastBounds = key;
  try {
    await api.webPreview.layout(bounds);
  } catch {
    lastBounds = "";
  }
}
$("toolbar").addEventListener("submit", (event) => {
  event.preventDefault();
  const value = $("url").value.trim();
  if (value)
    void command({
      type: "navigate",
      url: /^[a-z][a-z\d+.-]*:/i.test(value) ? value : `https://${value}`,
    });
});
for (const type of ["back", "forward", "external"])
  $(type).addEventListener("click", () => void command({ type }));
$("reload").addEventListener("click", () =>
  void command({ type: state.loading ? "stop" : "reload" }));
$("new").addEventListener("click", () => {
  void api
    .openPanel(
      "modera.browser.preview",
      JSON.stringify({ key: crypto.randomUUID(), url: "" }),
    )
    .catch(() => {
      $("status").textContent = label("无法打开面板", "Cannot open panel");
    });
});
const snapshot = await api.snapshot();
zh = snapshot.locale.startsWith("zh");
document.documentElement.lang = zh ? "zh-CN" : "en";
for (const [id, cn, en] of [
  ["back", "后退", "Back"],
  ["forward", "前进", "Forward"],
  ["external", "在系统浏览器打开", "Open externally"],
  ["new", "新标签页", "New tab"],
  ["go", "前往", "Go"],
]) {
  setTooltip($(id), label(cn, en));
  $(id).setAttribute("aria-label", label(cn, en));
}
$("url").placeholder = label("输入网址", "Enter a URL");
$("heading").textContent = label("在这里浏览网页", "Browse here");
$("hint").textContent = label(
  "输入网址，或点击对话中的链接。网页与对话、插件工具栏分别隔离。",
  "Enter a URL or click a conversation link. Pages are isolated from the chat and plugin toolbar.",
);
api.webPreview.onChanged(paint);
new ResizeObserver(() => void layout()).observe($("viewport"));
await command(
  snapshot.view.data?.url && !snapshot.view.data?.managed
    ? { type: "navigate", url: snapshot.view.data.url }
    : { type: "state" },
);

function showBookmarks(items) {
  bookmarkItems = items ?? [];
  const root = { children: [] };
  for (const item of bookmarkItems) {
    let node = root;
    for (const name of (item.folder ?? "").split("/").filter(Boolean)) {
      let child = node.children.find((x) => x.children && x.title === name);
      if (!child) {
        child = { title: name, children: [] };
        node.children.push(child);
      }
      node = child;
    }
    node.children.push(item);
  }
  const bar = $("bookmarks");
  bar.replaceChildren();
  const overflow = [];
  for (const item of root.children) {
    const button = document.createElement("button");
    button.textContent = (item.children ? "▱ " : "") + item.title;
    button.onclick = () =>
      item.children
        ? openItems(item.children, button, item.title)
        : command({ type: "navigate", url: item.url });
    bar.append(button);
    if (button.offsetLeft + button.offsetWidth > bar.clientWidth - 36) {
      button.remove();
      overflow.push(item);
    }
  }
  if (overflow.length) {
    const more = document.createElement("button");
    more.textContent = "»";
    more.className = "bookmark-more";
    more.setAttribute("aria-label", label("更多书签", "More bookmarks"));
    more.onclick = () =>
      openItems(overflow, more, label("更多书签", "More bookmarks"));
    bar.append(more);
  }
  void layout();
}
showBookmarks(snapshot.view.data?.bookmarks);
setTooltip($("bookmark"), label("收藏当前网页", "Bookmark page"));
$("bookmark").addEventListener("click", async () => {
  if (!/^https?:/.test(state.url)) return;
  try {
    const next = await api.action(
      "bookmark",
      JSON.stringify({ url: state.url, title: state.title || state.url }),
    );
    showBookmarks(
      next.view?.data?.bookmarks ?? (await api.snapshot()).view.data?.bookmarks,
    );
  } catch {
    $("status").textContent = label("收藏失败", "Bookmark failed");
  }
});
let refreshingBookmarks = false;
let bookmarksDirty = false;
api.onChanged(async () => {
  bookmarksDirty = true;
  if (refreshingBookmarks) return;
  refreshingBookmarks = true;
  try {
    while (bookmarksDirty) {
      bookmarksDirty = false;
      const next = await api.snapshot();
      showBookmarks(next.view.data?.bookmarks);
    }
  } catch {
    // Preserve the current page and bookmarks if a refresh is unavailable.
  } finally {
    refreshingBookmarks = false;
  }
});

async function closeMenu() {
  menuOpen = false;
  renderMenu(null);
  $("menu-button").setAttribute("aria-expanded", "false");
  await layout();
  $("viewport").style.backgroundImage = "";
}
async function presentMenu(anchor) {
  if (!menuOpen) {
    try {
      const image = await api.webPreview.capture();
      $("viewport").style.backgroundImage = `url("${image}")`;
    } catch {}
    menuOpen = true;
    await layout();
  }
  renderMenu(anchor);
  $("menu-button").setAttribute("aria-expanded", "true");
  $("browser-menu").querySelector("button,input")?.focus();
}
function menuItem(text, action) { return createMenuItem(text, action); }

async function openItems(items, anchor, title, back) {
  const menu = $("browser-menu");
  menu.replaceChildren();
  if (back) menu.append(menuItem("‹ " + label("返回", "Back"), back));
  const heading = document.createElement("strong");
  heading.textContent = title;
  menu.append(heading);
  for (const item of items) {
    menu.append(
      menuItem(
        (item.children ? "▱ " : "") + item.title + (item.children ? "  ›" : ""),
        async () => {
          if (item.children)
            void openItems(item.children, anchor, item.title, () =>
              openItems(items, anchor, title, back),
            );
          else {
            await closeMenu();
            await command({ type: "navigate", url: item.url });
          }
        },
      ),
    );
  }
  await presentMenu(anchor);
}
let zoom = 1;
async function browserMenu() {
  const menu = $("browser-menu");
  menu.replaceChildren();
  const open = (page) => async () => {
    await closeMenu();
    await api.openSettings(page);
  };
  for (const [cn, en, page] of [
    ["浏览器设置", "Browser settings", ""],
    ["导入浏览数据…", "Import browser data…", "import"],
    ["书签管理器", "Bookmarks", "bookmarks"],
    ["密码管理器", "Passwords", "passwords"],
    ["浏览历史", "History", "history"],
    ["Cookie 导入", "Import cookies", "cookies"],
  ])
    menu.append(menuItem(label(cn, en), open(page)));
  const line = document.createElement("div");
  line.className = "menu-zoom";
  const value = document.createElement("span");
  value.textContent = `${Math.round(zoom * 100)}%`;
  for (const [text, delta] of [
    ["−", -0.1],
    ["+", 0.1],
  ])
    line.append(
      menuItem(text, async () => {
        zoom = Math.min(3, Math.max(0.25, zoom + delta));
        await closeMenu();
        await command({ type: "zoom", factor: zoom });
      }),
    );
  for (const [index, icon] of ["Minus", "Plus"].entries()) {
    const button = line.querySelectorAll("button")[index];
    button.setAttribute("aria-label", label(index ? "放大" : "缩小", index ? "Zoom in" : "Zoom out"));
    setIcon(button, icon, 15);
  }
  line.prepend(value);
  menu.append(line);
  const action = (type) => async () => {
    await closeMenu();
    await command({ type });
  };
  menu.append(
    menuItem(
      label("显示尺寸：切换手机 / 默认", "Display: mobile / default"),
      async () => {
        await closeMenu();
        const view = $("viewport");
        view.classList.toggle("mobile");
        await layout();
      },
    ),
  );
  menu.append(
    menuItem(label("在页面中查找…", "Find in page…"), async () => {
      await closeMenu();
      $("findbar").hidden = false;
      $("find-text").focus();
      await layout();
    }),
  );
  for (const [cn, en, type] of [
    ["截图…", "Screenshot…", "screenshot"],
    ["强制重新加载", "Reload without cache", "hard-reload"],
    ["开发者工具", "Developer tools", "devtools"],
  ])
    menu.append(menuItem(label(cn, en), action(type)));
  for (const [cn, en, type] of [
    ["清除缓存", "Clear cache", "clear-cache"],
    ["清除 Cookie", "Clear cookies", "clear-cookies"],
  ])
    menu.append(
      menuItem(label(cn, en), () => {
        menu.replaceChildren();
        const text = document.createElement("p");
        text.textContent = label(
          "确认清除？清除 Cookie 会退出登录。",
          "Confirm clearing? Clearing cookies signs you out.",
        );
        menu.append(
          text,
          menuItem(label("确认清除", "Confirm"), action(type)),
          menuItem(label("取消", "Cancel"), closeMenu),
        );
      }),
    );
  await presentMenu($("menu-button"));
}
$("menu-button").addEventListener("click", () => (menuOpen ? closeMenu() : browserMenu()));
setTooltip($("menu-button"), label("浏览器菜单", "Browser menu"));
$("find-close").onclick = async () => {
  $("findbar").hidden = true;
  await command({ type: "find", text: "" });
  await layout();
};
$("find-text").oninput = () =>
  void command({ type: "find", text: $("find-text").value });
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") void closeMenu();
});
document.addEventListener("pointerdown", (e) => {
  if (
    menuOpen &&
    !$("browser-menu").contains(e.target) &&
    !$("bookmarks").contains(e.target) &&
    !$("menu-button").contains(e.target)
  )
    void closeMenu();
});
new ResizeObserver(() => {
  showBookmarks(bookmarkItems);
  if (menuOpen) void closeMenu();
}).observe($("bookmarks"));
}
void boot();
