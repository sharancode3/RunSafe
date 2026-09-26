import { execFileSync, execSync } from "child_process";
import os from "os";

export function execDocker(command: string, envOverrides: Record<string, string> = {}): string {
  const isWindows = os.platform() === "win32";

  if (isWindows) {
    const envPrefix = Object.entries(envOverrides)
      .map(([k, v]) => `${k}="${v}"`)
      .join(" ");

    const bashCmd = `cd '/mnt/c/SHARAN PROJECTS/RunSafe' && ${envPrefix ? envPrefix + " " : ""}${command}`;
    const result = execFileSync(
      "wsl.exe",
      ["-u", "root", "bash", "-c", bashCmd],
      {
        encoding: "utf-8",
        stdio: ["ignore", "pipe", "ignore"],
      }
    );
    return result.trim();
  } else {
    const result = execSync(command, {
      encoding: "utf-8",
      env: { ...process.env, ...envOverrides },
      stdio: ["ignore", "pipe", "ignore"],
    });
    return result.trim();
  }
}
