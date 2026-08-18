/*
 * Created on Tue Aug 18 2026
 * Copyright © 2026 Wim Haanstra
 *
 * Non-commercial use only
 */

import { batteryIdFromListItem, isHostPack, PlatBatteryListItem, PlatMonitorPayload } from './plat-client';

export const CELL_VOLTAGE_COUNT = 16;
export const CELL_TEMPERATURE_COUNT = 3;

export type HomeyCapabilityValue = string | number | boolean;
export type HomeyCapabilityMap = Record<string, HomeyCapabilityValue>;

export type PlatPairingDevice = {
    name: string;
    data: {
        id: string;
        batteryId: string;
        serial: string;
        isHost: boolean;
    };
    settings: {
        account: string;
        password: string;
        refreshInterval: number;
        enabled: boolean;
    };
};

export function cellVoltageCapabilityId(index: number): string {
    return `measure_voltage.cell_${String(index + 1).padStart(2, '0')}`;
}

export function cellTemperatureCapabilityId(index: number): string {
    return `measure_temperature.cell_${index + 1}`;
}

export function platDeviceName(name?: string, serial?: string): string {
    const last6 = serial && serial.length >= 6 ? serial.slice(-6) : serial || '';
    const appName = (name || '').trim();
    if (appName && appName.toUpperCase() !== 'BLH') {
        return last6 ? `${appName} ${last6}` : appName;
    }
    return `BLH${last6}`;
}

export function mapBatteryListItemToPairingDevice(
    item: PlatBatteryListItem,
    credentials: { account: string; password: string },
): PlatPairingDevice | undefined {
    const batteryId = batteryIdFromListItem(item);
    if (!batteryId) {
        return undefined;
    }

    const serial = item.battery_number ? String(item.battery_number) : '';

    return {
        name: platDeviceName(item.name ? String(item.name) : undefined, serial),
        data: {
            id: `plat-${batteryId}`,
            batteryId,
            serial,
            isHost: isHostPack(item.is_host),
        },
        settings: {
            account: credentials.account,
            password: credentials.password,
            refreshInterval: 30,
            enabled: true,
        },
    };
}

export type PlatMapperContext = {
    isHost?: boolean;
    listItem?: PlatBatteryListItem;
};

export function packSsid(item?: PlatBatteryListItem): string | undefined {
    if (!item) {
        return undefined;
    }

    return firstString(item.ssid, item.sta_ssid, item.wifi_ssid, item.wifi_name, item.ap_ssid);
}

export function mapMonitorToCapabilities(
    monitor: PlatMonitorPayload,
    isHostOrContext: boolean | PlatMapperContext = false,
): HomeyCapabilityMap {
    const context: PlatMapperContext = typeof isHostOrContext === 'boolean'
        ? { isHost: isHostOrContext }
        : isHostOrContext;
    const detail = asRecord(monitor.battery_detail);
    const pack = asRecord(monitor.battery_data);
    const stack = asRecord(Array.isArray(monitor.battery_info) ? undefined : monitor.battery_info);
    const listItem = context.listItem;
    const host = Boolean(context.isHost) || isHostPack(detail.is_host) || isHostPack(listItem?.is_host);
    const capabilities: HomeyCapabilityMap = {};

    const soc = parseNumber(pack.soc ?? stack.soc);
    if (soc !== undefined) {
        capabilities.measure_battery = roundTo(soc, 0);
    }

    const soh = parseNumber(pack.soh ?? stack.soh);
    if (soh !== undefined) {
        capabilities['measure_percentage.soh'] = roundTo(soh, 0);
    }

    const packVoltage = parseNumber(pack.total_voltage);
    const packCurrent = parseNumber(pack.total_current);
    if (packVoltage !== undefined) {
        capabilities['measure_voltage.battery1'] = roundTo(packVoltage, 2);
    }
    if (packCurrent !== undefined) {
        capabilities['measure_current.battery1'] = roundTo(packCurrent, 2);
    }
    if (packVoltage !== undefined && packCurrent !== undefined) {
        capabilities.measure_power = roundTo(packVoltage * packCurrent, 0);
    }

    const serial = detail.battery_number;
    if (serial !== undefined && serial !== null && String(serial).trim() !== '') {
        capabilities.serial = String(serial);
    }

    capabilities['readable_boolean.host'] = host;
    capabilities['status_text.host'] = host ? 'Yes' : 'No';

    const ssid = packSsid(listItem);
    if (ssid) {
        capabilities['status_text.ssid'] = ssid;
    }

    const runMode = host
        ? firstString(stack.working_status, pack.charge_discharge_status)
        : firstString(pack.charge_discharge_status);
    if (runMode) {
        capabilities['status_text.run_mode'] = runMode;
    }

    setMeter(capabilities, 'meter_power.total_battery_charge', pack.total_input_electricity);
    setMeter(capabilities, 'meter_power.total_battery_discharge', pack.total_output_electricity);
    setMeter(capabilities, 'meter_power.daily_battery_charge', pack.totay_input_electricity);
    setMeter(capabilities, 'meter_power.daily_battery_discharge', pack.totay_output_electricity);

    const cellVoltages = parseCellVoltagesV(pack);
    cellVoltages.forEach((voltage, index) => {
        if (index < CELL_VOLTAGE_COUNT) {
            capabilities[cellVoltageCapabilityId(index)] = voltage;
        }
    });

    if (cellVoltages.length > 0) {
        const min = Math.min(...cellVoltages);
        const max = Math.max(...cellVoltages);
        capabilities['measure_voltage.cell_min'] = min;
        capabilities['measure_voltage.cell_max'] = max;
        capabilities['measure_voltage.cell_delta'] = roundTo(max - min, 3);
    }

    const cellTemps = parseCellTemperatures(pack);
    cellTemps.forEach((temperature, index) => {
        if (index < CELL_TEMPERATURE_COUNT) {
            capabilities[cellTemperatureCapabilityId(index)] = roundTo(temperature, 0);
        }
    });
    if (cellTemps.length > 0) {
        capabilities['measure_temperature.battery1'] = roundTo(Math.max(...cellTemps), 0);
    }

    if (host) {
        const stackVoltage = parseNumber(stack.total_voltage);
        const stackCurrent = parseNumber(stack.total_current);
        if (stackVoltage !== undefined) {
            capabilities['measure_voltage.stack'] = roundTo(stackVoltage, 2);
        }
        if (stackCurrent !== undefined) {
            capabilities['measure_current.stack'] = roundTo(stackCurrent, 2);
        }
        if (stackVoltage !== undefined && stackCurrent !== undefined) {
            capabilities['measure_power.stack'] = roundTo(stackVoltage * stackCurrent, 0);
        }
    }

    return capabilities;
}

function setMeter(capabilities: HomeyCapabilityMap, capabilityId: string, value: unknown): void {
    const parsed = parseNumber(value);
    if (parsed !== undefined) {
        capabilities[capabilityId] = roundTo(parsed, 2);
    }
}

function parseCellVoltagesV(pack: Record<string, unknown>): number[] {
    const single = asRecord(pack.single_voltage);
    const list = Array.isArray(single.voltage) ? single.voltage : [];
    const millivolts = list.map((value) => parseNumber(value)).filter((value): value is number => value !== undefined);
    if (millivolts.length === 0) {
        return [];
    }

    const treatAsMillivolts = Math.max(...millivolts) > 50;
    return millivolts.map((value) => roundTo(treatAsMillivolts ? value / 1000 : value, 3));
}

function parseCellTemperatures(pack: Record<string, unknown>): number[] {
    const temps = pack.cell_temperature;
    if (Array.isArray(temps)) {
        return temps.map((value) => parseNumber(value)).filter((value): value is number => value !== undefined);
    }
    const nested = asRecord(temps);
    const list = Array.isArray(nested.cell_temperature) ? nested.cell_temperature : [];
    return list.map((value) => parseNumber(value)).filter((value): value is number => value !== undefined);
}

function parseNumber(value: unknown): number | undefined {
    if (value === undefined || value === null || value === '') {
        return undefined;
    }
    const parsed = typeof value === 'number' ? value : Number(String(value).trim());
    return Number.isFinite(parsed) ? parsed : undefined;
}

function roundTo(value: number, decimals: number): number {
    const factor = 10 ** decimals;
    return Math.round(value * factor) / factor;
}

function asRecord(value: unknown): Record<string, unknown> {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
        return value as Record<string, unknown>;
    }
    return {};
}

function firstString(...values: unknown[]): string | undefined {
    for (const value of values) {
        if (value === undefined || value === null) {
            continue;
        }
        const text = String(value).trim();
        if (text) {
            return text;
        }
    }
    return undefined;
}
