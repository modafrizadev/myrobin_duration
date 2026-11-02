# Rekap Durasi File .enc & Daily Intern Report

Aplikasi web dan alat bantu rekap durasi rekaman kamera (file `.enc`) serta generator otomatis **Daily Physical AI Intern Report** untuk operasional MyRobin / Atlas.

## ✨ Fitur Utama

1. **Client-Side SD Card Direct Scan (Untuk Web / Vercel)**:
   - Membaca file rekaman `.enc` langsung di browser menggunakan File System Access API.
   - Tidak memerlukan instalasi server atau upload file ke internet (aman dan instan).
2. **Scan Otomatis Drive Laptop (Lokal)**:
   - Mencari folder kamera berdasarkan 4 digit seri kamera (contoh: `atlascm3047`) di partisi `C:`, `D:`, dll.
3. **Daily Intern Report Generator**:
   - Template laporan harian otomatis per tanggal.
   - Perhitungan jam rekaman (HMS dan desimal jam).
   - Pengelompokan lokasi dan pencatatan catatan harian siap salin ke clipboard.

## 🚀 Cara Menjalankan

### Opsi 1: Buka Web Online (Vercel)
Cukup buka link web hasil deploy Vercel, lalu gunakan tombol hijau **"Pilih Folder SD Card / Kamera"**.

### Opsi 2: Jalankan Secara Lokal
Jalankan file `start_web_app.bat` atau via terminal:
```bash
python server.py
```
Akses di browser: `http://localhost:8000/index.html`

## 📁 Struktur File
- `index.html` : Antarmuka web utama (Frontend)
- `server.py` : Server backend Python lokal
- `app.py` : Versi GUI desktop Tkinter
- `vercel.json` : Konfigurasi routing static web di Vercel
- `HITL_QA/` : Skrip otomasi QA dan Google Apps Script
