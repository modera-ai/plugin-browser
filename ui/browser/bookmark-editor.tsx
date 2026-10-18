import React, { useState } from "react";
import { Button, Dialog, Input } from "@pal/ui";
import type { Bookmark } from "./types";
import type { messages } from "./messages";

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
  text: ReturnType<typeof messages>;
  close(): void;
  save(item: Bookmark): Promise<void>;
  remove(): Promise<void>;
  fail(): void;
}) {
  const [title, setTitle] = useState(item.title);
  const [folder, setFolder] = useState(item.folder ?? "");
  const [busy, setBusy] = useState(false);
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
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) close();
      }}
      title={added ? text.bookmarkAdded : text.bookmarkEdit}
      footer={
        <>
          <Button disabled={busy} onClick={() => void run(remove)}>
            {text.remove}
          </Button>
          <Button
            variant="primary"
            disabled={busy || !title.trim()}
            onClick={() =>
              void run(() => save({ ...item, title: title.trim(), folder }))
            }
          >
            {text.done}
          </Button>
        </>
      }
    >
      <div className="browser-bookmark-fields">
        <Input
          label={text.bookmarkName}
          autoFocus
          value={title}
          maxLength={500}
          onFocus={(event) => event.currentTarget.select()}
          onChange={setTitle}
        />
        <Input
          label={text.bookmarkFolder}
          list="browser-bookmark-folders"
          value={folder}
          maxLength={300}
          placeholder={text.bookmarkBar}
          onChange={setFolder}
        />
        <datalist id="browser-bookmark-folders">
          {folders.map((path) => (
            <option key={path} value={path} />
          ))}
        </datalist>
      </div>
    </Dialog>
  );
}
