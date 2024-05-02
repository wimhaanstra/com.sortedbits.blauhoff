/*
 * Created on Wed Mar 20 2024
 * Copyright © 2024 Wim Haanstra
 *
 * Non-commercial use only
 */

import { aforeAFXKTH } from './devices/afore/af-xk-th-three-phase-hybrid';
import { deyeSunXKSG01HP3 } from './devices/deye/sun-xk-sg01hp3-eu-am2';
import { growattTL } from './devices/growatt/mod-XXXX-tl';
import { growattTL3 } from './devices/growatt/mod-XXXX-tl3';
import { DeviceModel } from './models/device-model';
import { Brand } from './models/enum/brand';
import { RegisterType } from './models/enum/register-type';
import { ModbusRegister } from './models/modbus-register';

export class DeviceRepository {
    private static devices: DeviceModel[] = [growattTL, growattTL3, deyeSunXKSG01HP3, aforeAFXKTH];

    public static getDevices(): DeviceModel[] {
        return this.devices;
    }

    public static getDeviceById(id: string): DeviceModel | undefined {
        return this.devices.find((device) => device.id === id);
    }

    public static getDevicesByBrand(brand: Brand): DeviceModel[] {
        return this.devices.filter((device) => device.brand === brand);
    }

    public static getDeviceByBrandAndModel(brand: Brand, model: string): DeviceModel | undefined {
        return this.devices.find((device) => device.brand === brand && device.id === model);
    }

    public static getRegisterByTypeAndAddress(device: DeviceModel, type: RegisterType, address: number): ModbusRegister | undefined {
        switch (type) {
            case RegisterType.Input:
                return device.definition.inputRegisters.find((register) => register.address === address);
            case RegisterType.Holding:
                return device.definition.holdingRegisters.find((register) => register.address === address);
            default:
                return undefined;
        }
    }
}
