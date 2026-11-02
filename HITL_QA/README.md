# ⚡ Atlas Capture QA Auto-Reporter to Google Sheets

Sistem otomatisasi untuk membaca data hasil Quality Assurance (QA) dari dashboard **Atlas Capture** dan menyalinnya secara instan ke **Google Spreadsheet** Anda.

---

## 📋 Struktur 10 Kolom Target di Google Spreadsheet

Sistem ini telah disesuaikan persis dengan 10 kolom yang Anda tentukan:

| No | Nama Kolom | Deskripsi Sumber Data | Contoh Data |
| :---: | :--- | :--- | :--- |
| 1 | **Nama Bisnis** | Nama bisnis atau folder dashboard | `Business` |
| 2 | **Task Name** | Judul task dan nomor part | `Business Task · Part 1/30` |
| 3 | **Submit Date** | Teks jenis cam dan tanggal submit | `Multicam · Oct 15, 2026 7:47 AM` |
| 4 | **Reject Class** | Klasifikasi tingkat penolakan | `-` |
| 5 | **QA Types** | Tipe QA berdasarkan tab aktif | `Auto QA` |
| 6 | **Rejected Clip Link** | Tautan langsung shareable link klip | `https://studio.atlascapture.io/...&autoEpisodeQaEpisode=b40...` |
| 7 | **Rejection Type** | Tag alasan penolakan dari badge UI | `Device Usage` |
| 8 | **Rejection Cause** | Keterangan penyebab penolakan | `-` |
| 9 | **Dispute note** | Catatan sanggahan / dispute | `-` |
| 10 | **Duration** | Durasi rekaman episode | `1:48` |

---

## 🚀 Panduan Setup (Hanya 3 Menit)

### Langkah 1: Pasang Google Apps Script di Spreadsheet Anda
1. Buka Google Spreadsheet Anda:
   👉 [Tautan Spreadsheet Anda](https://docs.google.com/spreadsheets/d/1MmLXrhQN2o5uetMG82qj8Nhskaad6_KtihHia3O47Tc/edit)
2. Di menu atas, klik **Extensions (Ekstensi)** > **Apps Script**.
3. Hapus semua kode bawaan di editor tersebut, lalu **Copy & Paste** seluruh isi dari file:
   👉 [`google-apps-script.js`](./google-apps-script.js)
4. Klik tombol **Save (Simpan / ikon disket)** atau tekan `Ctrl + S`.
5. Klik tombol biru **Deploy (Terapkan)** di kanan atas > pilih **New deployment (Penerapan baru)**:
   - Klik ikon gerigi (Select type) > pilih **Web app**.
   - **Description**: `Atlas QA Receiver v1`
   - **Execute as**: `Me (email Anda)`
   - **Who has access**: `Anyone (Siapa saja)` *(wajib agar browser bisa mengirim data tanpa login OAuth)*
6. Klik **Deploy** > jika diminta izin, klik **Authorize Access (Beri Akses)** > pilih akun Google Anda > klik **Advanced (Lanjutan)** > klik **Go to Untitled project (unsafe)** > klik **Allow**.
7. **Salin URL Web App** yang muncul (URL berakhiran `/exec`, contoh: `https://script.google.com/macros/s/AKfycb.../exec`).

---

### Langkah 2: Pasang Userscript di Browser Anda
1. Pastikan browser Anda (Chrome / Edge / Firefox) sudah terpasang ekstensi **Tampermonkey**:
   - Jika belum ada, pasang gratis dari Chrome Web Store: [Tampermonkey Chrome Web Store](https://chromewebstore.google.com/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo).
2. Klik ikon ekstensi **Tampermonkey** di pojok kanan atas browser > klik **Create a new script (Buat skrip baru)**.
3. Hapus kode default di dalamnya, lalu **Copy & Paste** seluruh isi dari file:
   👉 [`atlas-qa-scraper.user.js`](./atlas-qa-scraper.user.js)
4. Tekan `Ctrl + S` untuk menyimpan script.

---

### Langkah 3: Konfigurasi Sekali Saja di Atlas Capture
1. Buka halaman dashboard Atlas Capture Anda:
   👉 `https://studio.atlascapture.io/dashboard/business/...`
2. Di pojok kanan bawah layar akan otomatis muncul widget melayang: **⚡ Atlas QA Sync**.
3. Klik tombol gerigi **⚙️ (Pengaturan)** pada widget:
   - Masukkan **Google Apps Script Webhook URL** yang Anda salin di Langkah 1.
   - (Opsional) Masukkan nama tab sheet jika ingin diarahkan ke tab tertentu (misal: `Sheet1`).
   - Klik **Simpan Pengaturan**.

---

## 🎯 Cara Penggunaan Sehari-hari

Saat Anda sedang membuka atau menginspeksi hasil QA di Atlas Capture:

* **📌 Simpan Klip Ini ke Sheet**:
  Klik tombol ini saat Anda sedang membuka detail satu klip yang ditolak. Script akan membaca data, mengambil tautan `autoEpisodeQaEpisode`, dan menambahkannya sebagai baris baru ke Spreadsheet dalam hitungan detik.
* **⚡ Scan & Kirim Semua Baris**:
  Klik tombol ini jika Anda ingin membaca seluruh baris penolakan yang ada pada tabel/daftar halaman tersebut dan mengirimkannya sekaligus (*bulk batch*).
* **📋 Salin (TSV)**:
  Fitur cadangan (*fallback*). Data akan langsung disalin ke papan klip komputer Anda dalam format sel spreadsheet. Anda cukup membuka spreadsheet dan menekan `Ctrl + V`.
* **🔍 Pratinjau**:
  Menampilkan kotak dialog pratinjau data apa saja yang berhasil dideteksi sebelum dikirim ke Google Sheet.
