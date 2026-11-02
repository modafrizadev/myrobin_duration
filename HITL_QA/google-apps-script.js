/**
 * =======================================================================
 * GOOGLE APPS SCRIPT - AUTO QA REPORTING ATLAS CAPTURE RECEIVER
 * =======================================================================
 * Target Sheet URL: https://docs.google.com/spreadsheets/d/1MmLXrhQN2o5uetMG82qj8Nhskaad6_KtihHia3O47Tc/edit
 * 
 * 10 Kolom Header:
 * 1. Nama Bisnis
 * 2. Task Name
 * 3. Submit Date
 * 4. Reject Class
 * 5. QA Types
 * 6. Rejected Clip Link
 * 7. Rejection Type
 * 8. Rejection Cause
 * 9. Dispute note
 * 10. Duration
 * =======================================================================
 */

const HEADERS = [
  "Nama Bisnis",
  "Task Name",
  "Submit Date",
  "Reject Class",
  "QA Types",
  "Rejected Clip Link",
  "Rejection Type",
  "Rejection Cause",
  "Dispute note",
  "Duration"
];

/**
 * Handle GET Request (untuk tes koneksi browser / ping)
 */
function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    status: "ok",
    message: "Google Apps Script Webhook Atlas QA aktif dan siap menerima data!",
    timestamp: new Date().toISOString()
  })).setMimeType(ContentService.MimeType.JSON);
}

/**
 * Handle POST Request dari Tampermonkey Userscript
 */
function doPost(e) {
  const lock = LockService.getScriptLock();
  // Kunci eksekusi selama maksimal 30 detik untuk menghindari konflik baris saat banyak request
  lock.tryLock(30000);

  try {
    if (!e || !e.postData || !e.postData.contents) {
      return createJsonResponse({ status: "error", message: "Payload kosong atau tidak valid" }, 400);
    }

    const payload = JSON.parse(e.postData.contents);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // Pilih sheet berdasarkan nama yang dikirim atau sheet pertama aktif
    let sheet;
    if (payload.sheetName) {
      sheet = ss.getSheetByName(payload.sheetName);
      if (!sheet) {
        sheet = ss.insertSheet(payload.sheetName);
      }
    } else {
      sheet = ss.getSheets()[0];
    }

    // Pastikan Header terpasang di baris 1 jika sheet masih kosong
    ensureHeaders(sheet);

    let insertedCount = 0;

    if (payload.action === "batch" && Array.isArray(payload.rows)) {
      // Input banyak data sekaligus
      const rowsToAdd = payload.rows.map(item => formatRowData(item));
      if (rowsToAdd.length > 0) {
        const lastRow = sheet.getLastRow();
        sheet.getRange(lastRow + 1, 1, rowsToAdd.length, HEADERS.length).setValues(rowsToAdd);
        insertedCount = rowsToAdd.length;
      }
    } else {
      // Input 1 baris
      const singleItem = payload.data || payload;
      const rowData = formatRowData(singleItem);
      sheet.appendRow(rowData);
      insertedCount = 1;
    }

    return createJsonResponse({
      status: "success",
      message: `${insertedCount} baris data berhasil ditambahkan ke Spreadsheet.`,
      insertedCount: insertedCount,
      lastRow: sheet.getLastRow()
    });

  } catch (err) {
    return createJsonResponse({
      status: "error",
      message: err.toString()
    }, 500);
  } finally {
    lock.releaseLock();
  }
}

/**
 * Format objek data agar urutannya persis sesuai 10 kolom Header
 */
function formatRowData(item) {
  return [
    item.namaBisnis || item.businessName || "-",
    item.taskName || "-",
    item.submitDate || "-",
    item.rejectClass || "-",
    item.qaTypes || item.qaType || "Auto QA",
    item.rejectedClipLink || item.clipLink || "-",
    item.rejectionType || "-",
    item.rejectionCause || "-",
    item.disputeNote || "-",
    item.duration || "-"
  ];
}

/**
 * Cek dan pasang Header jika baris 1 masih kosong
 */
function ensureHeaders(sheet) {
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    // Beri format styling sederhana pada header
    const headerRange = sheet.getRange(1, 1, 1, HEADERS.length);
    headerRange.setFontWeight("bold");
    headerRange.setBackground("#1e293b");
    headerRange.setFontColor("#ffffff");
    sheet.setFrozenRows(1);
  }
}

/**
 * Helper untuk response JSON
 */
function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
