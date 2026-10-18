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
  const alive = useRef(false);
  const latest = useRef(state);
  const signature = useRef("");
  const processing = useRef(false);
  const failRef = useRef(fail);
  failRef.current = fail;
  const accept = useCallback((next: WebPreviewState) => {
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
      await execute({ type: "tabs-mode", multiple });
      if (!cancelled && !managed && initialUrl && !initial.url)
        await execute({ type: "navigate", url: initialUrl });
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
          });
      }
    })()
      .catch(() => failRef.current())
      .finally(() => {
        processing.current = false;
      });
  }, [state.openRequests, active, api, accept]);
  return { state, execute, command };
}
