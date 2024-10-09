import makeWASocket, { useMultiFileAuthState, fetchLatestBaileysVersion, DisconnectReason, makeInMemoryStore } from '@whiskeysockets/baileys';
import Pino from 'pino';
import path from 'path';
import qrcode from 'qrcode-terminal';
import fs from 'fs';

const store = makeInMemoryStore({ logger: Pino().child({ level: 'fatal', stream: 'store' }) });

const connectWhatsApp = async () => {
    const { version, isLatest } = await fetchLatestBaileysVersion();
    const { state, saveCreds } = await useMultiFileAuthState(path.resolve('auth'));
    console.log(`--- WhatsApp Bot Info ---`);
    console.log(`Using version: ${version}`);
    console.log(`Newer version available: ${isLatest ? 'Yes' : 'No'}`);
    console.log(`-------------------------`);
    const sock = makeWASocket({
        logger: Pino({ level: 'silent' }),
        printQRInTerminal: false,
        browser: ['BOT AUTO ORDER', 'Safari', '1.0.0'],
        auth: state,
        version: version || [2, 2204, 13],
    });
    store.bind(sock.ev);
    sock.ev.on('chats.upsert', () => { 
        console.log('got chats', store.chats.all().length);
    });
    sock.ev.on('contacts.upsert', () => { 
        console.log('got contacts', Object.values(store.contacts).length);
    });
    const uncache = (module: string = '.'): Promise<void> => {
        return new Promise((resolve, reject) => {
            try {
                delete require.cache[require.resolve(module)];
                resolve();
            } catch (e) {
                reject(e);
            }
        });
    };
    const nocache = (module: string, cb: (module: string) => void = () => {}): void => {
        console.log(`Module ${module} Berjalan`);
        fs.watchFile(require.resolve(module), async () => {
            await uncache(require.resolve(module));
            cb(module);
        });
    };
    nocache('./handler/message', module => console.log(`"${module}" Updated!`));
    sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
        if (connection === 'close') {
            const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
            if (statusCode !== DisconnectReason.loggedOut) {
                console.log('Connection closed. Reconnecting...');
                connectWhatsApp();
            } else {
                console.log('Bot has been logged out.');
            }
        } else if (connection === 'open') {
            console.log('✅ Bot connected successfully.');
        }
        if (qr) {
            console.log('⚠️  Please scan the QR code:');
            qrcode.generate(qr, { small: true });
        }
    });
    sock.ev.on('creds.update', saveCreds);
    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        require('./handler/message')(sock, msg);
    });
};

connectWhatsApp();
