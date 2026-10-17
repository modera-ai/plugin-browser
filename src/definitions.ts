import manifest from "../plugin.json";
import { declaredTools } from "@pal/plugin-sdk";

/**
 * Tool metadata declared in `plugin.json`, in declaration order.
 *
 * Schemas, titles and permissions live in the manifest so the host can list
 * them without loading this plugin; `tools.ts` supplies the behaviour.
 */
export const definitions = declaredTools(manifest);
