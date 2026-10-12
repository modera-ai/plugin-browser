import { createRequire } from "node:module";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, extname } from "node:path";
const require = createRequire(resolve("../../modera/modera-ui-site/package.json"));
const { chromium, expect } = require("@playwright/test");
const server = createServer(async (req, res) => {
  try { const file = resolve("dist/ui", req.url === "/" ? "index.html" : req.url.slice(1)); res.setHeader("Content-Type", ({".js":"text/javascript", ".css":"text/css", ".html":"text/html"})[extname(file)] || "application/octet-stream"); res.end(await readFile(file)); } catch { res.writeHead(404); res.end(); }
});
await new Promise(done => server.listen(0, "127.0.0.1", done));
const browser = await chromium.launch({headless:true, channel:"msedge"});
try {
  const page = await browser.newPage({viewport:{width:1100,height:850}});
  const errors = []; page.on("pageerror", e => (errors.push(e.message), console.error(e.message)));
  await page.addInitScript(() => {
    window.commands = []; window.layouts = [];
    window.moderaPlugin = { snapshot: async () => ({locale:"zh-CN", view:{data:{bookmarks:[]}}}), action:async()=>({}), onChanged:()=>{}, openSettings:async()=>{}, openPanel:async()=>{}, webPreview:{onChanged:fn=>{window.paint=fn}, command:async cmd=>{window.commands.push(cmd);return {url:"https://example.com",canGoBack:true,canGoForward:false}}, layout:async bounds=>window.layouts.push(bounds), capture:async()=>""} };
  });
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await expect(page.locator("#reload svg")).toBeVisible();
  for (let i=0;i<3;i++) {
    await page.waitForTimeout(200); await page.locator("#menu-button").click();
    await expect(page.locator(".mu-menu-popover #browser-menu")).toBeVisible();
    await expect(page.getByRole("menuitem",{name:"浏览器设置",exact:true})).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator("#browser-menu")).toBeHidden();
  }
  await page.waitForTimeout(200); await page.locator("#menu-button").click();
  await page.getByRole("menuitem",{name:"放大",exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>window.commands.at(-1))).toEqual({type:"zoom",factor:1.1});
  await page.evaluate(()=>window.paint({url:"https://example.com",loading:true}));
  await page.locator("#reload").click();
  await expect.poll(()=>page.evaluate(()=>window.commands.at(-1).type)).toBe("stop");
  if(errors.length) throw Error(errors.join("\n"));
  console.log("Browser menu: repeated open/Escape, zoom, SVG icons and stop loading passed");
} finally { await browser.close(); server.close(); }
