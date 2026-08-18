/*
 * Created on Tue Aug 18 2026
 * Copyright © 2026 Wim Haanstra
 *
 * Non-commercial use only
 */

import Homey from 'homey';
import { addCapabilityIfNotExists, capabilityChange } from 'homey-helpers';
import { DateTime } from 'luxon';
import { PlatClient } from '../../api/plat/plat-client';
import { HomeyCapabilityValue, mapMonitorToCapabilities } from '../../api/plat/plat-mapper';

const DEFAULT_REFRESH_INTERVAL = 30;
const MIN_REFRESH_INTERVAL = 10;

export class PlatDevice extends Homey.Device {
    private client?: PlatClient;
    private pollTimeout: NodeJS.Timeout | undefined;
    private runningRequest = false;
    private isStopping = false;

    public logDeviceName = () => {
        return this.getName();
    };

    public dlog(...args: any[]) {
        this.log(`[${this.logDeviceName()}]`, ...args);
    }

    public derror(...args: any[]) {
        this.error(`[${this.logDeviceName()}]`, ...args);
    }

    async onInit() {
        await super.onInit();

        await this.setClass('battery');
        await this.setEnergy({
            homeBattery: true,
        });

        await addCapabilityIfNotExists(this, 'readable_boolean.device_status');
        await addCapabilityIfNotExists(this, 'date.record');

        const { enabled } = this.getSettings();
        if (!enabled) {
            await this.setUnavailable('Device is disabled');
            this.dlog('PLAT device is disabled');
            return;
        }

        this.client = this.createClient();
        this.dlog('PlatDevice has been initialized');
        this.poll().catch((error) => this.derror('Initial poll failed', error));
    }

    async onAdded() {
        this.dlog('PlatDevice has been added');
    }

    async onSettings({
        oldSettings,
        newSettings,
        changedKeys,
    }: {
        oldSettings: { [key: string]: boolean | string | number | undefined | null };
        newSettings: { [key: string]: boolean | string | number | undefined | null };
        changedKeys: string[];
    }): Promise<string | void> {
        const enabledChanged = changedKeys.includes('enabled');
        const credentialsChanged = changedKeys.includes('account') || changedKeys.includes('password');
        const enabled = newSettings.enabled as boolean;

        if (enabledChanged && !enabled) {
            this.isStopping = true;
            this.clearPoll();
            await this.setUnavailable('Device is disabled');
            this.dlog('PLAT device is disabled');
            return;
        }

        if (enabledChanged && enabled) {
            this.isStopping = false;
            await this.setAvailable();
        }

        if (credentialsChanged) {
            await this.unsetStoreValue('token');
        }

        if (enabled) {
            this.client = this.createClient(newSettings.account as string, newSettings.password as string);
            this.clearPoll();
            this.poll().catch((error) => this.derror('Poll after settings change failed', error));
        }
    }

    async onDeleted() {
        this.isStopping = true;
        this.clearPoll();
        this.dlog('PlatDevice has been deleted');
    }

    private createClient(account?: string, password?: string): PlatClient | undefined {
        const settings = this.getSettings();
        const resolvedAccount = (account ?? settings.account ?? '').trim();
        const resolvedPassword = password ?? settings.password ?? '';

        if (!resolvedAccount || !resolvedPassword) {
            this.setUnavailable('Missing Smart Energy PLAT credentials');
            return undefined;
        }

        return new PlatClient({
            account: resolvedAccount,
            password: resolvedPassword,
            token: this.getStoreValue('token') || '',
            logger: this,
        });
    }

    private refreshIntervalSeconds(): number {
        const { refreshInterval } = this.getSettings();
        const interval = Number(refreshInterval);
        if (!Number.isFinite(interval) || interval < MIN_REFRESH_INTERVAL) {
            return DEFAULT_REFRESH_INTERVAL;
        }
        return interval;
    }

    private clearPoll() {
        if (this.pollTimeout) {
            this.homey.clearTimeout(this.pollTimeout);
            this.pollTimeout = undefined;
        }
    }

    private scheduleNextPoll() {
        if (this.isStopping) {
            return;
        }

        this.clearPoll();
        const timeoutMs = this.refreshIntervalSeconds() * 1000;
        this.pollTimeout = this.homey.setTimeout(() => {
            this.poll().catch((error) => this.derror('Scheduled poll failed', error));
        }, timeoutMs);
    }

    private poll = async () => {
        const { enabled } = this.getSettings();
        if (!enabled || this.isStopping) {
            return;
        }

        if (this.runningRequest) {
            this.dlog('Poll already running, skipping');
            return;
        }

        this.runningRequest = true;

        try {
            if (!this.client) {
                this.client = this.createClient();
            }
            if (!this.client) {
                return;
            }

            const { batteryId, isHost } = this.getData();
            const monitor = await this.client.monitor(String(batteryId));
            const token = this.client.getToken();
            if (token && token !== this.getStoreValue('token')) {
                await this.setStoreValue('token', token);
            }

            const capabilities = mapMonitorToCapabilities(monitor, Boolean(isHost));
            await this.applyCapabilities(capabilities);
            await this.markOnline(true);
        } catch (error) {
            this.derror('PLAT poll failed', error instanceof Error ? error.message : error);
            await this.markOnline(false);
        } finally {
            this.runningRequest = false;
            this.scheduleNextPoll();
        }
    };

    private applyCapabilities = async (capabilities: Record<string, HomeyCapabilityValue>) => {
        for (const [capabilityId, value] of Object.entries(capabilities)) {
            if (!this.hasCapability(capabilityId)) {
                await addCapabilityIfNotExists(this, capabilityId);
            }
            await capabilityChange(this, capabilityId, value);
        }

        const localTimezone = this.homey.clock.getTimezone();
        const localDate = DateTime.now().setZone(localTimezone);
        await capabilityChange(this, 'date.record', localDate.toFormat('HH:mm:ss'));
    };

    private markOnline = async (online: boolean) => {
        if (!this.hasCapability('readable_boolean.device_status')) {
            await addCapabilityIfNotExists(this, 'readable_boolean.device_status');
        }
        await capabilityChange(this, 'readable_boolean.device_status', online);

        if (online) {
            await this.setAvailable();
        }
    };
}

module.exports = PlatDevice;
