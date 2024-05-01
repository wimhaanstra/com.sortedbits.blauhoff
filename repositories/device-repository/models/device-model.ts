/*
 * Created on Wed Mar 20 2024
 * Copyright © 2024 Wim Haanstra
 *
 * Non-commercial use only
 */

import { IAPI } from '../../../api/iapi';
import { IBaseLogger } from '../../../helpers/log';
import { Brand } from './enum/brand';
import { ModbusDeviceDefinition } from './modbus-device-registers';

export enum SupportedFlowTypes {
    set_max_solar_power = 'set_max_solar_power',
    set_solar_sell = 'set_solar_sell',
    set_max_sell_power = 'set_max_sell_power',
    write_value_to_register = 'write_value_to_register',
    set_energy_pattern = 'set_energy_pattern',
    set_grid_peak_shaving_on = 'set_grid_peak_shaving_on',
    set_grid_peak_shaving_off = 'set_grid_peak_shaving_off',
    set_work_mode_and_zero_export_power = 'set_work_mode_and_zero_export_power',
    set_time_of_use_enabled = 'set_time_of_use_enabled',
    set_time_of_use_day_enabled = 'set_time_of_use_day_enabled',
    set_time_of_use_timeslot_parameters = 'set_time_of_use_timeslot_parameters',
}

export const getSupportedFlowTypes = (): string[] => {
    return Object.keys(SupportedFlowTypes).map((key: string) => SupportedFlowTypes[key as keyof typeof SupportedFlowTypes]);
};

interface SupportedFlows {
    actions?: {
        [id in SupportedFlowTypes]?: (origin: IBaseLogger, args: any, client: IAPI) => Promise<void>;
    };
}

export interface DeviceModel {
    id: string;
    brand: Brand;
    name: string;
    description: string;
    debug: boolean;

    definition: ModbusDeviceDefinition;

    supportedFlows?: SupportedFlows;
}