/**
 * Smart Energy PLAT cloud client (same API as the official app).
 *
 * Base: https://smartenergy.cfe-group.cn
 * Auth: POST /api/user/login with account + password (form-urlencoded).
 * Later requests send header `token: <userinfo.token>`.
 * Success is `code === 1` (ThinkPHP / FastAdmin style).
 */

import { request as httpsRequest } from "node:https";
import { URL } from "node:url";
import { appendFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

const DEFAULT_API_BASE = "https://smartenergy.cfe-group.cn";
const USER_AGENT = "Mozilla/5.0 SmartEnergyPLAT-probe";
const FINDINGS_PATH = resolve(process.cwd(), "notes", "findings.md");

export type CloudConfig = {
  apiBase: string;
  account: string;
  password: string;
};

export type ApiEnvelope<T = unknown> = {
  code: number;
  msg: string;
  time?: string;
  data: T;
  userinfo?: UserInfo;
};

export type UserInfo = {
  token?: string;
  name?: string;
  email?: string;
  account?: string;
  status_type?: string;
  time_zone?: string;
  [key: string]: unknown;
};

export type BatteryListItem = {
  id?: number | string;
  battery_id?: number | string;
  battery_number?: string;
  name?: string;
  status?: string;
  soc?: string | number;
  voltage?: string | number;
  current?: string | number;
  temperature?: string | number;
  [key: string]: unknown;
};

function formBody(data: Record<string, string | number | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) continue;
    params.set(key, String(value));
  }
  return params.toString();
}

async function post<T>(
  apiBase: string,
  path: string,
  data: Record<string, string | number | undefined> = {},
  token = "",
): Promise<ApiEnvelope<T>> {
  const body = formBody(data);
  const url = new URL(`${apiBase}${path}`);
  const text = await new Promise<string>((resolve, reject) => {
    const req = httpsRequest(
      {
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port || 443,
        path: `${url.pathname}${url.search}`,
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Content-Length": Buffer.byteLength(body),
          Accept: "application/json, */*",
          "User-Agent": USER_AGENT,
          ...(token ? { token } : {}),
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk) => chunks.push(chunk as Buffer));
        res.on("end", () => {
          const raw = Buffer.concat(chunks).toString("utf8");
          if ((res.statusCode ?? 0) >= 400 && !raw) {
            reject(new Error(`HTTP ${res.statusCode} from ${path}`));
            return;
          }
          resolve(raw);
        });
      },
    );
    req.on("error", reject);
    req.write(body);
    req.end();
  });

  try {
    return JSON.parse(text) as ApiEnvelope<T>;
  } catch {
    throw new Error(`Non-JSON response from ${path}: ${text.slice(0, 200)}`);
  }
}

function requireConfig(): CloudConfig {
  const apiBase = (process.env.PLAT_API_BASE || DEFAULT_API_BASE).replace(/\/$/, "");
  const account = process.env.PLAT_ACCOUNT || process.env.PLAT_EMAIL || "";
  const password = process.env.PLAT_PASSWORD || "";
  if (!account || !password) {
    throw new Error(
      "Set PLAT_ACCOUNT (or PLAT_EMAIL) and PLAT_PASSWORD in .env — the same login as Smart Energy PLAT.",
    );
  }
  return { apiBase, account, password };
}

function batteryId(item: BatteryListItem): string {
  const id = item.battery_id ?? item.id ?? item.battery_number;
  return id === undefined ? "" : String(id);
}

function pickUserinfo(login: ApiEnvelope<{ userinfo?: UserInfo } | UserInfo>): UserInfo | undefined {
  if (login.userinfo) return login.userinfo;
  const data = login.data;
  if (data && typeof data === "object") {
    if ("userinfo" in data && data.userinfo) return data.userinfo;
    if ("token" in data) return data as UserInfo;
  }
  return undefined;
}

function cellVoltagesMv(pack: Record<string, unknown>): number[] {
  const single = pack.single_voltage;
  if (!single || typeof single !== "object") return [];
  const list = (single as { voltage?: unknown }).voltage;
  return Array.isArray(list) ? list.map((v) => Number(v)).filter((v) => Number.isFinite(v)) : [];
}

function cellTemperaturesC(pack: Record<string, unknown>): number[] {
  const temps = pack.cell_temperature;
  if (Array.isArray(temps)) return temps.map((v) => Number(v)).filter((v) => Number.isFinite(v));
  if (!temps || typeof temps !== "object") return [];
  const list = (temps as { cell_temperature?: unknown }).cell_temperature;
  return Array.isArray(list) ? list.map((v) => Number(v)).filter((v) => Number.isFinite(v)) : [];
}

function formatMvAsVolts(mv: number): string {
  return (mv / 1000).toFixed(3);
}

function summarizeMonitor(id: string, item: BatteryListItem, monitor: Record<string, unknown>): string {
  const detail = (monitor.battery_detail ?? {}) as Record<string, unknown>;
  const pack = (monitor.battery_data ?? {}) as Record<string, unknown>;
  const stack = (monitor.battery_info ?? {}) as Record<string, unknown>;
  const stackObj = Array.isArray(stack) ? {} : stack;
  const cellsMv = cellVoltagesMv(pack);
  const temps = cellTemperaturesC(pack);
  const minMv = cellsMv.length ? Math.min(...cellsMv) : undefined;
  const maxMv = cellsMv.length ? Math.max(...cellsMv) : undefined;
  const minIdx = minMv === undefined ? undefined : cellsMv.indexOf(minMv);
  const maxIdx = maxMv === undefined ? undefined : cellsMv.indexOf(maxMv);
  const deltaMv = minMv !== undefined && maxMv !== undefined ? maxMv - minMv : undefined;
  const cellVoltLine = cellsMv.length
    ? `  cells V (${cellsMv.length}): ${cellsMv.map(formatMvAsVolts).join(" ")}  min=${formatMvAsVolts(minMv!)} #${minIdx} max=${formatMvAsVolts(maxMv!)} #${maxIdx} Δ=${deltaMv}mV`
    : "  cells V: n/a";
  const cellTempLine = temps.length
    ? `  cells T (${temps.length}): ${temps.map((t) => `${t}°C`).join(" ")}`
    : "  cells T: n/a";
  return [
    `- ${item.name || detail.battery_number || id} id=${id} serial=${detail.battery_number ?? "?"} host=${detail.is_host ?? "?"}`,
    `  status=${item.status ?? "?"} soc=${pack.soc ?? stackObj.soc ?? "?"} soh=${pack.soh ?? stackObj.soh ?? "?"}`,
    `  pack V=${pack.total_voltage ?? "?"} A=${pack.total_current ?? "?"} mode=${pack.charge_discharge_status ?? "?"}`,
    `  stack V=${stackObj.total_voltage ?? "n/a"} A=${stackObj.total_current ?? "n/a"} work=${stackObj.working_status ?? "n/a"}`,
    cellVoltLine,
    cellTempLine,
    `  ts=${pack.ts ?? "?"}`,
  ].join("\n");
}

export async function probeCloud(): Promise<void> {
  const apiBase = (process.env.PLAT_API_BASE || DEFAULT_API_BASE).replace(/\/$/, "");
  console.log(`Cloud API base: ${apiBase}`);

  const tz = await post<unknown>(apiBase, "/api/index/timezone");
  console.log(`timezone: code=${tz.code} ${tz.msg || "ok"} (${Array.isArray(tz.data) ? tz.data.length : 0} zones)`);

  let config: CloudConfig;
  try {
    config = requireConfig();
  } catch (err) {
    console.log(err instanceof Error ? err.message : String(err));
    console.log("Skipping login until credentials are set. Copy .env.example to .env.");
    return;
  }

  const login = await post<{ userinfo?: UserInfo }>(apiBase, "/api/user/login", {
    account: config.account,
    password: config.password,
  });
  if (login.code !== 1) {
    throw new Error(`Login failed: ${login.msg || `code ${login.code}`}`);
  }

  const userinfo = pickUserinfo(login);
  const token = userinfo?.token ?? "";
  if (!token) {
    const sanitized = JSON.stringify(login, (key, value) => (key === "token" ? "[redacted]" : value), 2);
    console.log("Login response:", sanitized);
    throw new Error("Login succeeded but no token was returned");
  }
  console.log(`Logged in as ${userinfo?.name || userinfo?.email || userinfo?.account || config.account} (${userinfo?.status_type || "user"})`);

  const list = await post<BatteryListItem[] | { data?: BatteryListItem[]; last_page?: number }>(
    apiBase,
    "/api/user/battery_list",
    {
      page: 1,
      pagesize: 50,
      status: "",
      battery_number: "",
    },
    token,
  );
  if (list.code !== 1) {
    throw new Error(`battery_list failed: ${list.msg || `code ${list.code}`}`);
  }

  const batteries = Array.isArray(list.data)
    ? list.data
    : Array.isArray(list.data?.data)
      ? list.data.data
      : [];
  console.log(`Batteries: ${batteries.length}`);
  if (batteries.length === 0) {
    console.log("No batteries bound to this account.");
    return;
  }

  const lines: string[] = [
    `## Cloud ${new Date().toISOString()}`,
    "",
    `- API: ${apiBase}`,
    `- login: ${userinfo?.name || userinfo?.email || config.account} (${userinfo?.status_type || "user"})`,
    `- batteries: ${batteries.length}`,
    "",
  ];

  for (const item of batteries) {
    const id = batteryId(item);
    if (!id) {
      console.log(`\n- ${item.name || "?"} (no id) keys=${Object.keys(item).join(",")}`);
      lines.push(`- ${item.name || "?"} (no id)`);
      continue;
    }

    const monitor = await post<Record<string, unknown>>(apiBase, "/api/user/battery_monitor", {
      battery_id: id,
    }, token);
    if (monitor.code !== 1) {
      const msg = `  monitor failed: ${monitor.msg || `code ${monitor.code}`}`;
      console.log(`\n- id=${id} status=${item.status ?? "?"}\n${msg}`);
      lines.push(`- id=${id} monitor failed: ${monitor.msg || monitor.code}`);
      continue;
    }
    const raw = (monitor.data && typeof monitor.data === "object" ? monitor.data : monitor) as Record<string, unknown>;
    const summary = summarizeMonitor(id, item, raw);
    console.log(`\n${summary}`);
    lines.push(summary, "");
  }

  mkdirSync(dirname(FINDINGS_PATH), { recursive: true });
  appendFileSync(FINDINGS_PATH, `${lines.join("\n")}\n`, "utf8");
  console.log(`\nWrote ${FINDINGS_PATH}`);
}
