/** Only displayable website icons; never persist local or executable URLs. */
export function faviconUrl(value: unknown): string | undefined {
  if (typeof value !== "string" || value.length > 32768) return;
  if (
    /^data:image\/(?:png|gif|jpeg|webp|avif|x-icon|vnd.microsoft.icon|svg\+xml)[;,]/i.test(
      value,
    )
  )
    return value;
  try {
    const url = new URL(value);
    if (
      ["https:", "http:"].includes(url.protocol) &&
      !url.username &&
      !url.password
    )
      return url.href;
  } catch {}
}
