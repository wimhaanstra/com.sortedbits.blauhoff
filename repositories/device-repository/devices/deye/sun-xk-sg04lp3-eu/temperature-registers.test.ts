import { Logger } from '../../../../../helpers/log';
import { DeviceRepository } from '../../../device-repository';
import { ModbusDevice } from '../../../models/modbus-device';
import { ModbusRegister } from '../../../models/modbus-register';

const log = new Logger();

// Sunsynk/Deye Modbus protocol: temperatures stored as tenths of °C with a +1000
// offset (1000 == 0°C). Verified against three calibration points published in
// the Sunsynk Modbus protocol document and against kellerza/sunsynk's TempSensor
// (offset=100, factor=0.1) which is functionally identical.
const calibration = [
    { raw: 438, expected: -56.2 },
    { raw: 1000, expected: 0 },
    { raw: 1505, expected: 50.5 },
    // Real-world case from a user report: device showed ~46°C while the app
    // showed 14.7°C with the previous (incorrect) `* 0.01` scaling.
    { raw: 1470, expected: 47.0 },
];

const findRegister = (device: ModbusDevice, capabilityId: string, address: number): ModbusRegister => {
    const register = device.holdingRegisters.find(
        (r) => r.address === address && r.parseConfigurations.some((p) => p.capabilityId === capabilityId),
    );
    if (!register) throw new Error(`Register ${capabilityId} @ ${address} not found`);
    return register;
};

const expectClose = (actual: number, expected: number) => {
    expect(Math.abs(actual - expected)).toBeLessThan(0.0001);
};

describe.each([
    ['sun-xk-sg04lp3-eu', 'Deye Sun *K SG04LP3 EU'],
    ['sun-xk-sg01hp3-eu-am2', 'Deye Sun *K SG01HP3 EU AM2'],
])('%s temperature registers apply offset-1000 encoding', (deviceId) => {
    const device = DeviceRepository.getInstance().getDeviceById(deviceId)!;

    test.each(calibration)(
        'AC temperature (541): raw $raw → $expected °C',
        ({ raw, expected }) => {
            const register = findRegister(device, 'measure_temperature.ac', 541);
            expectClose(register.calculateValue(raw, Buffer.alloc(0), log), expected);
        },
    );

    test.each(calibration)(
        'DC temperature (540): raw $raw → $expected °C',
        ({ raw, expected }) => {
            const register = findRegister(device, 'measure_temperature.dc', 540);
            expectClose(register.calculateValue(raw, Buffer.alloc(0), log), expected);
        },
    );

    test.each(calibration)(
        'Battery temperature (586): raw $raw → $expected °C',
        ({ raw, expected }) => {
            const register = findRegister(device, 'measure_temperature.battery1', 586);
            expectClose(register.calculateValue(raw, Buffer.alloc(0), log), expected);
        },
    );
});
