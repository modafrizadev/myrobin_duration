# Software Requirements Specification (SRS)
## Sistem Deteksi Durasi & Generator Laporan Harian (MyRobin Duration)

**Standar Dokumen:** IEEE 830-1998 / ISO/IEC/IEEE 29148  
**Kode Sistem:** SRS-MRD-001  
**Versi Sistem:** v2.0.0  
**Status Dokumen:** Approved / Production  
**Tanggal Rilis:** 18 November 2026  
**Klasifikasi:** Internal Engineering & Operational QA  

---

## 1. Pendahuluan (Introduction)

### 1.1 Tujuan Dokumen (Purpose)
Dokumen ini mendefinisikan spesifikasi persyaratan perangkat lunak secara formal untuk **Sistem Deteksi Durasi & Generator Laporan Harian (MyRobin Duration)**. Dokumen ini ditujukan bagi pengembang perangkat lunak, tim QA, teknisi data operasional, dan manajemen lapangan untuk memastikan bahwa seluruh fungsi teknis, batasan sistem, antarmuka, dan performa perangkat lunak terpenuhi sesuai kebutuhan operasional.

### 1.2 Cakupan Produk (Scope)
Sistem ini merupakan aplikasi berbasis web sisi klien (*pure client-side web application*) yang berjalan di peramban web modern tanpa memerlukan proses *server-side computation*. Perangkat lunak ini bertugas:
1. Mengakses dan memindai direktori kartu SD kamera fisik secara langsung melalui *File System Access API*.
2. Membaca berkas rekaman terenkripsi berekstensi `.enc` dan metadata berekstensi `.json`.
3. Menghitung durasi aktual perekaman video per berkas, per tanggal, dan total akumulatif berdasarkan penanda waktu UNIX epoch dalam milidetik.
4. Menyimpan izin akses kartu SD ke basis data lokal peramban (*IndexedDB*).
5. Menyimpan riwayat pemindaian kamera dan menyediakan algoritma penggabungan data multi-kamera (*log merging*) untuk tanggal yang sama.
6. Memformat dan memproduksi laporan teks terstandarisasi *Daily Physical AI Intern Report*.

### 1.3 Definisi, Akronim, & Singkatan (Definitions & Acronyms)
* **FSA API**: *File System Access API* (W3C standard) yang memungkinkan aplikasi web membaca direktori lokal dengan izin pengguna.
* **IndexedDB**: Basis data NoSQL lokal di dalam peramban web untuk penyimpanan objek berstruktur, termasuk `FileSystemDirectoryHandle`.
* **.enc**: Berkas video rekaman kamera yang terenkripsi (*encrypted MCAP stream*).
* **.json**: Berkas metadata penyerta yang menyimpan rekaman waktu awal (`started_epoch_ms`).
* **HMS**: Format penulisan waktu Jam:Menit:Detik (*Hours:Minutes:Seconds*).
* **Actual Hours**: Total jam aktif perekaman riil kamera di lapangan yang valid setelah dikalkulasi dari selisih waktu mulai dan selesai.
* **WCAG AAA**: *Web Content Accessibility Guidelines* level tertinggi untuk kontras warna teks dan elemen UI.

### 1.4 Referensi (References)
* W3C File System Access Specification: `https://wicg.github.io/file-system-access/`
* PRD Sistem Deteksi Durasi v2.0: `PRD_SISTEM_DETEKSI_DURASI.md`
* Repositori GitHub: `https://github.com/modafrizadev/myrobin_duration`

---

## 2. Deskripsi Keseluruhan (Overall Description)

### 2.1 Arsitektur Sistem & Perspektif Produk
Sistem beroperasi pada arsitektur *Zero-Backend Serverless*. Seluruh berkas pemrosesan logika dieksekusi di thread JavaScript lokal pada peramban klien.

```
+-------------------------------------------------------------------------------+
|                             CLIENT BROWSER (HOST)                             |
|                                                                               |
|  +--------------------+    +---------------------+    +--------------------+  |
|  |  Langkah 1: Izin   |    |  Langkah 2: Input   |    | Langkah 3: Profil  |  |
|  |   Akses Kartu SD   |--->|     Kode Kamera     |--->|  & Lokasi UMKM     |  |
|  +--------------------+    +---------------------+    +--------------------+  |
|            |                          |                          |            |
|            v                          v                          |            |
|  +-----------------------------------------------+               |            |
|  |           ENGINE PEMINDAIAN LOKAL             |               |            |
|  |  - Filter Folder Sistem (OS Isolation)        |               |            |
|  |  - Rekursi Direktori & Pair Parser (.enc/.json|               |            |
|  |  - Epoch Millisecond Timestamp Differencer    |               |            |
|  +-----------------------------------------------+               |            |
|            |                          |                          |            |
|            v                          v                          v            |
|  +--------------------+    +---------------------+    +--------------------+  |
|  |  IndexedDB Store   |    |  LocalStorage Store |    | Langkah 4: Display |  |
|  | ('activeSDCard')   |    | ('myrobin_scan_logs')|   | & Copy Report Text |  |
|  +--------------------+    +---------------------+    +--------------------+  |
|                                                                               |
+-------------------------------------------------------------------------------+
```

### 2.2 Karakteristik Pengguna
* **Field Operator / Data Recording Intern**: Memiliki keterampilan teknis dasar (pengguna laptop awam). Mengakses aplikasi melalui laptop berbasis Windows 10/11 menggunakan peramban Google Chrome atau Microsoft Edge.
* **Field Operations Lead**: Meninjau laporan yang disalin dari sistem via aplikasi pesan instan.

### 2.3 Lingkungan Operasional (Operating Environment)
* **Peramban yang Didukung**: Google Chrome (v86+), Microsoft Edge (v86+), Opera (v72+). Peramban harus mendukung *Chromium File System Access API*.
* **Sistem Operasi Host**: Microsoft Windows 10/11 (64-bit), macOS, Linux.
* **Konektivitas**: Aplikasi web disajikan melalui HTTPS via Vercel Edge Network. Setelah berkas `index.html` dimuat ke cache browser, operasi pemindaian dapat berjalan secara *offline* tanpa koneksi internet.

### 2.4 Batasan Perangkat Lunak & Desain (Constraints)
1. **Keamanan Sandboxing Browser**: Browser tidak mengizinkan pemindaian berkas di luar folder/drive yang diizinkan pengguna secara eksplisit.
2. **Folder Sistem Terproteksi OS**: Drive root Windows (misal `D:\`) memiliki folder terproteksi (`System Volume Information`). Sistem wajib mengabaikan folder ini agar tidak memicu eksepsi *SecurityError*.
3. **Standar Desain Bebas Emotikon**: Sistem dilarang menampilkan karakter emotikon grafis apa pun (misal `📁`, `✅`, `❌`, `⚡`). Seluruh visualisasi wajib menggunakan vektor Heroicons SVG.

---

## 3. Persyaratan Antarmuka Eksternal (External Interfaces)

### 3.1 Antarmuka Pengguna (User Interface)
Antarmuka disusun secara vertikal dalam 4 kartu panel (*card-panel*) yang selalu terlihat:
* **UI-01 (Bilah Status Kartu SD)**:
  - Indikator status lingkaran: Abu-abu (Belum Terhubung), Hijau Daun (Terhubung).
  - Teks status: Menampilkan nama folder/drive terhubung (misal `D:` atau `recording`).
  - Tombol aksi: `Beri Izin & Hubungkan SD Card` (saat belum terhubung) dan `Ganti Kartu SD` (saat terhubung).
* **UI-02 (Input Nomor Kamera & Scan)**:
  - Input field 4 digit angka (`#camCode`) dengan filter ekspresi reguler numerik otomatis `replace(/[^0-9]/g, '').slice(0, 4)`.
  - Tombol aksi: `Scan Otomatis` (`#scanBtn`) dengan ikon pencarian SVG dan teks dinamis (*Memindai...* saat proses berjalan).
* **UI-03 (Profil Petugas & Alokasi Lokasi)**:
  - Input nama petugas (`#userName`), role (`#userRole`), dan tanggal laporan (`#reportDate`).
  - Toggle alokasi lokasi multi-file per episode (`#perFileLocBox`) untuk pembagian waktu kerja antar UMKM.
* **UI-04 (Panel Hasil & Laporan)**:
  - Placeholder kosong (`#resultEmptyPlaceholder`) saat belum ada data.
  - Konten aktif (`#resultActiveContent`) yang menyajikan:
    - 4 Kotak Stat Utama: Grand Total (HMS), Jam Desimal, Rentang Tanggal, Jumlah File.
    - Tab navigasi tanggal dinamis (`#dateTabsNav`).
    - Tabel ringkasan harian beserta jam mulai, jam selesai, dan durasi.
    - Blok pratinjau teks laporan siap salin (`#codeOutput`).
    - Tombol `Salin Laporan` (`#copyBtn`) dan `Reset`.

### 3.2 Antarmuka Sistem Berkas (Hardware/Storage Interface)
* Menggunakan antarmuka W3C `window.showDirectoryPicker({ mode: 'read' })`.
* Struktur penanganan `FileSystemDirectoryHandle` dan `FileSystemFileHandle`.
* Akses berkas dilakukan melalui pemanggilan asinkron `entry.getFile()`.

### 3.3 Antarmuka Basis Data Lokal (Database Interface)
* **IndexedDB**:
  - Nama Basis Data: `MyRobinDurationDB` (versi 1).
  - Object Store: `handles`.
  - Kunci: `activeSDCard` $\rightarrow$ Menyimpan serialisasi objek `FileSystemDirectoryHandle`.
* **LocalStorage**:
  - Kunci: `myrobin_scan_logs` $\rightarrow$ Menyimpan JSON array dari riwayat pemindaian (`LogEntry[]`).

---

## 4. Persyaratan Fungsional Rinci (System Features)

### 4.1 Pemindaian & Isolasi Folder Sistem (Module: Scanner)

#### REQ-SCN-001: Penelusuran Direktori Rekursif & Proteksi Sistem
* **Deskripsi**: Sistem wajib menelusuri seluruh hierarki subdirektori kartu SD untuk mengidentifikasi berkas rekaman.
* **Logika Pemrosesan**:
  1. Sistem menginisialisasi set direktori terlarang (`IGNORED_DIRS`): `system volume information`, `$recycle.bin`, `found.000`, `found.001`, `.trash`, `.trashes`, `.spotlight-v100`, `.fseventsd`, `.git`, `.gemini`, `node_modules`, `recovery`.
  2. Saat menemukan `entry.kind === 'directory'`, sistem memeriksa: jika nama direktori diawali dengan `$` atau `.` atau terdapat di dalam `IGNORED_DIRS`, direktori tersebut langsung dilewati (*skip*).
  3. Setiap iterasi `for await (const entry of h.values())` dibungkus dalam blok `try...catch` mandiri.
* **Keluaran**: Koleksi peta pasangan berkas `encFiles[baseUUID]` dan `jsonFiles[baseUUID]`.

#### REQ-SCN-002: Kalkulasi Penanda Waktu Presisi (.enc & .json Pairing)
* **Deskripsi**: Sistem wajib menghitung durasi rekaman secara presisi dari metadata atau atribut berkas.
* **Logika Pemrosesan**:
  1. `startTime`: Diambil dari pembacaan isi teks `jsonFile` pada path `recording.started_epoch_ms` dan dikonversi menjadi objek `Date(parseInt(epoch_ms))`.
  2. Jika JSON tidak tersedia atau rusak, `startTime` dialihkan (*fallback*) ke `jsonFile.lastModified` atau `encFile.lastModified`.
  3. `endTime`: Diambil dari nilai `new Date(encFile.lastModified)`.
  4. Durasi dihitung: `Math.max(0, (endTime.getTime() - startTime.getTime()) / 1000)`.
* **Format Output**:
  - Detik: `duration_seconds`
  - Jam-Menit-Detik: `formatHMSFromSec(totalSeconds)` $\rightarrow$ `HH:MM:SS`
  - Teks Formal Indonesia: `formatIndoDurationSec(totalSeconds)` $\rightarrow$ `X jam Y menit Z detik`

#### REQ-SCN-003: Filter Berdasarkan Kode Kamera
* **Deskripsi**: Sistem memfilter berkas rekaman berdasarkan 4 digit kode kamera yang dimasukkan pengguna.
* **Logika Pemrosesan**:
  1. Token target dibentuk: `atlascm{KODE}` dan `{KODE}`.
  2. Array berkas disaring berdasarkan kecocokan path atau nama berkas terhadap token target.
  3. Jika tidak ada berkas yang cocok, sistem memunculkan pesan peringatan: *"Tidak ditemukan file rekaman untuk kamera atlascm[KODE]..."* dan menghentikan proses tanpa menghilangkan status kartu SD.

### 4.2 Manajemen Izin & Persistence (Module: Permission & Storage)

#### REQ-PRM-001: Verifikasi Izin Berkala
* **Deskripsi**: Sistem memeriksa izin baca pada `FileSystemDirectoryHandle` yang tersimpan.
* **Logika Pemrosesan**:
  1. Panggil `handle.queryPermission({ mode: 'read' })`.
  2. Jika berstatus `'granted'`, fungsi mengembalikan `true`.
  3. Jika berstatus `'prompt'`, panggil `handle.requestPermission({ mode: 'read' })`.
  4. Jika terjadi eksepsi atau ditolak, kembalikan `false`.

#### REQ-PRM-002: Pemulihan Status Saat Halaman Dimuat
* **Deskripsi**: Saat halaman dibuka, sistem otomatis memeriksa keberadaan handle di IndexedDB.
* **Keluaran**: Jika handle valid, UI Langkah 1 langsung menampilkan status hijau *Terhubung* tanpa perlu interaksi pengguna.

### 4.3 Riwayat Log & Penggabungan Multi-Kamera (Module: Log Aggregator)

#### REQ-LOG-001: Pencegahan Duplikasi Log
* **Deskripsi**: Log pemindaian disimpan secara otomatis dengan validasi keunikan.
* **Logika Pemrosesan**:
  Kombinasi `date + cameraCode + grand_total_seconds + found_files` dievaluasi. Jika sudah ada entri dengan parameter identik, penyimpanan dilewati untuk mencegah data ganda.

#### REQ-LOG-002: Algoritma Penggabungan Multi-Kamera (Merge Engine)
* **Deskripsi**: Menggabungkan data dari 2 atau lebih kartu SD/kamera yang beroperasi pada hari yang sama.
* **Logika Pemrosesan**:
  1. Himpun seluruh kelompok tanggal (`summary_per_date`) dari log yang dipilih.
  2. Untuk tanggal yang sama: Jumlahkan `total_seconds` dan `file_count`.
  3. Hitung ulang jam aktual (`grand_total_hours` dan `grand_total_hms`).
  4. Hitung jumlah kamera aktif unik dari set `camera_code`.
  5. Perbarui seluruh tabel UI Langkah 4 dan blok teks laporan.

### 4.4 Format Laporan Harian (Module: Report Generator)

#### REQ-REP-001: Pembangkitan Teks Laporan Otomatis
* **Deskripsi**: Menghasilkan string teks laporan terformat sesuai template resmi:
```
Daily Physical AI Intern Report

Nama : {Nama}
Role : {Role}
Tanggal : {Tanggal}

Summary Hari Ini
* Jumlah kamera yang dibawa : {KameraBawa}
* Jumlah kamera aktif : {KameraAktif}
* Jumlah actual hours: {Jam} jam {Menit} menit {Detik} detik.
Lokasi: 
- {Lokasi 1} : {Durasi 1}
- {Lokasi 2} : {Durasi 2}
Catatan:
{Catatan}
```

---

## 5. Persyaratan Non-Fungsional (Non-Functional Requirements)

### 5.1 Kinerja (Performance)
* **Waktu Respon Pemindaian**: Sistem wajib menyelesaikan pembacaan dan perhitungan 200 berkas rekaman dalam waktu $< 1.500\text{ ms}$ pada antarmuka USB 3.0 / SD Card UHS-I.
* **Beban Memori**: Penggunaan memori heap peramban dibatasi $< 80\text{ MB}$ karena berkas video `.enc` tidak dimuat seluruhnya ke RAM (hanya metadata ukuran dan penanda waktu yang dibaca).

### 5.2 Keamanan & Privasi (Security & Privacy)
* **Zero Cloud Transmission**: Berkas video terenkripsi tidak dikirimkan ke jaringan internet eksternal.
* **Isolasi Izin Peramban**: Izin akses media kartu SD tunduk pada batasan *Origin Private File System* dan *User Mediation Prompt*.

### 5.3 Aksesibilitas & UI Compliance
* **WCAG AAA Compliance**: Rasio kontras warna teks utama (`#111827`) terhadap latar belakang (`#FFFFFF` dan `#FAF8EE`) memenuhi standar minimal $7:1$.
* **Zero-Emoji Architecture**: Seluruh ikon grafis diimplementasikan menggunakan elemen `<svg class="hi-icon">` dengan atribut `stroke="currentColor"`.

---

## 6. Spesifikasi Skema Data (Data Models)

### 6.1 Skema Logika ScanData (JavaScript Object)
```typescript
interface ScanData {
  success: boolean;
  target_folder: string;
  found_files: number;
  dates_count: number;
  range_label: string;
  grand_total_hms: string;       // "01:39:49"
  grand_total_hours: number;     // 1.66
  grand_total_indo: string;      // "1 jam 39 menit 49 detik"
  summary_per_date: DailySummary[];
  groups: DateGroup[];
  raw_text: string;
}

interface DailySummary {
  date: string;                  // "2026-11-16"
  date_indo: string;             // "16 November 2026"
  total_hms: string;
  total_indo: string;
  total_hours: number;
  total_seconds: number;
  file_count: number;
  start_time: string;            // "09:12:04"
  end_time: string;              // "10:51:53"
}
```
