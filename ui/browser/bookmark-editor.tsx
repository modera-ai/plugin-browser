import React, { useMemo, useState } from "react";
import { Button, Dialog, Input, Menu } from "@pal/ui";
import { ChevronDown, Folder, Globe } from "@pal/ui/icons";
import type { Bookmark } from "./types";
import type { messages } from "./messages";

type Text = ReturnType<typeof messages>;
function FolderList({
  paths,
  parent = "",
  selected,
  select,
}: {
  paths: string[];
  parent?: string;
  selected: string;
  select(path: string): void;
}) {
  const children = paths.filter(
    (path) =>
      path.slice(0, path.lastIndexOf("/") + 1) === (parent ? parent + "/" : ""),
  );
  return (
    <ul className="browser-folder-list">
      {children.map((path) => {
        const nested = paths.some((other) => other.startsWith(path + "/"));
        const label = path.slice(path.lastIndexOf("/") + 1);
        const row = (
          <button
            type="button"
            aria-pressed={selected === path}
            onClick={() => select(path)}
          >
            <Folder size={16} />
            <span>{label}</span>
          </button>
        );
        return (
          <li key={path}>
            {nested ? (
              <details
                open={selected === path || selected.startsWith(path + "/")}
              >
                <summary>
                  <span className="browser-folder-disclosure" />
                  {row}
                </summary>
                <FolderList
                  paths={paths}
                  parent={path}
                  selected={selected}
                  select={select}
                />
              </details>
            ) : (
              <div className="browser-folder-leaf">{row}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
export function BookmarkEditor({
  item,
  added,
  folders,
  text,
  close,
  save,
  remove,
  fail,
}: {
  item: Bookmark;
  added: boolean;
  folders: string[];
  text: Text;
  close(): void;
  save(item: Bookmark): Promise<void>;
  remove(): Promise<void>;
  fail(): void;
}) {
  const [title, setTitle] = useState(item.title);
  const [folder, setFolder] = useState(item.folder ?? "");
  const [url, setUrl] = useState(item.url);
  const [advanced, setAdvanced] = useState(false);
  const [extraFolders, setExtraFolders] = useState<string[]>([]);
  const [newFolder, setNewFolder] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [failedIcon, setFailedIcon] = useState(false);
  const paths = useMemo(
    () =>
      [
        ...new Set(
          [...folders, ...extraFolders, folder].flatMap((path) => {
            const parts = path.split("/").filter(Boolean);
            return parts.map((_, index) => parts.slice(0, index + 1).join("/"));
          }),
        ),
      ].sort((a, b) => a.localeCompare(b)),
    [folders, extraFolders, folder],
  );
  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    try {
      await action();
      close();
    } catch {
      fail();
    } finally {
      setBusy(false);
    }
  };
  let favicon = item.favicon;
  try {
    favicon ??= /^https?:/.test(item.url)
      ? new URL("/favicon.ico", item.url).href
      : undefined;
  } catch {}
  const valid = !!title.trim() && !!url.trim();
  const commit = () =>
    run(() => save({ ...item, title: title.trim(), url: url.trim(), folder }));
  const addFolder = () => {
    const name = newFolder?.trim().replace(/[\/]+/g, " ");
    if (!name) return;
    const path = folder ? folder + "/" + name : name;
    setExtraFolders((previous) => [...previous, path]);
    setFolder(path);
    setNewFolder(null);
  };
  return (
    <Dialog
      open
      className={
        advanced ? "browser-bookmark-picker" : "browser-bookmark-editor"
      }
      onOpenChange={(open) => {
        if (!open && !busy) close();
      }}
      title={
        advanced
          ? text.bookmarkEdit
          : added
            ? text.bookmarkAdded
            : text.bookmarkEdit
      }
      footerStart={
        advanced ? (
          <Button disabled={busy} onClick={() => setNewFolder("")}>
            {text.newFolder}
          </Button>
        ) : undefined
      }
      footer={
        <>
          <Button
            disabled={busy}
            onClick={() => (advanced ? setAdvanced(false) : void run(remove))}
          >
            {advanced ? text.cancel : text.remove}
          </Button>
          <Button
            variant="primary"
            disabled={busy || !valid}
            onClick={() => void commit()}
          >
            {advanced ? text.save : text.done}
          </Button>
        </>
      }
    >
      <div className="browser-bookmark-layout">
        {!advanced && (
          <div className="browser-bookmark-preview">
            {favicon && !failedIcon ? (
              <img
                src={favicon}
                alt=""
                referrerPolicy="no-referrer"
                onError={() => setFailedIcon(true)}
              />
            ) : (
              <Globe size={24} />
            )}
          </div>
        )}
        <div className="browser-bookmark-fields">
          <Input
            label={text.bookmarkName}
            autoFocus
            value={title}
            maxLength={500}
            onFocus={(event) => event.currentTarget.select()}
            onChange={setTitle}
          />
          {advanced ? (
            <Input
              label={text.bookmarkUrl}
              value={url}
              maxLength={8192}
              onChange={setUrl}
            />
          ) : (
            <div className="browser-folder-field">
              <span>{text.bookmarkFolder}</span>
              <Menu
                className="browser-folder-select"
                popupAlign="start"
                label={text.bookmarkFolder}
                triggerContent={
                  <>
                    <span>{folder || text.bookmarkBar}</span>
                    <ChevronDown size={16} />
                  </>
                }
                items={[
                  {
                    label: text.bookmarkBar,
                    checked: folder === "",
                    onSelect: () => setFolder(""),
                  },
                  ...[...new Set([folder, ...paths])]
                    .filter(Boolean)
                    .slice(0, 6)
                    .map((path) => ({
                      label: path,
                      checked: folder === path,
                      onSelect: () => setFolder(path),
                    })),
                  {
                    label: text.chooseFolder,
                    separatorBefore: true,
                    onSelect: () => setAdvanced(true),
                  },
                ]}
              />
            </div>
          )}
        </div>
      </div>
      {advanced && (
        <>
          <div
            className="browser-folder-tree"
            aria-label={text.bookmarkFolder}
            // Keep native scrolling inside the shadow-root dialog. The modal's
            // document-level scroll lock sees a retargeted event outside its content.
            onWheel={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="browser-folder-root"
              aria-pressed={folder === ""}
              onClick={() => setFolder("")}
            >
              <Folder size={16} />
              {text.bookmarkBar}
            </button>
            <FolderList paths={paths} selected={folder} select={setFolder} />
          </div>
          {newFolder !== null && (
            <div className="browser-new-folder">
              <Input
                label={text.newFolder}
                autoFocus
                maxLength={100}
                value={newFolder}
                onChange={setNewFolder}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addFolder();
                  }
                }}
              />
              <Button onClick={addFolder} disabled={!newFolder.trim()}>
                {text.done}
              </Button>
              <Button onClick={() => setNewFolder(null)}>{text.cancel}</Button>
            </div>
          )}
        </>
      )}
    </Dialog>
  );
}
