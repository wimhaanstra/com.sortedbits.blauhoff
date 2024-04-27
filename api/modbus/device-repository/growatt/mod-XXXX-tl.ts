/*
 * Created on Wed Mar 20 2024
 * Copyright © 2024 Wim Haanstra
 *
 * Non-commercial use only
 */

import { DeviceModel } from '../../models/device-model';
import { Brand } from '../../models/enum/brand';
import { RegisterDataType } from '../../models/enum/register-datatype';
import { ModbusDeviceDefinition } from '../../models/modbus-device-registers';
import { ModbusRegister } from '../../models/modbus-register';
import { defaultValueConverter } from '../_shared/default-value-converter';

const inputRegisters = [
    ModbusRegister.default('status_code.run_mode', 0, 1, RegisterDataType.UINT8),

    ModbusRegister.scale('measure_voltage.pv1', 3, 2, RegisterDataType.UINT16, 0.1),
    ModbusRegister.scale('measure_voltage.pv2', 7, 2, RegisterDataType.UINT16, 0.1),

    ModbusRegister.scale('measure_power.ac', 1, 2, RegisterDataType.UINT32, 0.1),
    ModbusRegister.scale('measure_power.pv1', 5, 2, RegisterDataType.UINT32, 0.1),
    ModbusRegister.scale('measure_power.pv2', 9, 2, RegisterDataType.UINT32, 0.1),
    ModbusRegister.scale('measure_power', 35, 2, RegisterDataType.UINT32, 0.1),

    ModbusRegister.scale('measure_voltage.grid_l1', 38, 2, RegisterDataType.UINT16, 0.1),
    ModbusRegister.scale('meter_power.today', 53, 2, RegisterDataType.UINT32, 0.1),
    ModbusRegister.scale('meter_power', 55, 2, RegisterDataType.UINT32, 0.1),
];

const holdingRegisters: ModbusRegister[] = [ModbusRegister.default('serial', 23, 5, RegisterDataType.STRING)];

// eslint-disable-next-line camelcase
export const mod_tl_registers: ModbusDeviceDefinition = {
    inputRegisters,
    holdingRegisters,
    inputRegisterResultConversion: defaultValueConverter,
    holdingRegisterResultConversion: defaultValueConverter,
    deprecatedCapabilities: ['measure_power.l1', 'measure_power.l2', 'measure_power.l3'],
};

export const growattTL: DeviceModel = {
    id: 'growatt-tl',
    brand: Brand.Growatt,
    name: 'Growatt 1PH MIC TL-X series',
    description: 'Single phase Growatt string inverters with MODBUS interface.',
    debug: true,
    definition: mod_tl_registers,
};
