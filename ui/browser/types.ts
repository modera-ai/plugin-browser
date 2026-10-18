import type {
  PanelMenuRequest,
  PluginFrontendApi,
  PluginSurfaceSnapshot,
} from "@pal/contracts";
export interface BrowserApi extends Pick<
  PluginFrontendApi,
  "commands" | "webPreview" | "toast" | "dialog" | "snapshot" | "onChanged"
> {
  openSettings(page?: string): Promise<void>;
  menu: {
    show(request: PanelMenuRequest): Promise<string | null>;
    dismiss(): void;
    prepare(): Promise<void>;
  };
}
export interface BrowserProps {
  api: BrowserApi;
  snapshot: PluginSurfaceSnapshot;
  active: boolean;
}
export interface Bookmark {
  id?: string;
  title: string;
  url: string;
  folder?: string;
  favicon?: string;
}
export interface BookmarkNode extends Omit<Bookmark, "url"> {
  title: string;
  url?: string;
  children?: BookmarkNode[];
}
export function bookmarkTree(items: Bookmark[]): BookmarkNode[] {
  const root: BookmarkNode[] = [];
  for (const item of items) {
    let nodes = root;
    for (const title of (item.folder ?? "").split("/").filter(Boolean)) {
      let folder = nodes.find((node) => node.title === title && node.children);
      if (!folder) {
        folder = { title, children: [] };
        nodes.push(folder);
      }
      nodes = folder.children!;
    }
    nodes.push({ ...item });
  }
  return root;
}
