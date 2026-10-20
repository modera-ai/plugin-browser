export type ManagerKind = "bookmarks" | "passwords" | "history" | "cookies";
export type BrowserDataRow = {
  id: string;
  title?: string;
  url?: string;
  folder?: string;
  origin?: string;
  username?: string;
  visitedAt?: number;
};
export type Summary = {
  passwordCount: number;
  cookieCount: number;
  bookmarkCount: number;
  passwords: BrowserDataRow[];
  bookmarks: BrowserDataRow[];
};
export type BrowserCollectionData = Summary & {
  folders: string[];
  filteredBookmarkCount: number;
  filteredPasswordCount: number;
};
