const { writeExif } = require('../lib/function'); 
const fs = require('fs');

// --- ASUMSI: Fungsi Solving dan GroupParticipantsUpdate dihilangkan untuk fokus ---

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

            // --- KONVERSI STIKER ---
            case 'stiker':
            case 's':
                
                // Pastikan ada media yang dibalas dan media tersebut adalah gambar, video, atau GIF
                if (!quoted || (!isImage && !isVideo)) {
                    return conn.sendMessage(remoteJid, { text: '⚠️ Balas (*reply*) gambar, video (maks 5 detik), atau GIF yang ingin dijadikan stiker.' }, { quoted: m });
                }

                await conn.sendMessage(remoteJid, { text: '⏳ Sedang mengonversi media ke stiker...' }, { quoted: m });
                
                try {
                    // 1. Download Media yang Dibalas (Baileys helper)
                    const mediaBufferPath = await conn.downloadAndSaveMediaMessage(m, 'buffer'); // Download sebagai path file sementara
                    
                    // 2. Tentukan metadata stiker (dari settings.js)
                    const stickerData = { 
                        packname: global.packname, 
                        author: global.author 
                    };
                    
                    // 3. Konversi ke WEBP dan Tambahkan EXIF
                    const finalStickerPath = await writeExif(fs.readFileSync(mediaBufferPath), stickerData); 
                    
                    // 4. Kirim Stiker
                    await conn.sendMessage(remoteJid, { sticker: { url: finalStickerPath } }, { quoted: m });
                    
                    // 5. Hapus file sementara setelah dikirim
                    fs.unlinkSync(finalStickerPath); 
                    fs.unlinkSync(mediaBufferPath);
                    
                } catch (error) {
                    console.error("Error saat membuat stiker:", error);
                    await conn.sendMessage(remoteJid, { text: '❌ Gagal membuat stiker. Pastikan formatnya valid, durasi video tidak lebih dari 5 detik, dan Anda sudah menginstal FFmpeg.' }, { quoted: m });
                }
                break;

            default:
                // Abaikan command lain yang tidak terdaftar
                break;
        }
    }
}

module.exports = { MessagesUpsert }
      
