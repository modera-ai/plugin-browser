import React, { useState, type ReactNode } from "react";
import { Globe } from "@pal/ui/icons";
import { faviconUrl } from "../../src/data/favicon";

/** Share favicon validation and the same failed-image fallback across browser surfaces. */
export function siteIconUrl(url: string, ...sources: (string | undefined)[]) {
  for (const source of sources) {
    const safe = faviconUrl(source);
    if (safe) return safe;
  }
  try {
    const parsed = new URL(url);
    if (["http:", "https:"].includes(parsed.protocol) && !parsed.username && !parsed.password)
      return new URL("/favicon.ico", parsed.origin).href;
  } catch {}
}
export function SiteIcon({ src, size = 16, fallback }: { src?: string; size?: number; fallback?: ReactNode }) {
  const [failed, setFailed] = useState<string>();
  const safe = faviconUrl(src);
  return safe && safe !== failed ? (
    <img className="browser-favicon" src={safe} alt="" aria-hidden="true"
      width={size} height={size} style={{ width: size, height: size, objectFit: "contain", flex: "none" }}
      referrerPolicy="no-referrer" onError={() => setFailed(safe)} />
  ) : <>{fallback ?? <Globe size={size} />}</>;
}
