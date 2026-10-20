import { useCallback, useEffect, useRef, useState } from "react";
import type { WebPreviewCommand, WebPreviewState } from "@pal/contracts";
import type { BrowserApi } from "./types";
const empty: WebPreviewState = {
  url: "",
  title: "",
  loading: false,
  error: "",
  canGoBack: false,
  canGoForward: false,
  tabs: [],
};
/** Bounded page events and popup requests share the existing host-owned native instances. */
export function useBrowser(
  api: BrowserApi,
  active: boolean,
  fail: () => void,
  initialUrl = "",
  managed = false,
) {
  const [state, setState] = useState(empty);
  const [modeReady, setModeReady] = useState(false);
  const initialized = useRef(false);
  const ready = useRef(false);
  const deferred = useRef(
    new Map<string, { url: string; title?: string; favicon?: string }>(),
  );
  const restoreIds = useRef<string[]>([]);
  const restored = useRef(
    api.workspace?.restored?.version === 1
      ? (api.workspace.restored.data as {
          tabs?: { url: string; title?: string; favicon?: string }[];
          selected?: number;
          multiple?: boolean;
          zoom?: number;
        })
      : undefined,
  );
  const alive = useRef(false);
  const latest = useRef(state);
  const signature = useRef("");
  const processing = useRef(false);
  const failRef = useRef(fail);
  failRef.current = fail;
  const accept = useCallback((next: WebPreviewState) => {
    if (deferred.current.size && next.tabs)
      next = {
        ...next,
        tabs: next.tabs.map((tab) => {
          const saved = deferred.current.get(tab.id);
          return saved
            ? {
                ...tab,
                url: tab.url || saved.url,
                title: tab.title || saved.title || "",
                favicon: tab.favicon || saved.favicon,
              }
            : tab;
        }),
      };
    latest.current = next;
    if (alive.current) {
      const value = JSON.stringify(next);
      if (signature.current === value) return;
      signature.current = value;
      setState(next);
    }
  }, []);
  const execute = useCallback(
    async (command: WebPreviewCommand) => {
      const next = await api.webPreview.command(command);
      accept(next);
      return next;
    },
    [api, accept],
  );
  const command = useCallback(
    (value: WebPreviewCommand) => {
      void execute(value).catch(() => failRef.current());
    },
    [execute],
  );
  useEffect(() => {
    alive.current = true;
    if (!active)
      return () => {
        alive.current = false;
      };
    const unsubscribe = api.webPreview.onChanged(accept);
    void api.menu.prepare().catch(() => {});
    let cancelled = false;
    void (async () => {
      await Promise.resolve();
      if (cancelled) return;
      const initial = await execute({ type: "state" });
      let multiple = true;
      try {
        multiple =
          localStorage.getItem("pal.browser.multiple-tabs") !== "false";
      } catch {}
      if (initial.multipleTabs === false) multiple = false;
      const checkpoint = restored.current;
      if (!initialized.current && checkpoint)
        multiple = checkpoint.multiple !== false;
      await execute({ type: "tabs-mode", multiple });
      if (cancelled) return;
      setModeReady(true);
      if (
        !initialized.current &&
        checkpoint &&
        Array.isArray(checkpoint.tabs)
      ) {
        const tabs = checkpoint.tabs
          .slice(0, multiple ? 60 : 1)
          .filter(
            (tab) =>
              tab &&
              typeof tab.url === "string" &&
              (tab.url === "" || /^(https?:|about:blank$)/i.test(tab.url)),
          );
        const ids = restoreIds.current;
        // A renderer/locale replacement can attach to an already live native container.
        // Reuse its pages rather than replaying the checkpoint into duplicate tabs.
        if (!ids.length && (initial.tabs?.length ?? 0) > 1) {
          for (const [index, tab] of initial.tabs!.entries()) {
            ids.push(tab.id);
            if (!tab.url && tabs[index])
              deferred.current.set(tab.id, tabs[index]);
          }
        }
        for (let index = ids.length; index < tabs.length; index++) {
          if (cancelled) return;
          const next =
            index === 0
              ? await execute({ type: "state" })
              : await execute({ type: "tab-create" });
          if (next.activeTab) {
            ids.push(next.activeTab);
            deferred.current.set(next.activeTab, tabs[index]);
          }
        }
        const selected =
          ids[Math.max(0, Math.min(ids.length - 1, checkpoint.selected ?? 0))];
        if (selected && !cancelled) {
          await execute({ type: "tab-select", id: selected });
          const url = deferred.current.get(selected)?.url;
          deferred.current.delete(selected);
          if (url && url !== latest.current.url)
            await execute({ type: "navigate", url });
        }
        if (Number.isFinite(checkpoint.zoom) && !cancelled)
          await execute({
            type: "zoom",
            factor: Math.max(0.25, Math.min(5, checkpoint.zoom!)),
          });
      } else if (
        !initialized.current &&
        !managed &&
        initialUrl &&
        !initial.url
      ) {
        initialized.current = true;
        await execute({ type: "navigate", url: initialUrl });
      }
      initialized.current = true;
      ready.current = true;
    })().catch(() => {
      if (!cancelled) failRef.current();
    });
    return () => {
      cancelled = true;
      alive.current = false;
      unsubscribe();
      api.menu.dismiss();
    };
  }, [api, active, accept, execute, initialUrl, managed]);
  useEffect(() => {
    if (!active || !ready.current || !state.activeTab) return;
    const url = deferred.current.get(state.activeTab)?.url;
    if (!url) return;
    deferred.current.delete(state.activeTab);
    command({ type: "navigate", url });
  }, [state.activeTab, active, command]);
  useEffect(() => {
    if (!ready.current) return;
    api.workspace?.updateMetadata({
      title: state.title || undefined,
      icon: state.tabs?.find((tab) => tab.id === state.activeTab)?.favicon,
    });
    api.workspace?.saveState({
      version: 1,
      data: {
        tabs: (state.tabs ?? []).map((tab) => ({
          url: deferred.current.get(tab.id)?.url ?? tab.url,
          title: tab.title,
          favicon: tab.favicon,
        })),
        selected:
          state.tabs?.findIndex((tab) => tab.id === state.activeTab) ?? 0,
        multiple: state.multipleTabs !== false,
        zoom: state.zoomFactor,
      },
    });
  }, [api, state]);
  useEffect(() => {
    if (!active || processing.current || !state.openRequests?.length) return;
    processing.current = true;
    void (async () => {
      while (alive.current) {
        const next = latest.current.openRequests?.[0];
        if (!next) break;
        const claimed = await api.webPreview.command({
          type: "open-request",
          id: next.id,
        });
        accept(claimed);
        if (claimed.openRequest)
          await api.commands.execute("modera.browser.open", {
            url: claimed.openRequest.url,
            separatePanel: true,
          });
      }
    })()
      .catch(() => failRef.current())
      .finally(() => {
        processing.current = false;
      });
  }, [state.openRequests, active, api, accept]);
  return {
    state: modeReady ? state : { ...state, multipleTabs: false },
    execute,
    command,
  };
}
