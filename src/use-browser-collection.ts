import { useEffect, useRef, useState } from "react";
import { browserData } from "./data-command";
import type {
  ManagerKind,
  BrowserDataRow as Row,
  BrowserCollectionData as Data,
} from "./browser-data-types";

export function useBrowserCollection(kind: ManagerKind) {
  const [filter, setFilter] = useState("");
  const [folder, setFolder] = useState<string>();
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<Row[]>([]);
  const [folders, setFolders] = useState<string[]>([]);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(kind !== "cookies");
  const [loadFailed, setLoadFailed] = useState(false);
  const [working, setWorking] = useState(false);
  const [revision, setRevision] = useState(0);
  const [revealed, setRevealed] = useState<{ id: string; password: string }>();
  const request = useRef(0);
  const alive = useRef(true);
  const pageSize = kind === "history" ? 100 : 50;
  const disabled = loading || working;
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      request.current++;
    };
  }, []);
  useEffect(() => {
    if (kind === "cookies") return;
    const id = ++request.current;
    setLoading(true);
    setLoadFailed(false);
    setSelected([]);
    setRevealed(undefined);
    void (async () => {
      try {
        let items: Row[], count: number;
        if (kind === "history") {
          const data = await browserData<{ items: Row[]; total: number }>(
            "history",
            { query: filter, page, includePagination: true },
          );
          items = data.items;
          count = data.total;
        } else {
          const data = await browserData<Data>("dataSummary", {
            query: filter,
            page,
            ...(folder === undefined ? {} : { folder }),
          });
          items = data[kind];
          count =
            kind === "bookmarks"
              ? data.filteredBookmarkCount
              : data.filteredPasswordCount;
          if (id === request.current) setFolders(data.folders);
        }
        if (id !== request.current) return;
        if (page > 0 && page * pageSize >= count) {
          setPage(Math.max(0, Math.ceil(count / pageSize) - 1));
          return;
        }
        setRows(items);
        setTotal(count);
      } catch (error) {
        console.error("Browser collection load failed", error);
        if (id === request.current) setLoadFailed(true);
      } finally {
        if (id === request.current) setLoading(false);
      }
    })();
    return () => {
      request.current++;
    };
  }, [kind, page, filter, folder, revision]);

  useEffect(() => {
    if (!revealed) return;
    const hide = () => setRevealed(undefined);
    const timer = window.setTimeout(hide, 30_000);
    window.addEventListener("blur", hide);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("blur", hide);
    };
  }, [revealed]);
  const refresh = () => setRevision((value) => value + 1);
  return {
    filter,
    setFilter,
    folder,
    setFolder,
    page,
    setPage,
    rows,
    folders,
    total,
    selected,
    setSelected,
    loading,
    loadFailed,
    working,
    setWorking,
    revealed,
    setRevealed,
    request,
    alive,
    pageSize,
    disabled,
    refresh,
  };
}
