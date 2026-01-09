const { writeExif } = require('../lib/function'); 
const fs = require('fs');

// =========================================================
// === FUNGSI TAMBAHAN (Wajib diekspor) ======================
// =========================================================

async function Solving(conn, store) {
    console.log('✅ Fungsi Solving (Persiapan Awal) Selesai.');
}

async function GroupParticipantsUpdate(conn, update) {
    const { id, participants, action } = update;
    
    // Logika Welcome/Goodbye
    console.log(`[GROUP UPDATE] Group ID: ${id}, Aksi: ${action}`);

    if (action === 'add') {
        const participantId = participants[0];
        const welcomeText = `Selamat datang @${participantId.split('@')[0]} di grup!`;
        await conn.sendMessage(id, { text: welcomeText, contextInfo: { mentionedJid: participants } });
    }
    
    if (action === 'remove') {
        const participantId = participants[0];
        const goodbyeText = `Selamat jalan @${participantId.split('@')[0]}.`;
        await conn.sendMessage(id, { text: goodbyeText, contextInfo: { mentionedJid: participants } });
    }
}


// =========================================================
// === FUNGSI UTAMA PESAN ==================================
// =========================================================

async function MessagesUpsert(conn, message, store) {
    const m = message.messages[0];
    if (!m) return;
    
    const remoteJid = m.key.remoteJid;
    
    // --- EKSTRAKSI PESAN ---
    const body = m.message.conversation || m.message.extendedTextMessage?.text || m.message.imageMessage?.caption || m.message.videoMessage?.caption || '';
    const prefix = '.'; 
    const isCmd = body.startsWith(prefix);
    const command = isCmd ? body.slice(prefix.length).trim().split(/ +/).shift().toLowerCase() : '';
    
    // Pengecekan media yang dibalas
    const quoted = m.message.extendedTextMessage?.contextInfo?.quotedMessage;
    const quotedType = quoted ? Object.keys(quoted)[0] : '';
    const isImage = quotedType === 'imageMessage';
    const isVideo = quotedType === 'videoMessage';
    
    // Logika Perintah
    if (isCmd) {
        console.log(`[COMMAND] ${command} dari ${m.pushName || remoteJid}`);
        
        switch (command) {
            
            // --- MENU & INFO ---
            case 'menu':
            case 'help':
                let menuText = `${global.packname}!\n\n`;
                menuText += '━━━ *FITUR UTAMA* ━━━\n';
                menuText += `* ${prefix}stiker (Balas Gambar/Video/GIF)\n`;
                menuText += '━━━ *BOT INFO* ━━━\n';
                menuText += `* ${prefix}ping\n`;
                menuText += `* ${prefix}owner\n`;
                
                await conn.sendMessage(remoteJid, { text: menuText }, { quoted: m });
                break;
                
            case 'ping':
                const time = (new Date()).getTime();
                await conn.sendMessage(remoteJid, { text: `Pong! 🚀\nRespon Time: *${(time - m.messageTimestamp * 1000)}ms*` }, { quoted: m });
                break;
                
            case 'owner':
                const ownerNumber = global.owner[0][0] + '@s.whatsapp.net';
                const ownerName = global.owner[0][1];
                await conn.sendMessage(remoteJid, { 
                    text: `Owner : *${ownerName}*`,
                    contextInfo: { mentionedJid: [ownerNumber] }
                }, { quoted: m });
                break;

            // --- KONVERSI STIKER (LOGIKA SUDAH DIPERBAIKI) ---
            case 'stiker':
            case 's':
                
                // Cek apakah ada media yang dibalas
                const mediaMsg = quoted?.imageMessage || quoted?.videoMessage;
                const isQuotedMedia = !!mediaMsg;

                if (!isQuotedMedia) {
                    return conn.sendMessage(remoteJid, { text: '⚠️ Balas (*reply*) gambar, video (maks 5 detik), atau GIF yang ingin dijadikan stiker.' }, { quoted: m });
                }

                await conn.sendMessage(remoteJid, { text: '⏳ Sedang mengonversi media ke stiker...' }, { quoted: m });
                
                try {
                    // 1. Download media sebagai Buffer (Cara Baileys modern yang benar)
                    const mediaBuffer = await conn.downloadMediaMessage(mediaMsg, 'buffer', {}); 
                    
                    // 2. Tentukan metadata stiker
                    const stickerData = { 
                        packname: global.packname, 
                        author: global.author 
                    };
                    
                    // 3. Konversi ke WEBP dan Tambahkan EXIF (Diasumsikan writeExif menerima buffer)
                    const finalStickerBuffer = await writeExif(mediaBuffer, stickerData); 
                    
                    // 4. Kirim Stiker (Mengirim Buffer)
                    await conn.sendMessage(remoteJid, { sticker: finalStickerBuffer }, { quoted: m });
                    
                    // TIDAK PERLU HAPUS FILE SEMENTARA karena menggunakan buffer
                    
                } catch (error) {
                    console.error("Error saat membuat stiker:", error);
                    await conn.sendMessage(remoteJid, { text: '❌ Gagal membuat stiker. Pastikan formatnya valid, durasi video tidak lebih dari 5 detik, dan Anda sudah menginstal FFmpeg.' }, { quoted: m });
                }
                break;

            default:
                break;
        }
    }
}

// =========================================================
// === EXPORT SEMUA FUNGSI (Untuk menghindari 'is not defined')
// =========================================================

module.exports = { 
    MessagesUpsert,
    GroupParticipantsUpdate, 
    Solving                  
}
