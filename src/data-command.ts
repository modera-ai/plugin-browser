import { settingsAction } from "@pal/plugin-sdk/react";
export function browserData<T = unknown>(
  operation: string,
  value: unknown = {},
): Promise<T> {
  return settingsAction<T>("modera.browser.data", {
    operation,
    value,
  });
}
