import { spawn } from "node:child_process";
import { createDecipheriv } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
/** Current-user DPAPI only. No elevation, SYSTEM tokens or App-Bound bypass. */
export function unprotectWindows(encrypted: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const script =
      "Add-Type -AssemblyName System.Security; try { $v=[Console]::In.ReadToEnd(); $b=[Convert]::FromBase64String($v); $p=[Security.Cryptography.ProtectedData]::Unprotect($b,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser); [Console]::Out.Write([Convert]::ToBase64String($p)) } catch { exit 1 }";
    const child = spawn(
      join(
        process.env.SystemRoot ?? "C:\\Windows",
        "System32/WindowsPowerShell/v1.0/powershell.exe",
      ),
      ["-NoProfile", "-NonInteractive", "-Command", script],
      { windowsHide: true, stdio: ["pipe", "pipe", "pipe"] },
    );
    let out = "";
    const timer = setTimeout(() => child.kill(), 10000);
    child.stdout.on("data", (v) => {
      out += v;
    });
    child.stderr.resume();
    child.stdin.on("error", () => {});
    child.on("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(Buffer.from(out.trim(), "base64"));
      else reject(new Error("DPAPI unavailable"));
    });
    child.stdin.end(encrypted.toString("base64"));
  });
}
export async function profileKey(root: string): Promise<Buffer> {
  if (process.platform !== "win32")
    throw new Error(
      "Native password import is currently supported on Windows; use a browser CSV export",
    );
  const state = JSON.parse(await readFile(join(root, "Local State"), "utf8"));
  const wrapped = Buffer.from(state.os_crypt?.encrypted_key ?? "", "base64");
  if (wrapped.subarray(0, 5).toString() !== "DPAPI")
    throw new Error("Browser encryption key unavailable");
  return unprotectWindows(wrapped.subarray(5));
}
export async function decryptValue(data: Buffer, key: Buffer): Promise<Buffer> {
  const prefix = data.subarray(0, 3).toString();
  if (prefix === "v20")
    throw new Error("APP_BOUND_ENCRYPTION: use browser export");
  if (prefix !== "v10" && prefix !== "v11") return unprotectWindows(data);
  const decipher = createDecipheriv("aes-256-gcm", key, data.subarray(3, 15));
  decipher.setAuthTag(data.subarray(-16));
  return Buffer.concat([
    decipher.update(data.subarray(15, -16)),
    decipher.final(),
  ]);
}
