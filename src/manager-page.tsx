import { useEffect, useState } from "react";
import { frontend } from "@modera/plugin-sdk/react";
import { Button } from "@modera/ui";
import { SettingsPage } from "@modera/ui/settings";
import { MagnifyingGlassIcon as Search } from "@phosphor-icons/react/dist/csr/MagnifyingGlass";
import { PlusIcon as Plus } from "@phosphor-icons/react/dist/csr/Plus";
import { PencilIcon as Pencil } from "@phosphor-icons/react/dist/csr/Pencil";
import { TrashIcon as Trash2 } from "@phosphor-icons/react/dist/csr/Trash";
import { EyeIcon as Eye } from "@phosphor-icons/react/dist/csr/Eye";
import { EyeSlashIcon as EyeOff } from "@phosphor-icons/react/dist/csr/EyeSlash";
import { FolderIcon as Folder } from "@phosphor-icons/react/dist/csr/Folder";
import { DownloadIcon as Download } from "@phosphor-icons/react/dist/csr/Download";

import { settingsAction, useSettings } from "@modera/plugin-sdk/react";
export type ManagerKind = "bookmarks" | "passwords" | "history" | "cookies";
type Row = {
  id: string;
  title?: string;
  url?: string;
  folder?: string;
  origin?: string;
  username?: string;
  visitedAt?: number;
};
type Data = {
  bookmarks: Row[];
  passwords: Row[];
  folders: string[];
  bookmarkCount: number;
  passwordCount: number;
};
export function BrowserManager({
  kind,
  s,
}: {
  kind: ManagerKind;
  s: ReturnType<typeof useSettings>;
}) {
  const t = (cn: string, en: string) => (s.zh ? cn : en);
  const title = {
    bookmarks: t("书签管理器", "Bookmarks"),
    passwords: t("密码管理器", "Passwords"),
    history: t("浏览历史", "History"),
    cookies: t("Cookie 导入", "Import cookies"),
  }[kind];
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("");
  const [folder, setFolder] = useState<string>();
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<Row[]>([]);
  const [folders, setFolders] = useState<string[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [folderName, setFolderName] = useState<string>();
  const [editing, setEditing] = useState<Record<string, string> | null>(null);
  const [revealed, setRevealed] = useState<{ id: string; password: string }>();
  const reload = async () => {
    if (kind === "history")
      setRows(await settingsAction<Row[]>("history", { query: filter, page }));
    else if (kind !== "cookies") {
      const data = await settingsAction<Data>("dataSummary", {
        query: filter,
        page,
        ...(folder === undefined ? {} : { folder }),
      });
      setRows(data[kind]);
      setFolders(data.folders ?? []);
    }
    setSelected([]);
  };
  useEffect(() => {
    void s.run(reload);
    setRevealed(undefined);
  }, [kind, page, filter, folder]);
  const remove = () =>
    void s.run(async () => {
      if (
        !window.confirm(
          t(
            "删除所选记录？此操作不可撤销。",
            "Delete selected records? This cannot be undone.",
          ),
        )
      )
        return;
      if (kind === "history")
        await settingsAction("removeHistory", { ids: selected });
      else await settingsAction("removeSelected", { kind, ids: selected });
      await reload();
    });
  const check = (id: string) =>
    setSelected((v) =>
      v.includes(id) ? v.filter((x) => x !== id) : [...v, id],
    );
  const importFile = () =>
    void s.run(async () => {
      const path = await frontend().settings.pickFile();
      if (!path) return;
      const result = await settingsAction<{
        imported: number;
        skipped: number;
      }>(kind === "cookies" ? "importCookieJson" : "importPasswordCsv", {
        path,
      });
      await reload();
      s.setMessage(
        t(
          `已导入 ${result.imported} 条，跳过 ${result.skipped} 条。`,
          `Imported ${result.imported}; skipped ${result.skipped}.`,
        ),
      );
    });
  const row = (item: Row) => (
    <tr key={item.id}>
      <td>
        <input
          type="checkbox"
          aria-label={t("选择记录", "Select record")}
          checked={selected.includes(item.id)}
          onChange={() => check(item.id)}
        />
      </td>
      {kind === "bookmarks" && (
        <td className="bm-folder">{item.folder || t("未分组", "Unfiled")}</td>
      )}
      <td>
        <strong>{item.title || item.origin}</strong>
        <small>{item.url || item.username}</small>
      </td>
      {kind === "passwords" && (
        <td className="bm-secret">
          {revealed?.id === item.id ? revealed.password : "••••••••"}
        </td>
      )}
      {kind === "history" && (
        <td>
          {new Date(item.visitedAt!).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </td>
      )}
      <td className="bm-actions">
        {kind === "passwords" && (
          <Button
            aria-label={t("查看密码", "Reveal password")}
            onClick={() =>
              void s.run(async () => {
                setRevealed(
                  revealed?.id === item.id
                    ? undefined
                    : {
                        id: item.id,
                        password: await settingsAction<string>(
                          "revealPassword",
                          { id: item.id },
                        ),
                      },
                );
              })
            }
          >
            {revealed?.id === item.id ? (
              <EyeOff size={14} />
            ) : (
              <Eye size={14} />
            )}
          </Button>
        )}
        {kind !== "history" && (
          <Button
            aria-label={t("编辑", "Edit")}
            onClick={() =>
              setEditing(
                kind === "bookmarks"
                  ? {
                      id: item.id,
                      title: item.title ?? "",
                      url: item.url ?? "",
                      folder: item.folder ?? "",
                    }
                  : {
                      id: item.id,
                      origin: item.origin ?? "",
                      username: item.username ?? "",
                      password: "",
                    },
              )
            }
          >
            <Pencil size={14} />
          </Button>
        )}
      </td>
    </tr>
  );
  const groups = new Map<string, Row[]>();
  if (kind === "history")
    for (const item of rows) {
      const date = new Date(item.visitedAt!).toLocaleDateString(
        s.zh ? "zh-CN" : "en",
      );
      groups.set(date, [...(groups.get(date) ?? []), item]);
    }
  return (
    <SettingsPage title={title} description={kind === "bookmarks"
          ? t(
              "按文件夹整理收藏；导入时保留原有目录。",
              "Organize bookmarks in folders; imports preserve their hierarchy.",
            )
          : kind === "passwords"
            ? t(
                "密码加密保存在本机，仅在点击查看时显示。",
                "Passwords are encrypted locally and revealed only on request.",
              )
            : kind === "history"
              ? t(
                  "查看和管理在内置浏览器中访问的页面。",
                  "Review pages visited in the built-in browser.",
                )
              : t(
                  "选择从浏览器导出的 Cookie JSON 文件，支持数组或含 cookies 数组的对象。",
                  "Select an exported cookie JSON array or an object containing a cookies array.",
                )}>
      <style>{managerStyle}</style>

      {kind === "cookies" ? (
        <div className="df-card">
          <h3>{t("从文件导入", "Import from file")}</h3>
          <p>
            {t(
              "仅导入你拥有或获授权的浏览器数据。登录 Cookie 属于敏感数据，请妥善保管导出文件。",
              "Import browser data you own or are authorized to use. Keep exported session cookies private.",
            )}
          </p>
          <Button className="primary" disabled={s.busy} onClick={importFile}>
            <Download size={14} />
            {t("选择 Cookie JSON", "Choose cookie JSON")}
          </Button>
        </div>
      ) : (
        <>
          <div className="bm-toolbar">
            <Search size={16} />
            <input
              aria-label={t("搜索记录", "Search records")}
              placeholder={t(
                "搜索标题、网址或用户名…",
                "Search titles, URLs or usernames…",
              )}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  if (query === filter && page === 0) void s.run(reload);
                  else {
                    setFilter(query);
                    setPage(0);
                  }
                }
              }}
            />
            <Button
              onClick={() => {
                if (query === filter && page === 0) void s.run(reload);
                else {
                  setFilter(query);
                  setPage(0);
                }
              }}
            >
              {t("搜索", "Search")}
            </Button>
            {kind !== "history" && (
              <Button
                disabled={s.busy}
                onClick={() =>
                  setEditing(
                    kind === "bookmarks"
                      ? { title: "", url: "", folder: folder ?? "" }
                      : { origin: "", username: "", password: "" },
                  )
                }
              >
                <Plus size={14} />
                {t("添加", "Add")}
              </Button>
            )}
          </div>
          {kind === "passwords" && (
            <Button disabled={s.busy} onClick={importFile}>
              <Download size={14} />
              {t("导入密码 CSV", "Import password CSV")}
            </Button>
          )}
          {kind === "bookmarks" && (
            <div className="bm-folders">
              <Button
                className={folder === undefined ? "primary" : ""}
                onClick={() => {
                  setFolder(undefined);
                  setPage(0);
                }}
              >
                {t("全部书签", "All bookmarks")}
              </Button>
              {folders.map((name) => (
                <Button
                  key={name}
                  className={folder === name ? "primary" : ""}
                  onClick={() => {
                    setFolder(name);
                    setPage(0);
                  }}
                >
                  <Folder size={14} />
                  {name || t("未分组", "Unfiled")}
                </Button>
              ))}
            </div>
          )}
          {kind === "bookmarks" && folder && (
            <Button onClick={() => setFolderName(folder)}>
              {t("重命名分组", "Rename folder")}
            </Button>
          )}
          {folderName !== undefined && (
            <form
              className="bm-toolbar"
              onSubmit={(e) => {
                e.preventDefault();
                void s.run(async () => {
                  const target = folderName
                    .split("/")
                    .map((x) => x.trim())
                    .filter(Boolean)
                    .join("/");
                  await settingsAction("renameFolder", {
                    from: folder,
                    to: target,
                  });
                  setFolder(target);
                  setFolderName(undefined);
                });
              }}
            >
              <input
                aria-label={t("分组名称", "Folder name")}
                required
                value={folderName}
                onChange={(e) => setFolderName(e.target.value)}
              />
              <Button type="submit" disabled={s.busy}>
                {t("保存", "Save")}
              </Button>
              <Button type="button" onClick={() => setFolderName(undefined)}>
                {t("取消", "Cancel")}
              </Button>
            </form>
          )}
          <div className="bm-toolbar">
            <label className="df-check">
              <input
                type="checkbox"
                checked={rows.length > 0 && selected.length === rows.length}
                onChange={(e) =>
                  setSelected(e.target.checked ? rows.map((x) => x.id) : [])
                }
              />
              {t("选择本页", "Select page")}
            </label>
            <span className="df-muted">
              {selected.length} {t("项已选", "selected")}
            </span>
            <Button disabled={s.busy || !selected.length} onClick={remove}>
              <Trash2 size={14} />
              {t("删除所选", "Delete selected")}
            </Button>
            {kind === "history" && (
              <Button
                disabled={s.busy}
                onClick={() =>
                  void s.run(async () => {
                    if (
                      window.confirm(
                        t("清除全部浏览历史？", "Clear all browsing history?"),
                      )
                    ) {
                      await settingsAction("removeHistory", { all: true });
                      await reload();
                    }
                  })
                }
              >
                {t("清除历史", "Clear history")}
              </Button>
            )}
          </div>
          {kind === "history" ? (
            [...groups].map(([date, items], i) => (
              <details className="bm-day" key={date} open={i === 0}>
                <summary>
                  {date}
                  <small>{items.length}</small>
                </summary>
                <table className="bm-table">
                  <tbody>{items.map(row)}</tbody>
                </table>
              </details>
            ))
          ) : (
            <div className="bm-table-wrap">
              <table className="bm-table">
                <thead>
                  <tr>
                    <th></th>
                    {kind === "bookmarks" && <th>{t("文件夹", "Folder")}</th>}
                    <th>
                      {kind === "bookmarks"
                        ? t("标题与网址", "Title and URL")
                        : t("网站与账号", "Website and account")}
                    </th>
                    {kind === "passwords" && <th>{t("密码", "Password")}</th>}
                    <th></th>
                  </tr>
                </thead>
                <tbody>{rows.map(row)}</tbody>
              </table>
            </div>
          )}
          {!rows.length && (
            <p className="df-empty">{t("暂无记录", "No records")}</p>
          )}
          {
            <div className="bm-toolbar">
              <Button
                disabled={s.busy || page === 0}
                onClick={() => setPage((v) => v - 1)}
              >
                {t("上一页", "Previous")}
              </Button>
              <span>{page + 1}</span>
              <Button
                disabled={
                  s.busy || rows.length < (kind === "history" ? 100 : 50)
                }
                onClick={() => setPage((v) => v + 1)}
              >
                {t("下一页", "Next")}
              </Button>
            </div>
          }
        </>
      )}
      {editing && (
        <div className="bm-editor">
          <h3>{t("编辑记录", "Edit record")}</h3>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void s.run(async () => {
                await settingsAction(
                  kind === "bookmarks" ? "saveBookmark" : "savePassword",
                  editing,
                );
                setEditing(null);
                await reload();
              });
            }}
          >
            {Object.keys(editing)
              .filter((k) => k !== "id")
              .map((key) => (
                <label className="df-field" key={key}>
                  <span>
                    {
                      (
                        {
                          title: t("标题", "Title"),
                          url: t("网址", "URL"),
                          folder: t(
                            "文件夹（如 Work/项目）",
                            "Folder (e.g. Work/Project)",
                          ),
                          origin: t("网站", "Website"),
                          username: t("用户名", "Username"),
                          password: t("新密码", "New password"),
                        } as Record<string, string>
                      )[key]
                    }
                  </span>
                  <input
                    required={key !== "folder" && key !== "username"}
                    type={key === "password" ? "password" : "text"}
                    value={editing[key]}
                    onChange={(e) =>
                      setEditing((v) => ({ ...v, [key]: e.target.value }))
                    }
                  />
                </label>
              ))}
            <div className="df-toolbar">
              <Button type="submit" className="primary" disabled={s.busy}>
                {t("保存", "Save")}
              </Button>
              <Button type="button" onClick={() => setEditing(null)}>
                {t("取消", "Cancel")}
              </Button>
            </div>
          </form>
        </div>
      )}
      {(s.message || s.error) && (
        <p role="status" className="df-notice">
          {s.error || s.message}
        </p>
      )}
    </SettingsPage>
  );
}
const managerStyle = `.bm-crumb{display:flex;align-items:center;gap:8px;margin:12px 0 24px;color:var(--settings-muted);font-size:12px}.bm-toolbar{display:flex;align-items:center;gap:10px;margin:16px 0}.bm-toolbar input:not([type=checkbox]){flex:1}.bm-folders{display:flex;flex-wrap:wrap;gap:6px;margin:20px 0}.bm-table-wrap{overflow:auto;border:1px solid var(--settings-border);border-radius:12px}.bm-table{width:100%;border-collapse:collapse;font-size:12px;text-align:left;table-layout:fixed}.bm-table th{font-weight:500;color:var(--settings-muted);background:var(--settings-card);padding:12px}.bm-table td{padding:12px;border-top:1px solid var(--settings-border);overflow-wrap:anywhere}.bm-table th:first-child,.bm-table td:first-child{width:38px}.bm-table th:last-child,.bm-table td:last-child{width:86px}.bm-table strong{font-size:12px;font-weight:500;display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.bm-table small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--settings-muted);margin-top:4px}.bm-folder{width:22%;color:var(--settings-muted)}.bm-secret{width:25%;font-family:monospace}.bm-actions .df-button{padding:5px}.bm-day{border:1px solid var(--settings-border);border-radius:12px;margin:10px 0;padding:8px 12px}.bm-day summary{cursor:pointer;padding:10px}.bm-day summary small{float:right;color:var(--settings-muted)}.bm-editor{padding:24px;border:1px solid var(--settings-border);border-radius:12px;margin-top:20px;background:var(--settings-card)}`;
