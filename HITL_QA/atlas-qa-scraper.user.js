// ==UserScript==
// @name         Atlas Capture QA Auto-Reporter to Google Sheets
// @namespace    https://studio.atlascapture.io/
// @version      1.0.0
// @description  Ekstraksi otomatis data Rejection QA Atlas Capture dan sinkronisasi ke Google Spreadsheet
// @author       Antigravity
// @match        https://studio.atlascapture.io/*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_setClipboard
// @connect      script.google.com
// @connect      script.googleusercontent.com
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  // ==========================================
  // KONFIGURASI DEFAULT & STATE
  // ==========================================
  const STORAGE_KEYS = {
    WEBHOOK_URL: 'atlas_qa_webhook_url',
    SHEET_NAME: 'atlas_qa_sheet_name',
    DEFAULT_BIZ: 'atlas_qa_default_biz',
    SYNCED_LINKS: 'atlas_qa_synced_links'
  };

  let lastCopiedLinkFromAtlas = '';

  // Intercept clipboard writeText agar saat tombol bawaan "Copy Link" diklik (manual/otomatis),
  // link clip shareable yang dihasilkan Atlas langsung tertangkap 100% akurat.
  const originalClipboardWriteText = navigator.clipboard ? navigator.clipboard.writeText : null;
  if (originalClipboardWriteText) {
    navigator.clipboard.writeText = function (text) {
      if (typeof text === 'string' && text.includes('atlascapture.io')) {
        lastCopiedLinkFromAtlas = text;
      }
      return originalClipboardWriteText.apply(this, arguments);
    };
  }

  // ==========================================
  // HELPER PENGAMBIL DATA (DOM SCRAPING)
  // ==========================================

  /**
   * Ekstraksi link klip yang ditolak
   */
  async function resolveRejectedClipLink(container = document) {
    // 1. Cek jika URL di address bar browser sudah memuat parameter episode
    const currentUrl = window.location.href;
    if (currentUrl.includes('autoEpisodeQaEpisode=')) {
      return currentUrl;
    }

    // 2. Jika baru saja ada link yang disalin oleh Atlas ke clipboard
    if (lastCopiedLinkFromAtlas && lastCopiedLinkFromAtlas.includes('autoEpisodeQaEpisode=')) {
      return lastCopiedLinkFromAtlas;
    }

    // 3. Cari tombol "Copy Link" / "Copy shareable page link" dan simulasikan klik
    const copyBtn = container.querySelector(
      'button[title*="Copy shareable"], button[title*="Copy Link"], button:has(svg):has(span)'
    ) || Array.from(container.querySelectorAll('button')).find(b => b.textContent.includes('Copy Link'));

    if (copyBtn) {
      copyBtn.click();
      // Beri jeda 150ms agar event handler clipboard Atlas sempat menulis
      await new Promise(r => setTimeout(r, 150));
      if (lastCopiedLinkFromAtlas) {
        return lastCopiedLinkFromAtlas;
      }
    }

    // 4. Fallback: Cari link atau anchor terdekat yang mengandung format autoEpisodeQaEpisode
    const anchor = container.querySelector('a[href*="autoEpisodeQaEpisode"]');
    if (anchor && anchor.href) {
      return anchor.href;
    }

    // 5. Fallback terakhir: Kembalikan URL aktif saat ini
    return currentUrl;
  }

  /**
   * Ekstraksi Submit Date
   * Target contoh: "Mulyatinah · Business / Multicam · Oct 15, 2026 7:47 AM"
   * Output yang diminta: " Multicam · Oct 15, 2026 7:47 AM"
   */
  function extractSubmitDate(container = document) {
    const el = container.querySelector('div.text-\\[10px\\].text-gray-500, div.text-gray-500.truncate') 
      || Array.from(container.querySelectorAll('div, span, p')).find(e => 
          e.textContent.includes('·') && (e.textContent.includes('AM') || e.textContent.includes('PM') || /\d{4}/.test(e.textContent))
      );

    if (!el) return '-';

    const fullText = el.textContent.trim();
    const parts = fullText.split('·').map(p => p.trim());

    if (parts.length >= 3) {
      // Misal parts[0]="Mulyatinah", parts[1]="Business / Multicam", parts[2]="Oct 15, 2026 7:47 AM"
      let middle = parts[1];
      if (middle.includes('/')) {
        middle = middle.split('/').pop().trim(); // Ambil "Multicam"
      }
      return `${middle} · ${parts.slice(2).join(' · ')}`;
    } else if (parts.length === 2) {
      return parts[1];
    }
    return fullText;
  }

  /**
   * Ekstraksi Nama Bisnis
   */
  function extractBusinessName(container = document) {
    const defaultBiz = GM_getValue(STORAGE_KEYS.DEFAULT_BIZ, '');
    if (defaultBiz) return defaultBiz;

    // Coba tebak dari teks info submit: "Mulyatinah · Business / Multicam · ..."
    const infoEl = container.querySelector('div.text-\\[10px\\].text-gray-500') 
      || Array.from(container.querySelectorAll('div, span')).find(e => e.textContent.includes('Business /'));
    if (infoEl && infoEl.textContent.includes('Business /')) {
      return 'Business';
    }

    // Coba tebak dari URL: /dashboard/business/69fc6c78...
    if (window.location.pathname.includes('/business/')) {
      return 'Business';
    }

    return 'Atlas Business';
  }

  /**
   * Ekstraksi Rejection Type
   * Target contoh: <span class="... bg-violet-100 ...">Device Usage</span>
   */
  function extractRejectionType(container = document) {
    const badges = container.querySelectorAll(
      'span.rounded-full[class*="bg-"], span[class*="text-violet"], span[class*="bg-violet"]'
    );
    for (const b of badges) {
      const text = b.textContent.trim();
      if (text && !text.includes('·') && text.length < 50) {
        return text;
      }
    }
    return 'Device Usage';
  }

  /**
   * Ekstraksi Task Name
   * Target contoh: <button ... class="... text-blue-600 ...">Business Task · Part 1/30</button>
   * atau <h3 ...>Business Task · Part 1/30</h3>
   */
  function extractTaskName(container = document) {
    const heading = container.querySelector('h3.text-lg, h3[class*="font-semibold"]');
    if (heading && heading.textContent.trim()) {
      return heading.textContent.trim();
    }

    const taskBtn = container.querySelector('button.text-blue-600, a.text-blue-600, [class*="text-blue-600"]');
    if (taskBtn && taskBtn.textContent.trim()) {
      return taskBtn.textContent.trim();
    }

    return '-';
  }

  /**
   * Ekstraksi Durasi
   * Target contoh: <p class="text-gray-900">1:48</p>
   */
  function extractDuration(container = document) {
    // Regex durasi seperti "1:48" atau "01:23:45"
    const durationRegex = /^\d{1,2}:\d{2}(:\d{2})?$/;

    // Cari dari tag p atau span di sekitar container
    const candidates = container.querySelectorAll('p.text-gray-900, p, span');
    for (const el of candidates) {
      const text = el.textContent.trim();
      if (durationRegex.test(text)) {
        return text;
      }
    }

    // Fallback: cari teks di seluruh container yang cocok dengan pola durasi
    const match = container.textContent.match(/\b\d{1,2}:\d{2}(:\d{2})?\b/);
    if (match) return match[0];

    return '-';
  }

  /**
   * Ekstraksi 1 Paket Objek Data Sesuai 10 Kolom Spreadsheet
   */
  async function scrapeCurrentItem(container = document) {
    const clipLink = await resolveRejectedClipLink(container);
    const submitDate = extractSubmitDate(container);
    const rejectionType = extractRejectionType(container);
    const taskName = extractTaskName(container);
    const duration = extractDuration(container);
    const namaBisnis = extractBusinessName(container);

    // Deteksi tipe QA dari parameter query URL
    const urlParams = new URLSearchParams(window.location.search);
    const qaTab = urlParams.get('tab') || 'autoEpisodeQA';
    const qaType = qaTab === 'autoEpisodeQA' ? 'Auto QA' : qaTab;

    return {
      namaBisnis: namaBisnis,
      taskName: taskName,
      submitDate: submitDate,
      rejectClass: '-',
      qaTypes: qaType,
      rejectedClipLink: clipLink,
      rejectionType: rejectionType,
      rejectionCause: '-',
      disputeNote: '-',
      duration: duration
    };
  }

  // ==========================================
  // SINKRONISASI KE GOOGLE APPS SCRIPT WEBHOOK
  // ==========================================

  function sendToGoogleSheet(payload) {
    return new Promise((resolve, reject) => {
      const webhookUrl = GM_getValue(STORAGE_KEYS.WEBHOOK_URL, '');

      if (!webhookUrl || !webhookUrl.startsWith('https://script.google.com')) {
        reject(new Error('URL Webhook Google Apps Script belum diisi di Pengaturan!'));
        return;
      }

      const sheetName = GM_getValue(STORAGE_KEYS.SHEET_NAME, '');
      const body = {
        sheetName: sheetName || undefined,
        ...payload
      };

      GM_xmlhttpRequest({
        method: 'POST',
        url: webhookUrl,
        data: JSON.stringify(body),
        headers: {
          'Content-Type': 'application/json'
        },
        onload: function (response) {
          try {
            const res = JSON.parse(response.responseText);
            if (res.status === 'success' || response.status === 200) {
              resolve(res);
            } else {
              reject(new Error(res.message || 'Gagal menyimpan ke Google Sheet.'));
            }
          } catch (e) {
            // Kadang Apps Script redirect 302 dan berhasil
            if (response.status >= 200 && response.status < 400) {
              resolve({ status: 'success', message: 'Data terkirim!' });
            } else {
              reject(new Error('Respon tidak valid dari server Google: ' + response.responseText));
            }
          }
        },
        onerror: function (err) {
          reject(new Error('Koneksi internet bermasalah atau URL Webhook salah.'));
        }
      });
    });
  }

  // ==========================================
  // FITUR CLIPBOARD TSV (FALLBACK OFFLINE)
  // ==========================================

  function copyToClipboardAsTSV(rows) {
    const lines = rows.map(item => [
      item.namaBisnis,
      item.taskName,
      item.submitDate,
      item.rejectClass,
      item.qaTypes,
      item.rejectedClipLink,
      item.rejectionType,
      item.rejectionCause,
      item.disputeNote,
      item.duration
    ].join('\t'));

    const tsvString = lines.join('\n');
    if (typeof GM_setClipboard === 'function') {
      GM_setClipboard(tsvString);
    } else {
      navigator.clipboard.writeText(tsvString);
    }
  }

  // ==========================================
  // USER INTERFACE (FLOATING WIDGET)
  // ==========================================

  function createFloatingUI() {
    if (document.getElementById('atlas-qa-widget-root')) return;

    // CSS Styling
    const style = document.createElement('style');
    style.innerHTML = `
      #atlas-qa-widget-root {
        position: fixed;
        bottom: 24px;
        right: 24px;
        z-index: 999999;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        font-size: 13px;
        color: #f1f5f9;
      }
      .aqa-card {
        background: rgba(15, 23, 42, 0.95);
        backdrop-filter: blur(12px);
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 14px;
        box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.4);
        width: 310px;
        overflow: hidden;
        transition: all 0.25s ease;
      }
      .aqa-header {
        padding: 12px 16px;
        background: linear-gradient(135deg, #1e3a8a, #0f172a);
        display: flex;
        align-items: center;
        justify-content: space-between;
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      }
      .aqa-title {
        font-weight: 700;
        font-size: 13px;
        display: flex;
        align-items: center;
        gap: 6px;
        color: #60a5fa;
      }
      .aqa-badge {
        font-size: 10px;
        background: #2563eb;
        color: #fff;
        padding: 2px 6px;
        border-radius: 10px;
      }
      .aqa-body {
        padding: 14px 16px;
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .aqa-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        width: 100%;
        padding: 8px 12px;
        border-radius: 8px;
        border: none;
        font-weight: 600;
        font-size: 12.5px;
        cursor: pointer;
        transition: all 0.15s ease;
      }
      .aqa-btn-primary {
        background: #2563eb;
        color: #ffffff;
      }
      .aqa-btn-primary:hover {
        background: #1d4ed8;
      }
      .aqa-btn-emerald {
        background: #059669;
        color: #ffffff;
      }
      .aqa-btn-emerald:hover {
        background: #047857;
      }
      .aqa-btn-secondary {
        background: rgba(255, 255, 255, 0.08);
        color: #cbd5e1;
        border: 1px solid rgba(255, 255, 255, 0.1);
      }
      .aqa-btn-secondary:hover {
        background: rgba(255, 255, 255, 0.15);
        color: #ffffff;
      }
      .aqa-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      .aqa-actions-row {
        display: flex;
        gap: 8px;
      }
      .aqa-status-box {
        font-size: 11px;
        color: #94a3b8;
        padding: 6px 10px;
        background: rgba(0, 0, 0, 0.3);
        border-radius: 6px;
        border-left: 3px solid #3b82f6;
        word-break: break-word;
      }
      .aqa-toast {
        position: fixed;
        bottom: 90px;
        right: 24px;
        background: #1e293b;
        color: #fff;
        padding: 10px 16px;
        border-radius: 8px;
        font-size: 12.5px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.4);
        display: none;
        z-index: 1000000;
        border-left: 4px solid #10b981;
      }
      .aqa-settings-modal {
        display: none;
        padding: 14px 16px;
        border-top: 1px solid rgba(255, 255, 255, 0.1);
        background: rgba(0, 0, 0, 0.4);
      }
      .aqa-input-group {
        display: flex;
        flex-direction: column;
        gap: 4px;
        margin-bottom: 8px;
      }
      .aqa-input-group label {
        font-size: 11px;
        color: #94a3b8;
      }
      .aqa-input-group input {
        background: #0f172a;
        border: 1px solid rgba(255, 255, 255, 0.2);
        color: #fff;
        padding: 6px 8px;
        border-radius: 6px;
        font-size: 11.5px;
      }
    `;
    document.head.appendChild(style);

    // Root Element
    const root = document.createElement('div');
    root.id = 'atlas-qa-widget-root';

    root.innerHTML = `
      <div class="aqa-card" id="aqa-card">
        <div class="aqa-header">
          <div class="aqa-title">
            <span>⚡ Atlas QA Sync</span>
            <span class="aqa-badge" id="aqa-badge-status">Ready</span>
          </div>
          <button id="aqa-btn-toggle-settings" style="background:none; border:none; color:#94a3b8; cursor:pointer;" title="Pengaturan Webhook">⚙️</button>
        </div>

        <div class="aqa-body">
          <button id="aqa-btn-single" class="aqa-btn aqa-btn-primary">
            📌 Simpan Klip Ini ke Sheet
          </button>
          
          <button id="aqa-btn-bulk" class="aqa-btn aqa-btn-emerald">
            ⚡ Scan & Kirim Semua Baris
          </button>

          <div class="aqa-actions-row">
            <button id="aqa-btn-copy-tsv" class="aqa-btn aqa-btn-secondary" title="Salin format tabel spreadsheet">
              📋 Salin (TSV)
            </button>
            <button id="aqa-btn-preview" class="aqa-btn aqa-btn-secondary" title="Lihat pratinjau data yang terdeteksi">
              🔍 Pratinjau
            </button>
          </div>

          <div class="aqa-status-box" id="aqa-status-text">
            Siap mengambil data QA dari halaman ini.
          </div>
        </div>

        <!-- SETTINGS PANEL -->
        <div class="aqa-settings-modal" id="aqa-settings-modal">
          <div class="aqa-input-group">
            <label>Google Apps Script Webhook URL:</label>
            <input type="text" id="aqa-input-webhook" placeholder="https://script.google.com/macros/s/.../exec" />
          </div>
          <div class="aqa-input-group">
            <label>Nama Sheet / Tab (Opsional):</label>
            <input type="text" id="aqa-input-sheet" placeholder="Sheet1 (atau kosongkan)" />
          </div>
          <div class="aqa-input-group">
            <label>Default Nama Bisnis (Opsional):</label>
            <input type="text" id="aqa-input-biz" placeholder="Business" />
          </div>
          <button id="aqa-btn-save-settings" class="aqa-btn aqa-btn-primary" style="margin-top:6px;">
            Simpan Pengaturan
          </button>
        </div>
      </div>

      <div class="aqa-toast" id="aqa-toast"></div>
    `;

    document.body.appendChild(root);

    // Event Listeners
    setupUIEvents();
  }

  function showToast(msg, isSuccess = true) {
    const toast = document.getElementById('aqa-toast');
    if (!toast) return;
    toast.textContent = msg;
    toast.style.borderLeftColor = isSuccess ? '#10b981' : '#ef4444';
    toast.style.display = 'block';
    setTimeout(() => {
      toast.style.display = 'none';
    }, 3500);
  }

  function setStatus(text) {
    const el = document.getElementById('aqa-status-text');
    if (el) el.textContent = text;
  }

  function setupUIEvents() {
    const btnSingle = document.getElementById('aqa-btn-single');
    const btnBulk = document.getElementById('aqa-btn-bulk');
    const btnCopyTSV = document.getElementById('aqa-btn-copy-tsv');
    const btnPreview = document.getElementById('aqa-btn-preview');
    const btnToggleSettings = document.getElementById('aqa-btn-toggle-settings');
    const settingsModal = document.getElementById('aqa-settings-modal');
    const btnSaveSettings = document.getElementById('aqa-btn-save-settings');

    const inputWebhook = document.getElementById('aqa-input-webhook');
    const inputSheet = document.getElementById('aqa-input-sheet');
    const inputBiz = document.getElementById('aqa-input-biz');

    // Load saved settings
    inputWebhook.value = GM_getValue(STORAGE_KEYS.WEBHOOK_URL, '');
    inputSheet.value = GM_getValue(STORAGE_KEYS.SHEET_NAME, '');
    inputBiz.value = GM_getValue(STORAGE_KEYS.DEFAULT_BIZ, '');

    btnToggleSettings.addEventListener('click', () => {
      const isVisible = settingsModal.style.display === 'block';
      settingsModal.style.display = isVisible ? 'none' : 'block';
    });

    btnSaveSettings.addEventListener('click', () => {
      GM_setValue(STORAGE_KEYS.WEBHOOK_URL, inputWebhook.value.trim());
      GM_setValue(STORAGE_KEYS.SHEET_NAME, inputSheet.value.trim());
      GM_setValue(STORAGE_KEYS.DEFAULT_BIZ, inputBiz.value.trim());
      settingsModal.style.display = 'none';
      showToast('✅ Pengaturan berhasil disimpan!');
      setStatus('Webhook siap digunakan.');
    });

    // 1. SIMPAN 1 KLIP AKTIF
    btnSingle.addEventListener('click', async () => {
      btnSingle.disabled = true;
      setStatus('⏳ Membaca klip yang sedang dibuka...');
      try {
        const item = await scrapeCurrentItem(document);
        setStatus(`Kirim data: "${item.taskName}" (${item.rejectionType})...`);
        
        await sendToGoogleSheet({ action: 'appendSingle', data: item });
        showToast(`✅ Berhasil: 1 klip disimpan ke Sheet!`);
        setStatus(`✅ Tersimpan: ${item.taskName} [${item.duration}]`);
      } catch (err) {
        showToast(`❌ ${err.message}`, false);
        setStatus(`Error: ${err.message}`);
      } finally {
        btnSingle.disabled = false;
      }
    });

    // 2. SCAN SEMUA DI HALAMAN (BULK SCAN)
    btnBulk.addEventListener('click', async () => {
      btnBulk.disabled = true;
      setStatus('⏳ Memindai semua baris/klip di halaman...');
      try {
        // Cari baris-baris tabel atau daftar kartu di tab autoEpisodeQA
        let rowsElements = document.querySelectorAll('tbody tr, div[data-agentation-id]');
        
        // Filter elemen yang memiliki task name / rejection badge
        const validRows = Array.from(rowsElements).filter(el => {
          return el.querySelector('button.text-blue-600, h3, span[class*="bg-violet"]') !== null;
        });

        const itemsToSave = [];

        if (validRows.length > 0) {
          for (const row of validRows) {
            const data = await scrapeCurrentItem(row);
            if (data.taskName !== '-' && !itemsToSave.some(x => x.taskName === data.taskName && x.submitDate === data.submitDate)) {
              itemsToSave.push(data);
            }
          }
        }

        // Jika tidak ada tabel multi-baris, ambil 1 item aktif
        if (itemsToSave.length === 0) {
          const single = await scrapeCurrentItem(document);
          itemsToSave.push(single);
        }

        setStatus(`Mengirim ${itemsToSave.length} baris ke Google Sheet...`);
        await sendToGoogleSheet({ action: 'batch', rows: itemsToSave });

        showToast(`✅ Berhasil mengirim ${itemsToSave.length} baris data!`);
        setStatus(`✅ Selesai: ${itemsToSave.length} baris berhasil masuk ke Sheet.`);
      } catch (err) {
        showToast(`❌ ${err.message}`, false);
        setStatus(`Error: ${err.message}`);
      } finally {
        btnBulk.disabled = false;
      }
    });

    // 3. SALIN SEBAGAI TSV (CLIPBOARD)
    btnCopyTSV.addEventListener('click', async () => {
      setStatus('Menyalin format spreadsheet ke clipboard...');
      try {
        const item = await scrapeCurrentItem(document);
        copyToClipboardAsTSV([item]);
        showToast('📋 Berhasil disalin! Tinggal Ctrl+V di Google Sheet.');
        setStatus('Data tersalin ke clipboard (bisa langsung Ctrl+V).');
      } catch (e) {
        showToast('Gagal menyalin: ' + e.message, false);
      }
    });

    // 4. PRATINJAU DATA DETEKSI
    btnPreview.addEventListener('click', async () => {
      const item = await scrapeCurrentItem(document);
      const previewText = 
        `1. Nama Bisnis: ${item.namaBisnis}\n` +
        `2. Task Name: ${item.taskName}\n` +
        `3. Submit Date: ${item.submitDate}\n` +
        `4. Reject Class: ${item.rejectClass}\n` +
        `5. QA Types: ${item.qaTypes}\n` +
        `6. Clip Link: ${item.rejectedClipLink}\n` +
        `7. Rejection Type: ${item.rejectionType}\n` +
        `8. Rejection Cause: ${item.rejectionCause}\n` +
        `9. Dispute note: ${item.disputeNote}\n` +
        `10. Duration: ${item.duration}`;
      
      alert(`=== HASIL DETEKSI DATA QA ===\n\n${previewText}`);
      setStatus('Pratinjau data telah ditampilkan.');
    });
  }

  // Jalankan inisialisasi UI setelah halaman selesai dimuat
  setTimeout(() => {
    createFloatingUI();
  }, 1200);

})();
