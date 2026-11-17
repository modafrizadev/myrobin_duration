// ==UserScript==
// @name         Atlas Capture QA Auto-Reporter to Google Sheets
// @namespace    https://studio.atlascapture.io/
// @version      1.1.0
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
  // IKON HEROICONS SVG (BEBAS EMOTE / EMOJI)
  // ==========================================
  const ICONS = {
    sync: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>',
    cog: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
    documentPlus: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>',
    cloudUp: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 16l-4-4-4 4"/><path d="M12 12v9"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/></svg>',
    clipboard: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>',
    eye: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
    check: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
    alert: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>'
  };

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
   * Output yang diminta: "Multicam · Oct 15, 2026 7:47 AM"
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
        reject(new Error('URL Webhook Google Apps Script belum diisi di Pengaturan.'));
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
              resolve({ status: 'success', message: 'Data terkirim.' });
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
  // DESIGN SYSTEM SESUAI MYROBIN APPS
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
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
        font-size: 13px;
        color: #111827;
      }
      .aqa-card {
        background: #FFFFFF;
        border: 1.5px solid #E5DEC9;
        border-radius: 14px;
        box-shadow: 0 12px 32px rgba(27, 77, 75, 0.16), 0 2px 6px rgba(0, 0, 0, 0.05);
        width: 320px;
        overflow: hidden;
        transition: all 0.25s ease;
      }
      .aqa-header {
        padding: 12px 16px;
        background: #FAF8EE;
        display: flex;
        align-items: center;
        justify-content: space-between;
        border-bottom: 1px solid #E5DEC9;
      }
      .aqa-title {
        font-weight: 700;
        font-size: 13.5px;
        display: flex;
        align-items: center;
        gap: 8px;
        color: #1B4D4B;
      }
      .aqa-badge {
        font-size: 10.5px;
        font-weight: 600;
        background: #F4EFE6;
        color: #1B4D4B;
        border: 1px solid #E5DEC9;
        padding: 2px 8px;
        border-radius: 9999px;
      }
      .aqa-btn-icon {
        background: none;
        border: none;
        color: #64748B;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 4px;
        border-radius: 6px;
        transition: color 0.15s ease, background-color 0.15s ease;
      }
      .aqa-btn-icon:hover {
        color: #1B4D4B;
        background-color: #EFE9D9;
      }
      .aqa-body {
        padding: 14px 16px;
        display: flex;
        flex-direction: column;
        gap: 10px;
        background: #FFFFFF;
      }
      .aqa-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        width: 100%;
        padding: 9px 12px;
        border-radius: 8px;
        border: none;
        font-weight: 600;
        font-size: 12.5px;
        cursor: pointer;
        transition: all 0.15s ease;
      }
      .aqa-btn-primary {
        background: #1B4D4B;
        color: #FFFFFF;
        box-shadow: 0 2px 6px rgba(27, 77, 75, 0.2);
      }
      .aqa-btn-primary:hover {
        background: #133A38;
      }
      .aqa-btn-bulk {
        background: #3AA39E;
        color: #FFFFFF;
        box-shadow: 0 2px 6px rgba(58, 163, 158, 0.2);
      }
      .aqa-btn-bulk:hover {
        background: #2D8581;
      }
      .aqa-btn-secondary {
        background: #FAF8F2;
        color: #111827;
        border: 1px solid #E5DEC9;
      }
      .aqa-btn-secondary:hover {
        background: #F1ECE0;
        border-color: #1B4D4B;
        color: #1B4D4B;
      }
      .aqa-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      .aqa-actions-row {
        display: flex;
        gap: 8px;
      }
      .aqa-actions-row .aqa-btn {
        flex: 1;
      }
      .aqa-status-box {
        font-size: 11.5px;
        color: #475569;
        padding: 8px 10px;
        background: #FBF8EE;
        border-radius: 6px;
        border: 1px solid #E5DEC9;
        border-left: 3.5px solid #3AA39E;
        word-break: break-word;
        line-height: 1.4;
      }
      .aqa-toast {
        position: fixed;
        bottom: 90px;
        right: 24px;
        background: #14532D;
        color: #FFFFFF;
        padding: 10px 16px;
        border-radius: 8px;
        font-size: 12.5px;
        font-weight: 500;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
        display: none;
        z-index: 1000000;
        border-left: 4px solid #4ADE80;
        max-width: 320px;
        line-height: 1.4;
      }
      .aqa-settings-modal {
        display: none;
        padding: 14px 16px;
        border-top: 1px solid #E5DEC9;
        background: #FAF8F2;
      }
      .aqa-input-group {
        display: flex;
        flex-direction: column;
        gap: 5px;
        margin-bottom: 10px;
      }
      .aqa-input-group label {
        font-size: 11px;
        font-weight: 600;
        color: #475569;
      }
      .aqa-input-group input {
        background: #FFFFFF;
        border: 1px solid #D6CDC0;
        color: #111827;
        padding: 7px 9px;
        border-radius: 6px;
        font-size: 11.5px;
        outline: none;
        transition: border-color 0.15s ease;
      }
      .aqa-input-group input:focus {
        border-color: #1B4D4B;
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
            <span style="display:inline-flex; align-items:center; color:#1B4D4B;">${ICONS.sync}</span>
            <span>Atlas QA Sync</span>
            <span class="aqa-badge" id="aqa-badge-status">Siap</span>
          </div>
          <button id="aqa-btn-toggle-settings" class="aqa-btn-icon" title="Pengaturan Webhook">
            ${ICONS.cog}
          </button>
        </div>

        <div class="aqa-body">
          <button id="aqa-btn-single" class="aqa-btn aqa-btn-primary">
            ${ICONS.documentPlus}
            <span>Simpan Klip Ini ke Sheet</span>
          </button>
          
          <button id="aqa-btn-bulk" class="aqa-btn aqa-btn-bulk">
            ${ICONS.cloudUp}
            <span>Pindai & Kirim Semua Baris</span>
          </button>

          <div class="aqa-actions-row">
            <button id="aqa-btn-copy-tsv" class="aqa-btn aqa-btn-secondary" title="Salin format tabel spreadsheet">
              ${ICONS.clipboard}
              <span>Salin (TSV)</span>
            </button>
            <button id="aqa-btn-preview" class="aqa-btn aqa-btn-secondary" title="Lihat pratinjau data yang terdeteksi">
              ${ICONS.eye}
              <span>Pratinjau</span>
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
    if (isSuccess) {
      toast.style.background = '#14532D';
      toast.style.borderLeftColor = '#4ADE80';
      toast.style.color = '#FFFFFF';
    } else {
      toast.style.background = '#991B1B';
      toast.style.borderLeftColor = '#F87171';
      toast.style.color = '#FFFFFF';
    }
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
      showToast('Pengaturan berhasil disimpan.');
      setStatus('Webhook siap digunakan.');
    });

    // 1. SIMPAN 1 KLIP AKTIF
    btnSingle.addEventListener('click', async () => {
      btnSingle.disabled = true;
      setStatus('Membaca klip yang sedang dibuka...');
      try {
        const item = await scrapeCurrentItem(document);
        setStatus(`Mengirim data: "${item.taskName}" (${item.rejectionType})...`);
        
        await sendToGoogleSheet({ action: 'appendSingle', data: item });
        showToast('Klip berhasil disimpan ke Google Sheet.');
        setStatus(`Tersimpan: ${item.taskName} [${item.duration}]`);
      } catch (err) {
        showToast(`Gagal: ${err.message}`, false);
        setStatus(`Kendala: ${err.message}`);
      } finally {
        btnSingle.disabled = false;
      }
    });

    // 2. SCAN SEMUA DI HALAMAN (BULK SCAN)
    btnBulk.addEventListener('click', async () => {
      btnBulk.disabled = true;
      setStatus('Memindai semua baris atau klip di halaman...');
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

        showToast(`Berhasil mengirim ${itemsToSave.length} baris data.`);
        setStatus(`Selesai: ${itemsToSave.length} baris berhasil masuk ke Sheet.`);
      } catch (err) {
        showToast(`Gagal: ${err.message}`, false);
        setStatus(`Kendala: ${err.message}`);
      } finally {
        btnBulk.disabled = false;
      }
    });

    // 3. SALIN SEBAGAI TSV (CLIPBOARD)
    btnCopyTSV.addEventListener('click', async () => {
      setStatus('Menyalin format spreadsheet ke papan klip...');
      try {
        const item = await scrapeCurrentItem(document);
        copyToClipboardAsTSV([item]);
        showToast('Data tersalin ke papan klip. Buka Google Sheet dan tekan Ctrl+V.');
        setStatus('Data tersalin ke papan klip (bisa langsung Ctrl+V).');
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
      
      alert(`=== PRATINJAU DATA QA ===\n\n${previewText}`);
      setStatus('Pratinjau data telah ditampilkan.');
    });
  }

  // Jalankan inisialisasi UI setelah halaman selesai dimuat
  setTimeout(() => {
    createFloatingUI();
  }, 1200);

})();
