// ==UserScript==
// @name         Atlas Capture QA Auto-Reporter to Google Sheets
// @namespace    https://studio.atlascapture.io/
// @version      5.1.0
// @description  Episode Scrapper v5.1: Targeted Precision Date Range Scraper dengan Multi-UMKM Otomatis, Live Progress Ditelusuri & Cocok, Verification Flow, Lebar Window Fleksibel, dan Zero Emotikon
// @author       Antigravity
// @match        https://studio.atlascapture.io/*
// @grant        unsafeWindow
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_setClipboard
// @connect      script.google.com
// @connect      script.googleusercontent.com
// @run-at       document-start
// ==/UserScript==

(function () {
  'use strict';

  // ==========================================
  // KONFIGURASI DEFAULT & STATE
  // ==========================================
  const STORAGE_KEYS = {
    WEBHOOK_URL: 'atlas_qa_webhook_url',
    SHEET_NAME: 'atlas_qa_sheet_name',
    DATE_START: 'atlas_qa_date_start',
    DATE_END: 'atlas_qa_date_end',
    CUSTOM_BIZ_NAME: 'atlas_qa_custom_biz_name',
    WIDGET_WIDTH: 'atlas_qa_widget_width'
  };

  const win = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;

  const state = {
    allEpisodes: new Map(), // Seluruh episode dari DB yang ditelusuri (id -> ep)
    episodes: new Map(),    // Episode yang cocok dengan filter tanggal (id -> ep)
    businessId: '',
    userGroupId: '',
    businessName: '',       // Diambil langsung dari <h1>
    bucket: 'P0',
    isScrapingRunning: false,
    stopRequested: false,
    isOnBusinessPage: false
  };

  // ==========================================
  // IKON HEROICONS SVG (BEBAS EMOTE / EMOJI)
  // ==========================================
  const ICONS = {
    sync: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>',
    cog: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
    building: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"/><line x1="9" y1="22" x2="9" y2="22.01"/><line x1="15" y1="22" x2="15" y2="22.01"/><line x1="9" y1="6" x2="9" y2="6.01"/><line x1="15" y1="6" x2="15" y2="6.01"/><line x1="9" y1="10" x2="9" y2="10.01"/><line x1="15" y1="10" x2="15" y2="10.01"/><line x1="9" y1="14" x2="9" y2="14.01"/><line x1="15" y1="14" x2="15" y2="14.01"/><line x1="9" y1="18" x2="9" y2="18.01"/><line x1="15" y1="18" x2="15" y2="18.01"/></svg>',
    search: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
    calendar: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
    clipboard: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>',
    send: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>',
    stop: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="6" width="12" height="12" rx="2" ry="2"/></svg>',
    check: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
    alert: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
    refresh: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>',
    close: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
    help: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
    chevronDown: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>',
    chevronUp: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>',
    arrowRight: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>'
  };

  // ==========================================
  // HELPER FORMAT & UTILITY (NAMA BISNIS DARI <h1>)
  // ==========================================

  // Deteksi nama UMKM langsung dari elemen <h1> (contoh: <h1 class="text-3xl font-bold text-gray-900">Kedai QQ</h1>)
  function detectBusinessName() {
    const custom = GM_getValue(STORAGE_KEYS.CUSTOM_BIZ_NAME, '');
    if (custom) return custom;

    // 1. Prioritas Utama: Elemen <h1> seperti di halaman Atlas
    const h1 = document.querySelector('h1[data-agentation-id], h1.text-3xl, h1');
    if (h1 && h1.textContent.trim()) {
      const txt = h1.textContent.trim();
      if (!txt.toLowerCase().includes('dashboard') && !txt.toLowerCase().includes('atlas')) {
        state.businessName = txt;
        return txt;
      }
    }

    // 2. Fallback: Breadcrumb DOM
    const breadcrumbLinks = Array.from(document.querySelectorAll('nav a, nav span, header a, header span, div[class*="breadcrumb"] *'));
    const bizIdx = breadcrumbLinks.findIndex(el => el.textContent.trim().toLowerCase() === 'business');
    if (bizIdx !== -1) {
      for (let i = bizIdx + 1; i < Math.min(bizIdx + 4, breadcrumbLinks.length); i++) {
        const txt = breadcrumbLinks[i].textContent.trim();
        if (txt && !txt.includes('/') && !txt.includes('>') && txt.length > 1 && txt.length < 50) {
          state.businessName = txt;
          return txt;
        }
      }
    }

    // 3. Fallback: document.title
    if (document.title && document.title.includes('·')) {
      const txt = document.title.split('·')[0].trim();
      if (txt) {
        state.businessName = txt;
        return txt;
      }
    }

    return state.businessName || '';
  }

  function parseDashboardUrl() {
    try {
      const parts = window.location.pathname.split('/').filter(Boolean);
      const bizIdx = parts.indexOf('business');
      if (bizIdx !== -1 && parts[bizIdx + 2]) {
        state.userGroupId = parts[bizIdx + 1];
        state.businessId = parts[bizIdx + 2];
        state.isOnBusinessPage = true;
      } else {
        state.isOnBusinessPage = false;
      }
      state.businessName = detectBusinessName();
    } catch (e) {
      state.isOnBusinessPage = false;
    }
  }

  function snakeToTitle(str) {
    if (!str || typeof str !== 'string') return '-';
    return str
      .split('_')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');
  }

  function formatDuration(durationHours) {
    if (typeof durationHours !== 'number' || isNaN(durationHours) || durationHours <= 0) {
      return '1:48';
    }
    const totalSec = Math.round(durationHours * 3600);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  function formatSubmitDate(isoString, projectName) {
    let camName = 'Multicam';
    if (projectName && typeof projectName === 'string') {
      const parts = projectName.split('/');
      camName = parts[parts.length - 1].trim();
    }
    if (!isoString) return camName;
    try {
      const d = new Date(isoString);
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const m = months[d.getMonth()];
      const day = d.getDate();
      const y = d.getFullYear();
      let hr = d.getHours();
      const min = d.getMinutes().toString().padStart(2, '0');
      const ampm = hr >= 12 ? 'PM' : 'AM';
      hr = hr % 12 || 12;
      return `${camName} · ${m} ${day}, ${y} ${hr}:${min} ${ampm}`;
    } catch (e) {
      return camName;
    }
  }

  function buildClipUrl(episodeId) {
    parseDashboardUrl();
    const ugId = state.userGroupId || '69fc6c78bb0a6298ce6916e9';
    const bId = state.businessId || '6a60c310ffc3bc5072f378ed';
    return `https://studio.atlascapture.io/dashboard/business/${ugId}/${bId}?tab=autoEpisodeQA&autoEpisodeQaEpisode=${episodeId}`;
  }

  function getLocalDateString(isoStr) {
    if (!isoStr) return '';
    const d = new Date(isoStr);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function isDateInRange(isoStr, startStr, endStr) {
    if (!isoStr) return false;
    const dateStr = getLocalDateString(isoStr);
    if (startStr && dateStr < startStr) return false;
    if (endStr && dateStr > endStr) return false;
    return true;
  }

  function transformEpisodeToRow(ep) {
    parseDashboardUrl();
    const namaBisnis = ep.businessName || state.businessName || detectBusinessName() || 'Kedai QQ';

    let taskName = ep.taskTitle || ep.subjectLabel || 'Business Task';
    if (ep.part != null && ep.partTotal != null) {
      taskName = `${taskName} · Part ${ep.part}/${ep.partTotal}`;
    }

    const submitDate = formatSubmitDate(ep.createdAt, ep.projectName);
    const rejectClass = ep.bucket || state.bucket || 'P0';
    const qaTypes = 'Auto QA';
    const rejectedClipLink = buildClipUrl(ep.id || ep.episodeId);

    const rawReason = ep.selectedReason || (ep.rejectionReasons && ep.rejectionReasons[0]) || 'hands_not_in_frame';
    const rejectionType = snakeToTitle(rawReason);

    let rejectionCause = '-';
    if (ep.handsNotInFrameFailures && ep.handsNotInFrameFailures.length > 0) {
      rejectionCause = ep.handsNotInFrameFailures.map(snakeToTitle).join(', ');
    } else if (ep.geminiReasonDetails && ep.geminiReasonDetails.length > 0) {
      rejectionCause = ep.geminiReasonDetails[0].reason || '-';
    } else if (ep.rejectionReasons && ep.rejectionReasons.length > 1) {
      rejectionCause = ep.rejectionReasons.slice(1).map(snakeToTitle).join(', ');
    }

    let disputeNote = '-';
    if (ep.canDispute === false) {
      disputeNote = 'Cannot Dispute';
    } else if (ep.submitterNote) {
      disputeNote = ep.submitterNote;
    }

    const duration = formatDuration(ep.durationHours);

    return {
      namaBisnis,
      taskName,
      submitDate,
      rejectClass,
      qaTypes,
      rejectedClipLink,
      rejectionType,
      rejectionCause,
      disputeNote,
      duration,
      _raw: ep
    };
  }

  // ==========================================
  // TARGETED SCRAPING ENGINE DENGAN LIVE PROGRESS
  // ==========================================

  async function runTargetedScraper(startDate, endDate) {
    state.isScrapingRunning = true;
    state.stopRequested = false;
    state.allEpisodes.clear();
    state.episodes.clear();

    parseDashboardUrl();
    const bId = state.businessId || '6a60c310ffc3bc5072f378ed';

    const discoveredReasons = new Set([
      'hands_not_in_frame',
      'device_usage',
      'children_in_frame',
      'child_in_frame',
      'non_meaningful_task',
      'task_not_meaningful',
      'non_meaningful',
      'blurry_dirty_lens',
      'blurry_lens',
      'dirty_lens',
      'lens_blurry_dirty',
      'bad_lighting',
      'poor_lighting',
      'illegal_substances_activity',
      'illegal_substances',
      'banned_task',
      'nsfw',
      'image_quality_camera_broken',
      'camera_broken',
      'broken_camera',
      'camera_broken_image_quality'
    ]);

    function extractCodes(val) {
      if (!val) return;
      if (typeof val === 'string') {
        const v = val.toLowerCase().trim();
        if ((/^[a-z]+(_[a-z0-9]+)+$/.test(v) || v === 'nsfw') && v.length < 40) {
          if (!['auto_episode_qa', 'user_task', 'batch_link', 'rejected', 'approved'].includes(v)) {
            discoveredReasons.add(v);
          }
        }
      } else if (Array.isArray(val)) {
        val.forEach(extractCodes);
      } else if (typeof val === 'object') {
        for (const k in val) {
          const kLow = k.toLowerCase().trim();
          if ((/^[a-z]+(_[a-z0-9]+)+$/.test(kLow) || kLow === 'nsfw') && kLow.length < 40) {
            discoveredReasons.add(kLow);
          }
          extractCodes(val[k]);
        }
      }
    }

    try {
      const entries = performance.getEntriesByType('resource').filter(r => r.name.includes('/api/trpc/'));
      for (const e of entries) {
        try {
          const res = await win.fetch(e.name, { credentials: 'include' });
          const text = await res.text();
          if (text.includes('Non-Meaningful') || text.includes('Children') || text.includes('Blurry') || text.includes('146')) {
            const json = JSON.parse(text);
            extractCodes(json);
          }
        } catch(err) {}
      }
    } catch(err) {}

    const reasonList = Array.from(discoveredReasons);
    setStatus(`Memulai pemindaian... Meneliti ${reasonList.length} kategori alasan.`);
    updateProgressUI();

    for (const code of reasonList) {
      if (state.stopRequested) break;
      let cursor = null;
      let page = 1;
      let countForCode = 0;

      while (!state.stopRequested) {
        const inputObj = {
          "0": {
            "json": {
              "businessId": bId,
              "reason": code,
              "bucket": "P0",
              "additionalReasons": null,
              "projectId": null,
              "startDate": null,
              "endDate": null,
              "limit": 50,
              "direction": "forward"
            },
            "meta": {
              "values": {
                "additionalReasons": ["undefined"],
                "projectId": ["undefined"],
                "startDate": ["undefined"],
                "endDate": ["undefined"]
              },
              "v": 1
            }
          }
        };

        if (cursor) {
          inputObj["0"].json.cursor = cursor;
          inputObj["0"].meta.values["cursor.createdAt"] = ["Date"];
        }

        const input = encodeURIComponent(JSON.stringify(inputObj));
        const res = await win.fetch(`/api/trpc/userGroup.getBusinessRejectedEpisodesForReason?batch=1&input=${input}`, { credentials: 'include' });

        if (!res.ok) break;

        const json = await res.json();
        const data = json[0]?.result?.data?.json;
        const eps = data?.episodes || [];
        if (eps.length === 0) break;

        for (const ep of eps) {
          state.allEpisodes.set(ep.id, ep);
          if (isDateInRange(ep.createdAt, startDate, endDate)) {
            state.episodes.set(ep.id, ep);
          }
        }

        countForCode += eps.length;
        updateProgressUI();
        setStatus(`[${snakeToTitle(code)}] Hal ${page} | Ditelusuri: ${state.allEpisodes.size} | Cocok: ${state.episodes.size}`);

        if (!data.nextCursor) break;
        cursor = data.nextCursor;
        page++;
        await new Promise(r => setTimeout(r, 60));
      }
    }

    state.isScrapingRunning = false;
    updateProgressUI();
  }

  // ==========================================
  // GOOGLE APPS SCRIPT WEBHOOK SYNC
  // ==========================================
  function sendToGoogleSheet(rows) {
    return new Promise((resolve, reject) => {
      const webhookUrl = GM_getValue(STORAGE_KEYS.WEBHOOK_URL, '');
      if (!webhookUrl || !webhookUrl.startsWith('https://script.google.com')) {
        reject(new Error('URL Webhook Google Apps Script belum diisi di Pengaturan.'));
        return;
      }

      const sheetName = GM_getValue(STORAGE_KEYS.SHEET_NAME, '');
      const body = {
        sheetName: sheetName || undefined,
        action: 'batch',
        rows: rows,
        items: rows
      };

      GM_xmlhttpRequest({
        method: 'POST',
        url: webhookUrl,
        data: JSON.stringify(body),
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        onload: function (response) {
          try {
            const res = JSON.parse(response.responseText);
            if (res.status === 'success' || response.status === 200) {
              resolve(res);
            } else {
              reject(new Error(res.message || 'Gagal menyimpan ke Google Sheet.'));
            }
          } catch (e) {
            if (response.status >= 200 && response.status < 400) {
              resolve({ status: 'success', message: 'Data terkirim.' });
            } else {
              reject(new Error(`Respon server (${response.status}): ${response.responseText ? response.responseText.slice(0, 100) : 'Tidak ada respon'}`));
            }
          }
        },
        onerror: function (err) {
          reject(new Error('Koneksi internet bermasalah atau URL Webhook salah: ' + (err?.error || 'Network Error')));
        }
      });
    });
  }

  // ==========================================
  // LIVE PROGRESS & STATUS UPDATE
  // ==========================================

  function updateProgressUI() {
    // 1. Update status badge di header
    const badge = document.getElementById('aqa-badge-status');
    if (badge) {
      if (state.isScrapingRunning) {
        badge.textContent = 'Memindai...';
      } else if (state.episodes.size > 0) {
        badge.textContent = `${state.episodes.size} Cocok`;
      } else if (state.isOnBusinessPage) {
        badge.textContent = 'Pilih Tanggal & Pindai';
      } else {
        badge.textContent = 'Buka Halaman Bisnis';
      }
    }

    // 2. Update kartu UMKM
    const bizActiveView = document.getElementById('aqa-biz-active-view');
    const bizGuidanceView = document.getElementById('aqa-biz-guidance-view');
    const bizNameEl = document.getElementById('aqa-biz-name');
    const bizHintEl = document.getElementById('aqa-biz-state-hint');

    const detectedBiz = state.businessName || detectBusinessName();

    if (state.isOnBusinessPage && detectedBiz) {
      if (bizActiveView) bizActiveView.style.display = 'flex';
      if (bizGuidanceView) bizGuidanceView.style.display = 'none';
      if (bizNameEl) bizNameEl.textContent = detectedBiz;
      if (bizHintEl) {
        if (state.isScrapingRunning) {
          bizHintEl.textContent = 'Sedang memindai episode penolakan dari database...';
        } else if (state.episodes.size > 0) {
          bizHintEl.textContent = `${state.episodes.size} episode cocok siap disalin atau dikirim ke Sheet.`;
        } else {
          bizHintEl.textContent = 'Pilih rentang tanggal di bawah lalu klik Mulai Pindai.';
        }
      }
    } else {
      if (bizActiveView) bizActiveView.style.display = 'none';
      if (bizGuidanceView) bizGuidanceView.style.display = 'flex';
    }

    // 3. Update 2 baris keterangan metrik
    const statScanned = document.getElementById('aqa-stat-scanned');
    if (statScanned) {
      statScanned.textContent = `${state.allEpisodes.size}`;
    }
    const statMatched = document.getElementById('aqa-stat-matched');
    if (statMatched) {
      statMatched.textContent = `${state.episodes.size}`;
    }
  }

  function setStatus(text) {
    const el = document.getElementById('aqa-status-text');
    if (el) el.textContent = text;
  }

  // NOTIFIKASI DI ATAS LAYAR (TOP NOTIFICATION BANNER)
  function showTopNotification(msg, isSuccess = true) {
    let banner = document.getElementById('aqa-top-banner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'aqa-top-banner';
      document.body.appendChild(banner);
    }

    banner.innerHTML = `
      <div style="display:flex; align-items:center; gap:10px;">
        <span style="display:inline-flex; align-items:center;">${isSuccess ? ICONS.check : ICONS.alert}</span>
        <span>${msg}</span>
      </div>
      <button id="aqa-top-banner-close" style="background:none; border:none; color:#FFFFFF; cursor:pointer; padding:4px; display:flex; align-items:center; justify-content:center; opacity:0.85;" title="Tutup">
        ${ICONS.close}
      </button>
    `;

    banner.className = isSuccess ? 'aqa-top-success' : 'aqa-top-error';
    banner.style.display = 'flex';

    document.getElementById('aqa-top-banner-close').onclick = () => {
      banner.style.display = 'none';
    };

    setTimeout(() => {
      if (banner) banner.style.display = 'none';
    }, 7000);
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
    setTimeout(() => { toast.style.display = 'none'; }, 4000);
  }

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
      const ta = document.createElement('textarea');
      ta.value = tsvString;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
  }

  // ==========================================
  // FLOW VERIFIKASI SEBELUM KIRIM
  // ==========================================
  function showReviewDialog(rows, startDate, endDate, onRetry, onConfirmSend) {
    let overlay = document.getElementById('aqa-modal-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'aqa-modal-overlay';
      document.body.appendChild(overlay);
    }

    const currentBiz = state.businessName || detectBusinessName() || 'Kedai QQ';

    overlay.innerHTML = `
      <div class="aqa-dialog-box">
        <div class="aqa-dialog-header">
          <div style="display:flex; align-items:center; gap:8px;">
            <span style="display:inline-flex; align-items:center;">${ICONS.clipboard}</span>
            <span>Verifikasi Hasil Pemindaian</span>
          </div>
          <span style="font-size:11px; background:#FAF8EE; border:1px solid #E5DEC9; color:#1B4D4B; padding:2px 8px; border-radius:9999px; font-weight:600;">Langkah 2/3</span>
        </div>

        <div class="aqa-dialog-body">
          <div style="font-size:13.5px; font-weight:700; color:#1B4D4B; margin-bottom:6px; display:flex; align-items:center; gap:6px;">
            <span>${ICONS.building}</span>
            <span>${currentBiz}</span>
          </div>
          <div style="font-size:12px; color:#64748B; margin-bottom:12px; display:flex; align-items:center; gap:6px;">
            <span>${ICONS.calendar}</span>
            <span>Rentang Target: <b>${startDate}</b> s/d <b>${endDate}</b></span>
          </div>

          <div class="aqa-stats-row" style="margin-bottom:14px;">
            <div class="aqa-stat-box">
              <div class="aqa-stat-val" style="color:#1B4D4B;">${state.allEpisodes.size}</div>
              <div class="aqa-stat-lbl">Total Ditelusuri</div>
            </div>
            <div class="aqa-stat-box">
              <div class="aqa-stat-val" style="color:#3AA39E;">${rows.length}</div>
              <div class="aqa-stat-lbl">Cocok Rentang</div>
            </div>
          </div>

          <div style="font-size:12px; line-height:1.5; color:#475569; background:#FBF8EE; padding:10px 12px; border-radius:8px; border:1px solid #E5DEC9; border-left:3.5px solid #3AA39E;">
            Pastikan data di atas sudah sesuai sebelum dikirim ke Google Sheet:
            <div style="font-size:11.5px; color:#64748B; margin-top:4px;">
              • Klik <b>"Kirim ke Sheet"</b> jika data sudah sesuai.<br>
              • Klik <b>"Ulang Pindai"</b> jika data masih belum lengkap.
            </div>
          </div>
        </div>

        <div class="aqa-dialog-footer">
          <button id="aqa-dialog-btn-retry" class="aqa-btn aqa-btn-secondary" style="flex:1;">
            ${ICONS.refresh}
            <span>Ulang Pindai</span>
          </button>
          <button id="aqa-dialog-btn-confirm" class="aqa-btn aqa-btn-emerald" style="flex:1.4;">
            ${ICONS.send}
            <span>Kirim ke Sheet</span>
          </button>
        </div>
      </div>
    `;

    overlay.style.display = 'flex';

    document.getElementById('aqa-dialog-btn-retry').onclick = () => {
      overlay.style.display = 'none';
      if (onRetry) onRetry();
    };

    document.getElementById('aqa-dialog-btn-confirm').onclick = () => {
      overlay.style.display = 'none';
      if (onConfirmSend) onConfirmSend();
    };
  }

  // ==========================================
  // MODAL PANDUAN / TUTORIAL CEPAT
  // ==========================================
  function showHelpModal() {
    let overlay = document.getElementById('aqa-help-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'aqa-help-overlay';
      document.body.appendChild(overlay);
    }

    overlay.innerHTML = `
      <div class="aqa-dialog-box">
        <div class="aqa-dialog-header">
          <div style="display:flex; align-items:center; gap:8px;">
            <span style="display:inline-flex; align-items:center; color:#1B4D4B;">${ICONS.help}</span>
            <span>Panduan Episode Scrapper v5.1</span>
          </div>
          <button id="aqa-help-close-x" class="aqa-btn-icon" title="Tutup">${ICONS.close}</button>
        </div>

        <div class="aqa-dialog-body" style="display:flex; flex-direction:column; gap:12px; font-size:12px; color:#334155; line-height:1.5;">
          <div style="display:flex; gap:10px; align-items:flex-start;">
            <div style="background:#FAF8EE; border:1px solid #E5DEC9; color:#1B4D4B; font-weight:700; width:22px; height:22px; border-radius:50%; display:flex; align-items:center; justify-content:center; flex-shrink:0;">1</div>
            <div><b>Buka Halaman Bisnis UMKM</b><br>Pastikan Anda membuka URL bisnis di Atlas Studio (contoh: <code>/dashboard/business/...</code>). Widget akan otomatis mendeteksi nama UMKM.</div>
          </div>
          <div style="display:flex; gap:10px; align-items:flex-start;">
            <div style="background:#FAF8EE; border:1px solid #E5DEC9; color:#1B4D4B; font-weight:700; width:22px; height:22px; border-radius:50%; display:flex; align-items:center; justify-content:center; flex-shrink:0;">2</div>
            <div><b>Pilih Rentang Tanggal</b><br>Tentukan tanggal awal dan akhir episode rekaman yang ingin discrap.</div>
          </div>
          <div style="display:flex; gap:10px; align-items:flex-start;">
            <div style="background:#FAF8EE; border:1px solid #E5DEC9; color:#1B4D4B; font-weight:700; width:22px; height:22px; border-radius:50%; display:flex; align-items:center; justify-content:center; flex-shrink:0;">3</div>
            <div><b>Klik "Mulai Pindai Sesuai Tanggal"</b><br>Sistem menyisir database background secara cerdas di seluruh kategori penolakan.</div>
          </div>
          <div style="display:flex; gap:10px; align-items:flex-start;">
            <div style="background:#FAF8EE; border:1px solid #E5DEC9; color:#1B4D4B; font-weight:700; width:22px; height:22px; border-radius:50%; display:flex; align-items:center; justify-content:center; flex-shrink:0;">4</div>
            <div><b>Salin atau Kirim ke Sheet</b><br>Gunakan tombol <b>Kirim ke Sheet</b> untuk mengirim instan, atau <b>Salin (TSV)</b> untuk langsung tempel (Ctrl+V) ke spreadsheet.</div>
          </div>
        </div>

        <div class="aqa-dialog-footer">
          <button id="aqa-help-close-btn" class="aqa-btn aqa-btn-emerald" style="width:100%;">
            Tutup Panduan
          </button>
        </div>
      </div>
    `;

    overlay.style.display = 'flex';

    const closeHelp = () => { overlay.style.display = 'none'; };
    document.getElementById('aqa-help-close-x').onclick = closeHelp;
    document.getElementById('aqa-help-close-btn').onclick = closeHelp;
  }

  // ==========================================
  // FLOATING UI UTAMA (TOP-TO-BOTTOM FLOW)
  // ==========================================

  function createFloatingUI() {
    if (document.getElementById('atlas-qa-widget-root')) return;

    const savedWidth = parseInt(GM_getValue(STORAGE_KEYS.WIDGET_WIDTH, '340'), 10) || 340;

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
        width: ${savedWidth}px;
        overflow: hidden;
        transition: width 0.15s ease;
      }
      .aqa-header {
        padding: 10px 14px;
        background: #FAF8EE;
        display: flex;
        align-items: center;
        justify-content: space-between;
        border-bottom: 1px solid #E5DEC9;
      }
      .aqa-title {
        font-weight: 700;
        font-size: 12.5px;
        display: flex;
        align-items: center;
        gap: 7px;
        color: #1B4D4B;
      }
      .aqa-header-right {
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .aqa-badge {
        font-size: 11px;
        background: #F4EFE6;
        color: #1B4D4B;
        border: 1px solid #E5DEC9;
        padding: 2px 8px;
        border-radius: 9999px;
        font-weight: 600;
        white-space: nowrap;
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
        transition: all 0.15s ease;
      }
      .aqa-btn-icon:hover {
        color: #1B4D4B;
        background-color: #EFE9D9;
      }
      .aqa-body {
        padding: 12px 14px;
        display: flex;
        flex-direction: column;
        gap: 10px;
        background: #FFFFFF;
      }

      /* KARTU STATUS UMKM / PANDUAN NAVIGASI */
      .aqa-biz-card {
        padding: 8px 10px;
        border-radius: 8px;
        border: 1px solid #E5DEC9;
        display: flex;
        align-items: flex-start;
        gap: 8px;
      }
      .aqa-biz-card--guidance {
        background: #FFFDF5;
        border-color: #F8DE85;
      }
      .aqa-biz-card--guidance .aqa-biz-icon {
        color: #B45309;
        margin-top: 1px;
      }
      .aqa-biz-card--guidance .aqa-biz-title {
        font-size: 11.5px;
        font-weight: 700;
        color: #92400E;
      }
      .aqa-biz-card--guidance .aqa-biz-subtitle {
        font-size: 10.5px;
        color: #78350F;
        margin-top: 2px;
      }

      .aqa-biz-card--active {
        background: #FAF8EE;
        border-color: #E5DEC9;
      }
      .aqa-biz-card--active .aqa-biz-icon {
        color: #1B4D4B;
        margin-top: 2px;
      }
      .aqa-biz-card--active .aqa-biz-label {
        font-size: 9.5px;
        font-weight: 600;
        color: #64748B;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      .aqa-biz-card--active .aqa-biz-title {
        font-size: 13px;
        font-weight: 700;
        color: #1B4D4B;
        line-height: 1.2;
      }
      .aqa-biz-card--active .aqa-biz-subtitle {
        font-size: 10.5px;
        color: #475569;
        margin-top: 2px;
      }

      /* DATE RANGE SELECTOR */
      .aqa-date-box {
        display: flex;
        gap: 8px;
        background: #FAF8F2;
        padding: 8px 10px;
        border-radius: 8px;
        border: 1px solid #E5DEC9;
      }
      .aqa-date-field {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 3px;
      }
      .aqa-date-field label {
        font-size: 10.5px;
        color: #475569;
        font-weight: 600;
      }
      .aqa-date-field input {
        background: #FFFFFF;
        border: 1px solid #D6CDC0;
        color: #111827;
        padding: 5px 7px;
        border-radius: 6px;
        font-size: 11.5px;
        outline: none;
        width: 100%;
        box-sizing: border-box;
        transition: border-color 0.15s ease;
      }
      .aqa-date-field input:focus {
        border-color: #1B4D4B;
      }

      /* METRIK 2 KETERANGAN BERURUTAN */
      .aqa-metrics-container {
        background: #FAF8F2;
        border: 1px solid #E5DEC9;
        border-radius: 8px;
        padding: 8px 10px;
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .aqa-metric-row {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 11.5px;
        color: #334155;
      }
      .aqa-metric-dot {
        width: 7px;
        height: 7px;
        border-radius: 50%;
        flex-shrink: 0;
      }
      .aqa-metric-dot.dot-scanned {
        background: #1B4D4B;
      }
      .aqa-metric-dot.dot-matched {
        background: #3AA39E;
      }
      .aqa-metric-row strong {
        font-weight: 700;
        color: #111827;
      }

      /* TOMBOL AKSI */
      .aqa-btn {
        width: 100%;
        padding: 8px 12px;
        border-radius: 8px;
        font-weight: 600;
        font-size: 12px;
        cursor: pointer;
        border: none;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        transition: all 0.15s ease;
      }
      .aqa-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      .aqa-btn-emerald {
        background: #1B4D4B;
        color: #FFFFFF;
        box-shadow: 0 2px 6px rgba(27, 77, 75, 0.2);
      }
      .aqa-btn-emerald:hover {
        background: #133A38;
      }
      .aqa-btn-danger {
        background: #991B1B;
        color: #FFFFFF;
        box-shadow: 0 2px 6px rgba(153, 27, 27, 0.2);
      }
      .aqa-btn-danger:hover {
        background: #7F1D1D;
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
      .aqa-actions-row {
        display: flex;
        gap: 8px;
      }
      .aqa-status-box {
        font-size: 11px;
        color: #475569;
        padding: 7px 9px;
        background: #FBF8EE;
        border-radius: 6px;
        border: 1px solid #E5DEC9;
        border-left: 3.5px solid #3AA39E;
        word-break: break-word;
        line-height: 1.4;
      }

      /* FOOTER TOGGLE PENGATURAN DI PALING BAWAH */
      .aqa-footer-settings {
        border-top: 1px solid #E5DEC9;
        background: #FAF8EE;
      }
      .aqa-settings-toggle-btn {
        width: 100%;
        padding: 8px 12px;
        background: none;
        border: none;
        display: flex;
        align-items: center;
        justify-content: space-between;
        font-size: 11.5px;
        font-weight: 600;
        color: #475569;
        cursor: pointer;
        transition: background-color 0.15s ease, color 0.15s ease;
      }
      .aqa-settings-toggle-btn:hover {
        background-color: #F1ECE0;
        color: #1B4D4B;
      }
      .aqa-settings-modal {
        display: none;
        padding: 12px 14px;
        border-top: 1px solid #E5DEC9;
        background: #FAF8F2;
      }
      .aqa-input-group {
        display: flex;
        flex-direction: column;
        gap: 4px;
        margin-bottom: 8px;
      }
      .aqa-input-group label {
        font-size: 11px;
        font-weight: 600;
        color: #475569;
      }
      .aqa-input-group input[type="text"] {
        background: #FFFFFF;
        border: 1px solid #D6CDC0;
        color: #111827;
        padding: 6px 8px;
        border-radius: 6px;
        font-size: 11.5px;
        outline: none;
        transition: border-color 0.15s ease;
      }
      .aqa-input-group input[type="text"]:focus {
        border-color: #1B4D4B;
      }

      /* TOAST & BANNER & DIALOG */
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
        max-width: 330px;
        line-height: 1.4;
      }
      #aqa-top-banner {
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 99999999;
        min-width: 380px;
        max-width: 90%;
        padding: 12px 20px;
        border-radius: 12px;
        color: #FFFFFF;
        font-size: 13.5px;
        font-weight: 600;
        box-shadow: 0 10px 30px rgba(27, 77, 75, 0.25);
        display: none;
        align-items: center;
        justify-content: space-between;
        animation: aqaSlideDown 0.3s ease-out;
        gap: 12px;
      }
      .aqa-top-success {
        background: #14532D;
        border: 1px solid #4ADE80;
      }
      .aqa-top-error {
        background: #991B1B;
        border: 1px solid #F87171;
      }
      @keyframes aqaSlideDown {
        from { top: -60px; opacity: 0; }
        to { top: 20px; opacity: 1; }
      }
      #aqa-modal-overlay, #aqa-help-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: rgba(17, 24, 39, 0.6);
        backdrop-filter: blur(5px);
        z-index: 9999999;
        display: none;
        align-items: center;
        justify-content: center;
      }
      .aqa-dialog-box {
        background: #FFFFFF;
        border: 1.5px solid #E5DEC9;
        border-radius: 14px;
        width: 400px;
        max-width: 92%;
        overflow: hidden;
        box-shadow: 0 20px 40px rgba(27, 77, 75, 0.25);
      }
      .aqa-dialog-header {
        background: #FAF8EE;
        padding: 12px 16px;
        font-weight: 700;
        font-size: 13px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 1px solid #E5DEC9;
        color: #1B4D4B;
      }
      .aqa-dialog-body {
        padding: 14px 16px;
        color: #111827;
      }
      .aqa-dialog-footer {
        padding: 12px 16px;
        background: #FAF8F2;
        border-top: 1px solid #E5DEC9;
        display: flex;
        gap: 10px;
      }
    `;
    document.head.appendChild(style);

    const savedStart = GM_getValue(STORAGE_KEYS.DATE_START, '2026-10-01');
    const savedEnd = GM_getValue(STORAGE_KEYS.DATE_END, '2026-10-15');
    const currentBiz = state.businessName || detectBusinessName() || 'Kedai QQ';

    const root = document.createElement('div');
    root.id = 'atlas-qa-widget-root';

    root.innerHTML = `
      <div class="aqa-card" id="aqa-card">
        <!-- 1. HEADER (Paling Atas) -->
        <div class="aqa-header">
          <div class="aqa-title">
            <span style="display:inline-flex; align-items:center; color:#1B4D4B;">${ICONS.sync}</span>
            <span>Episode Scrapper v5.1</span>
          </div>
          <div class="aqa-header-right">
            <span class="aqa-badge" id="aqa-badge-status">Siap Digunakan</span>
            <button id="aqa-btn-help" class="aqa-btn-icon" title="Panduan Penggunaan">
              ${ICONS.help}
            </button>
          </div>
        </div>

        <div class="aqa-body">
          <!-- 2. KARTU UMKM / PETUNJUK NAVIGASI STATE -->
          <div class="aqa-biz-card aqa-biz-card--guidance" id="aqa-biz-guidance-view" style="display:${state.isOnBusinessPage ? 'none' : 'flex'};">
            <div class="aqa-biz-icon">${ICONS.building}</div>
            <div class="aqa-biz-info">
              <div class="aqa-biz-title">Silakan Buka Halaman Bisnis / UMKM</div>
              <div class="aqa-biz-subtitle">Buka dashboard bisnis di Atlas Studio untuk mulai scrapping.</div>
            </div>
          </div>

          <div class="aqa-biz-card aqa-biz-card--active" id="aqa-biz-active-view" style="display:${state.isOnBusinessPage ? 'flex' : 'none'};">
            <div class="aqa-biz-icon">${ICONS.building}</div>
            <div class="aqa-biz-info" style="flex:1; overflow:hidden;">
              <div class="aqa-biz-label">UMKM Aktif:</div>
              <div class="aqa-biz-title" id="aqa-biz-name" style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${currentBiz}</div>
              <div class="aqa-biz-subtitle" id="aqa-biz-state-hint">Pilih rentang tanggal di bawah lalu klik Mulai Pindai.</div>
            </div>
          </div>

          <!-- 3. DATE RANGE SELECTOR & MULAI PINDAI -->
          <div class="aqa-date-box">
            <div class="aqa-date-field">
              <label>Dari Tanggal:</label>
              <input type="date" id="aqa-input-date-start" value="${savedStart}" />
            </div>
            <div class="aqa-date-field">
              <label>Sampai Tanggal:</label>
              <input type="date" id="aqa-input-date-end" value="${savedEnd}" />
            </div>
          </div>

          <div style="display:flex; gap:8px;">
            <button id="aqa-btn-start-scrape" class="aqa-btn aqa-btn-emerald" style="flex:1;">
              ${ICONS.search}
              <span>Mulai Pindai Sesuai Tanggal</span>
            </button>
            <button id="aqa-btn-stop" class="aqa-btn aqa-btn-danger" style="display:none; width:75px;">
              ${ICONS.stop}
              <span>Stop</span>
            </button>
          </div>

          <!-- 4. DUA KETERANGAN METRIK HASIL -->
          <div class="aqa-metrics-container">
            <div class="aqa-metric-row">
              <div class="aqa-metric-dot dot-scanned"></div>
              <div class="aqa-metric-text">
                <strong id="aqa-stat-scanned">0</strong> episode telah ditelusuri di database
              </div>
            </div>
            <div class="aqa-metric-row">
              <div class="aqa-metric-dot dot-matched"></div>
              <div class="aqa-metric-text">
                <strong id="aqa-stat-matched">0</strong> episode pada tanggal yang dipilih
              </div>
            </div>
          </div>

          <!-- 5. AKSI SALIN ATAU KIRIM KE SHEET -->
          <div class="aqa-actions-row">
            <button id="aqa-btn-copy-tsv" class="aqa-btn aqa-btn-secondary" style="flex:1;" title="Salin data yang cocok ke papan klip">
              ${ICONS.clipboard}
              <span>Salin (TSV)</span>
            </button>
            <button id="aqa-btn-send-sheet" class="aqa-btn aqa-btn-emerald" style="flex:1;" title="Kirim data ke Google Sheet">
              ${ICONS.send}
              <span>Kirim ke Sheet</span>
            </button>
          </div>

          <!-- STATUS LOG / KETERANGAN PROSES -->
          <div class="aqa-status-box" id="aqa-status-text">
            Siap menyisir. Tentukan tanggal lalu klik Mulai Pindai.
          </div>
        </div>

        <!-- 6. PENGATURAN DI BAWAH (LINK SHEET & LEBAR WINDOW) -->
        <div class="aqa-footer-settings">
          <button id="aqa-btn-toggle-settings" class="aqa-settings-toggle-btn">
            <div style="display:flex; align-items:center; gap:6px;">
              ${ICONS.cog}
              <span>Pengaturan Webhook & Lebar Window</span>
            </div>
            <span id="aqa-settings-caret">${ICONS.chevronDown}</span>
          </button>

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
              <label>Nama UMKM Kustom (Opsional, otomatis dari h1):</label>
              <input type="text" id="aqa-input-custom-biz" placeholder="Kosongkan untuk auto h1" />
            </div>
            <div class="aqa-input-group">
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <label>Lebar Window Widget:</label>
                <span id="aqa-val-width" style="font-size:11px; font-weight:700; color:#1B4D4B;">${savedWidth}px</span>
              </div>
              <input type="range" id="aqa-input-width" min="300" max="480" step="10" value="${savedWidth}" style="cursor:pointer;" />
            </div>
            <button id="aqa-btn-save-settings" class="aqa-btn aqa-btn-emerald" style="margin-top:6px;">
              Simpan Pengaturan
            </button>
          </div>
        </div>
      </div>

      <div class="aqa-toast" id="aqa-toast"></div>
    `;

    document.body.appendChild(root);
    setupUIEvents();
    updateProgressUI();
  }

  function setupUIEvents() {
    const btnStart = document.getElementById('aqa-btn-start-scrape');
    const btnStop = document.getElementById('aqa-btn-stop');
    const btnCopyTSV = document.getElementById('aqa-btn-copy-tsv');
    const btnSendSheet = document.getElementById('aqa-btn-send-sheet');
    const btnHelp = document.getElementById('aqa-btn-help');
    const btnToggleSettings = document.getElementById('aqa-btn-toggle-settings');
    const settingsModal = document.getElementById('aqa-settings-modal');
    const settingsCaret = document.getElementById('aqa-settings-caret');
    const btnSaveSettings = document.getElementById('aqa-btn-save-settings');

    const inputStart = document.getElementById('aqa-input-date-start');
    const inputEnd = document.getElementById('aqa-input-date-end');
    const inputWebhook = document.getElementById('aqa-input-webhook');
    const inputSheet = document.getElementById('aqa-input-sheet');
    const inputCustomBiz = document.getElementById('aqa-input-custom-biz');
    const inputWidth = document.getElementById('aqa-input-width');
    const valWidth = document.getElementById('aqa-val-width');
    const cardEl = document.getElementById('aqa-card');

    // Load saved settings
    inputWebhook.value = GM_getValue(STORAGE_KEYS.WEBHOOK_URL, '');
    inputSheet.value = GM_getValue(STORAGE_KEYS.SHEET_NAME, '');
    inputCustomBiz.value = GM_getValue(STORAGE_KEYS.CUSTOM_BIZ_NAME, '');

    // Help Tutorial Modal
    btnHelp.addEventListener('click', showHelpModal);

    // Toggle Settings Panel di Bawah
    btnToggleSettings.addEventListener('click', () => {
      const isVisible = settingsModal.style.display === 'block';
      settingsModal.style.display = isVisible ? 'none' : 'block';
      if (settingsCaret) {
        settingsCaret.innerHTML = isVisible ? ICONS.chevronDown : ICONS.chevronUp;
      }
    });

    // Realtime Widget Width Slider
    inputWidth.addEventListener('input', (e) => {
      const w = e.target.value;
      if (valWidth) valWidth.textContent = `${w}px`;
      if (cardEl) cardEl.style.width = `${w}px`;
    });

    // Save Settings
    btnSaveSettings.addEventListener('click', () => {
      GM_setValue(STORAGE_KEYS.WEBHOOK_URL, inputWebhook.value.trim());
      GM_setValue(STORAGE_KEYS.SHEET_NAME, inputSheet.value.trim());
      GM_setValue(STORAGE_KEYS.CUSTOM_BIZ_NAME, inputCustomBiz.value.trim());
      GM_setValue(STORAGE_KEYS.WIDGET_WIDTH, inputWidth.value);
      settingsModal.style.display = 'none';
      if (settingsCaret) settingsCaret.innerHTML = ICONS.chevronDown;
      parseDashboardUrl();
      updateProgressUI();
      showToast('Pengaturan berhasil disimpan.');
    });

    async function executeSendSheet(rows) {
      const currentBiz = state.businessName || detectBusinessName();
      setStatus(`Mengirim ${rows.length} episode ke Google Sheet...`);
      try {
        await sendToGoogleSheet(rows);
        showToast(`${rows.length} baris data berhasil dikirim ke Google Sheet.`);
        setStatus(`Selesai: ${rows.length} baris masuk ke Sheet.`);

        // Notifikasi top banner
        showTopNotification(`Sukses: ${rows.length} Data QA [${currentBiz}] Berhasil Terkirim ke Spreadsheet!`, true);
      } catch (e) {
        showToast(`Gagal: ${e.message}`, false);
        setStatus(`Gagal kirim: ${e.message}`);
        showTopNotification(`Gagal Mengirim ke Sheet: ${e.message}`, false);
      }
    }

    // 1. MULAI TARGETED AUTO-NEXT SCRAPING (DENGAN FLOW VERIFIKASI)
    async function startScrapeFlow() {
      const startDate = inputStart.value;
      const endDate = inputEnd.value;

      GM_setValue(STORAGE_KEYS.DATE_START, startDate);
      GM_setValue(STORAGE_KEYS.DATE_END, endDate);

      btnStart.disabled = true;
      btnStop.style.display = 'block';

      try {
        await runTargetedScraper(startDate, endDate);

        const rows = Array.from(state.episodes.values()).map(transformEpisodeToRow);

        if (rows.length > 0) {
          copyToClipboardAsTSV(rows); // Backup otomatis ke papan klip
          showToast(`Selesai: Ditemukan ${rows.length} episode cocok.`);

          // FLOW VERIFIKASI: Tanyakan user apakah data sudah benar/lengkap
          showReviewDialog(
            rows,
            startDate,
            endDate,
            () => {
              // Jika user pilih "Ulang Pindai"
              showToast('Mengulang proses pemindaian...');
              startScrapeFlow();
            },
            () => {
              // Jika user pilih "Sudah Lengkap, Kirim ke Sheet!"
              executeSendSheet(rows);
            }
          );

        } else {
          showToast(`Tidak ada episode yang ditemukan pada rentang ${startDate} s/d ${endDate}.`, false);
          setStatus(`Tidak ada episode pada rentang ${startDate} s/d ${endDate}.`);
        }
      } catch (err) {
        showToast(`Gagal: ${err.message}`, false);
        setStatus(`Kendala: ${err.message}`);
      } finally {
        btnStart.disabled = false;
        btnStop.style.display = 'none';
        updateProgressUI();
      }
    }

    btnStart.addEventListener('click', startScrapeFlow);

    // 2. STOP BUTTON
    btnStop.addEventListener('click', () => {
      state.stopRequested = true;
      setStatus('Menghentikan penelusuran...');
      showToast('Pemindaian dihentikan.');
    });

    // 3. SALIN HASIL MANUAL
    btnCopyTSV.addEventListener('click', () => {
      const rows = Array.from(state.episodes.values()).map(transformEpisodeToRow);
      if (rows.length === 0) {
        showToast('Belum ada data hasil yang cocok. Jalankan Mulai Pindai terlebih dahulu.', false);
        return;
      }
      copyToClipboardAsTSV(rows);
      showToast(`${rows.length} baris data tersalin ke papan klip.`);
    });

    // 4. KIRIM KE SHEET MANUAL
    btnSendSheet.addEventListener('click', async () => {
      const rows = Array.from(state.episodes.values()).map(transformEpisodeToRow);
      if (rows.length === 0) {
        showToast('Belum ada data untuk dikirim.', false);
        return;
      }
      btnSendSheet.disabled = true;
      try {
        await executeSendSheet(rows);
      } finally {
        btnSendSheet.disabled = false;
      }
    });
  }

  // Monitor perpindahan halaman (SPA Navigation) antar UMKM
  let lastPath = window.location.pathname;
  setInterval(() => {
    if (window.location.pathname !== lastPath) {
      lastPath = window.location.pathname;
      parseDashboardUrl();
      state.allEpisodes.clear();
      state.episodes.clear();
      updateProgressUI();
      if (state.isOnBusinessPage) {
        setStatus(`Beralih ke UMKM: ${state.businessName || state.businessId}`);
      } else {
        setStatus('Buka halaman bisnis / UMKM untuk memulai.');
      }
    }
  }, 1000);

  // Inisialisasi awal
  parseDashboardUrl();
  setTimeout(createFloatingUI, 1200);

})();
