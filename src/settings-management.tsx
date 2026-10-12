import { useState } from "react";
import { Button, SettingsCard, frontend } from "@modera/plugin-sdk/react";
import { BookmarkIcon as Bookmark } from "@phosphor-icons/react/dist/csr/Bookmark";
import { KeyIcon as KeyRound } from "@phosphor-icons/react/dist/csr/Key";
import { TrashIcon as Trash2 } from "@phosphor-icons/react/dist/csr/Trash";
import { EyeIcon as Eye } from "@phosphor-icons/react/dist/csr/Eye";
import { EyeSlashIcon as EyeOff } from "@phosphor-icons/react/dist/csr/EyeSlash";
import { DownloadIcon as Download } from "@phosphor-icons/react/dist/csr/Download";
import { MagnifyingGlassIcon as Search } from "@phosphor-icons/react/dist/csr/MagnifyingGlass";

import { useSettings, settingsAction } from "@modera/plugin-sdk/react";
export type Summary = {
  passwordCount: number;
  cookieCount: number;
  bookmarkCount: number;
  passwords: { id: string; origin: string; username: string }[];
  bookmarks: { id: string; title: string; url: string }[];
};
export function DataManagement({
  settings: s,
  summary,
  onSummary,
}: {
  settings: ReturnType<typeof useSettings>;
  summary: Summary;
  onSummary: (value: Summary) => void;
}) {
  const t = (a: string, b: string) => (s.zh ? a : b);
  const [visible, setVisible] = useState<{ id: string; password: string }>();
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const refresh = async (next = page) => {
    onSummary(
      await settingsAction<Summary>("dataSummary", { query, page: next }),
    );
    setPage(next);
  };
  return (
    <>
      <div className="df-row" style={{ margin: "24px 0 12px" }}>
        <Search size={15} />
        <input
          aria-label={t("搜索密码和书签", "Search saved data")}
          placeholder={t("搜索密码和书签", "Search passwords and bookmarks")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void s.run(() => refresh(0));
          }}
        />
        <Button disabled={s.busy} onClick={() => void s.run(() => refresh(0))}>
          {t("搜索", "Search")}
        </Button>
      </div>
      <div className="df-section">
        <h3 className="df-section-title">{t("密码", "Passwords")}</h3>
        <SettingsCard title={t("管理已保存的密码", "Manage saved passwords")}>
          <p>
            {t(
              "密码由系统安全存储加密保护，仅在点击查看时显示。",
              "Protected by OS secure storage. Passwords are revealed only when requested.",
            )}
          </p>
          <Button
            disabled={s.busy}
            onClick={() =>
              void s.run(async () => {
                const path = await frontend().settings.pickFile();
                if (!path) return;
                const result = await settingsAction<{ imported: number; skipped: number }>(
                  "importPasswordCsv",
                  { path },
                );
                await refresh();
                s.setMessage(
                  t(
                    `已导入 ${result.imported} 条密码，跳过 ${result.skipped} 条`,
                    `Imported ${result.imported} passwords; skipped ${result.skipped}`,
                  ),
                );
              })
            }
          >
            <Download size={14} />
            {t("导入浏览器导出的 CSV", "Import browser CSV")}
          </Button>
          {!summary.passwords.length && (
            <div className="df-empty">
              {t(
                "暂无密码。可从上方扫描导入，或选择浏览器导出的密码文件。",
                "No passwords yet. Scan a profile above or import a browser CSV export.",
              )}
            </div>
          )}
          {summary.passwords.map((p) => (
            <div className="df-list-row" key={p.id}>
              <KeyRound size={15} />
              <div className="grow">
                <strong>{p.origin}</strong>
                <small>{p.username}</small>
                {visible?.id === p.id && (
                  <div className="df-password">{visible.password}</div>
                )}
              </div>
              <Button
                disabled={s.busy}
                aria-label={t("查看密码", "Reveal password")}
                onClick={() =>
                  void s.run(async () => {
                    if (visible?.id === p.id) setVisible(undefined);
                    else
                      setVisible({
                        id: p.id,
                        password: await settingsAction<string>(
                          "revealPassword",
                          { id: p.id },
                        ),
                      });
                  })
                }
              >
                {visible?.id === p.id ? (
                  <EyeOff size={14} />
                ) : (
                  <Eye size={14} />
                )}
              </Button>
              <Button
                aria-label={t("删除密码", "Delete password")}
                disabled={s.busy}
                onClick={() =>
                  void s.run(async () => {
                    await settingsAction("removePassword", { id: p.id });
                    setVisible(undefined);
                    await refresh();
                  })
                }
              >
                <Trash2 size={14} />
              </Button>
            </div>
          ))}
        </SettingsCard>
      </div>
      <div className="df-section">
        <h3 className="df-section-title">{t("书签", "Bookmarks")}</h3>
        <SettingsCard title={t("管理书签", "Manage bookmarks")}>
          <p>
            {t(
              "导入的书签会合并去重，也可以从侧栏浏览器打开。",
              "Imported bookmarks are merged and available in the sidebar browser.",
            )}
          </p>
          {!summary.bookmarks.length && (
            <div className="df-empty">
              {t(
                "暂无书签。从上方选择浏览器导入，或在侧栏收藏当前网页。",
                "No bookmarks yet. Import a browser profile or bookmark a page in the sidebar.",
              )}
            </div>
          )}
          {summary.bookmarks.map((b) => (
            <div className="df-list-row" key={b.id}>
              <Bookmark size={15} />
              <div className="grow">
                <strong>{b.title}</strong>
                <small>{b.url}</small>
              </div>
              <Button
                disabled={s.busy}
                aria-label={t("删除书签", "Delete bookmark")}
                onClick={() =>
                  void s.run(async () => {
                    await settingsAction("removeBookmark", { id: b.id });
                    await refresh();
                  })
                }
              >
                <Trash2 size={14} />
              </Button>
            </div>
          ))}
        </SettingsCard>
      </div>
      {(page > 0 ||
        summary.passwords.length === 50 ||
        summary.bookmarks.length === 50) && (
        <div className="df-toolbar">
          <Button
            disabled={!page || s.busy}
            onClick={() => void s.run(() => refresh(page - 1))}
          >
            {t("上一页", "Previous")}
          </Button>
          <span>{page + 1}</span>
          <Button
            disabled={
              s.busy ||
              (summary.passwords.length < 50 && summary.bookmarks.length < 50)
            }
            onClick={() => void s.run(() => refresh(page + 1))}
          >
            {t("下一页", "Next")}
          </Button>
        </div>
      )}
    </>
  );
}
