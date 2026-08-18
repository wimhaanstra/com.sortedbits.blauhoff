/*
 * Created on Tue Aug 18 2026
 * Copyright © 2026 Wim Haanstra
 *
 * Non-commercial use only
 */

import { request as httpsRequest } from 'https';
import { URL } from 'url';

const DEFAULT_API_BASE = 'https://smartenergy.cfe-group.cn';
const USER_AGENT = 'Mozilla/5.0 HomeyBlauHoff-PLAT';
const REQUEST_TIMEOUT_MS = 15_000;
const LIST_CACHE_MS = 60_000;

const batteryListCache = new Map<string, { at: number; items: PlatBatteryListItem[] }>();

export type PlatLogger = {
    log: (...args: any[]) => void;
    error: (...args: any[]) => void;
};

export type PlatUserInfo = {
    token?: string;
    name?: string;
    email?: string;
    account?: string;
    status_type?: string;
    time_zone?: string;
    [key: string]: unknown;
};

export type PlatApiEnvelope<T = unknown> = {
    code: number;
    msg: string;
    time?: string;
    data: T;
    userinfo?: PlatUserInfo;
};

export type PlatBatteryListItem = {
    id?: number | string;
    battery_id?: number | string;
    battery_number?: string;
    name?: string;
    status?: string;
    model?: string;
    equipment_name?: string;
    software_version?: string | number;
    hardware_version?: string | number;
    is_host?: string | boolean | number;
    soc?: string | number;
    ssid?: string;
    sta_ssid?: string;
    wifi_ssid?: string;
    wifi_name?: string;
    ap_ssid?: string;
    [key: string]: unknown;
};

export type PlatMonitorPayload = {
    battery_detail?: Record<string, unknown>;
    battery_data?: Record<string, unknown>;
    battery_info?: Record<string, unknown> | unknown[];
    [key: string]: unknown;
};

export class PlatError extends Error {
    constructor(message: string, readonly code?: number) {
        super(message);
        this.name = 'PlatError';
    }
}

type PlatClientOptions = {
    account: string;
    password: string;
    token?: string;
    apiBase?: string;
    logger?: PlatLogger;
};

function formBody(data: Record<string, string | number | undefined>): string {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(data)) {
        if (value === undefined) {
            continue;
        }
        params.set(key, String(value));
    }
    return params.toString();
}

function pickUserinfo(login: PlatApiEnvelope<{ userinfo?: PlatUserInfo } | PlatUserInfo>): PlatUserInfo | undefined {
    if (login.userinfo) {
        return login.userinfo;
    }

    const data = login.data;
    if (data && typeof data === 'object') {
        const record = data as { userinfo?: PlatUserInfo; token?: string };
        if (record.userinfo) {
            return record.userinfo;
        }
        if (record.token) {
            return data as PlatUserInfo;
        }
    }

    return undefined;
}

function unwrapList(data: unknown): PlatBatteryListItem[] {
    if (Array.isArray(data)) {
        return data;
    }
    if (data && typeof data === 'object' && Array.isArray((data as { data?: unknown }).data)) {
        return (data as { data: PlatBatteryListItem[] }).data;
    }
    return [];
}

function listLastPage(data: unknown): number {
    if (data && typeof data === 'object' && 'last_page' in data) {
        const lastPage = Number((data as { last_page?: unknown }).last_page);
        return Number.isFinite(lastPage) && lastPage > 0 ? lastPage : 1;
    }
    return 1;
}

export function batteryIdFromListItem(item: PlatBatteryListItem): string {
    const id = item.battery_id ?? item.id ?? item.battery_number;
    return id === undefined || id === null ? '' : String(id);
}

export function isHostPack(value: unknown): boolean {
    if (value === true || value === 1) {
        return true;
    }
    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        return normalized === 'yes' || normalized === '1' || normalized === 'true';
    }
    return false;
}

async function post<T>(
    apiBase: string,
    path: string,
    data: Record<string, string | number | undefined> = {},
    token = '',
): Promise<PlatApiEnvelope<T>> {
    const body = formBody(data);
    const url = new URL(`${apiBase}${path}`);

    const text = await new Promise<string>((resolve, reject) => {
        const req = httpsRequest(
            {
                protocol: url.protocol,
                hostname: url.hostname,
                port: url.port || 443,
                path: `${url.pathname}${url.search}`,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Content-Length': Buffer.byteLength(body),
                    Accept: 'application/json, */*',
                    'User-Agent': USER_AGENT,
                    ...(token ? { token } : {}),
                },
            },
            (res) => {
                const chunks: Buffer[] = [];
                res.on('data', (chunk) => chunks.push(chunk as Buffer));
                res.on('end', () => {
                    const raw = Buffer.concat(chunks).toString('utf8');
                    const status = res.statusCode ?? 0;
                    if (status >= 400 && !raw) {
                        reject(new PlatError(`HTTP ${status} from ${path}`, status));
                        return;
                    }
                    resolve(raw);
                });
            },
        );

        req.setTimeout(REQUEST_TIMEOUT_MS, () => {
            req.destroy(new PlatError(`Timeout from ${path}`));
        });
        req.on('error', reject);
        req.write(body);
        req.end();
    });

    try {
        return JSON.parse(text) as PlatApiEnvelope<T>;
    } catch {
        throw new PlatError(`Non-JSON response from ${path}`);
    }
}

export class PlatClient {
    private readonly account: string;
    private readonly password: string;
    private readonly apiBase: string;
    private readonly logger?: PlatLogger;
    private token: string;

    constructor(options: PlatClientOptions) {
        this.account = options.account;
        this.password = options.password;
        this.apiBase = (options.apiBase || DEFAULT_API_BASE).replace(/\/$/, '');
        this.logger = options.logger;
        this.token = options.token || '';
    }

    getToken(): string {
        return this.token;
    }

    setToken(token: string): void {
        this.token = token;
    }

    async login(): Promise<PlatUserInfo> {
        const login = await post<{ userinfo?: PlatUserInfo } | PlatUserInfo>(this.apiBase, '/api/user/login', {
            account: this.account,
            password: this.password,
        });

        if (login.code !== 1) {
            throw new PlatError(login.msg || 'Login failed', login.code);
        }

        const userinfo = pickUserinfo(login);
        const token = userinfo?.token ?? '';
        if (!token) {
            throw new PlatError('Login succeeded but no token was returned');
        }

        this.token = token;
        this.logger?.log('PLAT login succeeded');
        return userinfo || { token };
    }

    async listBatteries(): Promise<PlatBatteryListItem[]> {
        const batteries: PlatBatteryListItem[] = [];
        let page = 1;
        let lastPage = 1;
        const maxPages = 10;

        do {
            const envelope = await this.request<PlatBatteryListItem[] | { data?: PlatBatteryListItem[]; last_page?: number }>(
                '/api/user/battery_list',
                {
                    page,
                    pagesize: 50,
                    status: '',
                    battery_number: '',
                },
            );
            batteries.push(...unwrapList(envelope));
            lastPage = Math.min(listLastPage(envelope), maxPages);
            page += 1;
        } while (page <= lastPage);

        return batteries;
    }

    async findBattery(batteryId: string): Promise<PlatBatteryListItem | undefined> {
        const items = await this.listBatteriesCached();
        const wanted = String(batteryId);
        return items.find((item) => batteryIdFromListItem(item) === wanted);
    }

    private async listBatteriesCached(): Promise<PlatBatteryListItem[]> {
        const cached = batteryListCache.get(this.account);
        if (cached && Date.now() - cached.at < LIST_CACHE_MS) {
            return cached.items;
        }

        const items = await this.listBatteries();
        batteryListCache.set(this.account, { at: Date.now(), items });
        return items;
    }

    async monitor(batteryId: string): Promise<PlatMonitorPayload> {
        const data = await this.request<PlatMonitorPayload>('/api/user/battery_monitor', {
            battery_id: batteryId,
        });

        if (data && typeof data === 'object') {
            return data;
        }
        return {};
    }

    private async request<T>(path: string, data: Record<string, string | number | undefined>, retried = false): Promise<T> {
        if (!this.token && !retried) {
            await this.login();
        }

        try {
            const envelope = await post<T>(this.apiBase, path, data, this.token);
            if (this.isUnauthorized(envelope.code)) {
                return this.retryAfterLogin(path, data, retried);
            }

            if (envelope.code !== 1) {
                throw new PlatError(envelope.msg || `PLAT request failed (${path})`, envelope.code);
            }

            return envelope.data;
        } catch (error) {
            if (error instanceof PlatError && this.isUnauthorized(error.code) && !retried) {
                return this.retryAfterLogin(path, data, retried);
            }
            throw error;
        }
    }

    private async retryAfterLogin<T>(
        path: string,
        data: Record<string, string | number | undefined>,
        retried: boolean,
    ): Promise<T> {
        if (retried) {
            throw new PlatError('Unauthorized', 401);
        }
        this.logger?.log('PLAT token expired, logging in again');
        await this.login();
        return this.request<T>(path, data, true);
    }

    private isUnauthorized(code?: number): boolean {
        return code === 401;
    }
}
