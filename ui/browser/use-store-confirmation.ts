import { useEffect, useRef } from "react";
import type { WebPreviewCommand, WebPreviewState } from "@pal/contracts";
import type { BrowserProps } from "./types";

export function useStoreConfirmation(
  api: BrowserProps["api"],
  prompt: WebPreviewState["extensionStorePrompt"],
  locale: string,
  execute: (command: WebPreviewCommand) => Promise<unknown>,
) {
  const seen = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!prompt || seen.current === prompt.token) return;
    seen.current = prompt.token;
    const zh = locale.startsWith("zh");
    const install = prompt.operation === "install";
    const remove = prompt.operation === "uninstall";
    const title = zh
      ? install
        ? "添加扩展程序？"
        : remove
          ? "移除扩展程序？"
          : "启用扩展程序？"
      : install
        ? "Add extension?"
        : remove
          ? "Remove extension?"
          : "Enable extension?";
    const permissions = prompt.permissions.length
      ? `\n\n${zh ? "请求的权限" : "Requested permissions"}：\n${prompt.permissions.join("\n")}`
      : "";
    void api.dialog
      .confirm({
        title,
        content: prompt.name + (remove ? "" : permissions),
        confirmText: zh
          ? install
            ? "添加扩展程序"
            : remove
              ? "移除"
              : "启用"
          : install
            ? "Add extension"
            : remove
              ? "Remove"
              : "Enable",
        ...(remove ? { tone: "danger" as const } : {}),
      })
      .then((confirmed) =>
        execute({
          type: "extension-store-response",
          token: prompt.token,
          confirmed,
        }),
      )
      .catch(() =>
        execute({
          type: "extension-store-response",
          token: prompt.token,
          confirmed: false,
        }).catch(() => {}),
      );
  }, [api, prompt, locale, execute]);
}
