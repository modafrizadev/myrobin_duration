# 📄 Product Requirements Document (PRD), Arsitektur & Riwayat Perubahan

**Nama Proyek:** Rekap Durasi File .enc & Daily Intern Report (MyRobin Duration)  
**Repositori GitHub:** [modafrizadev/myrobin_duration](https://github.com/modafrizadev/myrobin_duration)  
**Target Deployment:** Vercel Production & Local Standalone  
**Versi Dokumen:** v1.5.0  
**Tanggal Terakhir Diperbarui:** 2 November 2026  
**Penyusun:** Mohamad Dwi Affriza & Antigravity AI  

---

## 📑 Daftar Isi
1. [Latar Belakang & Problem Statement](#1-latar-belakang--problem-statement)
2. [Tujuan Produk (Product Objectives)](#2-tujuan-produk-product-objectives)
3. [User Persona & Target Pengguna](#3-user-persona--target-pengguna)
4. [Kebutuhan Fungsional (Functional Requirements)](#4-kebutuhan-fungsional-functional-requirements)
5. [Arsitektur Sistem & Spesifikasi Teknis](#5-arsitektur-sistem--spesifikasi-teknis)
6. [Riwayat Perubahan & Changelog Lengkap](#6-riwayat-perubahan--changelog-lengkap)
7. [Panduan Operasional & SOP Penggunaan](#7-panduan-operasional--sop-penggunaan)
8. [Rencana Pengembangan Masa Depan (Roadmap)](#8-rencana-pengembangan-masa-depan-roadmap)

---

## 1. Latar Belakang & Problem Statement

### 1.1 Konteks Operasional
Dalam operasional pengumpulan data lapangan berbasis kamera pintar (*Atlas / MyRobin AI Data Collection*), tim lapangan (*Recording Operations & QA Intern*) menggunakan kamera khusus yang menyimpan rekaman video dalam format terenkripsi (`.enc`) bersama metadata berformat `.json` pada kartu memori (SD Card).

### 1.2 Masalah yang Dihadapi Sebelumnya
1. **Penghitungan Durasi Manual yang Lambat & Rawan Human Error**:
   Setiap kamera menghasilkan puluhan file rekaman `.enc` setiap hari. Petugas harus memeriksa jam mulai (*epoch ms*) dan jam selesai untuk menghitung durasi file, menjumlahkan jam/menit/detik per hari, serta membuat total rentang hari secara manual.
2. **Keterbatasan Aplikasi Desktop / Python Lokal**:
   Versi awal dibuat menggunakan Python (`app.py` berbasis Tkinter). Meskipun berjalan baik di laptop pembuat, aplikasi tersebut **tidak bisa dijalankan oleh tim lain di laptop masing-masing** tanpa menginstal Python, mengatur environment, dan mengonfigurasi dependensi.
3. **Kendala Deployment Web (Vercel) & Akses Hard Disk**:
   Ketika dipindahkan ke website online (Vercel), standar keamanan browser modern melarang website publik menelusuri partisi lokal (`C:`, `D:`) secara diam-diam. Tombol "Scan Otomatis" awalnya gagal (*Unexpected token '<'* dan *Failed to fetch*) karena tidak ada backend Python di server Vercel.

---

## 2. Tujuan Produk (Product Objectives)

* **Multi-Device & Zero Installation**: Dapat diakses oleh siapa saja di laptop mana pun cukup melalui browser (Chrome / Edge) via link Vercel tanpa instalasi software tambahan.
* **Keamanan & Privasi Data**: File video `.enc` diproses **100% di sisi klien (browser lokal)** tanpa di-upload ke server internet, menghemat kuota dan menjaga kerahasiaan data.
* **Otomasi Penuh Berbasis Izin (Permission-Based)**: Memberikan izin folder SD Card hanya 1 kali, dan browser mengingat izin tersebut selamanya sehingga pemindaian berikutnya berjalan 100% otomatis.
* **Standardisasi Format Laporan**: Menghasilkan template laporan harian (*Daily Physical AI Intern Report*) secara instan dengan fitur salin 1-klik ke clipboard.

---

## 3. User Persona & Target Pengguna

| Profil | Kebutuhan Utama | Hambatan Utama |
| :--- | :--- | :--- |
| **Data QA & Recording Intern** | Menghitung durasi jam kerja kamera per hari dengan cepat untuk laporan harian ke koordinator. | Tidak mengerti instalasi Python/coding; butuh buka link web langsung beres. |
| **Field Operations Lead** | Menerima format laporan seragam dari semua intern dengan rincian durasi per lokasi yang akurat. | Sering terjadi perbedaan format dan salah hitung jika dilakukan manual. |

---

## 4. Kebutuhan Fungsional (Functional Requirements)

### 4.1 Pemindaian & Parsing File
* **Client-Side File System Access API**: Mampu membaca struktur folder SD Card dan file berekstensi `.enc` serta `.json`.
* **Metadata Timestamp Parser**: Mengambil waktu mulai perekaman yang presisi dari properti JSON `jdata.recording.started_epoch_ms`. Jika JSON absen/rusak, menggunakan *fallback* `encFile.lastModified`.
* **Kalkulasi Durasi Presisi**: Menghitung selisih waktu perekaman dalam format jam, menit, detik (HMS), desimal jam (misal `6.25 jam`), dan teks Bahasa Indonesia (`6 jam 15 menit 0 detik`).

### 4.2 Manajemen Izin & SD Card Terhubung (IndexedDB)
* **Status Bar SD Card**: Menampilkan indikator visual status koneksi kartu SD (`Belum Terhubung` vs `🟢 Terhubung ke: Drive X`).
* **Handle Persistence**: Menyimpan `FileSystemDirectoryHandle` ke dalam IndexedDB lokal browser (`MyRobinDurationDB`).
* **One-Click Reconnection**: Saat web dibuka kembali di lain hari, browser memeriksa izin yang tersimpan dan langsung siap memindai tanpa dialog pemilihan folder ulang.

### 4.3 Pemfilteran Berdasarkan Nomor Seri Kamera
* Input 4 digit nomor kamera (misal `3374` atau `3047`).
* Pemfilteran pintar: Jika kartu SD berisi banyak kamera (`atlascm3047`, `atlascm3374`, `atlascm3388`), sistem secara cerdas hanya merangkum file kamera yang diminta.

### 4.4 Multi-Location Breakdown
* Memungkinkan pencatatan lokasi berbeda untuk file tertentu jika intern berpindah tempat di jam tertentu (misal: Pagi di Kedai QQ, Siang di Perpustakaan).
* Durasi actual hours dihitung otomatis per lokasi pada template laporan harian.

### 4.5 Profil & Template Laporan
* Menyimpan profil pelapor (Nama, Role Operasional, Jumlah Kamera Dibawa & Aktif) di `localStorage`.
* Tombol **"Salin Laporan Tanggal Ini"** dengan notifikasi toast konfirmasi.

---

## 5. Arsitektur Sistem & Spesifikasi Teknis

```mermaid
flowchart TD
    User([Pengguna di Laptop Mana Saja]) --> Browser[Web Browser Chrome / Edge]
    Browser --> Host{Akses Melalui}
    
    Host -->|Vercel Web Online| Vercel[Vercel Static CDN]
    Host -->|Local Machine| PyServer[Python http.server :8000]
    
    Browser --> IDB[(IndexedDB: MyRobinDurationDB)]
    Browser --> SDCard[Kartu SD / Harddisk Kamera]
    
    IDB -. Simpan/Baca Handle Folder .-> SDCard
    SDCard -. Baca .enc & .json secara Lokal .-> Engine[Client-Side Duration Engine]
    Engine --> Output[Tab Rekap Harian & Template Report Siap Salin]
```

### 5.1 Komponen Teknologi
* **Frontend**: HTML5 Semantic, Modern Vanilla CSS (CSS Variables, Flexbox/Grid, Dark Mode `#080c16`, JetBrains Mono & Outfit typography), Vanilla JavaScript (ES2022 Async/Await).
* **Browser APIs**:
  * `window.showDirectoryPicker()` (File System Access API)
  * `IndexedDB` (Penyimpanan Directory Handle permanen)
  * `window.localStorage` (Penyimpanan preferensi profil pelapor & draft lokasi)
  * `navigator.clipboard` (Penyalinan laporan instan)
* **Local Backend (Opsional)**: Python 3 Standard Library `http.server` & `SimpleHTTPRequestHandler` dengan dukungan penuh CORS dan routing JSON API.
* **Hosting**: Vercel Serverless Static Edge Network dengan konfigurasi routing [vercel.json](file:///c:/Users/ASUS/Downloads/MYROBIN%20APPS/vercel.json).

---

## 6. Riwayat Perubahan & Changelog Lengkap

### 🏷️ v1.5.0 (2 November 2026) — *Persistent Permission System & Full Automation*
* **[FEAT] Persistent SD Card Permission**: Mengintegrasikan `IndexedDB` (`MyRobinDurationDB`) untuk menyimpan `FileSystemDirectoryHandle`. Pengguna di laptop mana pun hanya perlu memberi izin akses 1 kali; untuk pemindaian selanjutnya tidak perlu memilih folder lagi.
* **[FEAT] SD Card Status Bar**: Menambahkan bilah status interaktif dengan indikator titik warna (oranye = belum terhubung, hijau berpendar = terhubung & berizin) lengkap dengan tombol *Connect* dan *Ganti SD Card*.
* **[FEAT] Smart Multi-Camera Filtering**: Menambahkan penyaringan otomatis berdasarkan 4 digit nomor seri kamera (`atlascm<kode>`) saat pengguna memilih folder induk `recording` atau *root* kartu SD.
* **[CHORE] Git & Auto-Deploy Pipeline**: Sinkronisasi commit otomatis ke GitHub branch `main` (`21f2c20`) yang memicu auto-deployment Vercel.

### 🏷️ v1.4.0 (2 November 2026) — *Fix Vercel Production Crash & Client-Side Scan*
* **[FIX] Unexpected Token '<' on Vercel**: Mengatasi error parsing JSON akibat pemanggilan `/api/scan` di Vercel yang mereturn file `index.html`.
* **[FEAT] Environment Detection**: Menambahkan logika pendeteksian otomatis apakah web berjalan di cloud (`!isLocalhost`) atau lokal, sehingga tombol "Scan Otomatis" di Vercel dialihkan langsung ke pemrosesan sisi klien.
* **[FEAT] Fallback File Input**: Menyediakan `<input type="file" webkitdirectory>` cadangan untuk browser yang belum mendukung File System Access API standar.

### 🏷️ v1.3.0 (2 November 2026) — *Smart Fallback & CORS Resolution*
* **[FIX] Failed to Fetch Error**: Mengatasi kendala koneksi saat file `index.html` dibuka via protokol `file:///` dengan menerapkan *smart fallback* ke `http://localhost:8000`.
* **[FEAT] Server CORS Support**: Menambahkan penanganan method `do_OPTIONS` dan header `Access-Control-Allow-Origin: *` pada [server.py](file:///c:/Users/ASUS/Downloads/MYROBIN%20APPS/server.py).
* **[FEAT] Interactive Alert Action**: Memperbarui pesan error dengan tombol pintas langsung ke pemindaian manual.

### 🏷️ v1.2.0 (2 November 2026) — *Repository Setup & Vercel Configuration*
* **[CHORE] Git Initialization**: Menginisialisasi repositori Git lokal dengan branch utama `main`, membuat file [.gitignore](file:///c:/Users/ASUS/Downloads/MYROBIN%20APPS/.gitignore), dan menyusun [README.md](file:///c:/Users/ASUS/Downloads/MYROBIN%20APPS/README.md).
* **[FEAT] Helper Script**: Membuat [push_to_github.bat](file:///c:/Users/ASUS/Downloads/MYROBIN%20APPS/push_to_github.bat) untuk memudahkan autentikasi interaktif Git Credential Manager ke remote GitHub `modafrizadev/myrobin_duration`.

### 🏷️ v1.1.0 (Oktober 2026) — *Modern Web Interface & Server Engine*
* **[FEAT] Web UI Transition**: Membuat antarmuka web modern responsif [index.html](file:///c:/Users/ASUS/Downloads/MYROBIN%20APPS/index.html) menggantikan GUI desktop lawas.
* **[FEAT] Daily Intern Report Generator**: Menambahkan kalkulator jam aktual per tanggal, pemecah lokasi berdasarkan jam file rekaman, dan format laporan harian MyRobin siap salin.
* **[FEAT] Local Web Server**: Mengembangkan server Python lokal [server.py](file:///c:/Users/ASUS/Downloads/MYROBIN%20APPS/server.py) dan script launcher [start_web_app.bat](file:///c:/Users/ASUS/Downloads/MYROBIN%20APPS/start_web_app.bat).

### 🏷️ v1.0.0 (Awal Proyek) — *Legacy CLI & Desktop App*
* **[INIT]**: Script dasar [Duration_Detection.py](file:///c:/Users/ASUS/Downloads/MYROBIN%20APPS/Duration_Detection.py) dan aplikasi desktop Tkinter [app.py](file:///c:/Users/ASUS/Downloads/MYROBIN%20APPS/app.py) dengan batch launcher [run_app.bat](file:///c:/Users/ASUS/Downloads/MYROBIN%20APPS/run_app.bat).

---

## 7. Panduan Operasional & SOP Penggunaan

### 🌐 Skenario A: Menggunakan via Web Online (Vercel) — *Rekomendasi untuk Semua Tim*
1. Buka link web Vercel Anda di Google Chrome atau Microsoft Edge pada laptop manapun.
2. **Langkah Pertama Kali (Cukup 1x):**
   * Perhatikan status bar di bagian atas: `Akses SD Card: Belum Dihubungkan`.
   * Masukkan 4 digit nomor seri kamera (misal `3374`) lalu klik **Scan Otomatis** *(atau klik tombol hijau "Beri Izin & Hubungkan SD Card")*.
   * Jendela pemilihan folder Windows akan muncul. Pilih kartu SD Anda (misal drive `D:` atau folder `recording`).
   * Browser akan menyimpan izin ini ke dalam memori lokal laptop. Status bar berubah menjadi hijau (`🟢 Terhubung`).
3. **Pemindaian Seterusnya (100% Otomatis):**
   * Cukup ketik nomor kamera (misal `3374`, `3047`, dll) lalu klik **Scan Otomatis**.
   * Sistem akan otomatis merangkum data durasi dan menyusun laporan harian dalam hitungan detik tanpa membuka jendela folder lagi!
4. **Menyalin Laporan:**
   * Masukkan nama lokasi (default: `Kedai QQ`).
   * Jika berpindah tempat, gunakan fitur *Pecah Lokasi Berdasarkan Jam File*.
   * Klik tombol **"Salin Laporan Tanggal Ini"** dan tempel (*paste*) ke WhatsApp / Telegram grup koordinasi.

### 💻 Skenario B: Menggunakan via Offline Lokal (Python)
1. Colokkan SD Card ke laptop Anda.
2. Jalankan file [start_web_app.bat](file:///c:/Users/ASUS/Downloads/MYROBIN%20APPS/start_web_app.bat).
3. Browser akan otomatis terbuka di `http://localhost:8000/index.html`.
4. Masukkan kode kamera dan klik **Scan Otomatis**.

---

## 8. Rencana Pengembangan Masa Depan (Roadmap)

* [ ] **PWA (Progressive Web App)**: Menambahkan `manifest.json` dan Service Worker agar aplikasi web dapat diinstal sebagai aplikasi mandiri di desktop tanpa address bar browser.
* [ ] **Ekspor Laporan ke Excel / CSV**: Menyediakan tombol unduh file `.xlsx` untuk rekapitulasi data durasi bulanan.
* [ ] **Deteksi Anomali File**: Memberikan tanda peringatan visual jika ada file `.enc` yang durasinya kurang dari 1 menit atau ukuran filenya 0 KB (rekaman korup).
