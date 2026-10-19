import { useLayoutEffect, useRef, useState } from "react";

/** Keep a prefix in the bar; measure actual labels rather than guessing by count. */
export function useBookmarkOverflow(items: readonly unknown[]) {
  const bar = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(items.length);
  useLayoutEffect(() => {
    const element = bar.current;
    if (!element) return;
    let frame = 0;
    let alive = true;
    const measure = () => {
      frame = 0;
      if (!alive || !element.isConnected || element.clientWidth === 0) return;
      const style = getComputedStyle(element);
      const gap = parseFloat(style.columnGap) || 0;
      const available =
        element.clientWidth -
        (parseFloat(style.paddingLeft) || 0) -
        (parseFloat(style.paddingRight) || 0);
      const widths = [
        ...element.querySelectorAll<HTMLElement>("[data-bookmark-item]"),
      ].map((item) => item.getBoundingClientRect().width);
      const total =
        widths.reduce((sum, width) => sum + width, 0) +
        Math.max(0, widths.length - 1) * gap;
      if (total <= available) {
        setVisible(widths.length);
        return;
      }
      const more = element.querySelector<HTMLElement>(
        ".browser-bookmarks-more",
      )!;
      const budget = available - more.getBoundingClientRect().width;
      let used = 0,
        count = 0;
      for (const width of widths) {
        // Every visible bookmark also needs the gap before the trailing overflow button.
        if (used + width + gap > budget) break;
        used += width + gap;
        count++;
      }
      setVisible(count);
    };
    const schedule = () => {
      if (alive && !frame) frame = requestAnimationFrame(measure);
    };
    measure();
    const observer = new ResizeObserver(schedule);
    observer.observe(element);
    for (const item of element.querySelectorAll<HTMLElement>(
      "[data-bookmark-item]",
    ))
      observer.observe(item);
    void document.fonts.ready.then(schedule);
    return () => {
      alive = false;
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [items]);
  return { bar, visible: Math.min(visible, items.length) };
}
