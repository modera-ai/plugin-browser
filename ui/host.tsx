import React from "react";
import BrowserPanel from "./browser/browser-panel";
import type { BrowserProps } from "./browser/types";
// @ts-expect-error The host renderer embeds its styles in the panel ShadowRoot.
import css from "./browser/style.css";
// @ts-expect-error Public UI styles are bundled as text in trusted host modules.
import uiCss from "@pal/ui/styles.css";

export default function BrowserHostPanel(props: BrowserProps) {
  const theme = props.snapshot.theme;
  const colors = theme?.colors;
  const variables = colors
    ? `:host{--mu-page:${colors.page};--mu-card:${colors.card};--mu-control:${colors.control};--mu-ink:${colors.ink};--mu-muted:${colors.muted};--mu-line:${colors.line};--mu-soft:${colors.soft};--mu-accent:${theme?.accent};}`
    : "";
  return (
    <>
      <style>{uiCss + css + variables}</style>
      <BrowserPanel {...props} />
    </>
  );
}
