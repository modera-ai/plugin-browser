import { useEffect, useState } from "react";
import { Button, Dialog, DialogNotice, Input, Select, Switch, UiProvider } from "@modera/ui";
import { Form, FormItem, SettingsPage, SettingsPanel } from "@modera/ui/settings";
import { DownloadIcon as Download } from "@phosphor-icons/react/dist/csr/Download";
import { GlobeIcon as Globe } from "@phosphor-icons/react/dist/csr/Globe";
import { ClockCounterClockwiseIcon as History } from "@phosphor-icons/react/dist/csr/ClockCounterClockwise";
import { frontend, settingsAction, useSettings } from "@modera/plugin-sdk/react";
import { BrowserManager, type ManagerKind } from "./manager-page";
import { type Summary } from "./settings-management";

type Source = { id: string; name: string; profile: string; account: string; passwords: number; cookies: number; bookmarks: number; note: string };

export function BrowserSettings() {
  const s = useSettings({ autoSave: true });
  const t = (zh: string, en: string) => s.zh ? zh : en;
  const [summary, setSummary] = useState<Summary>({ passwordCount: 0, cookieCount: 0, bookmarkCount: 0, passwords: [], bookmarks: [] });
  const [route, setRoute] = useState(window.location.hash.slice(1));
  const [importOpen, setImportOpen] = useState(false);
  const [sources, setSources] = useState<Source[]>([]);
  const [selected, setSelected] = useState("");
  const [scanned, setScanned] = useState(false);
  const [closedBrowser, setClosedBrowser] = useState(false);
  const [choices, setChoices] = useState({ passwords: true, cookies: false, bookmarks: true });
  const refresh = async () => setSummary(await settingsAction<Summary>("dataSummary"));
  const scan = async () => {
    const found = await settingsAction<Source[]>("scanBrowsers");
    setSources(found); setSelected(found[0]?.id ?? ""); setScanned(true); setClosedBrowser(false); setImportOpen(true);
  };
  useEffect(() => { void frontend().ready().catch(() => {}); }, []);
  useEffect(() => { if (s.config && !route) void s.run(refresh); }, [!!s.config]);
  useEffect(() => {
    if (s.config && route === "import") { setRoute(""); void s.run(scan); }
  }, [!!s.config, route]);
  const source = sources.find((item) => item.id === selected);
  const managerRoute = ["bookmarks", "passwords", "history", "cookies"].includes(route);
  const canImport = !!source && !s.busy && closedBrowser && Object.entries(choices).some(([key, enabled]) => enabled && source[key as keyof typeof choices]);
  const importSelected = () => void s.run(async () => {
    if (!source) return;
    const result = await settingsAction<{ passwords: number; cookies: number; bookmarks: number; skipped: number; notes: string[] }>("importSelected", {
      source: source.id,
      passwords: choices.passwords && !!source.passwords,
      cookies: choices.cookies && !!source.cookies,
      bookmarks: choices.bookmarks && !!source.bookmarks,
    });
    await refresh(); setImportOpen(false);
    s.setMessage(t(
      `已导入 ${result.passwords} 条密码、${result.cookies} 个 Cookie、${result.bookmarks} 条书签；跳过 ${result.skipped} 条。`,
      `Imported ${result.passwords} passwords, ${result.cookies} cookies, ${result.bookmarks} bookmarks; skipped ${result.skipped}.`,
    ) + result.notes.join(" "));
  });
  return <UiProvider theme={s.snapshot?.theme?.mode ?? "system"} locale={s.zh ? "zh-CN" : "en"} className="browser-settings-ui mu-settings-codex">
    {!s.config ? <SettingsPage title={t("浏览器设置", "Browser settings")}><DialogNotice tone={s.error ? "error" : "default"}>{s.error || t("正在加载…", "Loading…")}</DialogNotice></SettingsPage>
    : managerRoute ? <BrowserManager kind={route as ManagerKind} s={s} onBack={() => { setRoute(""); void s.run(refresh); }} />
    : <SettingsPage title={t("浏览器设置", "Browser settings")} description={t("设置起始页，查看本机浏览数据。", "Set a start page and review local browser data.")} actions={<span className="settings-save-feedback" role="status" aria-live="polite">{s.failed || s.error ? "" : s.message}</span>}>
      <SettingsPanel variant="preferences" title={t("偏好设置", "Preferences")}>
        <Form columns={1}>
          <FormItem variant="inline" className="settings-path-row" label={t("起始页", "Start page")} description={t("新标签页打开时显示；留空则显示空白页。", "Shown in new tabs; leave empty for a blank page.")}><Input label={t("起始页", "Start page")} hideLabel type="url" placeholder="https://example.com" leftIcon={<Globe size={15} />} value={String(s.values.startPage ?? "")} onChange={(value) => s.setValues((current) => ({ ...current, startPage: value }))} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} /></FormItem>
          <FormItem variant="inline" label={t("从其他浏览器导入", "Import from another browser")} description={t("选择浏览器配置和需要迁移的数据。", "Choose a browser profile and the data to bring over.")}><Button variant="outline" disabled={s.busy} onClick={() => void s.run(scan)}><Download size={14} />{t("打开导入", "Open import")}</Button></FormItem>
        </Form>
      </SettingsPanel>
      {(s.failed || s.error) && <DialogNotice tone={s.failed || s.error ? "error" : "default"}>{s.error || s.message}</DialogNotice>}
      <SettingsPanel variant="preferences" title={t("浏览数据", "Browsing data")}>
        <Form>
          <FormItem variant="inline" label={t("书签", "Bookmarks")} description={t(`已保存 ${summary.bookmarkCount} 条书签，支持文件夹、搜索和编辑。`, `${summary.bookmarkCount} saved bookmarks. Organize folders, search and edit.`)}><Button variant="outline" onClick={() => setRoute("bookmarks")}>{t("管理书签", "Manage bookmarks")}</Button></FormItem>
          <FormItem variant="inline" label={t("密码", "Passwords")} description={t(`本机加密保存 ${summary.passwordCount} 条密码。`, `${summary.passwordCount} locally encrypted passwords.`)}><Button variant="outline" onClick={() => setRoute("passwords")}>{t("管理密码", "Manage passwords")}</Button></FormItem>
          <FormItem variant="inline" label={t("浏览历史", "History")} description={t("查看和清理访问记录。", "Review and clear browsing activity.")}><Button variant="outline" onClick={() => setRoute("history")}>{t("查看历史", "View history")}</Button></FormItem>
          <FormItem variant="inline" label="Cookie" description={t(`本机已有 ${summary.cookieCount} 个 Cookie；支持导入导出的 JSON 文件。`, `${summary.cookieCount} local cookies. Import an exported JSON file.`)}><Button variant="outline" onClick={() => setRoute("cookies")}>{t("导入 Cookie", "Import cookies")}</Button></FormItem>
        </Form>
      </SettingsPanel>
      <Dialog open={importOpen} onOpenChange={setImportOpen} title={t("从浏览器导入", "Import from browser")} description={t("选择浏览器及要导入的数据。", "Choose a browser and the data to import.")} footer={<><Button variant="quiet" onClick={() => setImportOpen(false)}>{t("取消", "Cancel")}</Button><Button variant="primary" disabled={!canImport} onClick={importSelected}><Download size={14} />{s.busy ? t("处理中…", "Working…") : t("导入所选", "Import selected")}</Button></>}>
        {scanned && sources.length === 0 ? <DialogNotice>{t("没有找到可导入的 Chrome / Edge 配置档案。", "No Chrome / Edge profiles found.")}</DialogNotice> : sources.length > 0 && <Form><FormItem variant="inline" label={t("浏览器配置", "Browser profile")}><Select label={t("浏览器配置", "Browser profile")} value={selected} onValueChange={setSelected} options={sources.map((item) => ({ value: item.id, label: `${item.name} · ${item.account || item.profile}`, description: t(`密码 ${item.passwords} 条 · Cookie ${item.cookies} 个 · 书签 ${item.bookmarks} 条`, `${item.passwords} passwords · ${item.cookies} cookies · ${item.bookmarks} bookmarks`) }))} /></FormItem></Form>}
        {source && <div className="browser-import-options">
          <DialogNotice>{t("导入前请关闭所选浏览器，确保数据库可读取且数据完整。", "Close the selected browser before importing to keep its database readable and complete.")}</DialogNotice>
          <Form>
            <FormItem variant="inline" label={t("我已关闭所选浏览器", "I have closed the selected browser")}><Switch label={t("我已关闭所选浏览器", "I have closed the selected browser")} checked={closedBrowser} onCheckedChange={setClosedBrowser} /></FormItem>
            {(["passwords", "cookies", "bookmarks"] as const).map((key) => <FormItem key={key} variant="inline" label={t(`导入${key === "passwords" ? "密码" : key === "cookies" ? " Cookie" : "书签"}（${source[key]}）`, `Import ${key} (${source[key]})`)}><Switch label={key} disabled={!source[key] || s.busy} checked={!!source[key] && choices[key]} onCheckedChange={(value) => setChoices((current) => ({ ...current, [key]: value }))} /></FormItem>)}
          </Form>
          <DialogNotice>{t("书签及旧版加密数据无需管理员权限。新版 Chrome / Edge 的应用绑定加密密码和 Cookie 暂不支持，导入时会跳过；密码可从浏览器导出 CSV 后导入。", "Bookmarks and older encrypted data need no administrator access. App-bound encrypted passwords and cookies are currently skipped; passwords can be imported from a browser CSV export.")}</DialogNotice>
          {source.note && <DialogNotice tone="warning">{source.note}</DialogNotice>}
        </div>}
        {s.error && <DialogNotice tone="error">{s.error}</DialogNotice>}
      </Dialog>
    </SettingsPage>}
  </UiProvider>;
}
