import { useCallback, useEffect, useRef } from "react";
import { frontend, useSettings } from "@pal/plugin-sdk/react";

/** Settings own their action channel; transient failures belong in the public toast. */
export function useBrowserSettings() {
  const settings = useSettings({ autoSave: true });
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const report = useCallback(
    async (cause: unknown, kind: "action" | "save" | "load") => {
      if (
        !mounted.current ||
        (cause instanceof Error && cause.name === "AbortError")
      )
        return;
      console.error(`Browser settings ${kind} failed`, cause);
      const messages = settings.zh
        ? {
            action: "操作失败，请重试",
            save: "设置保存失败，请重试",
            load: "无法加载浏览器设置，请重试",
          }
        : {
            action: "Action failed. Please try again.",
            save: "Could not save settings. Please try again.",
            load: "Could not load browser settings. Please try again.",
          };
      await frontend()
        .toast.show({ level: "error", text: messages[kind] })
        .catch((error) => {
          console.warn("Browser settings toast unavailable", error);
        });
    },
    [settings.zh],
  );
  useEffect(() => {
    if (settings.error) void report(settings.error, "load");
  }, [settings.error, report]);
  useEffect(() => {
    if (settings.failed && settings.message)
      void report(settings.message, "save");
  }, [settings.failed, settings.message, report]);
  return {
    ...settings,
    run: (task: () => Promise<void>) =>
      settings.run(async () => {
        try {
          await task();
        } catch (cause) {
          await report(cause, "action");
        }
      }),
  };
}
