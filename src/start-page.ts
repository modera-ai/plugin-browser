import { normalizeBrowserUrl } from "@pal/contracts";

/** A malformed optional preference must not prevent opening a browser panel. */
export function startPageUrl(value: unknown): string {
  if (typeof value !== "string") return "";
  let address = value.trim();
  if (!address) return "";
  if (
    /^(?:localhost|(?:[a-z\d-]+\.)+[a-z\d-]+|\[[a-f\d:]+\])(?::\d+)?(?:[/?#].*)?$/i.test(address)
  ) {
    const local = /^(?:localhost(?=[:/?#]|$)|127\.|10\.|192\.168\.|\[::1\])/i.test(address);
    address = `${local ? "http" : "https"}://${address}`;
  }
  try {
    return normalizeBrowserUrl(address);
  } catch {
    return "";
  }
}
