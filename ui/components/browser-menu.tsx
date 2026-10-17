import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { renderToStaticMarkup } from "react-dom/server.browser";
import { MenuAction, MenuPanel, PopoverMorph, UiProvider } from "@pal/ui";
import { useLayoutEffect, useRef } from "react";
import { MinusIcon } from "@phosphor-icons/react/dist/csr/Minus";
import * as Icons from "@pal/ui/icons";
import "@pal/ui/styles.css";

export function setIcon(element: HTMLElement, name: keyof typeof Icons | "Minus", size = 18) {
  const Icon = (name === "Minus" ? MinusIcon : Icons[name]) as React.ComponentType<{ size: number }>;
  element.innerHTML = renderToStaticMarkup(<Icon size={size} />);
}
export function createMenuItem(text: string, action: () => void) {
  const template = document.createElement("template");
  template.innerHTML = renderToStaticMarkup(<MenuAction>{text}</MenuAction>);
  const entry = template.content.firstElementChild as HTMLElement;
  entry.querySelector("button")!.onclick = action;
  return entry;
}
function Content({ element }: { element: HTMLElement }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    ref.current!.append(element);
    const scope = document.querySelector(".browser-menu-scope");
    const popup = ref.current!.closest(".browser-menu-popover");
    if (scope && popup) {
      const tokens = getComputedStyle(scope);
      for (let i = 0; i < tokens.length; i++) {
        const name = tokens[i];
        if (name.startsWith("--mu-")) (popup as HTMLElement).style.setProperty(name, tokens.getPropertyValue(name));
      }
    }
  }, [element]);
  return <div ref={ref} />;
}
export function createBrowserMenu(element: HTMLElement, onClose: () => void) {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  return (anchor: HTMLElement | null) => {
    element.hidden = !anchor;
    flushSync(() => root.render(<UiProvider className="browser-menu-scope">{anchor && <PopoverMorph open={!!anchor} anchor={anchor} align="start" onOpenChange={(open) => { if (!open) onClose(); }} className="mu-menu-popover mu-menu-dropdown browser-menu-popover"><MenuPanel label="Browser menu"><Content element={element} /></MenuPanel></PopoverMorph>}</UiProvider>));
    if (!anchor) document.body.append(element);
  };
}
