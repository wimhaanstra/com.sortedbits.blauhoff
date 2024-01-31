import fetch from 'node-fetch';

import { API } from '../api';
import { Logger } from '../log';
import { deviceInfoResponse } from './helpers/device-info';
import { testDevice } from './helpers/test-device';
import { BlauHoffDeviceStatus } from '../models/blauhoff-device-status';
import { QueryDeviceResponse } from '../models/responses/query-device.response';

jest.mock('node-fetch');
const { Response } = jest.requireActual('node-fetch');

const failObject = {
    msg: 'ERROR',
    code: 401,
    t: 1684756685989,
};

const getObjectsFromRow = (deviceInfo: QueryDeviceResponse, row: number, column: number): BlauHoffDeviceStatus => {
    const name = deviceInfo.data.columns[column];
    const metadata = deviceInfo.data.metadata[column];
    const value = deviceInfo.data.rows[row][column];

    return {
        dataType: metadata,
        name,
        value,
    };
};

describe('query-device', () => {
    test('succesfully query a device', async () => {
        const api = new API(new Logger());

        expect(fetch).toHaveBeenCalledTimes(0);

        (fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue(
            new Response(JSON.stringify(deviceInfoResponse)),
        );

        const currentTime = Date.now() / 1000;
        const previousTime = currentTime - 1000;

        const response = await api.queryDevice(testDevice, {
            start: previousTime,
            end: currentTime,
        });

        expect(response.length).toStrictEqual(deviceInfoResponse.data.rows.length);

        response.forEach((row, rowIndex) => {
            row.forEach((item, itemIndex) => {
                const compareItem = getObjectsFromRow(deviceInfoResponse, rowIndex, itemIndex);
                expect(item).toStrictEqual(compareItem);
            });
        });
    });

    test('fail querying a device', async () => {
        const api = new API(new Logger());

        expect(fetch).toHaveBeenCalledTimes(0);

        (fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue(
            new Response(JSON.stringify(failObject)),
        );

        const currentTime = Date.now() / 1000;
        const previousTime = currentTime - 1000;

        const response = await api.queryDevice(testDevice, {
            start: previousTime,
            end: currentTime,
        });

        expect(response).toStrictEqual([]);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });
});
