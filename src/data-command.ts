import { frontend } from "@pal/plugin-sdk/react";
export function browserData<T = unknown>(
  operation: string,
  value: unknown = {},
): Promise<T> {
  return frontend().commands.execute<T>("modera.browser.data", {
    operation,
    value,
  }) as Promise<T>;
}
