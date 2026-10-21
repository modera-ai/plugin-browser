import { BrowserImportDialog } from "./browser-import-dialog";
import { browserData } from "./data-command";
import { useEffect, useState } from "react";
import { Button, DialogNotice, Input, UiProvider } from "@pal/ui";
import {
  Form,
  FormItem,
  SettingsPage,
  SettingsPanel,
  SettingsBreadcrumbs,
} from "@pal/ui/settings";
import { DownloadIcon as Download } from "@phosphor-icons/react/dist/csr/Download";
import { GlobeIcon as Globe } from "@phosphor-icons/react/dist/csr/Globe";
import { pal } from "@pal/plugin-sdk";
import { useBrowserSettings } from "./use-browser-settings";
import { BrowserManager, type ManagerKind } from "./manager-page";
import type { Summary } from "./browser-data-types";

export function BrowserSettings() {
  const s = useBrowserSettings();
  const t = (zh: string, en: string) => (s.zh ? zh : en);
  const [summary, setSummary] = useState<Summary>({
    passwordCount: 0,
    cookieCount: 0,
    bookmarkCount: 0,
    passwords: [],
    bookmarks: [],
  });
  const initialRoute = window.location.hash.slice(1);
  const [navigation, setNavigation] = useState({
    entries: initialRoute ? ["", initialRoute] : [""],
    index: initialRoute ? 1 : 0,
  });
  const route = navigation.entries[navigation.index]!;
  const setRoute = (next: string) =>
    setNavigation((current) =>
      current.entries[current.index] === next
        ? current
        : {
            entries: [...current.entries.slice(0, current.index + 1), next],
            index: current.index + 1,
          },
    );
  useEffect(() => {
    const followRoute = () => {
      const requested = window.location.hash.slice(1);
      const next = [
        "bookmarks",
        "passwords",
        "history",
        "cookies",
        "import",
      ].includes(requested)
        ? requested
        : "";
      setNavigation({ entries: next ? ["", next] : [""], index: next ? 1 : 0 });
    };
    followRoute();
    window.addEventListener("hashchange", followRoute);
    return () => window.removeEventListener("hashchange", followRoute);
  }, []);
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.hash.slice(1) === route) return;
    url.hash = route;
    window.history.replaceState(null, "", url.href);
  }, [route]);
  const [importOpen, setImportOpen] = useState(false);
  const refresh = async () =>
    setSummary(await browserData<Summary>("dataSummary"));
  const scan = async () => {
    setImportOpen(true);
  };
  useEffect(() => {
    void pal
      .ready()
      .catch(() => {});
  }, []);
  useEffect(() => {
    if (s.config && !route) void s.run(refresh);
  }, [!!s.config, route]);
  useEffect(() => {
    if (s.config && route === "import") {
      setNavigation({ entries: [""], index: 0 });
      setImportOpen(true);
    }
  }, [!!s.config, route]);
  const managerRoute = [
    "bookmarks",
    "passwords",
    "history",
    "cookies",
  ].includes(route);
  return (
    <UiProvider
      theme={s.snapshot?.theme?.mode ?? "system"}
      locale={s.zh ? "zh-CN" : "en"}
      density="compact"
      className="browser-settings-ui mu-settings-codex"
    >
      {managerRoute && (
        <SettingsBreadcrumbs
          items={[
            { label: t("设置", "Settings") },
            {
              label: t("浏览器", "Browser"),
              onSelect: () => {
                setRoute("");
              },
            },
            ...(managerRoute
              ? [
                  {
                    label: (
                      {
                        bookmarks: t("书签管理器", "Bookmarks"),
                        passwords: t("密码管理器", "Passwords"),
                        history: t("浏览历史", "History"),
                        cookies: t("导入 Cookie", "Import cookies"),
                      } as Record<string, string>
                    )[route]!,
                  },
                ]
              : []),
          ]}
          onBack={
            navigation.index > 0
              ? () =>
                  setNavigation((current) => ({
                    ...current,
                    index: current.index - 1,
                  }))
              : undefined
          }
          onForward={
            navigation.index + 1 < navigation.entries.length
              ? () =>
                  setNavigation((current) => ({
                    ...current,
                    index: current.index + 1,
                  }))
              : undefined
          }
        />
      )}
      {!s.config ? (
        <SettingsPage title={t("浏览器设置", "Browser settings")}>
          {s.error ? (
            <Button variant="outline" onClick={() => window.location.reload()}>
              {t("重试", "Retry")}
            </Button>
          ) : (
            <DialogNotice>{t("正在加载…", "Loading…")}</DialogNotice>
          )}
        </SettingsPage>
      ) : managerRoute ? (
        <BrowserManager kind={route as ManagerKind} s={s} />
      ) : (
        <SettingsPage
          title={t("浏览器设置", "Browser settings")}
          description={t(
            "设置起始页，查看本机浏览数据。",
            "Set a start page and review local browser data.",
          )}
          actions={
            <span
              className="settings-save-feedback"
              role="status"
              aria-live="polite"
            >
              {s.failed || s.error ? "" : s.message}
            </span>
          }
        >
          <SettingsPanel
            variant="preferences"
            title={t("偏好设置", "Preferences")}
          >
            <Form columns={1}>
              <FormItem
                variant="inline"
                className="settings-path-row"
                label={t("起始页", "Start page")}
                description={t(
                  "新标签页打开时显示；留空则显示空白页。",
                  "Shown in new tabs; leave empty for a blank page.",
                )}
              >
                <Input
                  label={t("起始页", "Start page")}
                  hideLabel
                  type="url"
                  placeholder="https://example.com"
                  leftIcon={<Globe size={15} />}
                  value={String(s.values.startPage ?? "")}
                  onChange={(value) =>
                    s.setValues((current) => ({ ...current, startPage: value }))
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Enter") event.currentTarget.blur();
                  }}
                />
              </FormItem>
              <FormItem
                variant="inline"
                label={t("从其他浏览器导入", "Import from another browser")}
                description={t(
                  "选择浏览器配置和需要迁移的数据。",
                  "Choose a browser profile and the data to bring over.",
                )}
              >
                <Button
                  variant="outline"
                  disabled={s.busy}
                  onClick={() => void s.run(scan)}
                >
                  <Download size={14} />
                  {t("打开导入", "Open import")}
                </Button>
              </FormItem>
            </Form>
          </SettingsPanel>
          <SettingsPanel
            variant="preferences"
            title={t("浏览数据", "Browsing data")}
          >
            <Form>
              <FormItem
                variant="inline"
                label={t("书签", "Bookmarks")}
                description={t(
                  `已保存 ${summary.bookmarkCount} 条书签，支持文件夹、搜索和编辑。`,
                  `${summary.bookmarkCount} saved bookmarks. Organize folders, search and edit.`,
                )}
              >
                <Button variant="outline" onClick={() => setRoute("bookmarks")}>
                  {t("管理", "Manage")}
                </Button>
              </FormItem>
              <FormItem
                variant="inline"
                label={t("密码", "Passwords")}
                description={t(
                  `本机加密保存 ${summary.passwordCount} 条密码。`,
                  `${summary.passwordCount} locally encrypted passwords.`,
                )}
              >
                <Button variant="outline" onClick={() => setRoute("passwords")}>
                  {t("管理", "Manage")}
                </Button>
              </FormItem>
              <FormItem
                variant="inline"
                label={t("浏览历史", "History")}
                description={t(
                  "查看和清理访问记录。",
                  "Review and clear browsing activity.",
                )}
              >
                <Button variant="outline" onClick={() => setRoute("history")}>
                  {t("管理", "Manage")}
                </Button>
              </FormItem>
              <FormItem
                variant="inline"
                label="Cookie"
                description={t(
                  `本机已有 ${summary.cookieCount} 个 Cookie；支持导入导出的 JSON 文件。`,
                  `${summary.cookieCount} local cookies. Import an exported JSON file.`,
                )}
              >
                <Button variant="outline" onClick={() => setRoute("cookies")}>
                  {t("导入", "Import")}
                </Button>
              </FormItem>
            </Form>
          </SettingsPanel>
          {importOpen && (
            <BrowserImportDialog
              locale={s.snapshot?.locale ?? "en"}
              invoke={browserData}
              close={() => setImportOpen(false)}
              notify={() => {
                void s.run(refresh);
                s.setMessage(s.zh ? "已导入浏览数据" : "Browser data imported");
              }}
              fail={(error) => {
                console.error("Browser import failed", error);
                void pal.toast.show({
                  level: "error",
                  text: s.zh
                    ? "导入失败，请重试"
                    : "Import failed. Please retry.",
                });
              }}
            />
          )}
        </SettingsPage>
      )}
    </UiProvider>
  );
}
