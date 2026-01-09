const http = require('http');
const PORT = process.env.PORT || 8080; 

/**
 * Fungsi utama (handler) untuk server HTTP.
 * Setiap request (permintaan) yang masuk ke server akan melalui fungsi ini.
 * * Catatan: Endpoint '/qr' ditambahkan secara dinamis di index.js
 */
const app = (req, res) => {
    
    // Default response untuk halaman utama (e.g., saat Anda mengakses http://localhost:8080)
    if (req.url === '/') {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'text/plain');
        res.end('risshyt.bot Server is Running.\n');
        return;
    }
    
    // Jika tidak ada rute yang cocok
    res.statusCode = 404;
    res.setHeader('Content-Type', 'text/plain');
    res.end('Not Found\n');
};

// Membuat instance server menggunakan fungsi handler 'app'
const server = http.createServer(app);

// Mengekspor komponen-komponen yang dibutuhkan oleh index.js
module.exports = { app, server, PORT };

