import { createServer, Socket as NetSocket } from 'net';
import { Logger } from '../../../helpers/log';
import { SolarmanAPI2 } from '../solarman-api2';

const SERIAL = '1234567890';
const DEVICE_ID = 'sun-xk-sg01hp3-eu-am2';

// Build a minimal 13-byte Solarman V5 heartbeat frame.
// Layout matches what FrameDefinition.unwrapResponseFrame expects: it parses
// fine up to the control-code check (0x4710 instead of the 0x1510 expected
// for a Modbus response) which is exactly the path the production parser
// classifies as "ignore unsolicited frame".
//   [0]     0xA5 (start)
//   [1..2]  payload length (LE) = 0
//   [3..4]  control code (LE)   = 0x4710 (heartbeat)
//   [5..6]  sequence (LE)
//   [7..10] data logger serial (LE u32)
//   [11]    checksum: sum of bytes 1..10, low byte
//   [12]    0x15 (end)
const buildHeartbeatFrame = (serial: string): Buffer => {
    const frame = Buffer.alloc(13);
    frame[0] = 0xa5;
    frame.writeUInt16LE(0, 1);
    frame.writeUInt16LE(0x4710, 3);
    frame.writeUInt16LE(1, 5);
    frame.writeUInt32LE(Number(serial), 7);

    let checksum = 0;
    for (let i = 1; i <= 10; i++) {
        checksum = (checksum + frame[i]) & 0xff;
    }
    frame[11] = checksum;
    frame[12] = 0x15;
    return frame;
};

interface FakeServer {
    port: number;
    close: () => Promise<void>;
}

const startHeartbeatOnlyServer = async (): Promise<FakeServer> => {
    const sockets: NetSocket[] = [];
    const server = createServer((socket) => {
        sockets.push(socket);
        const heartbeat = buildHeartbeatFrame(SERIAL);
        const interval = setInterval(() => {
            if (!socket.destroyed) socket.write(heartbeat);
        }, 30);
        socket.on('close', () => clearInterval(interval));
        socket.on('error', () => { /* expected when client closes */ });
    });

    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 0;

    return {
        port,
        close: () => new Promise<void>((resolve) => {
            sockets.forEach((s) => s.destroy());
            server.close(() => resolve());
        }),
    };
};

describe('SolarmanAPI2 — heartbeat handling does not block forever', () => {
    test('performRequestQueued rejects within timeout when only heartbeat frames arrive', async () => {
        const server = await startHeartbeatOnlyServer();

        try {
            const api = new SolarmanAPI2(DEVICE_ID, {
                host: '127.0.0.1',
                port: server.port,
                unitId: 1,
                timeout: 250,
                serial: SERIAL,
            }, new Logger());

            // A throwaway Modbus request. The fake server never sends a real
            // Modbus response — only heartbeats — so this must reject on the
            // request deadline rather than hang.
            const request = Buffer.from([0x01, 0x03, 0x00, 0x00, 0x00, 0x01, 0x84, 0x0a]);

            const start = Date.now();
            await expect((api as any).performRequestQueued(request))
                .rejects.toThrow(/timeout|deadline/i);
            const elapsed = Date.now() - start;

            // Must give up close to the configured timeout, not many seconds later.
            expect(elapsed).toBeLessThan(1500);
            expect(elapsed).toBeGreaterThanOrEqual(200);
        } finally {
            await server.close();
        }
    }, 3000);
});
