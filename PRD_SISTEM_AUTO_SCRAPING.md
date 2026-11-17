# Product Requirements Document (PRD)
## Sistem Auto Scrapping QA Atlas Capture (Episode Scrapper)

**Versi Dokumen:** v5.1.0  
**Status Produk:** Production Ready  
**Target Platform:** Tampermonkey Userscript (Browser Extension) & Google Apps Script Webhook  
**Target Domain:** `https://studio.atlascapture.io/*`  
**File Skrip Klien:** `HITL_QA/atlas-qa-scraper.user.js`  
**File Skrip Server:** `HITL_QA/google-apps-script.js`  
**Terakhir Diperbarui:** 18 November 2026  

---

## 1. Executive Summary & Latar Belakang

### 1.1 Konteks Operasional
Tim Quality Assurance (QA) dan operasional Atlas Capture secara rutin meninjau episode rekaman yang ditolak (*rejected episodes*) pada platform **Atlas Studio** (`studio.atlascapture.io`). Data penolakan tersebut harus direkapitulasi ke dalam master **Google Spreadsheet** untuk keperluan evaluasi performa, audit penolakan (*rejection causes*), sanggahan (*dispute*), dan pelaporan ke manajemen mitra UMKM.

### 1.2 Masalah yang Dihadapi (Problem Statement)
1. **Penyalinan Data Manual yang Memakan Waktu**: Setiap episode yang ditolak memiliki parameter URL terpisah (`autoEpisodeQaEpisode`), alasan penolakan (*rejection type*), penyebab rinci (*rejection cause*), dan durasi. Menyalin satu per satu ke Spreadsheet memakan waktu berjam-jam untuk ratusan episode.
2. **Keterbatasan Filter Tanggal pada Dashboard Asli**: Dashboard bawaan Atlas Studio tidak memiliki fitur filter rentang tanggal (*date range*) yang fleksibel untuk mengekspor data penolakan secara spesifik per periode kerja intern.
3. **Penyalinan Multi-UMKM yang Terfragmentasi**: Setiap UMKM memiliki `userGroupId` dan `businessId` berbeda pada URL dashboard, menyulitkan rekonsiliasi data jika harus berpindah-pindah halaman secara manual.
4. **Resiko Kehilangan Data saat Jaringan Tidak Stabil**: Jika webhook Google Sheet mengalami *timeout* atau gagal jaringan, pengguna membutuhkan pencadangan (*fallback*) instan ke papan klip komputer.

---

## 2. Tujuan & Sasaran Produk (Product Goals)

### 2.1 Tujuan Utama (Goals)
* **Targeted Date Range Scraping**: Mampu menyisir dan mengekstraksi data penolakan episode pada rentang tanggal tertentu secara presisi.
* **Direct TRPC Background API Scraping**: Menghubungi endpoint API internal Atlas (`userGroup.getBusinessRejectedEpisodesForReason`) secara aman menggunakan sesi kredensial aktif pengguna, tanpa perlu mengklik halaman satu per satu di UI.
* **Deteksi Otomatis Multi-UMKM**: Mendeteksi nama bisnis/UMKM langsung dari elemen judul `<h1>` halaman aktif dengan sistem *fallback* cerdas ke *breadcrumb* dan *page title*.
* **Sinkronisasi 1-Klik ke Google Sheets**: Mengirim baris data hasil pemindaian langsung ke Google Spreadsheet melalui webhook Google Apps Script.
* **Flow Verifikasi Sebelum Kirim**: Menyediakan dialog konfirmasi (*Review Dialog*) agar operator dapat memastikan kebenaran jumlah episode sebelum data masuk ke sheet.
* **Pencadangan Offline (TSV Format)**: Format *Tab-Separated Values* disalin otomatis ke clipboard, siap di-paste (`Ctrl + V`) ke Google Sheet kapan saja.
* **Antarmuka Fleksibel & Bebas Emotikon**: Floating widget berdesain profesional dengan kontrol lebar jendela dinamis (*slider width*) dan standar visual tanpa emoji.

---

## 3. Struktur 10 Kolom Target Google Spreadsheet

Data yang diekstraksi dan dikirimkan telah dipetakan secara presisi ke 10 kolom standar:

| No | Nama Kolom | Deskripsi Sumber Data | Contoh Format Data |
| :---: | :--- | :--- | :--- |
| 1 | **Nama Bisnis** | Nama UMKM dari elemen `<h1>` halaman | `Kedai QQ` / `Kedai Uma` |
| 2 | **Task Name** | Nama tugas dan part rekaman | `Business Task · Part 1/30` |
| 3 | **Submit Date** | Jenis kamera dan waktu submit | `Multicam · Oct 15, 2026 7:47 AM` |
| 4 | **Reject Class** | Klasifikasi bucket penolakan | `P0` |
| 5 | **QA Types** | Jenis tab QA yang sedang aktif | `Auto QA` |
| 6 | **Rejected Clip Link** | Tautan langsung menuju episode tertarget | `https://studio.atlascapture.io/...&autoEpisodeQaEpisode=b40...` |
| 7 | **Rejection Type** | Kategori penolakan utama (Title Case) | `Device Usage` / `Hands Not In Frame` |
| 8 | **Rejection Cause** | Keterangan kegagalan spesifik | `Hands Not In Frame Failures` / `Gemini Reason` |
| 9 | **Dispute note** | Keterangan status dispute / catatan submitter | `Cannot Dispute` / `-` |
| 10 | **Duration** | Durasi rekaman (menit:detik) | `1:48` |

---

## 4. Alur Kerja Pengguna (User Flow)

```
[Buka Dashboard Atlas Studio]
             │
             ▼
[Deteksi Otomatis UMKM dari <h1>]
             │
             ▼
[Pilih Rentang Tanggal (Start & End Date)]
             │
             ▼
[Klik "Mulai Pindai Sesuai Tanggal"]
             │
             ▼
[Engine TRPC Menyisir Seluruh Kategori Alasan]
             │
             ▼
[Tampilkan Metrik Live: Ditelusuri vs Cocok]
             │
             ▼
[Dialog Verifikasi Hasil: Apakah Data Lengkap?]
      ├── (Ulang Pindai) ──> [Kembali ke Scan]
      └── (Kirim ke Sheet) ─> [Kirim via Webhook] ──> [Top Banner Notifikasi]
                                      │
                              (Backup ke Clipboard TSV)
```

---

## 5. Kebutuhan Fungsional (Functional Requirements)

### 5.1 Mesin Scraping TRPC Berbasis Tanggal
- **Kueri Multikategori Otomatis**: Menelusuri seluruh kategori alasan penolakan (`hands_not_in_frame`, `device_usage`, `children_in_frame`, `blurry_lens`, `bad_lighting`, dsb.) dengan resolusi cursor *pagination* otomatis.
- **Filter Rentang Tanggal Dinamis**: Menyaring `ep.createdAt` berdasarkan waktu lokal `YYYY-MM-DD` terhadap rentang tanggal mulai (*start*) dan akhir (*end*).
- **Progress Tracking Real-Time**: Memperbarui status box per kategori dan nomor halaman secara *real-time*.

### 5.2 Antarmuka Pengguna Melayang (Floating UI v5.1)
Tata letak disusun secara hierarkis dari atas ke bawah:
1. **Header**:
   - Judul: `Episode Scrapper v5.1`
   - Keterangan status dinamis (`Siap Digunakan`, `Pilih Tanggal & Pindai`, `Memindai...`, `X Cocok`).
   - Tombol Panduan `(?)` untuk membuka modal panduan ringkas 4 langkah.
2. **Kartu Status UMKM**:
   - Menampilkan status panduan (*Silakan Buka Halaman Bisnis*) saat pengguna berada di luar dashboard UMKM.
   - Menampilkan nama UMKM aktif saat berada di halaman bisnis Atlas Studio.
3. **Date Range Picker & Tombol Pindai**:
   - Input tanggal mulai & tanggal akhir.
   - Tombol utama *Mulai Pindai Sesuai Tanggal* (Pine Teal) dan tombol *Stop* (Merah).
4. **Dua Keterangan Metrik Terstruktur**:
   - Baris 1: `[X] episode telah ditelusuri di database`
   - Baris 2: `[Y] episode pada tanggal yang dipilih`
5. **Tombol Aksi Hasil**:
   - Tombol *Salin (TSV)* untuk backup clipboard.
   - Tombol *Kirim ke Sheet* untuk pengiriman data batch.
6. **Kotak Status / Log Operasional**:
   - Menampilkan status proses terkini.
7. **Pengaturan Footer (Terkunci di Bawah)**:
   - Panel akordeon dapat dibuka/tutup:
     - Input URL Webhook Google Apps Script.
     - Input nama sheet/tab tujuan.
     - Input nama UMKM kustom (opsional).
     - **Slider Lebar Window Widget (300px - 480px)** dengan perubahan lebar langsung (*real-time*) dan persisten di browser.

### 5.3 Flow Verifikasi Sebelum Pengiriman (Review Dialog)
- Menampilkan jendela modal sebelum data dikirim ke spreadsheet.
- Memperlihatkan ringkasan nama UMKM, rentang tanggal target, total yang ditelusuri, dan total yang cocok.
- Memberikan dua opsi keputusan:
  - *Ulang Pindai*: Jika operator merasa data belum lengkap.
  - *Kirim ke Sheet*: Untuk melanjutkan pengiriman data.

### 5.4 Notifikasi Top Banner & Toast
- Menampilkan banner notifikasi di bagian atas layar (`#aqa-top-banner`) dengan animasi *slide-down* setelah pengiriman berhasil atau terjadi kegagalan.
- Toast notifikasi di sudut kanan bawah untuk interaksi cepat (salin papan klip, simpan konfigurasi).

### 5.5 Integrasi Backend Google Apps Script
- Menangani request `POST` berformat JSON dengan mode penguncian skrip (`LockService.getScriptLock()`) untuk mencegah konflik baris saat data dikirim bersamaan.
- Mendukung mode penambahan baris tunggal (`appendSingle`) maupun batch (*bulk array*).
- Otomatis membuat header tabel pada baris pertama jika sheet masih kosong.

---

## 6. Kebutuhan Non-Fungsional (Non-Functional Requirements)

* **Zero-Emoji Compliance**: Seluruh ikon menggunakan Heroicons SVG monokromatik murni (tanpa emotikon Unicode) demi menjaga profesionalitas kerja QA.
* **Performa Ekstraksi**: Mampu menyisir ratusan record API dalam waktu kurang dari 5 detik menggunakan batch fetch asinkron.
* **Dukungan SPA (Single Page Application)**: Dilengkapi observer navigasi yang mendeteksi pergantian URL UMKM secara otomatis setiap detik tanpa perlu merefresh halaman.
* **Dukungan Layar Fleksibel**: Ukuran widget dapat diperkecil atau diperlebar melalui slider pengaturan agar tidak menutupi tombol penting pada dashboard Atlas.

---

## 7. Desain Sistem & Palet Warna

* **Kartu Widget**: Background `#FFFFFF`, Border `1.5px solid #E5DEC9`, Radius `14px`, Bayangan lembut `rgba(27, 77, 75, 0.16)`.
* **Header & Aksen**: Warm Cream `#FAF8EE` dengan judul Deep Pine Teal `#1B4D4B`.
* **Tombol Utama**: Deep Pine Teal `#1B4D4B` (hover `#133A38`), teks putih `#FFFFFF`.
* **Tombol Sekunder**: Background `#FAF8F2`, Border `#E5DEC9`, Teks `#111827`.
* **Top Banner Sukses**: Forest Green `#14532D` dengan border `#4ADE80`.
* **Top Banner Error**: Deep Crimson `#991B1B` dengan border `#F87171`.
