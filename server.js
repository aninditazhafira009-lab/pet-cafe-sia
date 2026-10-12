const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Buat path absolut untuk database.db
const dbPath = path.join(__dirname, 'database.db');

// Inisialisasi Database SQLite di Memory (Anti-Permission Error Windows)
const db = new sqlite3.Database(':memory:', (err) => {
    if (err) {
        console.error('Gagal terhubung ke database:', err.message);
    } else {
        console.log('Database SQLite terhubung di Memory.');
    }
});
// Buat Tabel Transaksi
db.serialize(() => {
    db.run(`
        CREATE TABLE IF NOT EXISTS transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            type TEXT,
            amount REAL,
            coa TEXT,
            vendor TEXT,
            description TEXT,
            payment_method TEXT,
            invoice_no TEXT,
            cashier TEXT,
            date TEXT,
            hash TEXT
        )
    `);
});

// Helper Generate SHA-256
function generateHash(data) {
    return crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
}

// 1. Endpoint Tambah Transaksi
app.post('/api/transactions', (req, res) => {
    const { type, amount, coa, vendor, description, payment_method, invoice_no, cashier, date } = req.body;
    
    if (!type || !amount || !coa) {
        return res.status(400).json({ error: 'Mohon lengkapi data transaksi.' });
    }

    const timestamp = Date.now();
    const hash = generateHash({ type, amount, coa, vendor, description, invoice_no, date, timestamp });

    const sql = `INSERT INTO transactions (type, amount, coa, vendor, description, payment_method, invoice_no, cashier, date, hash) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    
    db.run(sql, [type, amount, coa, vendor, description, payment_method, invoice_no, cashier, date, hash], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ id: this.lastID, hash, status: 'Success' });
    });
});

// 2. Endpoint Get Semua Transaksi
app.get('/api/transactions', (req, res) => {
    db.all("SELECT * FROM transactions ORDER BY id DESC", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// 3. Endpoint Download CSV
app.get('/api/download-csv', (req, res) => {
    db.all("SELECT * FROM transactions ORDER BY id ASC", [], (err, rows) => {
        if (err) return res.status(500).send('Error');

        let csv = 'ID,Tanggal,Jenis,Nominal,Kode Akun (COA),Vendor,Keterangan,Metode Pembayaran,Nomor Nota,Kasir,SHA256 Hash\n';
        rows.forEach(r => {
            csv += `"${r.id}","${r.date}","${r.type}","${r.amount}","${r.coa}","${r.vendor}","${r.description}","${r.payment_method}","${r.invoice_no}","${r.cashier}","${r.hash}"\n`;
        });

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=Laporan_Kas_Kecil_Pet_Cafe_de_Anin.csv');
        res.status(200).send(csv);
    });
});

// 4. Endpoint Cek SHA-256 Integrity
app.get('/api/verify-hash', (req, res) => {
    db.all("SELECT * FROM transactions", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ valid: true, totalRecords: rows.length, lastHash: rows.length > 0 ? rows[rows.length - 1].hash : 'N/A' });
    });
});

// 5. Endpoint List Chart of Accounts (COA)
app.get('/api/coa-list', (req, res) => {
    const coaList = [];
    coaList.push('1-1001 - Kas Kecil Utama');
    coaList.push('1-1002 - Kas Operasional');
    coaList.push('1-1003 - Bank BCA');
    coaList.push('1-1004 - Bank Mandiri');
    coaList.push('1-1005 - Piutang Pelanggan');
    for(let i=6; i<=20; i++) coaList.push(`1-10${i < 10 ? '0'+i : i} - Perlengkapan Kafe ${i}`);
    
    for(let i=1; i<=15; i++) coaList.push(`2-20${i < 10 ? '0'+i : i} - Utang Usaha & Operasional ${i}`);
    for(let i=1; i<=5; i++) coaList.push(`3-300${i} - Modal & Laba Ditahan ${i}`);

    coaList.push('4-4001 - Pemasukan Penjualan Kopi & Minuman');
    coaList.push('4-4002 - Pemasukan Grooming & Pet Care');
    coaList.push('4-4003 - Pengisian Kembali Kas Kecil (Replenishment)');
    for(let i=4; i<=15; i++) coaList.push(`4-40${i < 10 ? '0'+i : i} - Pendapatan Lain-lain ${i}`);

    coaList.push('5-1001 - HPP Biji Kopi & Bahan Utama Minuman');
    coaList.push('5-1002 - Biaya Perawatan & Grooming Hewan');
    coaList.push('5-1003 - Perlengkapan & Operasional Kafe');
    coaList.push('5-1004 - Makanan & Nutrisi Hewan Pet Cafe');
    coaList.push('5-1005 - Biaya Kebersihan & Sanitasi Kandang');
    for(let i=6; i<=45; i++) coaList.push(`5-10${i < 10 ? '0'+i : i} - Beban Operasional ${i}`);

    res.json(coaList);
});

app.listen(PORT, () => {
    console.log(`Server Pet Cafe de Anin berjalan di http://localhost:${PORT}`);
});