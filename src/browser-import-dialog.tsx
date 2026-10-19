import React, { useEffect, useState } from "react";
import { Button, Dialog, DialogNotice, Select, Switch } from "@pal/ui";
import { Form, FormItem } from "@pal/ui/settings";
import { messages } from "../ui/browser/messages";
export type BrowserDataCall = <T = unknown>(
  operation: string,
  value?: unknown,
) => Promise<T>;
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
/** One import dialog shared by settings and native-page chrome. */
export function BrowserImportDialog({
  locale,
  invoke,
  close,
  notify,
  fail,
}: {
  locale: string;
  invoke: BrowserDataCall;
  close(): void;
  notify(): void;
  fail(error: unknown): void;
}) {
  const t = messages(locale);
  const [sources, setSources] = useState<Source[]>([]),
    [selected, setSelected] = useState("");
  const [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [closed, setClosed] = useState(false);
  const [choices, setChoices] = useState({
    passwords: true,
    cookies: false,
    bookmarks: true,
  });
  useEffect(() => {
    let alive = true;
    void invoke<Source[]>("scanBrowsers")
      .then((rows) => {
        if (alive) {
          setSources(rows);
          setSelected(rows[0]?.id ?? "");
        }
      })
      .catch((error) => {
        if (alive) fail(error);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [invoke]);
  const source = sources.find((row) => row.id === selected);
  const enabled =
    !!source &&
    closed &&
    !busy &&
    Object.keys(choices).some(
      (key) =>
        choices[key as keyof typeof choices] &&
        source[key as keyof typeof choices] > 0,
    );
  const run = async () => {
    if (!source || !enabled) return;
    setBusy(true);
    try {
      await invoke("importSelected", {
        source: source.id,
        passwords: choices.passwords && !!source.passwords,
        cookies: choices.cookies && !!source.cookies,
        bookmarks: choices.bookmarks && !!source.bookmarks,
      });
      notify();
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
      title={t.importTitle}
      description={t.importDescription}
      onOpenChange={(open) => {
        if (!open && !busy) close();
      }}
      footer={
        <>
          <Button disabled={busy} onClick={close}>
            {t.cancel}
          </Button>
          <Button
            variant="primary"
            disabled={!enabled}
            onClick={() => void run()}
          >
            {busy ? t.working : t.importSelected}
          </Button>
        </>
      }
    >
      <div onWheel={(event) => event.stopPropagation()}>
        {loading ? (
          <DialogNotice>{t.loading}</DialogNotice>
        ) : !sources.length ? (
          <DialogNotice>{t.importNone}</DialogNotice>
        ) : (
          <>
            <Form>
              <FormItem variant="inline" label={t.profile}>
                <Select
                  label={t.profile}
                  value={selected}
                  onValueChange={(value) => {
                    setSelected(value);
                    setClosed(false);
                  }}
                  disabled={busy}
                  options={sources.map((row) => ({
                    value: row.id,
                    label: `${row.name} · ${row.account || row.profile}`,
                  }))}
                />
              </FormItem>
            </Form>
            <DialogNotice>{t.importWarning}</DialogNotice>
            <Form>
              <FormItem variant="inline" label={t.importClosed}>
                <Switch
                  label={t.importClosed}
                  checked={closed}
                  onCheckedChange={setClosed}
                  disabled={busy}
                />
              </FormItem>
              {(["passwords", "cookies", "bookmarks"] as const).map((key) => (
                <FormItem
                  key={key}
                  variant="inline"
                  label={`${t[key]} (${source?.[key] ?? 0})`}
                >
                  <Switch
                    label={t[key]}
                    checked={!!source?.[key] && choices[key]}
                    disabled={busy || !source?.[key]}
                    onCheckedChange={(value) =>
                      setChoices((previous) => ({ ...previous, [key]: value }))
                    }
                  />
                </FormItem>
              ))}
            </Form>
            <DialogNotice>{t.importNote}</DialogNotice>
            {source?.note && (
              <DialogNotice tone="warning">{source.note}</DialogNotice>
            )}
          </>
        )}
      </div>
    </Dialog>
  );
}
