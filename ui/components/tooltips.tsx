import { Tooltip } from '@modera/ui/tooltip';
import { createRoot, type Root } from 'react-dom/client';
import { flushSync } from 'react-dom';
import '@modera/ui/tooltip.css';

const roots = new WeakMap<HTMLButtonElement, Root>();
/** Adapt existing DOM buttons without duplicating the UI library's tooltip. */
export function setTooltip(button: HTMLButtonElement, label: string) {
  let root = roots.get(button);
  const attributes = Object.fromEntries(Array.from(button.attributes)
    .filter(a => !['title', 'aria-describedby', 'data-state'].includes(a.name))
    .map(a => [a.name, a.value]));
  const html = button.innerHTML;
  if (!root) {
    const host = document.createElement('span');
    host.style.display = 'contents';
    button.replaceWith(host);
    root = createRoot(host);
  }
  flushSync(() => root!.render(<Tooltip content={label} side="bottom">
    <button {...attributes} aria-label={label} disabled={button.disabled} dangerouslySetInnerHTML={{__html:html}} />
  </Tooltip>));
  const current = button.id ? document.getElementById(button.id) : null;
  if (current instanceof HTMLButtonElement) {
    roots.set(current,root);
  }
}
