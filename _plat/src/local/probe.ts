import { createConnection } from "node:net";
import { createSocket } from "node:dgram";
import { appendFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import mqtt from "mqtt";

const TCP_PORTS = [23, 80, 443, 502, 1883, 8080, 8883, 8888, 8899, 9090];
const HTTP_PATHS = ["/", "/api", "/status", "/info", "/cell"];
const HI_FLYING_PAGES = ["/status_en.html", "/port_en.html"];
const DEFAULT_BASIC_USER = process.env.LOCAL_HTTP_USER ?? "admin";
const DEFAULT_BASIC_PASS = process.env.LOCAL_HTTP_PASS ?? "admin";
const CONNECT_TIMEOUT_MS = 1500;
const HTTP_TIMEOUT_MS = 2500;
const MQTT_TIMEOUT_MS = 3000;
const UDP_TIMEOUT_MS = 2500;
const HI_FLYING_UDP_PORT = 48899;
const FINDINGS_PATH = resolve(process.cwd(), "notes", "findings.md");

export type TcpPortResult = {
  port: number;
  open: boolean;
  error?: string;
  banner?: string;
};

export type HttpResult = {
  url: string;
  ok: boolean;
  status?: number;
  contentType?: string;
  wwwAuthenticate?: string;
  server?: string;
  snippet?: string;
  error?: string;
};

export type HiFlyingConfig = {
  module?: string;
  version?: string;
  wifiMode?: string;
  staSsid?: string;
  staIp?: string;
  staMac?: string;
  netProtocol?: string;
  netMode?: string;
  cloudHost?: string;
  cloudPort?: string;
};

export type MqttResult = {
  url: string;
  connected: boolean;
  error?: string;
};

export type ModbusResult = {
  attempted: boolean;
  ok: boolean;
  registers?: number[];
  error?: string;
};

export type UdpDiscoveryResult = {
  port: number;
  responses: { address: string; port: number; hex: string; text: string }[];
  error?: string;
};

export type HostReport = {
  ip: string;
  reachable: boolean;
  tcp: TcpPortResult[];
  http: HttpResult[];
  mqtt: MqttResult[];
  modbus?: ModbusResult;
  hiFlyingBanner?: { port: 8899; hex: string; text: string } | { port: 8899; error: string };
  hiFlying?: HiFlyingConfig;
};

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolvePromise, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolvePromise(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

function snippet(text: string, max = 240): string {
  const compact = text.replace(/\s+/g, " ").trim();
  return compact.length > max ? `${compact.slice(0, max)}…` : compact;
}

function toPrintable(buf: Buffer): string {
  return [...buf]
    .map((b) => (b >= 32 && b < 127 ? String.fromCharCode(b) : "."))
    .join("");
}

async function probeTcpPort(ip: string, port: number): Promise<TcpPortResult> {
  return new Promise((resolveResult) => {
    const socket = createConnection({ host: ip, port });
    let settled = false;
    const finish = (result: TcpPortResult) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolveResult(result);
    };

    socket.setTimeout(CONNECT_TIMEOUT_MS);
    socket.once("connect", () => finish({ port, open: true }));
    socket.once("timeout", () => finish({ port, open: false, error: "timeout" }));
    socket.once("error", (err) => finish({ port, open: false, error: err.message }));
  });
}

async function grabBanner(ip: string, port: number, waitMs = 800): Promise<string> {
  return new Promise((resolveResult, reject) => {
    const chunks: Buffer[] = [];
    const socket = createConnection({ host: ip, port });
    const done = (err?: Error) => {
      socket.destroy();
      if (err) reject(err);
      else resolveResult(Buffer.concat(chunks).toString("utf8"));
    };
    socket.setTimeout(waitMs);
    socket.once("connect", () => {
      // Some services speak first (telnet, HTTP servers on GET). Send nothing.
    });
    socket.on("data", (data) => chunks.push(data));
    socket.once("timeout", () => done());
    socket.once("end", () => done());
    socket.once("error", (err) => done(err));
  });
}

function basicAuthHeader(user: string, pass: string): string {
  return `Basic ${Buffer.from(`${user}:${pass}`).toString("base64")}`;
}

function parseJsVars(html: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /var\s+([A-Za-z0-9_]+)\s*=\s*"([^"]*)"/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html))) {
    out[match[1]] = match[2];
  }
  return out;
}

async function httpGet(url: string, authorization?: string): Promise<HttpResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HTTP_TIMEOUT_MS);
  try {
    const headers: Record<string, string> = { Accept: "application/json, text/plain, */*" };
    if (authorization) headers.Authorization = authorization;
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers,
    });
    const contentType = res.headers.get("content-type") ?? undefined;
    const body = await res.text();
    return {
      url,
      ok: true,
      status: res.status,
      contentType,
      wwwAuthenticate: res.headers.get("www-authenticate") ?? undefined,
      server: res.headers.get("server") ?? undefined,
      snippet: snippet(body),
    };
  } catch (err) {
    return { url, ok: false, error: err instanceof Error ? err.message : String(err) };
  } finally {
    clearTimeout(timer);
  }
}

async function httpGetText(url: string, authorization?: string): Promise<{ status: number; body: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HTTP_TIMEOUT_MS);
  try {
    const headers: Record<string, string> = { Accept: "text/html, */*" };
    if (authorization) headers.Authorization = authorization;
    const res = await fetch(url, { method: "GET", signal: controller.signal, headers });
    return { status: res.status, body: await res.text() };
  } finally {
    clearTimeout(timer);
  }
}

async function probeMqtt(ip: string, port: number, protocol: "mqtt" | "mqtts"): Promise<MqttResult> {
  const url = `${protocol}://${ip}:${port}`;
  return new Promise((resolveResult) => {
    const client = mqtt.connect(url, {
      connectTimeout: MQTT_TIMEOUT_MS,
      reconnectPeriod: 0,
      rejectUnauthorized: false,
      username: "",
      password: "",
      clientId: `cfe-probe-${Date.now()}`,
    });
    const finish = (result: MqttResult) => {
      client.end(true);
      resolveResult(result);
    };
    const timer = setTimeout(() => finish({ url, connected: false, error: "timeout" }), MQTT_TIMEOUT_MS + 500);
    client.on("connect", () => {
      clearTimeout(timer);
      finish({ url, connected: true });
    });
    client.on("error", (err) => {
      clearTimeout(timer);
      finish({ url, connected: false, error: err.message });
    });
  });
}

async function readModbusHoldingRegister0(ip: string): Promise<ModbusResult> {
  // Function 0x03 Read Holding Registers, start 0, quantity 1.
  const txnId = 1;
  const pdu = Buffer.from([0x00, 0x00, 0x00, 0x00, 0x00, 0x06, 0x01, 0x03, 0x00, 0x00, 0x00, 0x01]);
  pdu.writeUInt16BE(txnId, 0);

  return new Promise((resolveResult) => {
    const socket = createConnection({ host: ip, port: 502 });
    const chunks: Buffer[] = [];
    const finish = (result: ModbusResult) => {
      socket.destroy();
      resolveResult(result);
    };
    socket.setTimeout(CONNECT_TIMEOUT_MS);
    socket.once("connect", () => socket.write(pdu));
    socket.on("data", (data) => {
      chunks.push(data);
      const buf = Buffer.concat(chunks);
      if (buf.length < 9) return;
      const byteCount = buf[8];
      if (buf.length < 9 + byteCount) return;
      const registers: number[] = [];
      for (let i = 0; i < byteCount; i += 2) {
        registers.push(buf.readUInt16BE(9 + i));
      }
      finish({ attempted: true, ok: true, registers });
    });
    socket.once("timeout", () => finish({ attempted: true, ok: false, error: "timeout" }));
    socket.once("error", (err) => finish({ attempted: true, ok: false, error: err.message }));
  });
}

async function hiFlyingUdpDiscover(): Promise<UdpDiscoveryResult> {
  // Hi-Flying modules reply to a UDP search on 48899. Payload is typically "HF-A11ASSISTHREAD".
  const payload = Buffer.from("HF-A11ASSISTHREAD");
  return new Promise((resolveResult) => {
    const socket = createSocket("udp4");
    const responses: UdpDiscoveryResult["responses"] = [];
    const finish = (error?: string) => {
      try {
        socket.close();
      } catch {
        /* ignore */
      }
      resolveResult({ port: HI_FLYING_UDP_PORT, responses, error });
    };

    socket.on("message", (msg, rinfo) => {
      responses.push({
        address: rinfo.address,
        port: rinfo.port,
        hex: msg.toString("hex"),
        text: toPrintable(msg),
      });
    });
    socket.on("error", (err) => finish(err.message));
    socket.bind(() => {
      socket.setBroadcast(true);
      socket.send(payload, HI_FLYING_UDP_PORT, "255.255.255.255", (err) => {
        if (err) finish(err.message);
      });
    });
    setTimeout(() => finish(), UDP_TIMEOUT_MS);
  });
}

async function peekTcpBytes(ip: string, port: number): Promise<{ hex: string; text: string } | { error: string }> {
  return new Promise((resolveResult) => {
    const socket = createConnection({ host: ip, port });
    const chunks: Buffer[] = [];
    const finish = (result: { hex: string; text: string } | { error: string }) => {
      socket.destroy();
      resolveResult(result);
    };
    socket.setTimeout(1200);
    socket.once("connect", () => {
      // Do not write; just see if the BMS bridge speaks first.
    });
    socket.on("data", (data) => chunks.push(data));
    socket.once("timeout", () => {
      const buf = Buffer.concat(chunks);
      if (buf.length === 0) finish({ error: "no unsolicited data" });
      else finish({ hex: buf.toString("hex"), text: toPrintable(buf) });
    });
    socket.once("error", (err) => finish({ error: err.message }));
  });
}

function appendFindings(markdown: string): void {
  mkdirSync(dirname(FINDINGS_PATH), { recursive: true });
  appendFileSync(FINDINGS_PATH, markdown, "utf8");
}

function formatReport(now: string, reports: HostReport[], udp: UdpDiscoveryResult): string {
  const lines: string[] = [];
  lines.push(`## ${now}`);
  lines.push("");
  lines.push("### Hi-Flying UDP discovery (48899)");
  if (udp.error) lines.push(`- error: ${udp.error}`);
  if (udp.responses.length === 0) lines.push("- no replies");
  for (const r of udp.responses) {
    lines.push(`- ${r.address}:${r.port} text=\`${r.text}\` hex=${r.hex}`);
  }
  lines.push("");

  for (const report of reports) {
    lines.push(`### ${report.ip}`);
    const open = report.tcp.filter((p) => p.open).map((p) => p.port);
    lines.push(`- open TCP: ${open.length ? open.join(", ") : "(none)"}`);
    for (const p of report.tcp.filter((x) => !x.open && x.error && x.error !== "timeout")) {
      lines.push(`- port ${p.port}: ${p.error}`);
    }
    if (report.http.length) {
      lines.push("- HTTP:");
      for (const h of report.http) {
        if (h.ok) lines.push(`  - ${h.status} ${h.url} (${h.contentType ?? "no content-type"}) ${h.snippet ?? ""}`);
        else lines.push(`  - FAIL ${h.url} ${h.error}`);
      }
    }
    if (report.mqtt.length) {
      lines.push("- MQTT:");
      for (const m of report.mqtt) {
        lines.push(`  - ${m.connected ? "connected" : "no"} ${m.url}${m.error ? ` (${m.error})` : ""}`);
      }
    }
    if (report.modbus) {
      lines.push(
        `- Modbus TCP 502: ${report.modbus.ok ? `ok registers=${report.modbus.registers?.join(",")}` : `fail ${report.modbus.error}`}`,
      );
    }
    if (report.hiFlyingBanner) {
      if ("hex" in report.hiFlyingBanner) {
        lines.push(`- TCP 8899 peek: text=\`${report.hiFlyingBanner.text}\` hex=${report.hiFlyingBanner.hex}`);
      } else {
        lines.push(`- TCP 8899 peek: ${report.hiFlyingBanner.error}`);
      }
    }
    if (report.hiFlying) {
      const h = report.hiFlying;
      lines.push(
        `- Hi-Flying: ${h.module} ${h.version} mode=${h.wifiMode} STA=${h.staSsid}/${h.staIp} socket=${h.netProtocol} ${h.netMode} ${h.cloudHost}:${h.cloudPort}`,
      );
    }
    lines.push("");
  }
  return `${lines.join("\n")}\n`;
}

export async function probeLocal(ips: string[]): Promise<void> {
  console.log(`Probing ${ips.join(", ")} …`);
  const udp = await hiFlyingUdpDiscover();
  console.log(
    `UDP 48899: ${udp.responses.length} reply(ies)${udp.error ? ` (${udp.error})` : ""}`,
  );
  for (const r of udp.responses) {
    console.log(`  ${r.address}:${r.port} ${r.text}`);
  }

  const reports: HostReport[] = [];
  for (const ip of ips) {
    console.log(`\n=== ${ip} ===`);
    const tcp = await Promise.all(TCP_PORTS.map((port) => probeTcpPort(ip, port)));
    const open = tcp.filter((p) => p.open);
    console.log(`TCP open: ${open.length ? open.map((p) => p.port).join(", ") : "(none)"}`);

    const http: HttpResult[] = [];
    const httpPorts = open.filter((p) => [80, 8080, 8888, 9090].includes(p.port)).map((p) => p.port);
    const httpsPorts = open.filter((p) => p.port === 443).map((p) => p.port);
    const auth = basicAuthHeader(DEFAULT_BASIC_USER, DEFAULT_BASIC_PASS);
    for (const port of httpPorts) {
      for (const path of HTTP_PATHS) {
        const url = `http://${ip}:${port}${path}`;
        let result = await httpGet(url);
        if (result.status === 401) {
          const authed = await httpGet(url, auth);
          if (authed.status === 200) result = authed;
        }
        http.push(result);
        console.log(
          `HTTP ${result.ok ? result.status : "FAIL"} ${result.url} ${result.wwwAuthenticate ?? ""} ${result.snippet ?? result.error ?? ""}`,
        );
      }
    }
    for (const port of httpsPorts) {
      for (const path of HTTP_PATHS) {
        const result = await httpGet(`https://${ip}:${port}${path}`);
        http.push(result);
        console.log(
          `HTTPS ${result.ok ? result.status : "FAIL"} ${result.url} ${result.snippet ?? result.error ?? ""}`,
        );
      }
    }

    // Port 9090 is the module's *outbound* cloud TCP port, not a local HTTP listener.
    // Still probe it locally in case a unit is in TCP-server mode.
    if (open.some((p) => p.port === 9090)) {
      for (const path of ["/json", "/data", "/device", "/bms", "/monitor"]) {
        const result = await httpGet(`http://${ip}:9090${path}`);
        http.push(result);
        console.log(
          `HTTP ${result.ok ? result.status : "FAIL"} ${result.url} ${result.snippet ?? result.error ?? ""}`,
        );
      }
    }

    let hiFlying: HiFlyingConfig | undefined;
    if (open.some((p) => p.port === 80)) {
      try {
        const statusPage = await httpGetText(`http://${ip}/status_en.html`, auth);
        const portPage = await httpGetText(`http://${ip}/port_en.html`, auth);
        const statusVars = parseJsVars(statusPage.body);
        const portVars = parseJsVars(portPage.body);
        hiFlying = {
          module: statusVars.cover_mid,
          version: statusVars.cover_ver,
          wifiMode: statusVars.cover_wmode,
          staSsid: statusVars.cover_sta_ssid,
          staIp: statusVars.cover_sta_ip,
          staMac: statusVars.cover_sta_mac,
          netProtocol: portVars.net_setting_pro,
          netMode: portVars.net_setting_cs,
          cloudHost: portVars.net_setting_ip,
          cloudPort: portVars.net_setting_port,
        };
        console.log(
          `Hi-Flying ${hiFlying.module} ${hiFlying.version} ${hiFlying.netProtocol} ${hiFlying.netMode} -> ${hiFlying.cloudHost}:${hiFlying.cloudPort}`,
        );
      } catch (err) {
        console.log(`Hi-Flying pages: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    const mqttResults: MqttResult[] = [];
    if (open.some((p) => p.port === 1883)) {
      const r = await probeMqtt(ip, 1883, "mqtt");
      mqttResults.push(r);
      console.log(`MQTT ${r.connected ? "connected" : "no"} ${r.url} ${r.error ?? ""}`);
    }
    if (open.some((p) => p.port === 8883)) {
      const r = await probeMqtt(ip, 8883, "mqtts");
      mqttResults.push(r);
      console.log(`MQTTS ${r.connected ? "connected" : "no"} ${r.url} ${r.error ?? ""}`);
    }

    let modbus: ModbusResult | undefined;
    if (open.some((p) => p.port === 502)) {
      modbus = await readModbusHoldingRegister0(ip);
      console.log(
        `Modbus ${modbus.ok ? `ok ${modbus.registers?.join(",")}` : `fail ${modbus.error}`}`,
      );
    }

    let hiFlyingBanner: HostReport["hiFlyingBanner"];
    if (open.some((p) => p.port === 8899)) {
      const peek = await peekTcpBytes(ip, 8899);
      hiFlyingBanner = { port: 8899, ...peek };
      console.log(`8899 peek: ${"hex" in peek ? peek.text || peek.hex : peek.error}`);
    }

    if (open.some((p) => p.port === 23)) {
      try {
        const banner = await withTimeout(grabBanner(ip, 23), 1500, "telnet banner");
        if (banner) console.log(`telnet banner: ${snippet(banner)}`);
      } catch (err) {
        console.log(`telnet banner: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    reports.push({
      ip,
      reachable: open.length > 0,
      tcp,
      http,
      mqtt: mqttResults,
      modbus,
      hiFlyingBanner,
      hiFlying,
    });
  }

  const markdown = formatReport(new Date().toISOString(), reports, udp);
  appendFindings(markdown);
  console.log(`\nWrote ${FINDINGS_PATH}`);
}
