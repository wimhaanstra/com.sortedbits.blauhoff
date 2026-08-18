import { readFileSync } from 'fs';
import { join } from 'path';
import { PlatMonitorPayload } from '../plat-client';
import {
    cellTemperatureCapabilityId,
    cellVoltageCapabilityId,
    mapBatteryListItemToPairingDevice,
    mapMonitorToCapabilities,
    platDeviceName,
} from '../plat-mapper';

const slaveFixture = JSON.parse(readFileSync(join(__dirname, 'fixtures/battery-monitor-slave.json'), 'utf8')) as PlatMonitorPayload;
const hostFixture = JSON.parse(readFileSync(join(__dirname, 'fixtures/battery-monitor-host.json'), 'utf8')) as PlatMonitorPayload;

describe('plat-mapper', () => {
    test('maps a live slave monitor payload', () => {
        const capabilities = mapMonitorToCapabilities(slaveFixture);

        expect(capabilities.measure_battery).toBe(68);
        expect(capabilities['measure_percentage.soh']).toBe(95);
        expect(capabilities['measure_voltage.battery1']).toBe(52.3);
        expect(capabilities['measure_current.battery1']).toBe(-3.73);
        expect(capabilities.measure_power).toBe(-195);
        expect(capabilities['measure_temperature.battery1']).toBe(21);
        expect(capabilities['status_text.run_mode']).toBe('discharge');
        expect(capabilities.serial).toBe('1417907SLKOPG020040');
        expect(capabilities['meter_power.total_battery_charge']).toBe(123.45);
        expect(capabilities['meter_power.total_battery_discharge']).toBe(98.76);
        expect(capabilities['meter_power.daily_battery_charge']).toBe(1.23);
        expect(capabilities['meter_power.daily_battery_discharge']).toBe(4.56);
        expect(capabilities[cellVoltageCapabilityId(0)]).toBe(3.272);
        expect(capabilities[cellVoltageCapabilityId(8)]).toBe(3.27);
        expect(capabilities[cellVoltageCapabilityId(15)]).toBe(3.271);
        expect(capabilities['measure_voltage.cell_min']).toBe(3.27);
        expect(capabilities['measure_voltage.cell_max']).toBe(3.274);
        expect(capabilities['measure_voltage.cell_delta']).toBe(0.004);
        expect(capabilities[cellTemperatureCapabilityId(0)]).toBe(20);
        expect(capabilities[cellTemperatureCapabilityId(1)]).toBe(21);
        expect(capabilities[cellTemperatureCapabilityId(2)]).toBe(21);
        expect(capabilities['measure_voltage.stack']).toBeUndefined();
        expect(capabilities['measure_power.stack']).toBeUndefined();
    });

    test('maps host stack totals and working status', () => {
        const capabilities = mapMonitorToCapabilities(hostFixture, true);

        expect(capabilities.measure_battery).toBe(67);
        expect(capabilities['status_text.run_mode']).toBe('Discharging');
        expect(capabilities['measure_voltage.stack']).toBe(157.25);
        expect(capabilities['measure_current.stack']).toBe(-3.76);
        expect(capabilities['measure_power.stack']).toBe(-591);
        expect(capabilities[cellVoltageCapabilityId(14)]).toBe(3.277);
        expect(capabilities['measure_voltage.cell_delta']).toBe(0.007);
    });

    test('maps pairing devices from the battery list', () => {
        const device = mapBatteryListItemToPairingDevice(
            {
                id: 44798,
                name: 'BLH',
                battery_number: '1417907SLKOPG020040',
                is_host: 'No',
            },
            { account: 'user@example.com', password: 'secret' },
        );

        expect(device).toEqual({
            name: 'BLH020040',
            data: {
                id: 'plat-44798',
                batteryId: '44798',
                serial: '1417907SLKOPG020040',
                isHost: false,
            },
            settings: {
                account: 'user@example.com',
                password: 'secret',
                refreshInterval: 30,
                enabled: true,
            },
        });
    });

    test('uses the app name when it is not BLH', () => {
        expect(platDeviceName('Garage', '1418330SLKOPG020269')).toBe('Garage 020269');
    });
});
