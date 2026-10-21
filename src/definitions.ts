import manifest from "../pal-manifest.json";
import { declaredTools } from "@pal/plugin-sdk";

/**
 * Tool metadata declared in `pal-manifest.json`, in declaration order.
 *
 * Schemas, titles and permissions live in the manifest so the host can list
 * them without loading this plugin; `tools.ts` supplies the behaviour.
 */
export const definitions = declaredTools(manifest);
