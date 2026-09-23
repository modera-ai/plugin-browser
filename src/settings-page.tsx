import { BrowserManager, type ManagerKind } from "./manager-page";
import { ChromeLogo, EdgeLogo } from "./browser-logos";
import { useEffect, useState, useRef } from "react";
import { SettingsPage, Button } from "@modera/plugin-sdk/react";
import {
  Bookmark,
  Cookie,
  KeyRound,
  Globe,
  Download,
  ShieldCheck,
  History,
  Upload,
  ChevronRight,
} from "lucide-react";
import { useSettings, settingsAction } from "@modera/plugin-sdk/react";
import { type Summary } from "./settings-management";
type Source = {
  id: string;
  name: string;
  profile: string;
  account: string;
  passwords: number;
  cookies: number;
  bookmarks: number;
  note: string;
};
export function BrowserSettings() {
  const s = useSettings({ autoSave: true }),
    { zh } = s;
  const t = (a: string, b: string) => (zh ? a : b);
  const [summary, setSummary] = useState<Summary>({
    passwordCount: 0,
    cookieCount: 0,
    bookmarkCount: 0,
    passwords: [],
    bookmarks: [],
  });
  const [route, setRoute] = useState(window.location.hash.slice(1));
  const dialog = useRef<HTMLDialogElement>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [closedBrowser, setClosedBrowser] = useState(false);
  useEffect(() => {
    if (importOpen) dialog.current?.showModal();
    else dialog.current?.close();
  }, [importOpen]);
  const [sources, setSources] = useState<Source[]>([]);
  const [selected, setSelected] = useState("");
  const [scanned, setScanned] = useState(false);
  const [choices, setChoices] = useState({
    passwords: true,
    cookies: false,
    bookmarks: true,
  });
  const refresh = async () =>
    setSummary(await settingsAction<Summary>("dataSummary"));
  useEffect(() => {
    if (s.config && !route) void s.run(refresh);
  }, [!!s.config]);
  useEffect(() => {
    if (s.config && route === "import") {
      setRoute("");
      void s.run(async () => {
        const found = await settingsAction<Source[]>("scanBrowsers");
        setSources(found);
        setSelected(found[0]?.id ?? "");
        setScanned(true);
        setClosedBrowser(false);
        setImportOpen(true);
      });
    }
  }, [!!s.config, route]);
  const source = sources.find((x) => x.id === selected);
  if (!s.config)
    return s.error ? (
      <SettingsPage title={t("设置", "Settings")}>
        <p role="alert">{s.error}</p>
      </SettingsPage>
    ) : null;
  if (["bookmarks", "passwords", "history", "cookies"].includes(route))
    return (
      <BrowserManager
        kind={route as ManagerKind}
        s={s}
        onBack={() => {
          setRoute("");
          void s.run(refresh);
        }}
      />
    );
  const stats = [
    {
      Icon: KeyRound,
      value: summary.passwordCount,
      label: t("已保存密码", "Saved passwords"),
    },
    {
      Icon: Cookie,
      value: summary.cookieCount,
      label: t("本机 Cookie", "Browser cookies"),
    },
    {
      Icon: Bookmark,
      value: summary.bookmarkCount,
      label: t("书签", "Bookmarks"),
    },
    {
      Icon: Globe,
      value: s.values.startPage || t("空白页", "Blank page"),
      label: t("起始页", "Start page"),
    },
  ];
  return (
    <SettingsPage title={t("浏览器设置", "Browser settings")}>
      <p className="df-description">
        {t(
          "起始页、密码管理与从其他浏览器导入数据",
          "Start page, saved passwords and data from your other browsers",
        )}
      </p>
      <div className="browser-summary">
        {stats.map(({ Icon, value, label }) => (
          <div className="browser-metric" key={label}>
            <Icon size={16} />
            <span>
              <strong title={String(value)}>{String(value)}</strong>
              <small>{label}</small>
            </span>
          </div>
        ))}
      </div>
      <section className="browser-panel browser-preferences">
        <div className="browser-setting-row">
          <div className="browser-setting-copy">
            <strong>{t("起始页", "Start page")}</strong>
            <small>
              {t(
                "新标签页打开时显示；留空则显示空白页",
                "Shown when a new tab opens; leave empty for a blank page",
              )}
            </small>
          </div>
          <div className="browser-setting-control">
            <Globe size={16} aria-hidden="true" />
            <input
              aria-label={t("起始页", "Start page")}
              placeholder="https://www.google.com"
              value={String(s.values.startPage ?? "")}
              onChange={(e) =>
                s.setValues((v) => ({ ...v, startPage: e.target.value }))
              }
              onKeyDown={(event) => {
                if (event.key === "Enter") event.currentTarget.blur();
              }}
            />
          </div>
        </div>
        <div className="browser-setting-row browser-import-row">
          <div className="browser-setting-copy">
            <strong>
              {t("从其他浏览器导入", "Import from another browser")}
            </strong>
            <small>
              {t(
                "选择 Chrome 或 Edge 配置，并决定要迁移的数据",
                "Choose a Chrome or Edge profile and the data to migrate",
              )}
            </small>
          </div>
          <Button
            disabled={s.busy}
            onClick={() =>
              void s.run(async () => {
                const found = await settingsAction<Source[]>("scanBrowsers");
                setSources(found);
                setSelected(found[0]?.id ?? "");
                setScanned(true);
                setClosedBrowser(false);
                setImportOpen(true);
              })
            }
          >
            <Download size={14} />
            {t("打开导入", "Open import")}
          </Button>
        </div>
      </section>
      <dialog
        ref={dialog}
        className="df-import-dialog"
        onCancel={() => setImportOpen(false)}
      >
        <header>
          <h2>{t("从浏览器导入", "Import from browser")}</h2>
          <Button
            aria-label={t("关闭", "Close")}
            onClick={() => setImportOpen(false)}
          >
            ×
          </Button>
        </header>
        <p className="df-muted">
          {t(
            "选择浏览器及要导入的数据",
            "Choose a browser and the data to import",
          )}
        </p>
        <div style={{ marginTop: 14 }}>
          {sources.map((item) => (
            <label
              className={
                "df-list-row" + (item.id === selected ? " selected" : "")
              }
              key={item.id}
            >
              <input
                type="radio"
                name="profile"
                checked={item.id === selected}
                onChange={() => setSelected(item.id)}
              />
              <span className="df-logo">
                {item.name.includes("Edge") ? (
                  <EdgeLogo size={25} />
                ) : (
                  <ChromeLogo size={25} />
                )}
              </span>
              <span className="grow">
                <strong>{item.name}</strong>
                <small>
                  {item.account || item.profile} ·{" "}
                  {t(
                    `密码 ${item.passwords} 条 · Cookie ${item.cookies} 个 · 书签 ${item.bookmarks} 条`,
                    `${item.passwords} passwords · ${item.cookies} cookies · ${item.bookmarks} bookmarks`,
                  )}
                </small>
              </span>
            </label>
          ))}
        </div>
        {scanned && !sources.length && (
          <p className="df-empty">
            {t(
              "没有找到可导入的 Chrome / Edge 配置档案。",
              "No Chrome / Edge profiles found.",
            )}
          </p>
        )}
        {source && (
          <>
            <div className="df-notice">
              {t(
                "导入前请关闭所选浏览器，确保数据库可读取且数据完整。",
                "Close the selected browser before importing to keep its database readable and complete.",
              )}
            </div>
            <label className="df-check">
              <input
                type="checkbox"
                checked={closedBrowser}
                onChange={(e) => setClosedBrowser(e.target.checked)}
              />
              {t("我已关闭所选浏览器", "I have closed the selected browser")}
            </label>
            <div className="df-notice">
              {t(
                "书签及旧版加密数据无需管理员权限。新版 Chrome / Edge 的应用绑定加密密码和 Cookie 暂不支持，导入时会跳过；密码可从浏览器导出 CSV 后导入。",
                "Bookmarks and older encrypted data need no administrator access. App-bound encrypted passwords and cookies are currently skipped; passwords can be imported from a browser CSV export.",
              )}
            </div>
            {source.note && (
              <div className="df-notice warning">{source.note}</div>
            )}
            {(["passwords", "cookies", "bookmarks"] as const).map((key, i) => (
              <label className="df-check" key={key}>
                <input
                  type="checkbox"
                  className="df-switch"
                  disabled={!source[key] || s.busy}
                  checked={!!source[key] && choices[key]}
                  onChange={(e) =>
                    setChoices((v) => ({ ...v, [key]: e.target.checked }))
                  }
                />
                {
                  [
                    t("导入密码", "Import passwords"),
                    t("导入 Cookie", "Import cookies"),
                    t("导入书签", "Import bookmarks"),
                  ][i]
                }
                （{source[key]}）
              </label>
            ))}
            <Button
              className="primary"
              disabled={
                s.busy ||
                !closedBrowser ||
                !Object.entries(choices).some(
                  ([k, v]) => v && source[k as keyof typeof choices],
                )
              }
              onClick={() =>
                void s.run(async () => {
                  const result = await settingsAction<{
                    passwords: number;
                    cookies: number;
                    bookmarks: number;
                    skipped: number;
                    notes: string[];
                  }>("importSelected", {
                    source: source.id,
                    passwords: choices.passwords && !!source.passwords,
                    cookies: choices.cookies && !!source.cookies,
                    bookmarks: choices.bookmarks && !!source.bookmarks,
                  });
                  await refresh();
                  setImportOpen(false);
                  s.setMessage(
                    t(
                      `已导入 ${result.passwords} 条密码、${result.cookies} 个 Cookie、${result.bookmarks} 条书签；跳过 ${result.skipped} 条。`,
                      `Imported ${result.passwords} passwords, ${result.cookies} cookies, ${result.bookmarks} bookmarks; skipped ${result.skipped}.`,
                    ) + result.notes.join(" "),
                  );
                })
              }
            >
              <Download size={14} />
              {s.busy
                ? t("处理中…", "Working…")
                : t("导入所选", "Import selected")}
            </Button>
          </>
        )}
        {s.error && <p role="alert">{s.error}</p>}
      </dialog>
      {(s.message || s.error) && (
        <div
          role={s.failed ? "alert" : "status"}
          className={"df-notice" + (s.failed ? " warning" : "")}
        >
          {s.error || s.message}
        </div>
      )}
      <section className="browser-managers">
        <header>
          <div>
            <h3>{t("浏览数据", "Browsing data")}</h3>
            <p>
              {t(
                "管理浏览器中保存的个人数据",
                "Manage personal data stored by the browser",
              )}
            </p>
          </div>
          <ShieldCheck size={18} />
        </header>
        <div className="browser-manager-grid">
          {[
            {
              id: "bookmarks",
              Icon: Bookmark,
              title: t("书签管理器", "Bookmarks"),
              description: t(
                "整理文件夹、搜索和编辑收藏",
                "Organize, search and edit bookmarks",
              ),
            },
            {
              id: "passwords",
              Icon: KeyRound,
              title: t("密码管理器", "Passwords"),
              description: t(
                "管理本机加密保存的密码",
                "Manage locally encrypted passwords",
              ),
            },
            {
              id: "history",
              Icon: History,
              title: t("浏览历史", "History"),
              description: t(
                "查看和清理访问记录",
                "Review and clear browsing activity",
              ),
            },
            {
              id: "cookies",
              Icon: Upload,
              title: t("Cookie 导入", "Import cookies"),
              description: t(
                "导入浏览器导出的 JSON 文件",
                "Import an exported browser JSON file",
              ),
            },
          ].map(({ id, Icon, title, description }) => (
            <button
              type="button"
              className="browser-manager-tile"
              key={id}
              onClick={() => setRoute(id)}
            >
              <span className="browser-manager-icon">
                <Icon size={18} />
              </span>
              <span>
                <strong>{title}</strong>
                <small>{description}</small>
              </span>
              <ChevronRight size={17} />
            </button>
          ))}
        </div>
      </section>
    </SettingsPage>
  );
}
