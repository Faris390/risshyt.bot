const fs = require('fs');
const { promisify } = require('util');

// Menggunakan promisify agar fs.readFile dan fs.writeFile bisa menggunakan async/await
const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);

/**
 * Fungsi untuk mengelola pembacaan dan penulisan data ke file JSON.
 * @param {string} path - Path ke file database (e.g., './data/db.json').
 * @returns {object} Objek dengan method read dan write.
 */
const dataBase = (path) => {

    /**
     * Membaca data dari file JSON. Jika file belum ada, akan membuat file kosong.
     * @returns {Promise<object>} Data yang dibaca dari file.
     */
    const read = async () => {
        try {
            // Cek apakah file sudah ada
            if (!fs.existsSync(path)) {
                // Jika tidak ada, buat file kosong {}
                await writeFile(path, JSON.stringify({}));
                return {};
            }
            
            // Baca isi file
            const data = await readFile(path, 'utf8');
            
            // Parsing string JSON menjadi objek JavaScript
            return JSON.parse(data);

        } catch (e) {
            console.error(`[DATABASE ERROR] Gagal membaca ${path}:`, e);
            // Mengembalikan objek kosong jika ada error parsing
            return {};
        }
    }

    /**
     * Menulis (menyimpan) data ke file JSON.
     * @param {object} data - Objek data yang akan disimpan (biasanya global.db atau global.store).
     * @returns {Promise<void>}
     */
    const write = async (data) => {
        try {
            // Menulis data ke file dengan format yang rapi (null, 2)
            // null, 2 digunakan agar file JSON mudah dibaca (indentasi 2 spasi)
            await writeFile(path, JSON.stringify(data, null, 2));
        } catch (e) {
            console.error(`[DATABASE ERROR] Gagal menulis ke ${path}:`, e);
        }
    }

    return { read, write }
}

module.exports = { dataBase };
