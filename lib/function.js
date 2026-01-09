const fs = require('fs');
const path = require('path');
const { tmpdir } = require('os');
const { promisify } = require('util');
const { execSync } = require('child_process');
const Crypto = require('crypto');
const ff = require('fluent-ffmpeg');
const FileType = require('file-type');
const webp = require('node-webpmux');
const axios = require('axios');

// Pastikan FFmpeg terinstal sebelum menjalankan bot
const assertInstalled = (command, name, exitCode) => {
    try {
        execSync(command, { stdio: 'ignore' });
        console.log(`[CHECK] Tool "${name}" ditemukan.`);
    } catch (e) {
        console.error(`\n❌ ERROR: Tool eksternal "${name}" tidak ditemukan.`);
        console.error(`Pastikan Anda telah menginstal "${name}" di sistem Anda.`);
        console.error(`(e.g., Untuk Termux/Linux: pkg install ${name.toLowerCase()})`);
        process.exit(exitCode);
    }
}

// --- FUNGSI UTILITAS UMUM ---

const getBuffer = async (url, options = {}) => {
    try {
        const res = await axios({
            method: 'get',
            url,
            headers: { 'DNT': 1, 'Upgrade-Insecure-Requests': 1 },
            ...options,
            responseType: 'arraybuffer'
        });
        return res.data;
    } catch (e) {
        console.log(`Error mengambil Buffer dari ${url}: ${e}`);
        return null;
    }
}

const isUrl = (url) => {
    return url.match(new RegExp(/https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&//=]*)/, 'gi'));
}

// --- FUNGSI KONVERSI STIKER (WEBP) ---

async function gifToWebp(media) {
    const tmpFileIn = path.join(tmpdir(), `${Crypto.randomBytes(6).readUIntLE(0, 6).toString(36)}.gif`)
    const tmpFileOut = path.join(tmpdir(), `${Crypto.randomBytes(6).readUIntLE(0, 6).toString(36)}.webp`)
    fs.writeFileSync(tmpFileIn, media);
    await new Promise((resolve, reject) => {
        ff(tmpFileIn)
            .on('error', (err) => { fs.unlinkSync(tmpFileIn); reject(err); })
            .on('end', () => resolve(true))
            .addOutputOptions([
            	'-vf', 'scale=512:512:force_original_aspect_ratio=decrease',
            	'-loop', '0',
            	'-preset', 'default',
            	'-an', '-vsync', '0'
            ])
            .toFormat('webp')
            .save(tmpFileOut)
    })
    const buff = fs.readFileSync(tmpFileOut)
    fs.unlinkSync(tmpFileOut)
    fs.unlinkSync(tmpFileIn)
    return buff
}

async function imageToWebp(media) {
    const tmpFileOut = path.join(tmpdir(), `${Crypto.randomBytes(6).readUIntLE(0, 6).toString(36)}.webp`)
    const tmpFileIn = path.join(tmpdir(), `${Crypto.randomBytes(6).readUIntLE(0, 6).toString(36)}.jpg`)
    fs.writeFileSync(tmpFileIn, media)
    await new Promise((resolve, reject) => {
        ff(tmpFileIn)
            .on('error', (err) => { fs.unlinkSync(tmpFileIn); reject(err); })
            .on('end', () => resolve(true))
            .addOutputOptions([
                '-vcodec', 'libwebp', '-vf',
                'scale=500:500:force_original_aspect_ratio=decrease,setsar=1, pad=500:500:-1:-1:color=white@0.0, split [a][b]; [a] palettegen=reserve_transparent=on:transparency_color=ffffff [p]; [b][p] paletteuse',
                '-loop', '0', '-preset', 'default'
                 ])
            .toFormat('webp')
            .save(tmpFileOut)
    })

    const buff = fs.readFileSync(tmpFileOut)
    fs.unlinkSync(tmpFileOut)
    fs.unlinkSync(tmpFileIn)
    return buff
}

async function videoToWebp(media) {
    const tmpFileOut = path.join(tmpdir(), `${Crypto.randomBytes(6).readUIntLE(0, 6).toString(36)}.webp`)
    const tmpFileIn = path.join(tmpdir(), `${Crypto.randomBytes(6).readUIntLE(0, 6).toString(36)}.mp4`)
    fs.writeFileSync(tmpFileIn, media)
    await new Promise((resolve, reject) => {
        ff(tmpFileIn)
            .on('error', (err) => { fs.unlinkSync(tmpFileIn); reject(err); })
            .on('end', () => resolve(true))
            .addOutputOptions([
                '-vcodec', 'libwebp', '-vf',
                "scale='min(320,iw)':min'(320,ih)':force_original_aspect_ratio=decrease,fps=15, pad=320:320:-1:-1:color=white@0.0, split [a][b]; [a] palettegen=reserve_transparent=on:transparency_color=ffffff [p]; [b][p] paletteuse",
                '-loop', '0', '-ss', '00:00:00', '-t', '00:00:05',
                '-preset', 'default', '-an', '-vsync', '0'
            ])
            .toFormat('webp')
            .save(tmpFileOut)
    })

    const buff = fs.readFileSync(tmpFileOut)
    fs.unlinkSync(tmpFileOut)
    fs.unlinkSync(tmpFileIn)
    return buff
}

async function writeExif(media, data) {
	const anu = await FileType.fromBuffer(media)
    const wMedia = /webp/.test(anu.mime) ? media : /image\/gif/.test(anu.mime) ? await gifToWebp(media) : /jpeg|jpg|png/.test(anu.mime) ? await imageToWebp(media) : /video/.test(anu.mime) ? await videoToWebp(media) : '';
    
    const tmpFileIn = path.join(tmpdir(), `${Crypto.randomBytes(6).readUIntLE(0, 6).toString(36)}.webp`)
    const tmpFileOut = path.join(tmpdir(), `${Crypto.randomBytes(6).readUIntLE(0, 6).toString(36)}.webp`)
    fs.writeFileSync(tmpFileIn, wMedia)
    
    if (data) {
        const img = new webp.Image()
        const { wra = data.pack_id ? data.pack_id : global.author, wrb = data.packname ? data.packname : global.packname, wrc = data.author ? data.author : global.author, wrd = data.categories ? data.categories : [''], wre = data.isAvatar ? data.isAvatar : 0, ...wrf } = data
        const json = { 'sticker-pack-id': wra, 'sticker-pack-name': wrb, 'sticker-pack-publisher': wrc, 'emojis': wrd, 'is-avatar-sticker': wre, wrf };
        
        const exifAttr = Buffer.from([0x49, 0x49, 0x2A, 0x00, 0x08, 0x00, 0x00, 0x00, 0x01, 0x00, 0x41, 0x57, 0x07, 0x00, 0x00, 0x00, 0x00, 0x00, 0x16, 0x00, 0x00, 0x00])
        const jsonBuff = Buffer.from(JSON.stringify(json), 'utf-8')
        const exif = Buffer.concat([exifAttr, jsonBuff])
        exif.writeUIntLE(jsonBuff.length, 14, 4)
        
        await img.load(tmpFileIn)
        fs.unlinkSync(tmpFileIn)
        img.exif = exif
        await img.save(tmpFileOut)
        return tmpFileOut
    }
}

module.exports = { 
    getBuffer, 
    isUrl, 
    assertInstalled,
    writeExif,
    // Ekspor fungsi konversi lain (opsional)
    imageToWebp, 
    videoToWebp, 
    gifToWebp 
                         }
                  
