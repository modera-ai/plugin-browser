import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import type {
  PluginContext,
  ToolContribution,
  WebPageCommand,
  WebPageInfo,
} from "@pal/plugin-sdk";
import { definitions } from "./definitions";
import { startPageUrl } from "./start-page";
import {
  pointScript,
  snapshotScript,
  targetScript,
  type Target,
} from "./page-scripts";
interface Input extends Target {
  domain?: string;
  name?: string;
  showValues?: boolean;
  offset?: number;
  limit?: number;
  instanceId?: string;
  url?: string;
  action?: string;
  button?: string;
  values?: string[];
  key?: string;
  targetText?: string;
  clear?: boolean;
  submit?: boolean;
  expression?: string;
  files?: string[];
  maxChars?: number;
  state?: string;
  timeMs?: number;
  timeoutMs?: number;
}
export function browserTools(host: PluginContext): ToolContribution[] {
  return definitions.map((definition) => ({
    definition,
    async execute(raw, context) {
      if (!host.webPages)
        throw new Error("Browser host capability unavailable");
      const input = raw as Input;
      const signal = AbortSignal.any([host.signal, context.signal]);
      const bound = { ...context, signal };
      const execute = (command: WebPageCommand) =>
        host.webPages!.execute(command, bound);
      const name = definition.id.slice("browser_".length);
      if (name === "list") return execute({ type: "list" });
      if (name === "create") {
        const url =
          input.url ??
          startPageUrl(
            (await host.config?.read(context.projectId))?.values.startPage ??
              "",
          );
        const created = (await execute({
          type: "create",
          panel: "pal.browser.preview",
          resource: JSON.stringify({ key: randomUUID(), url, automated: true }),
        })) as WebPageInfo;
        return url
          ? execute({ type: "navigate", instanceId: created.instanceId, url })
          : created;
      }
      const instance = input.instanceId ? { instanceId: input.instanceId } : {};
      const evaluate = (expression: string) =>
        execute({ type: "evaluate", ...instance, expression });
      const send = (event: Record<string, unknown>) =>
        execute({ type: "input", ...instance, event });
      const press = async (key: string) => {
        const keys = key.split("+");
        const rawKey = keys.pop()!;
        const keyCode =
          (
            {
              ArrowUp: "Up",
              ArrowDown: "Down",
              ArrowLeft: "Left",
              ArrowRight: "Right",
            } as Record<string, string>
          )[rawKey] ?? rawKey;
        const aliases: Record<string, string> = {
          control: "control",
          ctrl: "control",
          meta: "meta",
          cmd: "meta",
          shift: "shift",
          alt: "alt",
        };
        const modifiers = keys.map((key) => {
          const value = aliases[key.toLowerCase()];
          if (!value) throw new Error("Unknown key modifier");
          return value;
        });
        await send({ type: "keyDown", keyCode, modifiers });
        await send({ type: "keyUp", keyCode, modifiers });
      };
      if (["navigate", "close", "focus", "back", "forward"].includes(name)) {
        const result = await execute(
          name === "navigate"
            ? { type: "navigate", ...instance, url: input.url! }
            : {
                type: name as "close" | "focus" | "back" | "forward",
                ...instance,
              },
        );
        if (name === "back" || name === "forward" || name === "focus") {
          const id = (result as WebPageInfo).instanceId;
          const deadline = Date.now() + 25000;
          do {
            await delay(100, undefined, { signal });
            const page = (
              (await execute({ type: "list" })) as WebPageInfo[]
            ).find((page) => page.instanceId === id);
            if (!page) throw new Error("Browser page closed during navigation");
            if (name === "focus" ? page.active : !page.loading) return page;
          } while (Date.now() < deadline);
          throw new Error("BROWSER_NAVIGATION_TIMEOUT");
        }
        return result;
      }
      if (name === "screenshot") {
        const result = (await execute({ type: "capture", ...instance })) as {
          mimeType: "image/jpeg";
          data: string;
          instanceId: string;
          url: string;
        };
        const { data, mimeType, ...metadata } = result;
        return { ...metadata, images: [{ mimeType, data }] };
      }
      if (name === "evaluate") return evaluate(input.expression!);
      if (name === "get_tab_content")
        return evaluate(snapshotScript(input.maxChars));
      if (name === "devtools") {
        if (input.action === "cookies")
          return execute({
            type: "cookies",
            ...instance,
            ...(input.domain !== undefined ? { domain: input.domain } : {}),
            ...(input.showValues !== undefined
              ? { showValues: input.showValues }
              : {}),
            ...(input.offset !== undefined ? { offset: input.offset } : {}),
            ...(input.limit !== undefined ? { limit: input.limit } : {}),
          });
        if (input.action === "cookieDelete") {
          if (!input.domain || !input.name)
            throw new Error("cookieDelete requires name and domain");
          return execute({
            type: "cookieDelete",
            ...instance,
            name: input.name,
            domain: input.domain,
          });
        }
        if (input.action === "console")
          return execute({ type: "console", ...instance });
        if (input.action === "ax") {
          const result = (await execute({
            type: "cdp",
            ...instance,
            method: "Accessibility.getFullAXTree",
          })) as {
            nodes: {
              ignored?: boolean;
              role?: { value?: string };
              name?: { value?: string };
              backendDOMNodeId?: number;
            }[];
          };
          return {
            nodes: result.nodes
              .filter((node) => !node.ignored)
              .slice(0, 150)
              .map((node) => ({
                role: node.role?.value,
                name: node.name?.value?.slice(0, 100),
                backendDOMNodeId: node.backendDOMNodeId,
              })),
            contentTrust: "untrusted",
          };
        }
        return evaluate(snapshotScript());
      }
      if (name === "press_key") {
        await press(input.key!);
        return { pressed: input.key };
      }
      if (name === "upload_file") {
        const tree = (await execute({
          type: "cdp",
          ...instance,
          method: "DOM.getDocument",
        })) as { root: { nodeId: number } };
        const node = (await execute({
          type: "cdp",
          ...instance,
          method: "DOM.querySelector",
          params: { nodeId: tree.root.nodeId, selector: input.selector! },
        })) as { nodeId: number };
        if (!node.nodeId) throw new Error("File input not found");
        await execute({
          type: "cdp",
          ...instance,
          method: "DOM.setFileInputFiles",
          params: { nodeId: node.nodeId, files: input.files! },
        });
        return { uploaded: input.files?.length };
      }
      if (name === "wait") {
        if (!input.selector && !input.text) {
          await delay(input.timeMs ?? 1000, undefined, { signal });
          return { waited: true };
        }
        const start = Date.now();
        while (Date.now() - start < (input.timeoutMs ?? 10000)) {
          const present = await evaluate(
            `(() => {${input.selector ? `return Array.from(document.querySelectorAll(${JSON.stringify(input.selector)})).some(el=>{const r=el.getBoundingClientRect();return r.width>0&&r.height>0&&getComputedStyle(el).visibility!=='hidden'});` : `return (document.body?.innerText||'').includes(${JSON.stringify(input.text)});`}})()`,
          );
          if (Boolean(present) === (input.state !== "hidden"))
            return { matched: true };
          await delay(100, undefined, { signal });
        }
        throw new Error("WAIT_TIMEOUT");
      }
      const target: Target = {
        ...(input.selector === undefined ? {} : { selector: input.selector }),
        ...(input.ref === undefined ? {} : { ref: input.ref }),
        ...((name === "type" ? input.targetText : input.text) === undefined
          ? {}
          : { text: (name === "type" ? input.targetText : input.text)! }),
      };
      if (name === "select_option")
        return evaluate(
          targetScript(
            target,
            `if(!(element instanceof HTMLSelectElement))throw new Error('Target is not a select');const values=${JSON.stringify(input.values)};if(!element.multiple&&values.length>1)throw new Error('Select allows one option');if(values.some(v=>!Array.from(element.options).some(o=>o.value===v&&!o.disabled)))throw new Error('Option unavailable');for(const option of element.options)option.selected=values.includes(option.value);element.dispatchEvent(new Event('input',{bubbles:true}));element.dispatchEvent(new Event('change',{bubbles:true}));return {values:Array.from(element.selectedOptions).map(o=>o.value)};`,
          ),
        );
      const point = (await evaluate(pointScript(target))) as {
        x: number;
        y: number;
      };
      await send({ type: "mouseMove", ...point });
      if (name === "hover") return { hovered: true };
      await send({
        type: "mouseDown",
        ...point,
        button: input.button ?? "left",
        clickCount: 1,
      });
      await send({
        type: "mouseUp",
        ...point,
        button: input.button ?? "left",
        clickCount: 1,
      });
      if (name === "type") {
        await evaluate(
          targetScript(
            target,
            "if(!(element instanceof HTMLInputElement||element instanceof HTMLTextAreaElement||element.isContentEditable))throw new Error('Target is not editable');element.focus();return true;",
          ),
        );
        if (input.clear) {
          await press(process.platform === "darwin" ? "Meta+A" : "Control+A");
          await press("Backspace");
        }
        await execute({
          type: "insertText",
          ...instance,
          text: input.text ?? "",
        });
        if (input.submit) await press("Enter");
        return { typed: input.text?.length ?? 0 };
      }
      return { clicked: true };
    },
  }));
}
