/*
 * Created on Tue Aug 18 2026
 * Copyright © 2026 Wim Haanstra
 *
 * Non-commercial use only
 */

import Homey from 'homey';
import { PairSession } from 'homey/lib/Driver';
import { PlatClient, PlatError } from '../../api/plat/plat-client';
import { mapBatteryListItemToPairingDevice } from '../../api/plat/plat-mapper';

interface LoginFormData {
    account: string;
    password: string;
}

interface FormResult {
    success: boolean;
    message?: string;
}

export class PlatDriver extends Homey.Driver {
    private pairingAccount?: string;
    private pairingPassword?: string;
    private pairingToken?: string;

    async onInit() {
        this.log('PlatDriver has been initialized');
    }

    onPair = async (session: PairSession) => {
        session.setHandler('plat_login', async (data: LoginFormData): Promise<FormResult> => {
            const account = (data.account || '').trim();
            const password = data.password || '';

            if (!account || !password) {
                return { success: false, message: 'Account and password are required' };
            }

            try {
                const client = new PlatClient({
                    account,
                    password,
                    logger: this,
                });
                await client.login();
                this.pairingAccount = account;
                this.pairingPassword = password;
                this.pairingToken = client.getToken();
                return { success: true };
            } catch (error) {
                const message = error instanceof PlatError ? error.message : 'Failed to sign in';
                this.error('PLAT login failed');
                return { success: false, message };
            }
        });

        session.setHandler('list_devices', async () => {
            if (!this.pairingAccount || !this.pairingPassword) {
                return [];
            }

            const client = new PlatClient({
                account: this.pairingAccount,
                password: this.pairingPassword,
                token: this.pairingToken,
                logger: this,
            });

            const batteries = await client.listBatteries();
            this.pairingToken = client.getToken();

            return batteries
                .map((item) => mapBatteryListItemToPairingDevice(item, {
                    account: this.pairingAccount!,
                    password: this.pairingPassword!,
                }))
                .filter((device): device is NonNullable<typeof device> => device !== undefined);
        });
    };
}

module.exports = PlatDriver;
