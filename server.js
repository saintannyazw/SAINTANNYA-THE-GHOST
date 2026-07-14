const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const QRCode = require('qrcode');
const pino = require('pino');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;

app.use(express.static('public'));

async function startWhatsAppBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');

    const sock = makeWASocket({
        logger: pino({ level: 'silent' }),
        auth: state,
        printQRInTerminal: true
    });

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            QRCode.toDataURL(qr, (err, url) => {
                if (!err) io.emit('qr', url);
            });
            io.emit('status', 'Waiting for QR Scan');
        }

        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            io.emit('status', 'Ghost Disconnected. Reincarnating...');
            if (shouldReconnect) {
                startWhatsAppBot();
            }
        } else if (connection === 'open') {
            console.log('SAINTANNYA THE GHOST has successfully materialized!');
            io.emit('status', 'Connected');
        }
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages;
        if (!msg.message || msg.key.fromMe) return;

        const remoteJid = msg.key.remoteJid;
        const messageText = msg.message.conversation || msg.message.extendedTextMessage?.text || '';

        if (messageText.toLowerCase() === '.ping') {
            await sock.sendMessage(remoteJid, { 
                text: '👻 *SAINTANNYA THE GHOST* is active and watching. \n⚡ Status: Fully Operational.' 
            });
        }
    });
}

io.on('connection', (socket) => {
    socket.emit('status', 'Awakening SAINTANNYA...');
});

server.listen(PORT, () => {
    console.log(`SAINTANNYA Control Interface active on port ${PORT}`);
    startWhatsAppBot();
});
