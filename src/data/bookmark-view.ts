import type { BrowserStore } from "./store";
/** Keep toolbar snapshots within the existing frontend response budget. */
export async function bookmarkView(store: BrowserStore) {
  const all = await store.bookmarks();
  let size = 0;
  return {
    bookmarks: all.filter((item) => {
      size += JSON.stringify(item).length;
      return size < 200000;
    }),
    bookmarkCount: all.length,
  };
}
