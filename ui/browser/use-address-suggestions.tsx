import React, { useEffect, useMemo, useState } from "react";
import { Globe, Search, Star } from "@pal/ui/icons";
import type { InputSuggestion } from "@pal/ui";
import type { Bookmark } from "./types";
import type { BrowserDataCall } from "../../src/browser-import-dialog";

type HistoryEntry = { url: string; title: string };
export function addressTarget(value: string): string {
  const query = value.trim();
  if (/^https?:\/\//i.test(query)) return query;
  if (!/\s/.test(query) && /^(?:localhost|(?:[a-z\d-]+\.)+[a-z\d-]+|\[[a-f\d:]+\])(?::\d+)?(?:[/?#].*)?$/i.test(query)) {
    const local = /^(?:localhost|127\.|10\.|192\.168\.|\[::1\])/i.test(query);
    return `${local ? "http" : "https"}://${query}`;
  }
  return `https://www.bing.com/search?q=${encodeURIComponent(query)}`;
}
const displayUrl = (url: string) => url.replace(/^https?:\/\//i, "").replace(/\/$/, "");
export function useAddressSuggestions(invoke: BrowserDataCall, bookmarks: Bookmark[], searchLabel: string) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      void invoke("history", { query }).then((value) => {
        if (!cancelled && Array.isArray(value)) setHistory(value.filter((row): row is HistoryEntry =>
          !!row && typeof row.url === "string" && typeof row.title === "string" && /^https?:\/\//i.test(row.url)));
      }).catch(() => { if (!cancelled) setHistory([]); });
    }, 100);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [invoke, open, query]);
  const suggestions = useMemo(() => {
    const result: InputSuggestion[] = [];
    const seen = new Set<string>();
    const needle = query.trim().toLocaleLowerCase();
    for (const row of [...history, ...bookmarks]) {
      if (!/^https?:\/\//i.test(row.url) || seen.has(row.url) || (needle && !`${row.title} ${row.url}`.toLocaleLowerCase().includes(needle))) continue;
      seen.add(row.url);
      const bookmark = bookmarks.some((item) => item.url === row.url);
      result.push({ value: row.url, label: row.title || displayUrl(row.url), description: displayUrl(row.url),
        completion: displayUrl(row.url), icon: bookmark ? <Star size={14} /> : <Globe size={14} /> });
      if (result.length === 7) break;
    }
    if (needle) {
      const target = addressTarget(query);
      const search = target.startsWith("https://www.bing.com/search?q=");
      const entry = { value: target, label: search ? `${query} — ${searchLabel}` : displayUrl(target),
        description: search ? "Bing" : target, icon: search ? <Search size={14} /> : <Globe size={14} /> };
      if (!seen.has(target)) result.push(entry);
    }
    return result;
  }, [history, bookmarks, query, searchLabel]);
  return { suggestions, setQuery, setOpen };
}
