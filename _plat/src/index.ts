import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { probeLocal } from "./local/probe.js";
import { probeCloud } from "./cloud/client.js";

function loadDotEnv(path = resolve(process.cwd(), ".env")): void {
  if (!existsSync(path)) return;
  const text = readFileSync(path, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

function usage(): never {
  console.log(`CFE battery probe

Usage:
  npx tsx src/index.ts probe-local [ip ...]
  npx tsx src/index.ts probe-cloud

Environment:
  BATTERY_IPS     comma-separated IPs (default 10.210.5.21)
  PLAT_EMAIL      Smart Energy PLAT login
  PLAT_PASSWORD   Smart Energy PLAT password
  PLAT_API_BASE   optional API origin override
`);
  process.exit(1);
}

function batteryIps(cliIps: string[]): string[] {
  if (cliIps.length > 0) return cliIps;
  const fromEnv = process.env.BATTERY_IPS?.split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return fromEnv && fromEnv.length > 0 ? fromEnv : ["10.210.5.21"];
}

async function main(): Promise<void> {
  loadDotEnv();
  const [command, ...rest] = process.argv.slice(2);
  if (!command || command === "-h" || command === "--help") usage();

  if (command === "probe-local") {
    await probeLocal(batteryIps(rest));
    return;
  }

  if (command === "probe-cloud") {
    await probeCloud();
    return;
  }

  usage();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
