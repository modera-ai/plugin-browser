import React, { useState } from "react";
import { Button, Dialog, Input, Switch } from "@pal/ui";
import type { WebPreviewCommand, WebPreviewState } from "@pal/contracts";
import type { messages } from "./messages";

type Extension = NonNullable<WebPreviewState["extensions"]>[number];
export function ExtensionsDialog({
  extensions,
  available,
  text,
  execute,
  close,
  fail,
}: {
  extensions: Extension[];
  available: boolean;
  text: ReturnType<typeof messages>;
  execute(command: WebPreviewCommand): Promise<unknown>;
  close(): void;
  fail(error: unknown): void;
}) {
  const [store, setStore] = useState("");
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState<Extension | null>(null);
  const run = async (command: WebPreviewCommand) => {
    if (busy) return;
    setBusy(true);
    try {
      await execute(command);
      return true;
    } catch (error) {
      fail(error);
      return false;
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <Dialog
        open
        title={text.extensions}
        className="browser-extensions-dialog"
        onOpenChange={(open) => {
          if (!open && !busy) close();
        }}
        footer={
          <Button disabled={busy} onClick={close}>
            {text.done}
          </Button>
        }
      >
        <div
          className="browser-extensions-content"
          onWheel={(event) => event.stopPropagation()}
        >
          <p className="browser-extension-note">
            {available ? text.extensionNotice : text.extensionUnavailable}
          </p>
          {available && (
            <>
              <div className="browser-extension-install-actions">
                <Button
                  size="small"
                  disabled={busy}
                  onClick={() =>
                    void run({ type: "extension-install", source: "directory" })
                  }
                >
                  {text.extensionDirectory}
                </Button>
                <Button
                  size="small"
                  disabled={busy}
                  onClick={() =>
                    void run({ type: "extension-install", source: "crx" })
                  }
                >
                  {text.extensionCrx}
                </Button>
              </div>
              <form
                className="browser-extension-store"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (store.trim())
                    void run({
                      type: "extension-install",
                      source: "store",
                      id: store.trim(),
                    }).then((ok) => {
                      if (ok) setStore("");
                    });
                }}
              >
                <Input
                  label={text.extensionStore}
                  value={store}
                  disabled={busy}
                  onChange={(event) => setStore(event.target.value)}
                />
                <Button
                  type="submit"
                  size="small"
                  disabled={busy || !store.trim()}
                >
                  {text.extensionInstall}
                </Button>
              </form>
            </>
          )}
          {!extensions.length && (
            <p className="browser-extension-empty">{text.extensionEmpty}</p>
          )}
          <div className="browser-extension-list">
            {extensions.map((extension) => (
              <section className="browser-extension" key={extension.id}>
                <div className="browser-extension-heading">
                  <div>
                    <strong>{extension.name}</strong>
                    <small>
                      {extension.version} ·{" "}
                      {extension.enabled
                        ? text.extensionEnabled
                        : text.extensionDisabled}
                    </small>
                  </div>
                  <Switch
                    label={extension.name}
                    checked={extension.enabled}
                    disabled={busy || !available}
                    onCheckedChange={(enabled) =>
                      void run({
                        type: "extension-enable",
                        id: extension.id,
                        enabled,
                      })
                    }
                  />
                </div>
                {extension.description && <p>{extension.description}</p>}
                <details>
                  <summary>{text.extensionPermissions}</summary>
                  <p>
                    {extension.permissions.length
                      ? extension.permissions.join(", ")
                      : text.extensionNoPermissions}
                  </p>
                </details>
                {extension.warning && (
                  <p className="browser-extension-note">{extension.warning}</p>
                )}
                <div className="browser-extension-actions">
                  <Button
                    size="small"
                    disabled={busy || !extension.enabled || !available}
                    onClick={() =>
                      void run({ type: "extension-open", id: extension.id })
                    }
                  >
                    {text.extensionOpen}
                  </Button>
                  <Button
                    size="small"
                    disabled={busy || !available}
                    onClick={() => setRemoving(extension)}
                  >
                    {text.remove}
                  </Button>
                </div>
              </section>
            ))}
          </div>
        </div>
      </Dialog>
      {removing && (
        <Dialog
          open
          title={text.extensionRemoveTitle}
          onOpenChange={(open) => {
            if (!open && !busy) setRemoving(null);
          }}
          footer={
            <>
              <Button disabled={busy} onClick={() => setRemoving(null)}>
                {text.cancel}
              </Button>
              <Button
                disabled={busy}
                variant="primary"
                onClick={() =>
                  void run({ type: "extension-remove", id: removing.id }).then(
                    (ok) => {
                      if (ok) setRemoving(null);
                    },
                  )
                }
              >
                {text.remove}
              </Button>
            </>
          }
        >
          <p>{removing.name}</p>
          <p>{text.extensionRemoveHint}</p>
        </Dialog>
      )}
    </>
  );
}
