import React, { useState } from "react";
import { Button, Dialog } from "@pal/ui";
import { Globe, Download, Settings, Edit, Image, Cookie } from "lucide-react";
import type { messages } from "./messages";
type Text = ReturnType<typeof messages>;
export type ClearSelection = {
  since: number;
  history: boolean;
  cookies: boolean;
  cache: boolean;
  downloads: boolean;
};
export function ClearDataDialog({
  text: t,
  close,
  clear,
  fail,
}: {
  text: Text;
  close(): void;
  clear(value: ClearSelection): Promise<void>;
  fail(error: unknown): void;
}) {
  const [hours, setHours] = useState(1),
    [busy, setBusy] = useState(false);
  const [checked, setChecked] = useState({
    history: true,
    cookies: true,
    cache: true,
    downloads: true,
  });
  const rows = [
    { key: "history", title: t.history, hint: t.historyRange, Icon: Globe },
    { key: "cookies", title: t.siteData, hint: t.allStorage, Icon: Cookie },
    { key: "cache", title: t.cacheData, hint: t.allStorage, Icon: Image },
    {
      key: "downloads",
      title: t.downloads,
      hint: t.allStorage,
      Icon: Download,
    },
    {
      key: "formData",
      title: t.formData,
      hint: t.unavailable,
      Icon: Edit,
      disabled: true,
    },
    {
      key: "siteSettings",
      title: t.siteSettings,
      hint: t.unavailable,
      Icon: Settings,
      disabled: true,
    },
  ];
  const submit = async () => {
    setBusy(true);
    try {
      await clear({
        ...checked,
        since: hours ? Date.now() - hours * 3600000 : 0,
      });
      close();
    } catch (error) {
      fail(error);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      open
      title={t.clearData}
      className="browser-clear-dialog"
      onOpenChange={(open) => {
        if (!open && !busy) close();
      }}
      footer={
        <>
          <Button onClick={close} disabled={busy}>
            {t.cancel}
          </Button>
          <Button
            variant="primary"
            disabled={busy || !Object.values(checked).some(Boolean)}
            onClick={() => void submit()}
          >
            {busy ? t.working : t.deleteData}
          </Button>
        </>
      }
    >
      <div onWheel={(event) => event.stopPropagation()}>
        <div
          className="browser-clear-ranges"
          role="group"
          aria-label={t.clearData}
        >
          {[
            [1, t.hour],
            [24, t.day],
            [168, t.week],
            [672, t.month],
            [0, t.allTime],
          ].map(([value, label]) => (
            <button
              key={value}
              disabled={busy}
              aria-pressed={hours === value}
              onClick={() => setHours(Number(value))}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="browser-clear-rows">
          {rows.map(({ key, title, hint, Icon, disabled }) => (
            <label key={key} className={disabled ? "disabled" : ""}>
              <Icon size={18} />
              <span>
                <strong>{title}</strong>
                <small>{hint}</small>
              </span>
              <input
                type="checkbox"
                disabled={busy || disabled}
                checked={
                  key in checked ? checked[key as keyof typeof checked] : false
                }
                onChange={(event) =>
                  setChecked((previous) => ({
                    ...previous,
                    [key]: event.target.checked,
                  }))
                }
              />
            </label>
          ))}
        </div>
      </div>
    </Dialog>
  );
}
