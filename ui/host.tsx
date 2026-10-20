import React from "react";
import BrowserPanel from "./browser/browser-panel";
import type { BrowserProps } from "./browser/types";
import { UiProvider } from "@pal/ui";
import { resolveLocale } from "@pal/contracts";
// @ts-expect-error The host renderer embeds its styles in the panel ShadowRoot.
import css from "./browser/style.css";
// @ts-expect-error CSS is bundled as text for the host ShadowRoot.
import extensionCss from "./browser/extensions.css";
// @ts-expect-error Public UI styles are bundled as text in trusted host modules.
import uiCss from "@pal/ui/styles.css";
// @ts-expect-error Text CSS imports do not expand styles.css @import rules.
import menuCss from "@pal/ui/menu.css";

export default function BrowserHostPanel(props: BrowserProps) {
  const theme = props.snapshot.theme;
  const colors = theme?.colors;
  const variables = colors
    ? `:host{--mu-page:${colors.page};--mu-card:${colors.card};--mu-control:${colors.control};--mu-ink:${colors.ink};--mu-muted:${colors.muted};--mu-line:${colors.line};--mu-soft:${colors.soft};--mu-accent:${theme?.accent};}`
    : "";
  return (
    <>
      <style>{uiCss + menuCss + css + extensionCss + variables}</style>
      <UiProvider
        density="compact"
        portalContainer={props.overlayRoot}
        theme={theme?.mode}
        locale={
          resolveLocale(props.snapshot.locale, ["en", "zh"]) === "zh"
            ? "zh-CN"
            : "en"
        }
        style={
          {
            height: "100%",
            ...(colors
              ? {
                  "--mu-page": colors.page,
                  "--mu-card": colors.card,
                  "--mu-control": colors.control,
                  "--mu-ink": colors.ink,
                  "--mu-muted": colors.muted,
                  "--mu-line": colors.line,
                  "--mu-soft": colors.soft,
                  "--mu-accent": theme?.accent,
                }
              : {}),
          } as React.CSSProperties
        }
      >
        <BrowserPanel {...props} />
      </UiProvider>
    </>
  );
}
