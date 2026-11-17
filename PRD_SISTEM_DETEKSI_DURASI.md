# Product Requirements Document (PRD)
## Sistem Deteksi Durasi & Generator Laporan Harian (MyRobin Duration)

**Versi Dokumen:** v2.0.0  
**Status Produk:** Production Ready  
**Target Platform:** Web Application (Vercel Production & Local Standalone)  
**URL Repositori:** [modafrizadev/myrobin_duration](https://github.com/modafrizadev/myrobin_duration)  
**Teknologi Utama:** Vanilla HTML5, CSS3 Modern (Custom Properties), JavaScript ES6+ (File System Access API & IndexedDB)  
**Terakhir Diperbarui:** 18 November 2026  

---

## 1. Executive Summary & Latar Belakang

### 1.1 Konteks Operasional
Dalam operasional pengumpulan data lapangan berbasis kecerdasan buatan (*Physical AI & Computer Vision Recording Operations*), operator lapangan mengoperasikan kamera khusus untuk merekam interaksi dan kegiatan UMKM mitra. Rekaman video disimpan dalam format terenkripsi (`.enc`) dengan file metadata (`.json`) pada kartu memori SD Card.

Setiap hari kerja, tim lapangan wajib menyusun **Daily Physical AI Intern Report** yang mencantumkan:
- Jumlah kamera yang dibawa dan kamera yang aktif.
- Total *actual hours* rekaman yang valid (dalam format jam, menit, detik).
- Rincian durasi kerja per lokasi UMKM yang dikunjungi.
- Catatan operasional kendala teknis atau lapangan.

### 1.2 Masalah yang Dihadapi (Problem Statement)
1. **Perhitungan Manual yang Rawan Kesalahan**: Memeriksa puluhan file `.enc` dan `.json`, menghitung selisih milidetik waktu (*epoch ms*), dan menjumlahkan durasi secara manual memakan waktu 30-45 menit per hari dan rentan *human error*.
2. **Ketergantungan Environment Python**: Skrip Python lokal (`Duration_Detection.py` / Tkinter GUI) tidak dapat dijalankan oleh seluruh anggota tim karena keterbatasan instalasi dependensi, permission OS, dan perbedaan sistem operasi.
3. **Restriksi Keamanan Browser Modern**: Pada website statis publik (Vercel), browser tidak mengizinkan akses sistem berkas lokal tanpa izin eksplisit (*sandboxing*).
4. **Kendala Multi-Kamera di Tanggal yang Sama**: Jika operator menggunakan lebih dari satu kamera (misalnya kamera `3047` dan `3447`), data dari kartu SD yang berbeda harus digabungkan tanpa duplikasi data.

---

## 2. Tujuan & Sasaran Produk (Product Goals)

### 2.1 Tujuan Utama (Goals)
* **Zero Installation**: Berjalan langsung di peramban modern (Google Chrome, Microsoft Edge) tanpa perlu menginstal Python atau runtime tambahan.
* **100% Client-Side Privacy**: Seluruh proses ekstraksi metadata dan kalkulasi durasi terjadi di memori browser lokal pengguna. Berkas video berukuran gigabyte tidak pernah diunggah ke internet, menghemat kuota dan menjamin kerahasiaan data.
* **Persistent One-Time SD Card Access**: Pengguna cukup memberikan izin folder SD Card satu kali. Handle direktori disimpan di IndexedDB sehingga pemindaian berikutnya instan.
* **Multi-Camera Log Aggregation**: Menyimpan riwayat scan kamera secara otomatis dan memungkinkan penggabungan log (*merge*) untuk menghasilkan satu laporan terpadu.
* **Standardized Copy-Ready Report**: Menghasilkan template laporan teks rapi sesuai format standar tim operasional yang siap disalin dalam 1 klik.

### 2.2 Bukan Tujuan (Non-Goals)
* Sistem ini tidak melakukan *decrypt* atau *playback* isi video `.enc`.
* Sistem ini tidak menyimpan video ke cloud storage backend.

---

## 3. User Persona & Use Cases

| Atribut | Detail |
| :--- | :--- |
| **Persona** | Recording Operations & Data QA Intern / Field Operator |
| **Tugas Harian** | Mengambil data rekaman di UMKM, memvalidasi durasi, dan melaporkan ke Field Operations Lead. |
| **Karakteristik** | Menggunakan laptop Windows dengan hak akses terbatas, membutuhkan alur kerja cepat (di bawah 2 menit) sebelum jam operasional berakhir. |

### Skenario Penggunaan Utama (User Journey):
1. **Langkah 1 (Izin SD Card)**: Pengguna membuka aplikasi web, lalu mengklik tombol *Beri Izin & Hubungkan SD Card* untuk memilih drive kartu SD (misal `D:` atau folder `recording`).
2. **Langkah 2 (Pemindaian Kamera)**: Pengguna memasukkan 4 digit nomor kamera (misal `3047`) dan menekan *Scan Otomatis*.
3. **Langkah 3 (Profil & Lokasi)**: Pengguna memverifikasi nama, role, dan tanggal laporan, serta mengisi pembagian lokasi (misal Kedai QQ: 0 jam 39 menit, Kedai Uma: 1 jam 00 menit).
4. **Langkah 4 (Hasil & Laporan)**: Sistem langsung menampilkan tabel durasi harian, kalkulasi jam aktual, dan teks laporan harian yang siap disalin (*Salin Laporan*).

---

## 4. Kebutuhan Fungsional (Functional Requirements)

### 4.1 Pemindaian & Parsing Berkas Kartu SD
- **Rekursi Cerdas**: Menelusuri seluruh subfolder dalam kartu SD untuk menemukan pasangan file rekaman (`.enc` / `.mcap.enc`) dan metadata (`.json`).
- **Isolasi Folder Sistem**: Otomatis mengabaikan folder sistem operasi seperti `System Volume Information`, `$RECYCLE.BIN`, `found.000`, dan folder tersembunyi berawalan titik (`.`) atau tanda dollar (`$`) untuk mencegah *NotAllowedError* pada Windows.
- **Kalkulasi Timestamp Presisi**:
  - Waktu mulai diambil dari `json.recording.started_epoch_ms`. Fallback menggunakan `file.lastModified`.
  - Waktu selesai diambil dari `encFile.lastModified`.
  - Durasi dihitung dalam format detik, dikonversi menjadi jam desimal, jam-menit-detik (HMS), dan kalimat bahasa Indonesia formal.
- **Penyaringan Nomor Kamera**: Memfilter file berdasarkan token nama folder/file `atlascm{KODE}`. Jika tidak ditemukan, sistem menampilkan pesan spesifik tanpa membatalkan koneksi kartu SD.

### 4.2 Manajemen Izin & Persistence (IndexedDB)
- **Penyimpanan Handle Direktori**: Menyimpan instance `FileSystemDirectoryHandle` ke dalam IndexedDB (`MyRobinDurationDB`, store: `handles`, key: `activeSDCard`).
- **Verifikasi Izin Otomatis**: Menguji izin baca menggunakan `queryPermission({ mode: 'read' })` dan meminta verifikasi (`requestPermission`) hanya saat diperlukan.
- **Indikator Status Visual**: Menampilkan bilah status koneksi kartu SD yang jelas:
  - *Belum Terhubung*: Memberikan instruksi panduan memilih folder kartu SD.
  - *Terhubung*: Menampilkan nama drive/folder dengan aksen warna hijau daun yang menenangkan mata.

### 4.3 Penyimpanan Log & Penggabungan Multi-Kamera
- **Penyimpanan Otomatis**: Setiap pemindaian yang berhasil otomatis disimpan ke `localStorage` (`myrobin_scan_logs`).
- **Pencegahan Duplikasi**: Pemindaian dengan tanggal, kode kamera, dan jumlah file yang sama tidak disimpan ganda.
- **Penggabungan Multi-Log (*Merge*)**:
  - Pengguna dapat memilih beberapa log (misal kamera 3047 dan kamera 3447 pada tanggal yang sama).
  - Sistem menghitung total jam aktual gabungan dan total kamera aktif.
  - Ringkasan harian otomatis menggabungkan file per tanggal secara kronologis.

### 4.4 Format Laporan Harian Terstandar
Menghasilkan output teks presisi sesuai format standar tim:
```text
Daily Physical AI Intern Report

Nama : [Nama Operator]
Role : [Role Operator]
Tanggal : [Tanggal Terformat]

Summary Hari Ini
* Jumlah kamera yang dibawa : [X]
* Jumlah kamera aktif : [Y]
* Jumlah actual hours: [H] jam [M] menit [S] detik.
Lokasi: 
- [Nama Lokasi 1] : [Durasi]
- [Nama Lokasi 2] : [Durasi]
Catatan:
[Catatan Tambahan]
```

---

## 5. Kebutuhan Non-Fungsional (Non-Functional Requirements)

* **Keamanan & Sandboxing**: Mematuhi standar *Same-Origin Policy* dan *Principle of Least Privilege*. Akses sistem berkas dibatasi hanya pada direktori yang dipilih pengguna.
* **Performa Pemindaian**: Mampu memindai 200+ berkas dalam waktu di bawah 1,5 detik pada drive USB 3.0 / SD Card Class 10.
* **Ketahanan Sistem (Fault Tolerance)**: Jika terdapat satu berkas korup atau terkunci, pemindaian tetap dilanjutkan untuk berkas lainnya tanpa *crash*.
* **Bebas Emotikon / Emote 100%**: Tidak menggunakan emoji dekoratif apa pun di UI, pesan error, maupun laporan teks demi menjaga estetika profesional. Seluruh indikator grafis menggunakan SVG Heroicons.

---

## 6. Desain Visual & Design System

* **Filosofi Warna**: Mengadopsi palet natural bertema bumi (*Warm Earth & Pine Teal*):
  - **Latar Belakang**: Warm Cream `#FBF8EE` dan `#FAF8F2` yang nyaman untuk penggunaan durasi lama.
  - **Border & Pembatas**: `#E5DEC9`.
  - **Aksi Utama**: Deep Pine Teal `#1B4D4B` (hover `#133A38`), kontras tinggi dengan teks putih `#FFFFFF`.
  - **Aksen Sekunder**: Turquoise Cyan `#3AA39E`.
  - **Tipografi**: Dark Charcoal `#111827` (standar WCAG AAA).
* **Struktur Kartu 4 Langkah Permanen**:
  - **Langkah 1**: Status Izin Akses Kartu SD
  - **Langkah 2**: Pemindaian Kamera
  - **Langkah 3**: Profil & Lokasi Tugas
  - **Langkah 4**: Hasil & Laporan Harian (menampilkan placeholder rapi saat belum ada data, dan otomatis menampilkan metrik lengkap saat pemindaian selesai).

---

## 7. Penanganan Kasus Khusus (Edge Cases Handled)

1. **Pemilihan Root Drive `D:\`**: Berkas tersembunyi `System Volume Information` diabaikan sehingga tidak memicu *NotAllowedError*.
2. **Kamera Tidak Sesuai**: Jika pengguna memasukkan nomor kamera yang tidak ada pada kartu SD, sistem menampilkan pesan spesifik dan tidak mereset status koneksi SD Card.
3. **Pembagian Multi-Lokasi**: Fitur alokasi durasi per berkas memungkinkan pembagian menit kerja presisi antar UMKM yang berbeda dalam hari yang sama.
