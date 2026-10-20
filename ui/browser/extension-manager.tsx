import React, { useState } from "react";
import { Button, Input, Switch, Tooltip } from "@pal/ui";
import { ArrowLeft, ExternalLink, Puzzle, X } from "lucide-react";
import type { WebPreviewCommand } from "@pal/contracts";
import {
  ExtensionIcon,
  extensionLabels,
  type BrowserExtension,
  type ExtensionsProps,
} from "./extensions-menu";

export function ExtensionManager({
  extensions,
  available,
  text,
  execute,
  close,
  fail,
  confirmRemove,
  onVisitStore,
}: ExtensionsProps & { close(): void; onVisitStore(): void }) {
  const labels = extensionLabels(text);
  const [query, setQuery] = useState("");
  const [store, setStore] = useState("");
  const [busy, setBusy] = useState(false);
  const [detail, setDetail] = useState<string | null>(null);
  const run = async (command: WebPreviewCommand) => {
    if (busy) return false;
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
  const remove = (extension: BrowserExtension) => {
    void confirmRemove(extension)
      .then((confirmed) => {
        if (confirmed) void run({ type: "extension-remove", id: extension.id });
      })
      .catch(fail);
  };
  const shown = extensions.filter((extension) =>
    `${extension.name} ${extension.description ?? ""}`
      .toLocaleLowerCase()
      .includes(query.toLocaleLowerCase().trim()),
  );
  const selected = extensions.find((extension) => extension.id === detail);
  return (
    <section
      className="browser-extension-manager"
      aria-label={text.extensions}
      onWheel={(event) => event.stopPropagation()}
    >
      <header className="browser-extension-manager-header">
        <Tooltip content={labels.back}>
          <Button
            variant="ghost"
            size="small"
            className="browser-extension-toolbar-button"
            aria-label={labels.back}
            onClick={close}
          >
            <ArrowLeft size={16} />
          </Button>
        </Tooltip>
        <h2>{text.extensions}</h2>
        <Input
          className="browser-extension-search"
          label={labels.search}
          placeholder={labels.search}
          value={query}
          onChange={setQuery}
        />
      </header>
      <div className="browser-extension-manager-scroll">
        <div className="browser-extension-manager-tools">
          <Button
            size="small"
            disabled={busy || !available}
            onClick={() =>
              void run({ type: "extension-install", source: "directory" })
            }
          >
            {text.extensionDirectory}
          </Button>
          <Button
            size="small"
            disabled={busy || !available}
            onClick={() =>
              void run({ type: "extension-install", source: "crx" })
            }
          >
            {text.extensionCrx}
          </Button>
          <Button variant="ghost" size="small" onClick={onVisitStore}>
            {labels.store}
            <ExternalLink size={14} />
          </Button>
        </div>
        <form
          className="browser-extension-manager-store"
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
            placeholder={text.extensionStore}
            value={store}
            disabled={busy || !available}
            onChange={setStore}
          />
          <Button
            type="submit"
            size="small"
            disabled={busy || !available || !store.trim()}
          >
            {text.extensionInstall}
          </Button>
        </form>
        {!available && (
          <p className="browser-extension-manager-notice">
            {text.extensionUnavailable}
          </p>
        )}
        {selected ? (
          <section className="browser-extension-detail">
            <div className="browser-extension-detail-heading">
              <Button
                variant="ghost"
                size="small"
                onClick={() => setDetail(null)}
              >
                <ArrowLeft size={14} />
                {text.extensions}
              </Button>
              <Tooltip content={text.close}>
                <Button
                  variant="ghost"
                  size="small"
                  aria-label={text.close}
                  onClick={() => setDetail(null)}
                >
                  <X size={14} />
                </Button>
              </Tooltip>
            </div>
            <div className="browser-extension-card-heading">
              <ExtensionIcon extension={selected} />
              <h3>
                {selected.name}
                <small>{selected.version}</small>
              </h3>
              <Switch
                label={selected.name}
                checked={selected.enabled}
                disabled={busy || !available}
                onCheckedChange={(enabled) =>
                  void run({
                    type: "extension-enable",
                    id: selected.id,
                    enabled,
                  })
                }
              />
            </div>
            {selected.description && <p>{selected.description}</p>}
            <h4>{text.extensionPermissions}</h4>
            <p>
              {selected.permissions.length
                ? selected.permissions.join(", ")
                : text.extensionNoPermissions}
            </p>
            {selected.warning && (
              <p className="browser-extension-manager-notice">
                {selected.warning}
              </p>
            )}
            <div className="browser-extension-card-actions">
              {selected.hasOptions && (
                <Button
                  size="small"
                  disabled={busy || !selected.enabled}
                  onClick={() =>
                    void run({
                      type: "extension-open",
                      id: selected.id,
                      options: true,
                    })
                  }
                >
                  {labels.options}
                </Button>
              )}
              <Button
                size="small"
                disabled={busy || !available}
                onClick={() => remove(selected)}
              >
                {text.remove}
              </Button>
            </div>
          </section>
        ) : (
          <div className="browser-extension-manager-grid">
            {shown.map((extension) => (
              <article key={extension.id} className="browser-extension-card">
                <div className="browser-extension-card-heading">
                  <ExtensionIcon extension={extension} />
                  <h3>
                    {extension.name}
                    <small>{extension.version}</small>
                  </h3>
                </div>
                <p className="browser-extension-card-description">
                  {extension.description ||
                    (extension.enabled
                      ? text.extensionEnabled
                      : text.extensionDisabled)}
                </p>
                {extension.warning && (
                  <p className="browser-extension-manager-notice">
                    {extension.warning}
                  </p>
                )}
                <div className="browser-extension-card-actions">
                  <Button
                    size="small"
                    disabled={busy}
                    onClick={() => setDetail(extension.id)}
                  >
                    {labels.details}
                  </Button>
                  <Button
                    variant="ghost"
                    size="small"
                    disabled={busy || !available}
                    onClick={() => remove(extension)}
                  >
                    {text.remove}
                  </Button>
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
              </article>
            ))}
          </div>
        )}
        {!selected && !shown.length && (
          <div className="browser-extension-manager-empty">
            <Puzzle size={28} />
            <p>{text.extensionEmpty}</p>
          </div>
        )}
      </div>
    </section>
  );
}
