Require('./settings');
const fs = require('fs');
const os = require('os');
const pino = require('pino');
const path = require('path');
const chalk = require('chalk');
const readline = require('readline');
const { Boom } = require('@hapi/boom');
const qrcode = require('qrcode-terminal');
const NodeCache = require('node-cache');
const { toBuffer } = require('qrcode');
const { exec } = require('child_process');
const { parsePhoneNumber } = require('awesome-phonenumber');
const { default: WAConnection, useMultiFileAuthState, Browsers, DisconnectReason, makeCacheableSignalKeyStore, fetchLatestBaileysVersion, jidNormalizedUser } = require('@whiskeysockets/baileys');

// Pastikan semua file ini ada di folder src/ dan lib/
const { dataBase } = require('./src/database'); 
const { app, server, PORT } = require('./src/server'); 

// IMPORT KETIGA FUNGSI (Memastikan tidak ada error 'is not defined')
const { GroupParticipantsUpdate, MessagesUpsert, Solving } = require('./src/message'); 

const { assertInstalled } = require('./lib/function'); 

// --- Inisialisasi & Konfigurasi Awal ---
const print = (label, value) => console.log(`${chalk.green.bold('║')} ${chalk.cyan.bold(label.padEnd(16))}${chalk.yellow.bold(':')} ${value}`);
const pairingCode = process.argv.includes('--qr') ? false : process.argv.includes('--pairing-code') || global.pairing_code;
const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
const question = (text) => new Promise((resolve) => rl.question(text, resolve))
let pairingStarted = false;
let phoneNumber;

const userInfoSyt = () => {
	try {
		return os.userInfo().username
	} catch (e) {
		return process.env.USER || process.env.USERNAME || 'unknown';
	}
}

const storeDB = dataBase(global.tempatStore);
const database = dataBase(global.tempatDB);
const msgRetryCounterCache = new NodeCache();

// Pastikan FFmpeg terinstal untuk stiker video
assertInstalled(process.platform === 'win32' ? 'where ffmpeg' : 'command -v ffmpeg', 'FFmpeg', 0); 
console.log(chalk.greenBright('✅  All external dependencies are satisfied'));
console.log(chalk.green.bold(`╔═════[${`${chalk.cyan(userInfoSyt())}@${chalk.cyan(os.hostname())}`}]═════`));
print('Script version', `v${require('./package.json').version}`);
print('Bot Name', global.packname); 

console.log(chalk.green.bold('╚' + ('═'.repeat(30))));
server.listen(PORT, () => {
	console.log('App listened on port', PORT);
});


async function startRisshytBot() {
  
	const { state, saveCreds } = await useMultiFileAuthState(global.session_folder); 
	const { version, isLatest } = await fetchLatestBaileysVersion();
	const level = pino({ level: 'silent' });
	
	try {
		// loading database
        const loadData = await database.read();
        const storeLoadData = await storeDB.read();
        
        global.db = loadData || {};
        global.store = storeLoadData || {};

        setInterval(async () => {
			if (global.db) await database.write(global.db);
			if (global.store) await storeDB.write(global.store);
		}, 30 * 1000);

	} catch (e) {
		console.log(e);
		process.exit(1);
	}
	
	store.loadMessage = function (remoteJid, id) {
		const messages = store.messages?.[remoteJid]?.array;
		if (!messages) return null;
		return messages.find(msg => msg?.key?.id === id) || null;
	}
	
	const getMessage = async (key) => {
		if (store) {
			const msg = await store.loadMessage(key.remoteJid, key.id);
			return msg?.message || ''
		}
		return {
			conversation: '🔥risshyt.bot jir🔥'
		}
	}
	
	const risshyt = WAConnection({
		logger: level,
		getMessage,
		syncFullHistory: true,
		maxMsgRetryCount: 15,
		msgRetryCounterCache,
        // Koneksi
		browser: Browsers.ubuntu('Chrome'),
		auth: {
			creds: state.creds,
			keys: makeCacheableSignalKeyStore(state.keys, level),
		},
	})
	
    // PANGGIL FUNGSI SOLVING SAAT STARTUP (wajib ada karena diimpor)
	await Solving(risshyt, store) 
	
	if (pairingCode && !phoneNumber && !risshyt.authState.creds.registered) {
		async function getPhoneNumber() {
			phoneNumber = global.number_bot ? global.number_bot : process.env.BOT_NUMBER || await question('Please type your WhatsApp number : ');
			phoneNumber = phoneNumber.replace(/[^0-9]/g, '')
			
			if (!parsePhoneNumber('+' + phoneNumber).valid && phoneNumber.length < 6) {
				console.log(chalk.bgBlack(chalk.redBright('Start with your Country WhatsApp code') + chalk.whiteBright(',') + chalk.greenBright(' Example : 62xxx')));
				await getPhoneNumber()
			}
		}
		(async () => {
			await getPhoneNumber();
            // Hapus session lama
			await exec(`rm -rf ./${global.session_folder}/*`); 
			console.log('Phone number captured. Waiting for Connection...\n' + chalk.blueBright('Estimated time: around 2 ~ 5 minutes'))
		})()
	}
	
	
	risshyt.ev.on('creds.update', saveCreds)
	
	risshyt.ev.on('connection.update', async (update) => {
		const { qr, connection, lastDisconnect, isNewLogin, receivedPendingNotifications } = update
		if (!risshyt.authState.creds.registered) console.log('Connection: ', connection || false);

		if ((connection === 'connecting' || !!qr) && pairingCode && phoneNumber && !risshyt.authState.creds.registered && !pairingStarted) {
            // Logic Request Pairing Code
			setTimeout(async () => {
				pairingStarted = true;
				console.log('Requesting Pairing Code...')
				let code = await risshyt.requestPairingCode(phoneNumber);
				console.log(chalk.blue('Your Pairing Code :'), chalk.green(code), '\n', chalk.yellow('Expires in 15 second'));
			}, 3000)
		}
        
		if (connection === 'close') {
			const reason = new Boom(lastDisconnect?.error)?.output.statusCode
            // Logic Reconnect/Exit
			if (reason === DisconnectReason.loggedOut) {
				console.log('Scan again and Run...');
				exec(`rm -rf ./${global.session_folder}/*`); // Hapus folder sesi
				process.exit(1);
			} else {
                // Panggil ulang fungsi startup
				startRisshytBot(); 
			}
		}
        
		if (connection == 'open') {
			console.log('Connected to : ' + JSON.stringify(risshyt.user, null, 2));
		}
        
		if (qr) {
			if (!pairingCode) qrcode.generate(qr, { small: true })
			app.use('/qr', async (req, res) => {
				res.setHeader('content-type', 'image/png')
				res.end(await toBuffer(qr))
			});
		}
	});
	
	// Event listeners:

	// 1. PESAN MASUK
	risshyt.ev.on('messages.upsert', async (message) => {
		await MessagesUpsert(risshyt, message, store);
	});
	
	// 2. PESERTA GRUP (Wajib dipanggil karena diimpor)
    risshyt.ev.on('group-participants.update', async (update) => {
		await GroupParticipantsUpdate(risshyt, update);
	});
	
	return risshyt
}

// Panggil fungsi startup bot
startRisshytBot()
// ... (Proses Exit dan Cleanup)
	
