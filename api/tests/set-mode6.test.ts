import fetch from 'node-fetch';

import { API } from '../api';
import { Logger } from '../log';
import { testDevice } from './helpers/test-device';

jest.mock('node-fetch');
const { Response } = jest.requireActual('node-fetch');

const successObject = {
    msg: 'OK',
    code: 200,
    t: 1684756685989,
};

const failObject = {
    msg: 'ERROR',
    code: 401,
    t: 1684756685989,
};

describe('setMode6', () => {
    test('with valid values', async () => {
        const api = new API(new Logger());
        api.setUserToken('user-token');
        expect(fetch).toHaveBeenCalledTimes(0);

        (fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue(
            new Response(JSON.stringify(successObject)),
        );

        const result = await api.setMode6(testDevice, {
            batPower: 2000,
            batPowerInvLimit: 3500,
            batCapMin: 10,
            timeout: 600,
        });

        const expectHeaders = {
            Accept: '*/*',
            Authorization: 'user-token',
            'Content-Type': 'application/json',
        };

        const expectedParams = JSON.stringify({
            batPower: 2000,
            batPowerInvLimit: 3500,
            batCapMin: 10,
            timeout: 600,
            deviceSn: testDevice.serial,
        });

        expect(fetch).toHaveBeenCalledWith(
            'https://api-vpp-au.weiheng-tech.com/api/vpp/v1/hub/device/vpp/mode6',
            { body: expectedParams, headers: expectHeaders, method: 'post' },
        );

        expect(result).toStrictEqual(true);
    });

    test('fails', async () => {
        const api = new API(new Logger());
        api.setUserToken('user-token');
        expect(fetch).toHaveBeenCalledTimes(0);

        (fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue(
            new Response(JSON.stringify(failObject)),
        );

        const result = await api.setMode6(testDevice, {
            batPower: 2000,
            batPowerInvLimit: 3500,
            batCapMin: 10,
            timeout: 600,
        });

        expect(result).toStrictEqual(false);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });
});