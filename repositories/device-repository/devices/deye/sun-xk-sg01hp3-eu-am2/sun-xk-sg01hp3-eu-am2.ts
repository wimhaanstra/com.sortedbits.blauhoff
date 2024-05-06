/*
 * Created on Fri Mar 22 2024
 * Copyright © 2024 Wim Haanstra
 *
 * Non-commercial use only
 */
import { IAPI } from '../../../../../api/iapi';
import { logBits, writeBitsToBuffer } from '../../../../../helpers/bits';
import { IBaseLogger } from '../../../../../helpers/log';
import { Device } from '../../../models/device';
import { Brand } from '../../../models/enum/brand';
import { RegisterType } from '../../../models/enum/register-type';
import { holdingRegisters } from './holding-registers';

export class DeyeSunXKSG01HP3 extends Device {
    constructor() {
        super('sun-xk-sg01hp3-eu-am2', Brand.Deye, 'Deye Sun *K SG01HP3 EU AM2 Series', 'Deye Sun *K SG01HP3 EU AM2 Series with modbus interface');

        this.supportsSolarman = true;
        this.deprecatedCapabilities = ['status_code.work_mode', 'status_code.run_mode'];

        this.supportedFlows = {
            actions: {
                set_max_solar_power: this.setMaxSolarPower,
                set_solar_sell: this.setSolarSell,
                set_max_sell_power: this.setMaxSellPower,
                write_value_to_register: this.writeValueToRegister,
                set_energy_pattern: this.setEnergyPattern,
                set_grid_peak_shaving_on: this.setGridPeakShavingOn,
                set_grid_peak_shaving_off: this.setGridPeakShavingOff,
                set_work_mode_and_zero_export_power: this.setWorkmodeAndZeroExportPower,
                set_time_of_use_enabled: this.setTimeOfUseEnabled,
                set_time_of_use_day_enabled: this.setTimeOfUseDayEnabled,
                set_time_of_use_timeslot_parameters: this.setTimeOfUseTimeslotParametersStart,
            },
        };

        this.addHoldingRegisters(holdingRegisters);
    }

    setMaxSolarPower = async (origin: IBaseLogger, args: any, client: IAPI): Promise<void> => {
        const register = this.getRegisterByTypeAndAddress(RegisterType.Holding, 340);

        if (register === undefined) {
            origin.error('Register not found');
            return;
        }

        const { value } = args;

        origin.log('Setting max solar power to: ', value);

        if (value < 1000 || value > 7800) {
            origin.error('Value out of range');
            return;
        }

        try {
            const payload = register.calculatePayload(value, origin);
            const result = await client.writeRegister(register, payload);
            origin.log('Output', result);
        } catch (error) {
            origin.error('Error enabling solar selling', error);
        }
    };

    setMaxSellPower = async (origin: IBaseLogger, args: any, client: IAPI): Promise<void> => {
        const register = this.getRegisterByTypeAndAddress(RegisterType.Holding, 143);

        if (register === undefined) {
            origin.error('Register not found');
            return;
        }

        const { value } = args;

        origin.log('Setting max sell power to: ', value);

        if (value < 10 || value > 16000) {
            origin.error('Value out of range');
            return;
        }

        try {
            const payload = register.calculatePayload(value, origin);
            const result = await client.writeRegister(register, payload);
            origin.log('Output', result);
        } catch (error) {
            origin.error('Error enabling solar selling', error);
        }
    };

    setSolarSell = async (origin: IBaseLogger, args: any, client: IAPI): Promise<void> => {
        const register = this.getRegisterByTypeAndAddress(RegisterType.Holding, 145);
        if (register === undefined) {
            origin.error('Register not found');
            return;
        }

        const { enabled } = args;

        origin.log('Setting solar selling to: ', enabled);

        try {
            const result = await client.writeRegister(register, enabled ? 1 : 0);
            origin.log('Output', result);
        } catch (error) {
            origin.error('Error enabling solar selling', error);
        }
    };

    writeValueToRegister = async (origin: IBaseLogger, args: any, client: IAPI): Promise<void> => {
        client.writeValueToRegister(args);
    };

    setEnergyPattern = async (origin: IBaseLogger, args: any, client: IAPI): Promise<void> => {
        const register = this.getRegisterByTypeAndAddress(RegisterType.Holding, 141);

        if (register === undefined) {
            origin.error('Register not found');
            return;
        }

        const { value } = args;

        if (value !== 'batt_first' && value !== 'load_first') {
            origin.error('Invalid value', value);
            return;
        }

        origin.log('Setting energy pattern to: ', value);

        const newBits = value === 'batt_first' ? [0] : [1];

        try {
            const readBuffer = await client.readAddressWithoutConversion(register);

            if (!readBuffer) {
                throw new Error('Error reading current value');
            }

            logBits(origin, readBuffer);

            const byteIndex = 1; // Big Endian so we count in reverse
            const resultBuffer = writeBitsToBuffer(readBuffer, byteIndex, newBits);
            logBits(origin, resultBuffer);

            const result = await client.writeBufferRegister(register, resultBuffer);
            origin.log('Output', result);
        } catch (error) {
            origin.error('Error reading current value', error);
            return;
        }
    };

    setWorkmodeAndZeroExportPower = async (origin: IBaseLogger, args: any, client: IAPI): Promise<void> => {
        const workmodes = [
            { id: 'selling_first', value: 0 },
            {
                id: 'zero_export_to_load',
                value: 1,
            },
            {
                id: 'zero_export_to_ct',
                value: 2,
            },
        ];

        const modeRegister = this.getRegisterByTypeAndAddress(RegisterType.Holding, 142);
        const powerRegister = this.getRegisterByTypeAndAddress(RegisterType.Holding, 104);

        if (!modeRegister || !powerRegister) {
            origin.error('Register not found');
            return;
        }

        const { value, workmode } = args;

        const workmodeDefinition = workmodes.find((m) => m.id === workmode);

        if (!workmodeDefinition) {
            origin.error('Invalid workmode', workmode);
            return;
        }

        if (value < 0 || value > 100) {
            origin.error('Value out of range', value);
            return;
        }

        origin.log('Setting workmode to ', workmode, 'with zero export power to ', value, 'W');

        const workModeValue = workmodeDefinition.value;

        try {
            const modeResult = await client.writeRegister(modeRegister, workModeValue);
            origin.log('Workmode output', modeResult);

            const payload = powerRegister.calculatePayload(value, origin);
            const powerResult = await client.writeRegister(powerRegister, payload);
            origin.log('Power output', powerResult);
        } catch (error) {
            origin.error('Error setting workmode or power', error);
        }
    };

    setGridPeakShavingOn = async (origin: IBaseLogger, args: any, client: IAPI): Promise<void> => {
        const modeRegister = this.getRegisterByTypeAndAddress(RegisterType.Holding, 178);
        const powerRegister = this.getRegisterByTypeAndAddress(RegisterType.Holding, 191);

        if (!modeRegister || !powerRegister) {
            origin.error('Register not found');
            return;
        }

        const { value } = args;

        if (value < 0 || value > 16000) {
            origin.error('Value out of range', value);
            return;
        }

        const bits = [1, 1];
        const bitIndex = 4;
        origin.log('Setting Grid Peak Shaving mode on with ', value, 'W');

        try {
            const result = await client.writeBitsToRegister(modeRegister, bits, bitIndex);
            origin.log('Set `grid peak shaving on` result', result);

            if (result) {
                const payload = powerRegister.calculatePayload(value, origin);
                const powerResult = await client.writeRegister(powerRegister, payload);
                origin.log('Power output', powerResult);
            }
        } catch (error) {
            origin.error('Error setting workmode or power', error);
        }
    };

    setGridPeakShavingOff = async (origin: IBaseLogger, args: any, client: IAPI): Promise<void> => {
        const modeRegister = this.getRegisterByTypeAndAddress(RegisterType.Holding, 178);

        if (!modeRegister) {
            origin.error('Register not found');
            return;
        }

        origin.log('Setting Grid Peak Shaving mode off');

        const bits = [0, 1];
        const bitIndex = 4;

        try {
            const result = await client.writeBitsToRegister(modeRegister, bits, bitIndex);
            origin.log('Set `grid peak shaving off` result', result);
        } catch (error) {
            origin.error('Error setting grid peak shaving mode', error);
        }
    };

    setTimeOfUseEnabled = async (origin: IBaseLogger, args: any, client: IAPI): Promise<void> => {
        const register = this.getRegisterByTypeAndAddress(RegisterType.Holding, 146);

        if (register === undefined) {
            origin.error('Register not found');
            return;
        }

        const { enabled } = args;
        origin.log('Setting time of use enabled to: ', enabled);
        const bits = enabled === 'true' ? [1] : [0];

        try {
            const result = await client.writeBitsToRegister(register, bits, 0);
            origin.log('Set time of use enabled result', result);
        } catch (error) {
            origin.error('Error setting workmode or power', error);
        }
    };

    setTimeOfUseDayEnabled = async (origin: IBaseLogger, args: any, client: IAPI): Promise<void> => {
        const register = this.getRegisterByTypeAndAddress(RegisterType.Holding, 146);

        if (register === undefined) {
            origin.error('Register not found');
            return;
        }

        const { enabled, day } = args;

        if (Number(day) < 1 || Number(day) > 7) {
            origin.error('Invalid day', day);
        }

        const bitIndex = Number(day);
        const bits = enabled === 'true' ? [1] : [0];

        try {
            const result = await client.writeBitsToRegister(register, bits, bitIndex);
            origin.log('Set time of use for day enabled result', result);
        } catch (error) {
            origin.error('Error setting workmode or power', error);
        }
    };

    setTimeOfUseTimeslotParametersStart = async (origin: IBaseLogger, args: any, client: IAPI): Promise<void> => {
        const randomTimeout = Math.floor(Math.random() * 600);

        return new Promise((resolve) => {
            setTimeout(() => resolve(this.setTimeOfUseTimeslotParameters(origin, args, client)), randomTimeout);
        });
    };

    setTimeOfUseTimeslotParameters = async (origin: IBaseLogger, args: any, client: IAPI): Promise<void> => {
        const { timeslot, time, gridcharge, generatorcharge, powerlimit, batterycharge } = args;

        const timeslotNumber = Number(timeslot);
        if (timeslotNumber < 1 || timeslotNumber > 6) {
            origin.error('Invalid timeslot', timeslot);
            return;
        }

        const gridChargeBit = gridcharge === 'true' ? 1 : 0;
        const generatorChargeBit = generatorcharge === 'true' ? 1 : 0;

        const powerLimitNumber = Number(powerlimit);
        if (powerLimitNumber < 0 || powerLimitNumber > 8000) {
            origin.error('Invalid power limit', powerlimit);
            return;
        }

        const batteryChargeNumber = Number(batterycharge);
        if (batteryChargeNumber < 0 || batteryChargeNumber > 100) {
            origin.error('Invalid battery charge', batterycharge);
            return;
        }

        const chargeAddress = 172 + (timeslotNumber - 1);
        const powerAddress = 154 + (timeslotNumber - 1);
        const batteryAddress = 166 + (timeslotNumber - 1);
        const timeAddress = 148 + (timeslotNumber - 1);

        const chargeRegister = this.getRegisterByTypeAndAddress(RegisterType.Holding, chargeAddress);
        const powerRegister = this.getRegisterByTypeAndAddress(RegisterType.Holding, powerAddress);
        const batteryRegister = this.getRegisterByTypeAndAddress(RegisterType.Holding, batteryAddress);
        const timeRegister = this.getRegisterByTypeAndAddress(RegisterType.Holding, timeAddress);

        if (!chargeRegister || !powerRegister || !batteryRegister || !timeRegister) {
            origin.error('Register not found', chargeAddress, powerAddress, batteryAddress, timeAddress);
            return;
        }

        const chargeBits = [gridChargeBit, generatorChargeBit];
        const parsedTime = Number(time.replace(':', ''));
        const powerPayload = powerRegister.calculatePayload(powerLimitNumber, origin);

        origin.log('Setting timeslot parameters', {
            timeslot,
            parsedTime,
            gridcharge,
            generatorcharge,
            chargingBits: chargeBits,
            powerPayload,
            batteryChargeNumber,
        });

        try {
            const chargeResult = await client.writeBitsToRegister(chargeRegister, chargeBits, 0);
            origin.log('Set timeslot charge result', chargeResult);

            const powerResult = await client.writeRegister(powerRegister, powerPayload);
            origin.log('Set timeslot power result', powerResult);

            const batteryResult = await client.writeRegister(batteryRegister, batteryChargeNumber);
            origin.log('Set timeslot battery result', batteryResult);

            const timeResult = await client.writeRegister(timeRegister, parsedTime);
            origin.log('Set timeslot time result', timeResult);
        } catch (error) {
            origin.error('Error setting timeslot parameters', error);
        }
    };
}