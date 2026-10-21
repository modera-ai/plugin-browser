import { useMemo, useState } from "react";
import { pal } from "@pal/plugin-sdk";
import {
  Button,
  Checkbox,
  CollectionPagination,
  CollectionState,
  CollectionTable,
  CollectionToolbar,
  CollectionWorkspace,
  Dialog,
  Input,
  MenuAction,
  MenuPanel,
  PopoverMorph,
  Tooltip,
  type CollectionColumn,
} from "@pal/ui";
import { FileTreeView } from "@pal/ui/files";
import { Form, SettingsDisclosure, SettingsPage } from "@pal/ui/settings";
import { MagnifyingGlassIcon as Search } from "@phosphor-icons/react/dist/csr/MagnifyingGlass";
import { PlusIcon as Plus } from "@phosphor-icons/react/dist/csr/Plus";
import { PencilIcon as Pencil } from "@phosphor-icons/react/dist/csr/Pencil";
import { TrashIcon as Trash } from "@phosphor-icons/react/dist/csr/Trash";
import { EyeIcon as Eye } from "@phosphor-icons/react/dist/csr/Eye";
import { EyeSlashIcon as EyeOff } from "@phosphor-icons/react/dist/csr/EyeSlash";
import { DownloadIcon as Download } from "@phosphor-icons/react/dist/csr/Download";
import { XIcon as X } from "@phosphor-icons/react/dist/csr/X";
import { browserData } from "./data-command";
import type { useBrowserSettings } from "./use-browser-settings";

import { useBrowserCollection } from "./use-browser-collection";
import type { ManagerKind, BrowserDataRow as Row } from "./browser-data-types";

export type { ManagerKind } from "./browser-data-types";
type Settings = ReturnType<typeof useBrowserSettings>;

// Remount all local state when navigating to a different data collection.
export function BrowserManager(props: { kind: ManagerKind; s: Settings }) {
  return <ManagerContent key={props.kind} {...props} />;
}
function ManagerContent({ kind, s }: { kind: ManagerKind; s: Settings }) {
  const t = (zh: string, en: string) => (s.zh ? zh : en);
  const title = {
    bookmarks: t("书签管理器", "Bookmarks"),
    passwords: t("密码管理器", "Passwords"),
    history: t("浏览历史", "History"),
    cookies: t("导入 Cookie", "Import cookies"),
  }[kind];
  const [query, setQuery] = useState("");
  const {
    filter,
    setFilter,
    folder,
    setFolder,
    page,
    setPage,
    rows,
    folders,
    total,
    selected,
    setSelected,
    loading,
    loadFailed,
    working,
    setWorking,
    revealed,
    setRevealed,
    request,
    alive,
    pageSize,
    disabled,
    refresh,
  } = useBrowserCollection(kind);
  const [editing, setEditing] = useState<Record<string, string> | null>(null);
  const [folderName, setFolderName] = useState<string>();
  const [folderMenu, setFolderMenu] = useState<{
    path: string;
    anchor: HTMLElement | { x: number; y: number };
  }>();
  const [confirm, setConfirm] = useState<"selected" | "all">();
  const notify = (text: string) =>
    pal.toast.show({ level: "success", text });
  const run = async (task: () => Promise<void>) => {
    if (working) return;
    setWorking(true);
    try {
      await s.run(task);
    } finally {
      if (alive.current) setWorking(false);
    }
  };
  const chooseFolder = (value: string | undefined) => {
    setFolder(value);
    setPage(0);
    setSelected([]);
  };
  const search = () => {
    setFilter(query.trim());
    setPage(0);
    setSelected([]);
    refresh();
  };
  const clearSearch = () => {
    setQuery("");
    setFilter("");
    setPage(0);
    refresh();
  };
  const check = (id: string, checked: boolean) =>
    setSelected((current) =>
      checked ? [...current, id] : current.filter((value) => value !== id),
    );
  const importFile = () =>
    void run(async () => {
      const path = await pal.settings.pickFile();
      if (!path) return;
      const result = await browserData<{ imported: number; skipped: number }>(
        kind === "cookies" ? "importCookieJson" : "importPasswordCsv",
        { path },
      );
      refresh();
      await notify(
        t(
          `已导入 ${result.imported} 条，跳过 ${result.skipped} 条`,
          `Imported ${result.imported}; skipped ${result.skipped}`,
        ),
      );
    });
  const openEditor = (item?: Row) => {
    setRevealed(undefined);
    setEditing(
      kind === "bookmarks"
        ? {
            ...(item ? { id: item.id } : {}),
            title: item?.title ?? "",
            url: item?.url ?? "",
            folder: item?.folder ?? folder ?? "",
          }
        : {
            ...(item ? { id: item.id } : {}),
            origin: item?.origin ?? "",
            username: item?.username ?? "",
            password: "",
          },
    );
  };
  const folderEntries = useMemo(
    () =>
      folders
        .filter(Boolean)
        .map((path) => ({ path, kind: "directory" as const })),
    [folders],
  );
  const columns: CollectionColumn<Row>[] = [
    {
      key: "select",
      width: 36,
      header: (
        <Checkbox
          label={t("选择本页", "Select page")}
          checked={rows.length > 0 && selected.length === rows.length}
          indeterminate={selected.length > 0 && selected.length < rows.length}
          disabled={disabled}
          onCheckedChange={(checked) =>
            setSelected(checked ? rows.map((item) => item.id) : [])
          }
        />
      ),
      render: (item) => (
        <Checkbox
          label={t(
            `选择 ${item.title || item.origin || item.url}`,
            `Select ${item.title || item.origin || item.url}`,
          )}
          checked={selected.includes(item.id)}
          disabled={disabled}
          onCheckedChange={(checked) => check(item.id, checked)}
        />
      ),
    },
    {
      key: "content",
      header:
        kind === "passwords"
          ? t("网站与账号", "Website and account")
          : t("标题与网址", "Title and URL"),
      render: (item) => (
        <Tooltip
          content={
            <>
              {item.title || item.origin || item.url}
              <br />
              {item.url || item.username}
            </>
          }
        >
          <div tabIndex={0}>
            <strong>{item.title || item.origin || item.url}</strong>
            <small>
              {item.url || item.username || t("无用户名", "No username")}
            </small>
          </div>
        </Tooltip>
      ),
    },
  ];
  if (kind === "bookmarks")
    columns.push({
      key: "folder",
      width: "24%",
      header: t("文件夹", "Folder"),
      render: (item) => (
        <Tooltip content={item.folder || t("未分组", "Unfiled")}>
          <span className="browser-manager-truncate" tabIndex={0}>
            {item.folder || t("未分组", "Unfiled")}
          </span>
        </Tooltip>
      ),
    });
  if (kind === "passwords")
    columns.push({
      key: "password",
      width: "24%",
      header: t("密码", "Password"),
      render: (item) => (
        <span className="browser-manager-secret">
          {revealed?.id === item.id ? revealed.password : "••••••••"}
        </span>
      ),
    });
  if (kind === "history")
    columns.push({
      key: "time",
      width: 66,
      header: t("时间", "Time"),
      render: (item) =>
        new Date(item.visitedAt!).toLocaleTimeString(s.zh ? "zh-CN" : "en", {
          hour: "2-digit",
          minute: "2-digit",
        }),
    });
  else
    columns.push({
      key: "actions",
      width: kind === "passwords" ? 72 : 42,
      header: (
        <span className="mu-visually-hidden">{t("操作", "Actions")}</span>
      ),
      render: (item) => (
        <div className="browser-manager-actions">
          {kind === "passwords" && (
            <Tooltip
              content={
                revealed?.id === item.id
                  ? t("隐藏密码", "Hide password")
                  : t("查看密码", "Reveal password")
              }
            >
              <Button
                size="icon"
                variant="quiet"
                aria-label={
                  revealed?.id === item.id
                    ? t("隐藏密码", "Hide password")
                    : t("查看密码", "Reveal password")
                }
                disabled={disabled}
                onClick={() => {
                  if (revealed?.id === item.id) setRevealed(undefined);
                  else
                    void run(async () => {
                      const id = request.current;
                      const password = await browserData<string>(
                        "revealPassword",
                        { id: item.id },
                      );
                      if (alive.current && id === request.current)
                        setRevealed({ id: item.id, password });
                    });
                }}
              >
                {revealed?.id === item.id ? (
                  <EyeOff size={14} />
                ) : (
                  <Eye size={14} />
                )}
              </Button>
            </Tooltip>
          )}
          <Tooltip content={t("编辑", "Edit")}>
            <Button
              size="icon"
              variant="quiet"
              aria-label={t("编辑", "Edit")}
              disabled={disabled}
              onClick={() => openEditor(item)}
            >
              <Pencil size={14} />
            </Button>
          </Tooltip>
        </div>
      ),
    });
  const groups = new Map<string, Row[]>();
  if (kind === "history")
    for (const item of rows) {
      const date = new Date(item.visitedAt!).toLocaleDateString(
        s.zh ? "zh-CN" : "en",
      );
      groups.set(date, [...(groups.get(date) ?? []), item]);
    }
  const editorTitle = editing?.id ? t("编辑", "Edit") : t("添加", "Add");
  return (
    <SettingsPage
      variant="collection"
      title={title}
      description={
        kind === "bookmarks"
          ? t(
              "按文件夹整理收藏，搜索标题或网址。",
              "Organize folders and search titles or URLs.",
            )
          : kind === "passwords"
            ? t(
                "密码加密保存在本机，点击查看后显示。",
                "Passwords are encrypted locally and revealed on request.",
              )
            : kind === "history"
              ? t("按日期查看访问记录。", "Review browsing activity by date.")
              : t(
                  "从文件导入浏览器登录数据。",
                  "Import browser session data from a file.",
                )
      }
    >
      {kind === "cookies" ? (
        <CollectionWorkspace label={title} toolbar={null}>
          <CollectionState
            title={t("从 JSON 文件导入 Cookie", "Import cookies from JSON")}
            description={t(
              "支持 JSON 数组或含 cookies 数组的对象。仅导入你拥有或获授权的数据，请妥善保管导出文件。",
              "Supports a JSON array or an object containing a cookies array. Import only authorized data and keep exported files private.",
            )}
            action={
              <Button
                size="small"
                variant="outline"
                disabled={working}
                loading={working}
                onClick={importFile}
              >
                <Download size={14} />
                {t("选择文件并导入", "Choose file and import")}
              </Button>
            }
          />
        </CollectionWorkspace>
      ) : (
        <CollectionWorkspace
          label={title}
          toolbar={
            <CollectionToolbar
              layout="inline"
              search={
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    search();
                  }}
                >
                  <Input
                    label={t("搜索记录", "Search records")}
                    hideLabel
                    type="search"
                    placeholder={
                      kind === "passwords"
                        ? t("搜索网站或账号", "Search websites or accounts")
                        : t("搜索标题或网址", "Search titles or URLs")
                    }
                    value={query}
                    onChange={(value) => {
                      setQuery(value);
                      if (!value) {
                        setFilter("");
                        setPage(0);
                      }
                    }}
                    leftIcon={<Search size={14} />}
                    rightIcon={
                      query ? (
                        <Tooltip content={t("清除搜索", "Clear search")}>
                          <Button
                            size="icon"
                            variant="quiet"
                            aria-label={t("清除搜索", "Clear search")}
                            onClick={clearSearch}
                          >
                            <X size={14} />
                          </Button>
                        </Tooltip>
                      ) : undefined
                    }
                  />
                </form>
              }
              actions={
                <>
                  <Button
                    size="small"
                    variant="quiet"
                    disabled={working}
                    onClick={search}
                  >
                    {t("搜索", "Search")}
                  </Button>
                  {kind === "passwords" && (
                    <Button
                      size="small"
                      variant="outline"
                      disabled={working}
                      onClick={importFile}
                    >
                      <Download size={14} />
                      {t("导入 CSV", "Import CSV")}
                    </Button>
                  )}
                  {kind !== "history" && (
                    <Button
                      size="small"
                      variant="outline"
                      disabled={disabled}
                      onClick={() => openEditor()}
                    >
                      <Plus size={14} />
                      {t("添加", "Add")}
                    </Button>
                  )}
                  {kind === "history" && (
                    <Button
                      size="small"
                      variant="quiet"
                      disabled={disabled || (!total && !filter)}
                      onClick={() => setConfirm("all")}
                    >
                      {t("清除历史", "Clear history")}
                    </Button>
                  )}
                </>
              }
            />
          }
          sidebar={
            kind === "bookmarks" ? (
              <>
                <Button
                  size="small"
                  variant="quiet"
                  aria-pressed={folder === undefined}
                  onClick={() => chooseFolder(undefined)}
                >
                  {t("全部书签", "All bookmarks")}
                </Button>
                <Button
                  size="small"
                  variant="quiet"
                  aria-pressed={folder === ""}
                  onClick={() => chooseFolder("")}
                >
                  {t("未分组", "Unfiled")}
                </Button>
                <div className="browser-manager-folders">
                  <FileTreeView
                    entries={folderEntries}
                    selected={folder}
                    label={t("书签文件夹", "Bookmark folders")}
                    initiallyOpen
                    selectDirectories
                    onOpen={chooseFolder}
                    onContextMenu={(item, anchor) =>
                      setFolderMenu({ path: item.path, anchor })
                    }
                  />
                </div>
                {folder && (
                  <Button
                    size="small"
                    variant="quiet"
                    disabled={disabled}
                    onClick={() => setFolderName(folder)}
                  >
                    <Pencil size={14} />
                    {t("重命名文件夹", "Rename folder")}
                  </Button>
                )}
              </>
            ) : undefined
          }
          selection={
            selected.length > 0 ? (
              <>
                <span>
                  {t(
                    `已选择 ${selected.length} 项`,
                    `${selected.length} selected`,
                  )}
                </span>
                <Button
                  size="small"
                  variant="quiet"
                  disabled={disabled}
                  onClick={() => setConfirm("selected")}
                >
                  <Trash size={14} />
                  {t("删除所选", "Delete selected")}
                </Button>
                <Button
                  size="small"
                  variant="quiet"
                  disabled={disabled}
                  onClick={() => setSelected([])}
                >
                  {t("取消选择", "Deselect")}
                </Button>
              </>
            ) : undefined
          }
          footer={
            !loading && !loadFailed ? (
              <CollectionPagination
                page={page}
                pageSize={pageSize}
                total={total}
                disabled={disabled}
                onPageChange={setPage}
              />
            ) : undefined
          }
        >
          {loading ? (
            <CollectionState title={t("正在加载…", "Loading…")} busy />
          ) : loadFailed ? (
            <CollectionState
              error
              title={t("无法加载记录", "Could not load records")}
              action={
                <Button size="small" onClick={refresh}>
                  {t("重试", "Retry")}
                </Button>
              }
            />
          ) : !rows.length ? (
            <CollectionState
              title={
                filter
                  ? t("没有匹配记录", "No matching records")
                  : t("暂无记录", "No records yet")
              }
              description={
                filter
                  ? t(
                      "试试其他关键词，或清除搜索。",
                      "Try another query or clear the search.",
                    )
                  : kind === "history"
                    ? t(
                        "访问的页面会显示在这里。",
                        "Pages you visit will appear here.",
                      )
                    : kind === "bookmarks"
                      ? t(
                          "添加书签，或从浏览器设置首页导入。",
                          "Add a bookmark or import from Browser settings.",
                        )
                      : t(
                          "添加账号，或导入密码 CSV。",
                          "Add an account or import a password CSV.",
                        )
              }
              action={
                filter ? (
                  <Button size="small" variant="quiet" onClick={clearSearch}>
                    {t("清除搜索", "Clear search")}
                  </Button>
                ) : kind !== "history" ? (
                  <Button
                    size="small"
                    variant="outline"
                    onClick={() => openEditor()}
                  >
                    {t("添加", "Add")}
                  </Button>
                ) : undefined
              }
            />
          ) : kind === "history" ? (
            [...groups].map(([date, items]) => (
              <SettingsDisclosure
                key={`${page}-${filter}-${date}`}
                title={`${date} · ${items.length}`}
                defaultOpen
              >
                <CollectionTable
                  columns={columns}
                  items={items}
                  rowKey={(item) => item.id}
                  label={`${title} ${date}`}
                />
              </SettingsDisclosure>
            ))
          ) : (
            <CollectionTable
              columns={columns}
              items={rows}
              rowKey={(item) => item.id}
              label={title}
            />
          )}
        </CollectionWorkspace>
      )}
      <PopoverMorph
        open={!!folderMenu}
        anchor={folderMenu?.anchor ?? null}
        onOpenChange={(open) => {
          if (!open) setFolderMenu(undefined);
        }}
        className="browser-folder-menu"
      >
        <MenuPanel label={t("文件夹操作", "Folder actions")}>
          <MenuAction
            icon={<Pencil size={14} />}
            disabled={disabled}
            onSelect={() => {
              chooseFolder(folderMenu!.path);
              setFolderName(folderMenu!.path);
              setFolderMenu(undefined);
            }}
          >
            {t("重命名文件夹", "Rename folder")}
          </MenuAction>
        </MenuPanel>
      </PopoverMorph>
      <Dialog
        open={!!editing}
        onOpenChange={(open) => {
          if (!open && !working) setEditing(null);
        }}
        title={`${editorTitle}${s.zh ? (kind === "bookmarks" ? "书签" : "密码") : kind === "bookmarks" ? " bookmark" : " password"}`}
        size="compact"
      >
        {editing && (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void run(async () => {
                await browserData(
                  kind === "bookmarks" ? "saveBookmark" : "savePassword",
                  editing,
                );
                setEditing(null);
                refresh();
                await notify(t("已保存", "Saved"));
              });
            }}
          >
            <Form columns={1}>
              {Object.keys(editing)
                .filter((key) => key !== "id")
                .map((key, index) => (
                  <Input
                    key={key}
                    label={
                      (
                        {
                          title: t("标题", "Title"),
                          url: t("网址", "URL"),
                          folder: t("文件夹", "Folder"),
                          origin: t("网站", "Website"),
                          username: t("用户名", "Username"),
                          password: editing.id
                            ? t("新密码", "New password")
                            : t("密码", "Password"),
                        } as Record<string, string>
                      )[key]!
                    }
                    hint={
                      key === "folder"
                        ? t(
                            "使用 / 分隔子文件夹，例如 工作/项目。",
                            "Separate nested folders with /, e.g. Work/Project.",
                          )
                        : undefined
                    }
                    type={
                      key === "password"
                        ? "password"
                        : key === "url" || key === "origin"
                          ? "url"
                          : "text"
                    }
                    autoFocus={index === 0}
                    autoComplete={key === "password" ? "new-password" : "off"}
                    required={key !== "folder" && key !== "username"}
                    disabled={working}
                    value={editing[key]}
                    onChange={(value) =>
                      setEditing(
                        (current) => current && { ...current, [key]: value },
                      )
                    }
                  />
                ))}
            </Form>
            <div className="browser-manager-dialog-actions">
              <Button
                size="small"
                variant="quiet"
                disabled={working}
                onClick={() => setEditing(null)}
              >
                {t("取消", "Cancel")}
              </Button>
              <Button
                size="small"
                variant="primary"
                type="submit"
                loading={working}
              >
                {t("保存", "Save")}
              </Button>
            </div>
          </form>
        )}
      </Dialog>
      <Dialog
        open={folderName !== undefined}
        onOpenChange={(open) => {
          if (!open && !working) setFolderName(undefined);
        }}
        title={t("重命名文件夹", "Rename folder")}
        size="compact"
      >
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void run(async () => {
              const target = folderName!
                .split("/")
                .map((value) => value.trim())
                .filter(Boolean)
                .join("/");
              if (!target) return;
              await browserData("renameFolder", { from: folder, to: target });
              setFolderName(undefined);
              chooseFolder(target);
              refresh();
              await notify(t("文件夹已重命名", "Folder renamed"));
            });
          }}
        >
          <Input
            label={t("文件夹名称", "Folder name")}
            autoFocus
            required
            disabled={working}
            value={folderName ?? ""}
            onChange={setFolderName}
          />
          <div className="browser-manager-dialog-actions">
            <Button
              size="small"
              variant="quiet"
              disabled={working}
              onClick={() => setFolderName(undefined)}
            >
              {t("取消", "Cancel")}
            </Button>
            <Button
              size="small"
              variant="primary"
              type="submit"
              loading={working}
            >
              {t("保存", "Save")}
            </Button>
          </div>
        </form>
      </Dialog>
      <Dialog
        open={!!confirm}
        onOpenChange={(open) => {
          if (!open && !working) setConfirm(undefined);
        }}
        title={
          confirm === "all"
            ? t("清除全部浏览历史？", "Clear all browsing history?")
            : t(
                `删除所选 ${selected.length} 条记录？`,
                `Delete ${selected.length} selected records?`,
              )
        }
        size="compact"
        footer={
          <>
            <Button
              size="small"
              variant="quiet"
              disabled={working}
              onClick={() => setConfirm(undefined)}
            >
              {t("取消", "Cancel")}
            </Button>
            <Button
              size="small"
              variant="primary"
              loading={working}
              onClick={() =>
                void run(async () => {
                  if (kind === "history")
                    await browserData(
                      "removeHistory",
                      confirm === "all" ? { all: true } : { ids: selected },
                    );
                  else
                    await browserData("removeSelected", {
                      kind,
                      ids: selected,
                    });
                  setConfirm(undefined);
                  setSelected([]);
                  refresh();
                  await notify(t("已删除记录", "Records deleted"));
                })
              }
            >
              {t("确认删除", "Delete")}
            </Button>
          </>
        }
      >
        <p>{t("此操作不可撤销。", "This cannot be undone.")}</p>
      </Dialog>
    </SettingsPage>
  );
}
