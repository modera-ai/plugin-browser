import React from "react";
import { Button } from "@pal/ui";
import { Globe } from "@pal/ui/icons";
import type { messages } from "./messages";

type Props = {
  error: string;
  url: string;
  text: ReturnType<typeof messages>;
  retry: () => void;
};

export function BrowserErrorPage({ error, url, text, retry }: Props) {
  let hostname = "";
  try {
    hostname = new URL(url).hostname;
  } catch {}
  const reason =
    error === "ERR_CONNECTION_REFUSED" ? text.errorRefused :
    error === "ERR_NAME_NOT_RESOLVED" ? text.errorDns :
    error === "timeout" || error === "ERR_TIMED_OUT" || error === "ERR_CONNECTION_TIMED_OUT" ? text.timeout :
    error === "page-crashed" ? text.crashed :
    error.includes("blocked") || error === "ERR_BLOCKED_BY_CLIENT" ? text.blocked :
    text.errorConnection;
  const code = /^ERR_[A-Z0-9_]{1,80}$/.test(error) ? error :
    error === "timeout" ? "ERR_TIMED_OUT" : "";
  return (
    <section className="browser-error-page" role="status">
      <div className="browser-error-content">
        <Globe className="browser-error-icon" size={32} aria-hidden="true" />
        <h1>{text.errorTitle}</h1>
        <p>{hostname && <><strong>{hostname}</strong>{" "}</>}{reason}</p>
        <p className="browser-error-try">{text.errorTry}</p>
        <ul><li>{text.errorNetwork}</li><li>{text.errorSettings}</li></ul>
        {code && <code className="browser-error-code">{code}</code>}
        <Button size="small" onClick={retry}>{text.errorRetry}</Button>
      </div>
    </section>
  );
}
