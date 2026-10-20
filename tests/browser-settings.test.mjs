import { createRequire } from "node:module";
import { createServer } from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { resolve, extname } from "node:path";
const require = createRequire(
  resolve("../../modera/modera-ui-site/package.json"),
);
const { chromium, expect } = require("@playwright/test");
const server = createServer(async (req, res) => {
  try {
    const file = resolve(
      "dist/ui",
      req.url === "/" ? "settings.html" : req.url.slice(1),
    );
    res.setHeader(
      "Content-Type",
      { ".js": "text/javascript", ".css": "text/css", ".html": "text/html" }[
        extname(file)
      ] || "application/octet-stream",
    );
    res.end(await readFile(file));
  } catch {
    res.writeHead(404);
    res.end();
  }
});
await new Promise((done) => server.listen(0, "127.0.0.1", done));
const browser = await chromium.launch({ headless: true, channel: "msedge" });
const output = resolve("../../output/browser-settings-ui/verification");
await mkdir(output, { recursive: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1060, height: 800 },
  });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    window.failLoad = false;
    window.totalRows = 3;
    window.notifications = [];
    let listener;
    window.changeTheme = (mode) => listener?.({ mode });
    window.palPlugin = {
      ready: async () => {},
      snapshot: async () => ({
        locale: "zh-CN",
        theme: { mode: "light" },
        view: { data: { config: { revision: 1, values: { startPage: "" } } } },
      }),
      onChanged: () => () => {},
      onThemeChanged: (fn) => {
        listener = fn;
        return () => {};
      },
      toast: {
        show: async (value) => {
          window.notifications.push(value);
        },
      },
      settings: {
        pickFile: async () => "fixture.json",
        action: async (_, raw) => {
          const { operation, value: v } = JSON.parse(raw);
          if (operation === "dataSummary") {
            await new Promise((done) => setTimeout(done, 80));
            if (window.failLoad) throw Error("fixture unavailable");
            let items = Array.from({ length: window.totalRows }, (_, i) => ({
              id: String(i),
              title: i === 0 ? "开发参考" : `阅读资料 ${i}`,
              url: `https://example.com/docs/${i}`,
              folder: i === 0 ? "Work/Project" : "Work",
            }));
            items = items.filter(
              (item) =>
                (v.folder === undefined ||
                  item.folder === v.folder ||
                  item.folder.startsWith(v.folder + "/")) &&
                (!v.query || item.title.includes(v.query)),
            );
            return {
              bookmarks: items.slice(
                (v.page || 0) * 50,
                (v.page || 0) * 50 + 50,
              ),
              passwords: [
                { id: "p1", origin: "https://example.com", username: "reader" },
              ],
              folders: ["Work", "Work/Project"],
              bookmarkCount: items.length,
              passwordCount: 1,
              cookieCount: 4,
              filteredBookmarkCount: items.length,
              filteredPasswordCount: 1,
            };
          }
          if (operation === "history")
            return {
              items: [
                {
                  id: "h1",
                  title: "历史页面",
                  url: "https://example.com/history",
                  visitedAt: Date.now(),
                },
              ],
              total: 1,
            };
          if (operation === "revealPassword") return "fixture-password";
          if (operation === "removeSelected") {
            window.totalRows -= v.ids.length;
            return {};
          }
          if (operation.startsWith("import"))
            return { imported: 2, skipped: 1 };
          return {};
        },
      },
    };
  });
  const navigate = (kind) =>
    page.evaluate((kind) => {
      window.location.hash = kind;
    }, kind);
  await page.goto(`http://127.0.0.1:${server.address().port}/#bookmarks`);
  await expect(page.getByRole("table")).toBeVisible();
  await expect(page.locator("file-tree-container")).toBeVisible();
  await page.screenshot({ path: `${output}/bookmarks-light.png` });
  await page.getByRole("treeitem", { name: "Project", exact: true }).click({ button: "right" });
  await page.getByRole("menuitem", { name: "重命名文件夹", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "重命名文件夹" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "文件夹名称" })).toHaveValue("Work/Project");
  await page.getByRole("button", { name: "取消", exact: true }).click();
  await expect(page.getByText("1–1 / 1", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "全部书签", exact: true }).click();
  await expect(page.getByText("1–3 / 3", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "添加", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "添加书签" })).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "标题", exact: true }),
  ).toBeFocused();
  await page.screenshot({ path: `${output}/bookmark-editor-light.png` });
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page
    .getByRole("checkbox", { name: "选择 开发参考", exact: true })
    .check();
  await expect(
    page.getByRole("checkbox", { name: "选择本页" }),
  ).toHaveJSProperty("indeterminate", true);
  await page.getByRole("button", { name: "删除所选" }).click();
  await expect(
    page.getByRole("dialog", { name: "删除所选 1 条记录？" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "取消", exact: true }).click();
  await page.getByRole("searchbox").fill("no-match");
  await page.getByRole("searchbox").press("Enter");
  await expect(page.getByText("没有匹配记录", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "清除搜索", exact: true })
    .first()
    .click();
  await expect(page.getByRole("table")).toBeVisible();
  await page.evaluate(() => {
    window.totalRows = 51;
  });
  await page.getByRole("button", { name: "搜索", exact: true }).click();
  await expect(page.getByText("1–50 / 51", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "下一页" }).click();
  await expect(page.getByText("51–51 / 51", { exact: true })).toBeVisible();
  await page.getByRole("checkbox", { name: "选择本页" }).check();
  await page.getByRole("button", { name: "删除所选" }).click();
  await page.getByRole("button", { name: "确认删除" }).click();
  await expect(page.getByText("1–50 / 50", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "下一页" })).toBeDisabled();
  await navigate("passwords");
  await expect(page.getByRole("searchbox")).toHaveValue("");
  await page.evaluate(() => window.changeTheme("dark"));
  await expect(page.locator(".browser-settings-ui")).toHaveAttribute(
    "data-theme",
    "dark",
  );
  await expect(page.locator(".browser-settings-ui")).not.toHaveCSS(
    "background-color",
    "rgb(255, 255, 255)",
  );
  await page.getByRole("button", { name: "查看密码" }).click();
  await expect(
    page.getByText("fixture-password", { exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: `${output}/passwords-dark.png` });
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await expect(page.getByText("fixture-password", { exact: true })).toHaveCount(
    0,
  );
  await page.getByRole("button", { name: "导入 CSV" }).click();
  await expect
    .poll(() => page.evaluate(() => window.notifications.at(-1)?.text))
    .toContain("已导入 2 条");
  await navigate("history");
  await expect(page.getByText("历史页面", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "清除历史", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "清除全部浏览历史？" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await navigate("cookies");
  await expect(
    page.getByRole("heading", { name: "导入 Cookie" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "选择文件并导入" }).click();
  await expect
    .poll(() => page.evaluate(() => window.notifications.at(-1)?.text))
    .toContain("已导入 2 条");
  await page.evaluate(() => {
    window.failLoad = true;
    window.location.hash = "bookmarks";
  });
  await expect(page.getByText("无法加载记录", { exact: true })).toBeVisible();
  await page.evaluate(() => {
    window.failLoad = false;
    window.totalRows = 3;
  });
  await page.getByRole("button", { name: "重试", exact: true }).click();
  await expect(page.getByRole("table")).toBeVisible();
  await page.setViewportSize({ width: 480, height: 800 });
  await page.screenshot({ path: `${output}/bookmarks-narrow-dark.png` });
  if (errors.length) throw Error(errors.join("\n"));
  console.log(
    "PASS: browser settings dialogs, partial selection, search, pagination/deletion, route reset, theme, password hiding, imports and retry.",
  );
} finally {
  await browser.close();
  server.close();
}
