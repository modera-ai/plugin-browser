export interface Target {
  selector?: string;
  text?: string;
  ref?: string;
}
/** Serialized into the remote page; no references to plugin or Node state. */
function find(input: Target): HTMLElement {
  if (
    [input.selector, input.text, input.ref].filter(
      (value) => value !== undefined,
    ).length !== 1
  )
    throw new Error("Provide exactly one selector, text or ref");
  let nodes: Element[];
  if (input.selector)
    nodes = Array.from(document.querySelectorAll(input.selector));
  else if (input.ref)
    nodes = Array.from(
      document.querySelectorAll(`[data-df-ref="${CSS.escape(input.ref)}"]`),
    );
  else {
    const candidates = Array.from(
      document.querySelectorAll("a,button,input,label,[role],span,div,p"),
    ).slice(0, 20000);
    const name = (node: Element) =>
      (node.getAttribute("aria-label") || node.textContent || "").trim();
    const exact = candidates.filter((node) => name(node) === input.text);
    nodes = (
      exact.length
        ? exact
        : candidates.filter((node) => name(node).includes(input.text!))
    ).sort((a, b) => name(a).length - name(b).length);
  }
  const node = nodes.find((node) => {
    const rect = node.getBoundingClientRect();
    return (
      rect.width > 0 &&
      rect.height > 0 &&
      getComputedStyle(node).visibility !== "hidden"
    );
  });
  if (!(node instanceof HTMLElement))
    throw new Error(
      "Element not found or not visible; obtain a fresh snapshot",
    );
  return node;
}
export function targetScript(input: Target, body: string): string {
  return `(() => { const element = (${find.toString()})(${JSON.stringify(input)}); ${body} })()`;
}
export const pointScript = (input: Target) =>
  targetScript(
    input,
    `element.scrollIntoView({block:'center',inline:'center'}); const r=element.getBoundingClientRect(); const x=Math.max(0,Math.min(innerWidth-1,r.x+r.width/2)); const y=Math.max(0,Math.min(innerHeight-1,r.y+r.height/2)); const top=document.elementFromPoint(x,y); if(top && top!==element && !element.contains(top)) throw new Error('Element covered by another element'); return {x:Math.round(x),y:Math.round(y)};`,
  );
export function snapshotScript(maxChars = 14000): string {
  return `(() => {
    const text=(document.body?.innerText||'');
    const prefix='df-'+Math.random().toString(36).slice(2,9)+'-';
    const elements=Array.from(document.querySelectorAll('a,button,input,textarea,select,[role],[contenteditable="true"]')).filter(el=>{const r=el.getBoundingClientRect();return r.width>0&&r.height>0&&getComputedStyle(el).visibility!=='hidden'}).slice(0,60).map((el,i)=>{const ref=prefix+i;el.setAttribute('data-df-ref',ref);return {ref,tag:el.tagName.toLowerCase(),role:el.getAttribute('role'),name:(el.getAttribute('aria-label')||el.getAttribute('placeholder')||el.textContent||'').trim().slice(0,100),type:el.getAttribute('type')};});
    return {url:location.href,title:document.title,text:text.slice(0,${maxChars}),truncated:text.length>${maxChars},elements,contentTrust:'untrusted'};
  })()`;
}
