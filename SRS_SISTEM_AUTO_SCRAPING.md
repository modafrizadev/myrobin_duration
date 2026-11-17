# Software Requirements Specification (SRS)
## Sistem Auto Scrapping QA Atlas Capture (Episode Scrapper)

**Standar Dokumen:** IEEE 830-1998 / ISO/IEC/IEEE 29148  
**Kode Sistem:** SRS-ATQ-002  
**Versi Sistem:** v5.1.0  
**Status Dokumen:** Approved / Production  
**Tanggal Rilis:** 18 November 2026  
**Klasifikasi:** Internal Engineering & Operational QA  

---

## 1. Pendahuluan (Introduction)

### 1.1 Tujuan Dokumen (Purpose)
Dokumen ini mendefinisikan spesifikasi teknis dan fungsional formal untuk **Sistem Auto Scrapping QA Atlas Capture (Episode Scrapper v5.1)**. Dokumen ini digunakan sebagai rujukan teknis bagi perancang sistem, teknisi automasi, tim Quality Assurance (QA), dan pengembang skrip peramban untuk memastikan keandalan ekstraksi data, validitas integrasi webhook, kepatuhan struktur tabel, dan integritas data operasional.

### 1.2 Cakupan Produk (Scope)
Sistem ini terdiri dari dua komponen terintegrasi:
1. **Komponen Klien (Userscript Browser Extension)**: Berjalan di peramban pengguna pada domain `https://studio.atlascapture.io/*` melalui ekstensi Tampermonkey. Bertugas menyisir database internal penolakan episode via API TRPC, menyaring berdasarkan rentang tanggal kalender, mendeteksi identitas UMKM secara dinamis dari elemen `<h1>`, menyajikan dialog verifikasi data, dan mengirimkan baris data terformat ke webhook.
2. **Komponen Server (Google Apps Script Webhook Receiver)**: Skrip backend *serverless* pada ekosistem Google Workspace yang menerima kiriman payload data via HTTP POST, menerapkan penguncian konkurensi (*script lock*), dan menuliskan baris data secara terstruktur ke Google Spreadsheet.

### 1.3 Definisi, Akronim, & Singkatan (Definitions & Acronyms)
* **TRPC**: Kerangka kerja RPC berkemampuan *type-safe* yang digunakan oleh backend Atlas Capture untuk melayani permintaan data aplikasi web.
* **Userscript**: Skrip JavaScript sisi klien yang diinjeksikan ke dalam halaman web tertentu untuk memodifikasi atau menambah fungsionalitas antarmuka.
* **Tampermonkey**: Manajer ekstensi peramban standar industri untuk mengeksekusi userscript dengan izin khusus (`GM_*`).
* **GM_xmlhttpRequest**: API istimewa Tampermonkey untuk melakukan HTTP request lintas-domain (*Cross-Origin*) tanpa terhalang kebijakan CORS peramban.
* **TSV**: *Tab-Separated Values*, format pertukaran data teks berbasis tabulasi yang kompatibel secara langsung dengan mekanisme paste sel Google Sheets dan Microsoft Excel.
* **SPA**: *Single Page Application*, arsitektur web Atlas Studio yang memuat halaman secara dinamis tanpa melakukan *full reload* peramban.

### 1.4 Referensi (References)
* PRD Sistem Auto Scrapping QA v5.1: `PRD_SISTEM_AUTO_SCRAPING.md`
* Skrip Klien: `HITL_QA/atlas-qa-scraper.user.js`
* Skrip Server: `HITL_QA/google-apps-script.js`
* Dokumentasi Tampermonkey API: `https://www.tampermonkey.net/documentation.php`

---

## 2. Deskripsi Keseluruhan (Overall Description)

### 2.1 Arsitektur Sistem & Aliran Data
Sistem menghubungkan dashboard Atlas Capture dengan Google Sheets melalui arsitektur terisolasi dan aman:

```
+-----------------------------------------------------------------------------------+
|                        BROWSER HOST (ATLAS CAPTURE DOMAIN)                        |
|                                                                                   |
|  +-----------------------------------------------------------------------------+  |
|  |                 USERSCRIPT ENGINE (atlas-qa-scraper.user.js)                |  |
|  |                                                                             |  |
|  |  +---------------------+   +---------------------+   +-------------------+  |  |
|  |  |  UMKM H1 Detector   |   | Date Range Selector |   | Widget UI Manager |  |  |
|  |  | (Observer Interval) |   | (YYYY-MM-DD Filter) |   | (Width & States)  |  |  |
|  |  +---------------------+   +---------------------+   +-------------------+  |  |
|  |            |                          |                          |          |  |
|  |            +--------------------------+--------------------------+          |  |
|  |                                       |                                     |  |
|  |                                       v                                     |  |
|  |                  +-----------------------------------------+                |  |
|  |                  |    Targeted TRPC Batch Scraper Engine   |                |  |
|  |                  | - Discovered Reasons Multicategory Set  |                |  |
|  |                  | - Cursor Pagination & Rate-Limit Delay  |                |  |
|  |                  +-----------------------------------------+                |  |
|  +-----------------------------------------------------------------------------+  |
|              |                                             |                      |
|              v (TRPC API Fetch)                            v (GM_xmlhttpRequest)  |
|  +------------------------+                   +--------------------------------+  |
|  |  Atlas TRPC Endpoints  |                   | Google Apps Script Webhook     |  |
|  |  (/api/trpc/userGroup) |                   | (google-apps-script.js)        |  |
|  +------------------------+                   +--------------------------------+  |
+----------------------------------------------------------------|------------------+
                                                                 v (Append Rows)
                                                +-----------------------------------+
                                                |     Target Google Spreadsheet     |
                                                |   (Master 10-Kolom QA Report)     |
                                                +-----------------------------------+
```

### 2.2 Karakteristik Pengguna
* **Quality Assurance Specialist & Operator QA**: Melakukan validasi hasil episode rekaman yang ditolak, memfilter data per periode tanggal, dan menyinkronkannya ke master spreadsheet secara cepat.
* **Lead Operations**: Memeriksa kelengkapan alasan penolakan dan tautan klip untuk evaluasi mitra UMKM.

### 2.3 Lingkungan Operasional (Operating Environment)
* **Ekstensi Browser**: Tampermonkey v4.18+ atau Violentmonkey v2.13+.
* **Peramban Web**: Google Chrome (v90+), Microsoft Edge (v90+), Mozilla Firefox (v88+).
* **Domain Akses**: `https://studio.atlascapture.io/dashboard/business/*`.
* **Backend Webhook**: Google Apps Script runtime V8 engine yang dideploy sebagai Web App publik (`executeAs: Me`, `access: Anyone`).

### 2.4 Batasan Sistem (Constraints)
1. **Autentikasi Sesi Atlas**: Kueri TRPC mengharuskan pengguna telah login aktif di Atlas Studio (menggunakan opsi peramban `credentials: 'include'`).
2. **Keterbatasan Kuota Google Apps Script**: Eksekusi pengiriman data batch wajib dikirimkan dalam 1 payload array tunggal guna menghindari batas kuota *URL Fetch / Execution Time* Google Apps Script.
3. **Standar Desain Bebas Emotikon**: Antarmuka melayang (*floating card*) dilarang menggunakan emoji Unicode, dan sepenuhnya menggunakan vektor SVG monokromatik.

---

## 3. Persyaratan Antarmuka Eksternal (External Interfaces)

### 3.1 Antarmuka Pengguna Melayang (Floating UI v5.1)
Komponen antarmuka didefinisikan secara hierarkis:
* **UI-HDR (Header Panel)**:
  - Label judul: `Episode Scrapper v5.1` dengan ikon sinkronisasi SVG.
  - Badge dinamis (`#aqa-badge-status`): Menampilkan status kontekstual (*Buka Halaman Bisnis*, *Pilih Tanggal & Pindai*, *Memindai...*, atau `[X] Cocok`).
  - Tombol bantuan tutorial (`#aqa-btn-help`): Membuka jendela panduan operasional 4 langkah.
* **UI-BIZ (Kartu Status UMKM)**:
  - Tampilan Panduan (`#aqa-biz-guidance-view`): Menampilkan kotak notifikasi kuning gading jika pengguna berada di luar dashboard UMKM.
  - Tampilan Aktif (`#aqa-biz-active-view`): Menampilkan teks `UMKM: [Nama UMKM]` berwarna Pine Teal dengan subteks status aksi.
* **UI-DTR (Pemilih Rentang Tanggal)**:
  - Dua input tanggal tipe HTML5 date: `#aqa-input-date-start` dan `#aqa-input-date-end`. Nilai otomatis disimpan ke storage lokal.
* **UI-MET (Panel Dua Keterangan Metrik)**:
  - Baris 1: `[X] episode telah ditelusuri di database` (titik aksen Pine Teal).
  - Baris 2: `[Y] episode pada tanggal yang dipilih` (titik aksen Cyan).
* **UI-ACT (Tombol Aksi Utama)**:
  - Tombol `Mulai Pindai Sesuai Tanggal` (`#aqa-btn-start-scrape`).
  - Tombol `Stop` (`#aqa-btn-stop`) dengan latar merah gelap `#991B1B`.
  - Tombol `Salin (TSV)` (`#aqa-btn-copy-tsv`) untuk ekspor clipboard offline.
  - Tombol `Kirim ke Sheet` (`#aqa-btn-send-sheet`) untuk transmisi webhook.
* **UI-SET (Footer Pengaturan Window & Webhook)**:
  - Tombol akordeon di bagian paling bawah kartu widget.
  - Input teks URL Webhook Google Apps Script (`#aqa-input-webhook`).
  - Input teks Nama Sheet/Tab (`#aqa-input-sheet`).
  - Input teks Nama Bisnis Kustom (`#aqa-input-custom-biz`).
  - Slider lebar widget (`#aqa-input-width` range 300px - 480px, step 10px) dengan respons real-time terhadap elemen `#aqa-card`.

### 3.2 Antarmuka API TRPC Atlas Capture
* **Endpoint URL**: `/api/trpc/userGroup.getBusinessRejectedEpisodesForReason?batch=1&input={INPUT_JSON}`
* **Format Input Query**:
```json
{
  "0": {
    "json": {
      "businessId": "6a60c310ffc3bc5072f378ed",
      "reason": "device_usage",
      "bucket": "P0",
      "additionalReasons": null,
      "projectId": null,
      "startDate": null,
      "endDate": null,
      "limit": 50,
      "direction": "forward",
      "cursor": "2026-10-15T00:47:00.000Z"
    },
    "meta": {
      "values": {
        "additionalReasons": ["undefined"],
        "projectId": ["undefined"],
        "startDate": ["undefined"],
        "endDate": ["undefined"],
        "cursor.createdAt": ["Date"]
      },
      "v": 1
    }
  }
}
```

### 3.3 Antarmuka Webhook Google Apps Script
* **Metode HTTP**: `POST`
* **Content-Type**: `text/plain;charset=utf-8` (mengatasi batasan preflight CORS).
* **Struktur Permintaan (Request Payload)**:
```json
{
  "sheetName": "Sheet1",
  "action": "batch",
  "rows": [
    {
      "namaBisnis": "Kedai QQ",
      "taskName": "Business Task · Part 1/30",
      "submitDate": "Multicam · Oct 15, 2026 7:47 AM",
      "rejectClass": "P0",
      "qaTypes": "Auto QA",
      "rejectedClipLink": "https://studio.atlascapture.io/dashboard/business/...&autoEpisodeQaEpisode=...",
      "rejectionType": "Device Usage",
      "rejectionCause": "-",
      "disputeNote": "-",
      "duration": "1:48"
    }
  ]
}
```
* **Struktur Respon (Success Response)**:
```json
{
  "status": "success",
  "message": "15 baris data berhasil ditambahkan ke Spreadsheet.",
  "insertedCount": 15,
  "lastRow": 126
}
```

---

## 4. Persyaratan Fungsional Rinci (System Features)

### 4.1 Mesin Scraping TRPC Berbasis Tanggal (Module: TRPC Engine)

#### REQ-ATQ-001: Penemuan Kategori Alasan Penolakan Otomatis
* **Deskripsi**: Sistem wajib mengidentifikasi daftar kategori alasan penolakan secara dinamis melalui analisis cache jaringan `performance.getEntriesByType('resource')` dan daftar alasan bawaan (*predefined reasons*).
* **Kategori Standar**: `hands_not_in_frame`, `device_usage`, `children_in_frame`, `non_meaningful_task`, `blurry_dirty_lens`, `bad_lighting`, `illegal_substances_activity`, `banned_task`, `nsfw`, `image_quality_camera_broken`.

#### REQ-ATQ-002: Resolusi Paginasi Berbasis Cursor & Penyaringan Tanggal
* **Deskripsi**: Sistem mengeksekusi paginasi data otomatis hingga seluruh episode pada kategori tertentu tuntas.
* **Logika Pemrosesan**:
  1. Kueri dijalankan per 50 episode (`limit: 50`).
  2. Seluruh episode yang diterima dimasukkan ke dalam Map `state.allEpisodes` (penghitung `Total Ditelusuri`).
  3. Tanggal pembuatan episode (`ep.createdAt`) dikonversi ke waktu lokal `YYYY-MM-DD`.
  4. Jika tanggal berada dalam rentang `startDate <= date <= endDate`, episode dimasukkan ke Map `state.episodes` (penghitung `Cocok Tanggal`).
  5. Jika respon memuat `nextCursor`, kueri dilanjutkan dengan jeda *rate-limit* $60\text{ ms}$. Jika tidak, berlanjut ke kategori berikutnya.

### 4.2 Deteksi UMKM Dinamis & SPA Observer (Module: Entity Detector)

#### REQ-ATQ-003: Hierarki Deteksi Nama UMKM
* **Deskripsi**: Sistem wajib mengekstrak nama UMKM dari halaman aktif tanpa intervensi manual.
* **Urutan Prioritas**:
  1. Konfigurasi kustom pengguna (`STORAGE_KEYS.CUSTOM_BIZ_NAME`).
  2. Elemen teks DOM `h1[data-agentation-id]`, `h1.text-3xl`, atau `h1` yang tidak mengandung kata *dashboard* atau *atlas*.
  3. Elemen *breadcrumb* navigasi peramban.
  4. Teks judul dokumen `document.title.split('·')[0]`.
  5. Nilai fallback aman: String kosong jika di luar dashboard.

#### REQ-ATQ-004: Pemantauan Navigasi SPA
* **Deskripsi**: Sistem menjalankan interval berkala $1.000\text{ ms}$ untuk membandingkan `window.location.pathname` terhadap `lastPath`.
* **Keluaran**: Jika terdeteksi perpindahan halaman bisnis, seluruh state data direset dan antarmuka otomatis menampilkan nama UMKM yang baru.

### 4.3 Alur Dialog Verifikasi (Module: Review Flow)

#### REQ-ATQ-005: Modal Konfirmasi Sebelum Transmisi Data
* **Deskripsi**: Sistem wajib menampilkan jendela modal verifikasi sebelum data dikirimkan ke Google Apps Script.
* **Parameter yang Ditampilkan**: Nama UMKM, rentang tanggal target, total episode ditelusuri di database, dan total episode yang cocok rentang tanggal.
* **Aksi Pengguna**:
  - Tombol *Ulang Pindai*: Menutup modal dan mengeksekusi ulang `startScrapeFlow()`.
  - Tombol *Kirim ke Sheet*: Menutup modal dan mengeksekusi transmisi ke webhook.

### 4.4 Pengiriman Data & Notifikasi Top Banner (Module: Sync & Alerts)

#### REQ-ATQ-006: Pengiriman Batch Bergaransi Mutex
* **Deskripsi**: Backend Google Apps Script menggunakan `LockService.getScriptLock().tryLock(30000)` untuk mencegah tabrakan baris saat beberapa operator mengirim data secara simultan.

#### REQ-ATQ-007: Notifikasi Banner Atas Layar (Top Banner)
* **Deskripsi**: Setelah transmisi data selesai, elemen `#aqa-top-banner` dianimasikan meluncur dari atas layar (`top: 20px`) selama 7 detik, menampilkan status keberhasilan atau rincian galat.

### 4.5 Pengatur Lebar Window Widget (Module: Layout Customizer)

#### REQ-ATQ-008: Slider Lebar Widget Real-Time
* **Deskripsi**: Pengguna dapat mengubah lebar kartu widget melalui slider range (300px - 480px).
* **Logika**: Nilai slider langsung memperbarui properti CSS `cardEl.style.width` secara *real-time* dan disimpan permanen via `GM_setValue(STORAGE_KEYS.WIDGET_WIDTH, val)`.

---

## 5. Persyaratan Non-Fungsional (Non-Functional Requirements)

### 5.1 Keandalan & Ketahanan Jaringan (Reliability)
* **Pencadangan Otomatis ke Papan Klip**: Setiap kali pemindaian selesai, seluruh baris data terformat otomatis dicadangkan ke clipboard dalam format TSV. Jika pengiriman webhook gagal karena kendala jaringan, pengguna dapat langsung melakukan `Ctrl + V` pada Google Spreadsheet.
* **Respon HTTP Redirect Handshake**: Mendukung penanganan otomatis redirect 302 dari server Google Apps Script.

### 5.2 Standar Visual & Aksesibilitas
* **Bebas Emotikon 100%**: Tidak ada karakter emoji Unicode pada HTML widget, modal verifikasi, banner notifikasi, maupun pesan toast. Seluruh indikator grafis menggunakan SVG Heroicons monokromatik.
* **Warna Brand Standar**: Mengadopsi palet Warm Cream (`#FAF8EE`), Deep Pine Teal (`#1B4D4B`), dan Turquoise Cyan (`#3AA39E`) sesuai design system MyRobin Apps.

---

## 6. Spesifikasi Struktur Data & Pemetaan 10 Kolom

### 6.1 Skema Objek Baris Spreadsheet (Row Data Schema)
```typescript
interface QaSpreadsheetRow {
  namaBisnis: string;        // Kolom 1: "Kedai QQ"
  taskName: string;          // Kolom 2: "Business Task · Part 1/30"
  submitDate: string;        // Kolom 3: "Multicam · Oct 15, 2026 7:47 AM"
  rejectClass: string;       // Kolom 4: "P0"
  qaTypes: string;           // Kolom 5: "Auto QA"
  rejectedClipLink: string;  // Kolom 6: "https://studio.atlascapture.io/dashboard/business/...&autoEpisodeQaEpisode=..."
  rejectionType: string;     // Kolom 7: "Device Usage"
  rejectionCause: string;    // Kolom 8: "Hands Not In Frame Failures" | "-"
  disputeNote: string;       // Kolom 9: "Cannot Dispute" | "-"
  duration: string;          // Kolom 10: "1:48"
}
```
