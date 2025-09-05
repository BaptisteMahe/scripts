import { spawn } from "node:child_process";

export function pbcopy(content: string) {
  const proc = spawn("pbcopy");
  proc.stdin.write(content);
  proc.stdin.end();
}
