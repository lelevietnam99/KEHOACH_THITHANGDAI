/**
 * =====================================================================
 *  KẾ HOẠCH THI THĂNG ĐAI — Máy chủ Google Apps Script
 * =====================================================================
 *  - Dữ liệu lưu trong Google Sheets, mỗi phần của kế hoạch là một trang tính.
 *  - Cung cấp API cho giao diện (file Index.html): đọc / thêm / sửa / xóa.
 *  - Cách cài đặt từng bước: xem README.md.
 *
 *  Có thể sửa trực tiếp trong Google Sheets, KHÔNG đổi tên dòng tiêu đề
 *  (dòng 1) và KHÔNG đổi tên các trang tính bên dưới.
 */

// ----------------------------- CẤU HÌNH -----------------------------

const TRANG_THAI = ['Chưa bắt đầu', 'Đang thực hiện', 'Hoàn thành', 'Tạm hoãn'];
const BUOI = ['', 'Sáng', 'Chiều', 'Tối'];
const DATE_FIELDS = ['deadline'];
const TIME_FIELDS = ['batDau', 'ketThuc'];
const MAX_LEN = 5000;
const PROP_KEY = 'MA_QUAN_TRI';         // Mã quản trị (bảo vệ thao tác sửa/xóa)
const PROP_SHEET_ID = 'SPREADSHEET_ID'; // Chỉ cần khi script KHÔNG gắn với Google Sheet

// Mỗi cột: [khóa nội bộ, tiêu đề trong Google Sheets, độ rộng cột]
const TABLES = {
  chuanBi: {
    sheet: '1. Chuẩn bị',
    cols: [
      ['id', 'ID', 90],
      ['nhom', 'Nhóm', 170],
      ['thuTu', 'Thứ tự', 60],
      ['hoatDong', 'Hoạt động', 180],
      ['chiTiet', 'Chi tiết công việc', 360],
      ['deadline', 'Deadline (dd/mm/yyyy)', 120],
      ['buoi', 'Buổi', 70],
      ['phuTrach', 'Người phụ trách chính', 200],
      ['hoTro', 'Nhân sự hỗ trợ', 160],
      ['trangThai', 'Trạng thái', 120],
      ['ghiChu', 'Ghi chú', 220],
      ['capNhat', 'Cập nhật lúc', 130],
    ],
    required: { hoatDong: 'Hoạt động' },
  },
  ngayThi: {
    sheet: '2. Ngày thi',
    cols: [
      ['id', 'ID', 90],
      ['batDau', 'Giờ bắt đầu', 90],
      ['ketThuc', 'Giờ kết thúc', 90],
      ['hoatDong', 'Hoạt động chính', 220],
      ['nhanSu', 'Nhân sự chính', 220],
      ['chiTiet', 'Chi tiết công việc', 420],
      ['trangThai', 'Trạng thái', 120],
      ['ghiChu', 'Ghi chú', 200],
      ['capNhat', 'Cập nhật lúc', 130],
    ],
    required: { batDau: 'Giờ bắt đầu', hoatDong: 'Hoạt động chính' },
  },
  hauKy: {
    sheet: '3. Hậu kỳ',
    cols: [
      ['id', 'ID', 90],
      ['thuTu', 'Thứ tự', 60],
      ['hoatDong', 'Hoạt động chính', 200],
      ['deadline', 'Deadline (dd/mm/yyyy)', 120],
      ['buoi', 'Buổi', 70],
      ['phuTrach', 'Người phụ trách chính', 180],
      ['hoTro', 'Nhân sự hỗ trợ', 180],
      ['chiTiet', 'Chi tiết công việc', 420],
      ['trangThai', 'Trạng thái', 120],
      ['ghiChu', 'Ghi chú', 200],
      ['capNhat', 'Cập nhật lúc', 130],
    ],
    required: { hoatDong: 'Hoạt động chính' },
  },
  nhanSu: {
    sheet: 'Nhân sự',
    cols: [
      ['id', 'ID', 90],
      ['nhom', 'Nhóm', 260],
      ['thuTu', 'Thứ tự', 60],
      ['vaiTro', 'Tiểu ban / Vai trò', 260],
      ['phuTrach', 'Người phụ trách chính', 220],
      ['hoTro', 'Nhân sự hỗ trợ', 200],
      ['ghiChu', 'Ghi chú nhiệm vụ', 320],
      ['capNhat', 'Cập nhật lúc', 130],
    ],
    required: { vaiTro: 'Tiểu ban / Vai trò' },
  },
};

const SETTINGS_SHEET = 'Cài đặt';
// [khóa, mô tả, giá trị mặc định]
const SETTINGS = [
  ['tenKeHoach', 'Tên kế hoạch', 'KẾ HOẠCH THI THĂNG ĐAI'],
  ['donVi', 'Đơn vị / Võ đường', ''],
  ['ngayThi', 'Ngày thi (dd/mm/yyyy)', '07/06/2026'],
  ['diaDiem', 'Địa điểm thi', 'Sân cỏ lớn'],
  ['chuanBiTu', 'Giai đoạn chuẩn bị: từ ngày (dd/mm/yyyy)', '24/05/2026'],
  ['chuanBiDen', 'Giai đoạn chuẩn bị: đến ngày (dd/mm/yyyy)', '07/06/2026'],
];
const SETTING_DATES = ['ngayThi', 'chuanBiTu', 'chuanBiDen'];

// ------------------------- WEB APP / API -------------------------

/** Mở trang web. Thêm ?action=getAll vào URL để xem dữ liệu dạng JSON. */
function doGet(e) {
  if (e && e.parameter && e.parameter.action === 'getAll') {
    return json_(api({ action: 'getAll' }));
  }
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Kế hoạch thi thăng đai')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/** API cho trường hợp giao diện được đặt ngoài Apps Script (ví dụ GitHub Pages). */
function doPost(e) {
  let req;
  try {
    req = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (err) {
    return json_({ ok: false, error: 'Dữ liệu gửi lên không hợp lệ.', code: 'ERROR' });
  }
  return json_(api(req));
}

const ACTIONS = {
  getAll: { run: () => getAll_() },
  checkKey: { write: true, run: () => true },
  create: { write: true, run: req => createItem_(req.table, req.item) },
  update: { write: true, run: req => updateItem_(req.table, req.id, req.item) },
  remove: { write: true, run: req => removeItem_(req.table, req.id) },
  saveSettings: { write: true, run: req => saveSettings_(req.settings) },
  seed: { write: true, run: req => seed_(!!req.overwrite) },
  rollover: { write: true, run: req => rollover_(req.ngayThi, !!req.resetStatus) },
};

/** Điểm vào duy nhất của API (gọi qua google.script.run hoặc doPost). */
function api(req) {
  try {
    req = req || {};
    const handler = ACTIONS[String(req.action || '')];
    if (!handler) throw err_('Thao tác không hợp lệ: ' + req.action);
    if (handler.write) checkKey_(req.key);
    return { ok: true, data: withLock_(() => handler.run(req)) };
  } catch (e) {
    return { ok: false, error: (e && e.message) || String(e), code: (e && e.code) || 'ERROR' };
  }
}

// ----------------------------- NGHIỆP VỤ -----------------------------

function getAll_() {
  const data = {};
  Object.keys(TABLES).forEach(name => {
    data[name] = readRows_(table_(name)).map(r => r.item);
  });
  data.settings = readSettings_();
  data.meta = {
    authRequired: !!getProp_(PROP_KEY),
    sheetUrl: ss_().getUrl(),
  };
  return data;
}

function createItem_(name, input) {
  const t = table_(name);
  const item = sanitize_(name, input, true);
  if ('thuTu' in t.map && !item.thuTu) item.thuTu = String(maxThuTu_(t) + 1);
  if ('trangThai' in t.map && !item.trangThai) item.trangThai = TRANG_THAI[0];
  item.id = newId_();
  item.capNhat = now_();
  validateRequired_(name, item);
  writeRow_(t, t.sh.getLastRow() + 1, item);
  return pick_(t, item);
}

function updateItem_(name, id, input) {
  const t = table_(name);
  const rowNum = findRow_(t, id);
  const cur = t.sh.getRange(rowNum, 1, 1, t.width).getDisplayValues()[0];
  const item = {};
  Object.keys(t.map).forEach(k => { item[k] = cleanRead_(k, cur[t.map[k]]); });
  Object.assign(item, sanitize_(name, input, false));
  item.id = String(id);
  item.capNhat = now_();
  validateRequired_(name, item);
  writeRow_(t, rowNum, item);
  return pick_(t, item);
}

function removeItem_(name, id) {
  const t = table_(name);
  const rowNum = findRow_(t, id);
  // Google Sheets không cho xóa hết các dòng không cố định -> chừa sẵn 1 dòng trống.
  if (t.sh.getMaxRows() - t.sh.getFrozenRows() <= 1) t.sh.insertRowsAfter(t.sh.getMaxRows(), 1);
  t.sh.deleteRow(rowNum);
  return { id: String(id) };
}

function saveSettings_(input) {
  input = input || {};
  const s = settingsSheet_();
  const values = s.sh.getRange(1, 1, s.sh.getLastRow(), 3).getDisplayValues();
  SETTINGS.forEach(([key, label]) => {
    if (!(key in input)) return;
    let v = String(input[key] == null ? '' : input[key]).trim();
    if (v.length > 300) throw err_('"' + label + '" quá dài.');
    if (v && SETTING_DATES.indexOf(key) >= 0) {
      const d = toDMY_(v);
      if (!d) throw err_('Ngày không hợp lệ ở mục "' + label + '": ' + v);
      v = d;
    }
    const r = values.findIndex(row => String(row[2]).trim() === key);
    if (r >= 0) s.sh.getRange(r + 1, 2).setNumberFormat('@').setValue(safeCell_(v));
  });
  return readSettings_();
}

/** Nạp dữ liệu mẫu (theo kế hoạch PDF 07/06/2026). overwrite = xóa dữ liệu cũ. */
function seed_(overwrite) {
  const added = {};
  Object.keys(DU_LIEU_MAU).forEach(name => {
    const t = table_(name);
    const last = t.sh.getLastRow();
    if (last > 1) {
      if (!overwrite) { added[name] = 0; return; }
      t.sh.getRange(2, 1, last - 1, t.sh.getLastColumn()).clearContent();
    }
    const stamp = now_();
    DU_LIEU_MAU[name].forEach((raw, i) => {
      const item = sanitize_(name, raw, true);
      item.id = newId_();
      item.capNhat = stamp;
      if ('thuTu' in t.map && !item.thuTu) item.thuTu = String(i + 1);
      if ('trangThai' in t.map && !item.trangThai) item.trangThai = TRANG_THAI[0];
      writeRow_(t, i + 2, item);
    });
    added[name] = DU_LIEU_MAU[name].length;
  });
  const s = settingsSheet_();
  if (overwrite) {
    const defaults = {};
    SETTINGS.forEach(([key, , def]) => { defaults[key] = def; });
    saveSettings_(defaults);
  }
  return { added: added, settingsSheet: s.sh.getName() };
}

/**
 * Chuyển kế hoạch sang kỳ thi mới: dời toàn bộ deadline (Phần 1, Phần 3) và
 * giai đoạn chuẩn bị theo số ngày chênh lệch giữa ngày thi cũ và mới.
 */
function rollover_(newDate, resetStatus) {
  const nd = toDMY_(String(newDate || ''));
  if (!nd) throw err_('Ngày thi mới không hợp lệ.');
  const st = readSettings_();
  if (!toDMY_(st.ngayThi)) throw err_('Chưa có "Ngày thi" hiện tại trong Cài đặt nên không tính được số ngày cần dời.');
  const delta = daysBetween_(st.ngayThi, nd);
  const stamp = now_();
  Object.keys(TABLES).forEach(name => {
    const t = table_(name);
    const hasDeadline = 'deadline' in t.map;
    const hasStatus = 'trangThai' in t.map;
    if (!hasDeadline && !(hasStatus && resetStatus)) return;
    readRows_(t).forEach(({ row, item }) => {
      if (hasDeadline && toDMY_(item.deadline)) item.deadline = shiftDMY_(item.deadline, delta);
      if (hasStatus && resetStatus) item.trangThai = TRANG_THAI[0];
      item.capNhat = stamp;
      writeRow_(t, row, item);
    });
  });
  const next = { ngayThi: nd };
  ['chuanBiTu', 'chuanBiDen'].forEach(k => {
    if (toDMY_(st[k])) next[k] = shiftDMY_(st[k], delta);
  });
  saveSettings_(next);
  return { delta: delta };
}

// --------------------------- TRUY CẬP SHEET ---------------------------

function ss_() {
  const id = getProp_(PROP_SHEET_ID);
  const ss = id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    throw err_('Không tìm thấy Google Sheet. Hãy mở Apps Script từ menu "Tiện ích mở rộng" của Google Sheet, ' +
      'hoặc khai báo thuộc tính tập lệnh ' + PROP_SHEET_ID + '.');
  }
  return ss;
}

/** Lấy (hoặc tạo) trang tính của một bảng và bản đồ khóa -> vị trí cột. */
function table_(name) {
  const def = TABLES[name];
  if (!def) throw err_('Bảng dữ liệu không tồn tại: ' + name);
  const ss = ss_();
  let sh = ss.getSheetByName(def.sheet);
  if (!sh) sh = ss.insertSheet(def.sheet);
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, def.cols.length).setValues([def.cols.map(c => c[1])]);
    formatSheet_(sh, def.cols);
  }
  const header = sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), 1)).getDisplayValues()[0]
    .map(h => String(h).trim());
  const map = {};
  def.cols.forEach(([key, label]) => {
    let idx = header.indexOf(label);
    if (idx < 0) { // Tự thêm cột còn thiếu vào cuối bảng
      idx = header.length;
      header.push(label);
      sh.getRange(1, idx + 1).setValue(label).setFontWeight('bold');
      sh.getRange(1, idx + 1, sh.getMaxRows(), 1).setNumberFormat('@');
    }
    map[key] = idx;
  });
  return { sh: sh, map: map, width: header.length };
}

function formatSheet_(sh, cols) {
  const n = cols.length;
  sh.getRange(1, 1, sh.getMaxRows(), n).setNumberFormat('@').setVerticalAlignment('top').setWrap(true);
  sh.getRange(1, 1, 1, n).setFontWeight('bold').setBackground('#ffff00').setFontColor('#cc0000')
    .setHorizontalAlignment('center').setVerticalAlignment('middle');
  sh.setFrozenRows(1);
  cols.forEach((c, i) => sh.setColumnWidth(i + 1, c[2] || 140));
  if (cols[0][0] === 'id') sh.hideColumns(1);
}

/** Đọc mọi dòng có dữ liệu. Dòng thiếu ID hoặc trùng ID sẽ được cấp ID mới. */
function readRows_(t) {
  const last = t.sh.getLastRow();
  if (last < 2) return [];
  const values = t.sh.getRange(2, 1, last - 1, t.width).getDisplayValues();
  const keys = Object.keys(t.map);
  const seen = {};
  const out = [];
  values.forEach((cells, i) => {
    if (cells.every(v => String(v).trim() === '')) return;
    const item = {};
    keys.forEach(k => { item[k] = cleanRead_(k, cells[t.map[k]]); });
    if (!item.id || seen[item.id]) {
      item.id = newId_();
      t.sh.getRange(i + 2, t.map.id + 1).setNumberFormat('@').setValue(item.id);
    }
    seen[item.id] = true;
    out.push({ row: i + 2, item: item });
  });
  return out;
}

function findRow_(t, id) {
  id = String(id || '');
  const last = t.sh.getLastRow();
  if (id && last >= 2) {
    const ids = t.sh.getRange(2, t.map.id + 1, last - 1, 1).getDisplayValues();
    for (let i = 0; i < ids.length; i++) {
      if (String(ids[i][0]).trim() === id) return i + 2;
    }
  }
  throw err_('Không tìm thấy dữ liệu (có thể đã bị xóa). Hãy bấm "Tải lại".', 'NOT_FOUND');
}

/** Ghi các cột đã biết của một dòng (không đụng tới cột người dùng tự thêm). */
function writeRow_(t, rowNum, item) {
  const keys = Object.keys(t.map);
  const idxs = keys.map(k => t.map[k]);
  const min = Math.min.apply(null, idxs);
  const max = Math.max.apply(null, idxs);
  if (max - min + 1 === keys.length) {
    const row = new Array(keys.length);
    keys.forEach(k => { row[t.map[k] - min] = safeCell_(item[k]); });
    t.sh.getRange(rowNum, min + 1, 1, keys.length).setNumberFormat('@').setValues([row]);
  } else {
    keys.forEach(k => {
      t.sh.getRange(rowNum, t.map[k] + 1).setNumberFormat('@').setValue(safeCell_(item[k]));
    });
  }
}

function maxThuTu_(t) {
  return readRows_(t).reduce((m, r) => {
    const n = parseInt(r.item.thuTu, 10);
    return isNaN(n) ? m : Math.max(m, n);
  }, 0);
}

function settingsSheet_() {
  const ss = ss_();
  let sh = ss.getSheetByName(SETTINGS_SHEET);
  if (!sh) sh = ss.insertSheet(SETTINGS_SHEET);
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, 3).setValues([['Mục', 'Giá trị', 'Khóa (không sửa)']]);
    formatSheet_(sh, [['muc', '', 300], ['giaTri', '', 320], ['khoa', '', 140]]);
    sh.getRange(1, 3, sh.getMaxRows(), 1).setFontColor('#888888');
    sh.getRange(1, 1, 1, 3).setFontColor('#cc0000');
  }
  const last = sh.getLastRow();
  const keys = sh.getRange(1, 3, last, 1).getDisplayValues().map(r => String(r[0]).trim());
  const missing = SETTINGS.filter(s => keys.indexOf(s[0]) < 0);
  if (missing.length) {
    sh.getRange(last + 1, 1, missing.length, 3).setNumberFormat('@')
      .setValues(missing.map(([key, label, def]) => [label, def, key]));
  }
  return { sh: sh };
}

function readSettings_() {
  const s = settingsSheet_();
  const values = s.sh.getRange(1, 1, s.sh.getLastRow(), 3).getDisplayValues();
  const out = {};
  SETTINGS.forEach(([key, , def]) => { out[key] = def; });
  values.forEach(row => {
    const key = String(row[2]).trim();
    if (!(key in out)) return;
    const v = String(row[1]).trim();
    out[key] = SETTING_DATES.indexOf(key) >= 0 ? (toDMY_(v) || v) : v;
  });
  return out;
}

// ----------------------------- TIỆN ÍCH -----------------------------

function sanitize_(name, input, isCreate) {
  input = input || {};
  const out = {};
  TABLES[name].cols.forEach(([k]) => {
    if (k === 'id' || k === 'capNhat') return;
    if (!(k in input)) {
      if (isCreate) out[k] = '';
      return;
    }
    out[k] = normalizeField_(k, input[k]);
  });
  return out;
}

function normalizeField_(k, v) {
  const s = (v == null ? '' : String(v)).replace(/\r\n?/g, '\n').trim();
  if (s.length > MAX_LEN) throw err_('Nội dung quá dài (tối đa ' + MAX_LEN + ' ký tự).');
  if (!s) return '';
  if (DATE_FIELDS.indexOf(k) >= 0) {
    const d = toDMY_(s);
    if (!d) throw err_('Ngày không hợp lệ: ' + s + ' (đúng dạng: dd/mm/yyyy)');
    return d;
  }
  if (TIME_FIELDS.indexOf(k) >= 0) {
    const t = toHM_(s);
    if (!t) throw err_('Giờ không hợp lệ: ' + s + ' (đúng dạng: HH:mm)');
    return t;
  }
  if (k === 'thuTu') {
    const n = parseInt(s, 10);
    if (isNaN(n)) throw err_('Thứ tự phải là số.');
    return String(n);
  }
  if (k === 'trangThai') return TRANG_THAI.indexOf(s) >= 0 ? s : TRANG_THAI[0];
  if (k === 'buoi') return BUOI.indexOf(s) >= 0 ? s : '';
  return s;
}

function cleanRead_(k, v) {
  const s = String(v == null ? '' : v).trim();
  if (!s) return '';
  if (DATE_FIELDS.indexOf(k) >= 0) return toDMY_(s) || s;
  if (TIME_FIELDS.indexOf(k) >= 0) return toHM_(s) || s;
  return s;
}

function validateRequired_(name, item) {
  const req = TABLES[name].required || {};
  Object.keys(req).forEach(k => {
    if (!String(item[k] || '').trim()) throw err_('Vui lòng nhập "' + req[k] + '".');
  });
}

function pick_(t, item) {
  const out = {};
  Object.keys(t.map).forEach(k => { out[k] = item[k] == null ? '' : String(item[k]); });
  return out;
}

/** Chặn Google Sheets hiểu nội dung bắt đầu bằng "=" là công thức. */
function safeCell_(v) {
  const s = v == null ? '' : String(v);
  return s.charAt(0) === '=' ? "'" + s : s;
}

/** Chuẩn hóa ngày về dạng dd/mm/yyyy. Nhận dd/mm/yyyy, d/m/yyyy hoặc yyyy-mm-dd. */
function toDMY_(s) {
  s = String(s || '').trim();
  let d, m, y;
  let r = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
  if (r) { y = +r[1]; m = +r[2]; d = +r[3]; } else {
    r = /^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})$/.exec(s);
    if (!r) return '';
    d = +r[1]; m = +r[2]; y = +r[3];
  }
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return '';
  return pad2_(d) + '/' + pad2_(m) + '/' + y;
}

function toHM_(s) {
  const r = /^(\d{1,2})[:hH.](\d{2})(?::\d{2})?$/.exec(String(s || '').trim());
  if (!r || +r[1] > 23 || +r[2] > 59) return '';
  return pad2_(+r[1]) + ':' + r[2];
}

function dmyToUTC_(s) {
  const p = toDMY_(s).split('/');
  return Date.UTC(+p[2], +p[1] - 1, +p[0]);
}

function daysBetween_(a, b) {
  return Math.round((dmyToUTC_(b) - dmyToUTC_(a)) / 86400000);
}

function shiftDMY_(s, days) {
  const dt = new Date(dmyToUTC_(s) + days * 86400000);
  return pad2_(dt.getUTCDate()) + '/' + pad2_(dt.getUTCMonth() + 1) + '/' + dt.getUTCFullYear();
}

function pad2_(n) { return (n < 10 ? '0' : '') + n; }

function now_() {
  return Utilities.formatDate(new Date(), ss_().getSpreadsheetTimeZone(), 'dd/MM/yyyy HH:mm');
}

function newId_() {
  return Utilities.getUuid().replace(/-/g, '').slice(0, 12);
}

function getProp_(k) {
  return PropertiesService.getScriptProperties().getProperty(k) || '';
}

function checkKey_(key) {
  const k = getProp_(PROP_KEY);
  if (k && String(key || '') !== k) {
    throw err_(key ? 'Mã quản trị không đúng.' : 'Cần nhập mã quản trị để chỉnh sửa.', 'AUTH');
  }
}

function withLock_(fn) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) throw err_('Hệ thống đang bận, vui lòng thử lại sau giây lát.');
  try {
    const result = fn();
    SpreadsheetApp.flush();
    return result;
  } finally {
    lock.releaseLock();
  }
}

function err_(msg, code) {
  const e = new Error(msg);
  e.code = code || 'ERROR';
  return e;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// --------------------- MENU TRONG GOOGLE SHEETS ---------------------

function onOpen() {
  SpreadsheetApp.getUi().createMenu('🥋 Thi thăng đai')
    .addItem('Cài đặt ban đầu (tạo trang tính + dữ liệu mẫu)', 'caiDatBanDau')
    .addItem('Mở trang quản lý (Web App)', 'menuMoWebApp')
    .addSeparator()
    .addItem('Đặt / đổi mã quản trị', 'menuDatMaQuanTri')
    .addItem('Xóa mã quản trị', 'menuXoaMaQuanTri')
    .addSeparator()
    .addItem('Nạp lại dữ liệu mẫu (XÓA dữ liệu hiện có)', 'menuNapLaiDuLieuMau')
    .addToUi();
}

/** Chạy hàm này 1 lần (từ trình soạn thảo hoặc menu) để tạo trang tính và dữ liệu mẫu. */
function caiDatBanDau() {
  const res = withLock_(() => seed_(false));
  const total = Object.keys(res.added).reduce((s, k) => s + res.added[k], 0);
  const msg = total
    ? 'Đã tạo các trang tính và nạp ' + total + ' dòng dữ liệu mẫu.'
    : 'Các trang tính đã có dữ liệu nên không nạp thêm dữ liệu mẫu.';
  try { ss_().toast(msg, 'Thi thăng đai', 6); } catch (e) { /* chạy từ trình soạn thảo */ }
  Logger.log(msg);
}

function menuMoWebApp() {
  const ui = SpreadsheetApp.getUi();
  const url = ScriptApp.getService().getUrl();
  if (!url) {
    ui.alert('Chưa triển khai Web App. Vào Apps Script → Triển khai → Tùy chọn triển khai mới → Ứng dụng web.');
    return;
  }
  const html = HtmlService.createHtmlOutput(
    '<p style="font-family:sans-serif">Địa chỉ trang quản lý:</p>' +
    '<p style="font-family:sans-serif;word-break:break-all"><a href="' + url + '" target="_blank">' + url + '</a></p>'
  ).setWidth(460).setHeight(150);
  ui.showModalDialog(html, 'Trang quản lý kế hoạch');
}

function menuDatMaQuanTri() {
  const ui = SpreadsheetApp.getUi();
  const res = ui.prompt('Mã quản trị',
    'Nhập mã mới. Ai muốn thêm/sửa/xóa trên trang web sẽ phải nhập mã này.', ui.ButtonSet.OK_CANCEL);
  if (res.getSelectedButton() !== ui.Button.OK) return;
  const key = res.getResponseText().trim();
  if (key.length < 4) { ui.alert('Mã cần có ít nhất 4 ký tự.'); return; }
  PropertiesService.getScriptProperties().setProperty(PROP_KEY, key);
  ui.alert('Đã đặt mã quản trị.');
}

function menuXoaMaQuanTri() {
  const ui = SpreadsheetApp.getUi();
  if (ui.alert('Xóa mã quản trị?', 'Sau khi xóa, bất kỳ ai mở được trang web đều sửa được dữ liệu.',
    ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
  PropertiesService.getScriptProperties().deleteProperty(PROP_KEY);
  ui.alert('Đã xóa mã quản trị.');
}

function menuNapLaiDuLieuMau() {
  const ui = SpreadsheetApp.getUi();
  if (ui.alert('Nạp lại dữ liệu mẫu?', 'Toàn bộ dữ liệu hiện có ở 4 trang tính kế hoạch sẽ bị XÓA và thay bằng dữ liệu mẫu.',
    ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
  withLock_(() => seed_(true));
  ui.alert('Đã nạp lại dữ liệu mẫu.');
}

// ------------------- DỮ LIỆU MẪU (theo file PDF 07/06/2026) -------------------

const DU_LIEU_MAU = {
  chuanBi: [
    { nhom: 'A. TỔNG HỢP', hoatDong: 'Thông báo', chiTiet: 'Thông báo chính thức kỳ thi thăng đai',
      deadline: '17/05/2026', phuTrach: 'Pháp Thanh', ghiChu: 'Gửi qua nhóm/thông báo tại võ đường.' },
    { nhom: 'A. TỔNG HỢP', hoatDong: 'Chốt Danh sách', chiTiet: 'Chốt Danh sách thí sinh thăng đai',
      deadline: '24/05/2026', phuTrach: 'Pháp Thanh', hoTro: 'Pháp Hỷ và Pháp Tĩnh',
      ghiChu: 'Gửi qua nhóm/thông báo tại võ đường.' },
    { nhom: 'A. TỔNG HỢP', hoatDong: 'Xuất phiếu thi và văn bằng chứng nhận để đi in',
      chiTiet: 'Xuất phiếu dự thi (đính kèm văn bằng cũ), văn bằng chứng nhận',
      deadline: '25/05/2026', phuTrach: 'Pháp Thanh', hoTro: 'Pháp Hỷ và Pháp Tĩnh' },
    { nhom: 'A. TỔNG HỢP', hoatDong: 'Kinh phí & Hỗ trợ',
      chiTiet: 'Lập Dự trù Kinh phí chi tiết (bao gồm cả Tiền thuê xe cho BGK). Trình Thầy Chưởng môn phê duyệt.',
      deadline: '26/05/2026', phuTrach: 'Thầy Pháp Tánh' },
    { nhom: 'B. TÀI LIỆU & TRUYỀN THÔNG', hoatDong: 'Banner',
      chiTiet: 'Thiết kế và in/làm: Banner màn hình LED (nếu có), Banner treo (tại sân cỏ lớn)',
      deadline: '27/05/2026', phuTrach: 'H Pháp Chân' },
    { nhom: 'B. TÀI LIỆU & TRUYỀN THÔNG', hoatDong: 'Thư ký & Bài thi',
      chiTiet: 'Chuẩn bị Danh sách thi (theo đai), Tập Lý thuyết, Chương trình huấn luyện, kiểm tra phiếu dự thi và văn bằng cũ.',
      deadline: '28/05/2026', phuTrach: 'Pháp Thanh', hoTro: 'Pháp Hỷ và Pháp Tĩnh',
      ghiChu: 'In ấn và phân loại hồ sơ thí sinh.' },
    { nhom: 'C. HẬU CẦN & KỸ THUẬT', hoatDong: 'MC & Trang phục',
      chiTiet: 'Liên hệ MC (người dẫn chương trình) và xây dựng Chương trình MC (chuẩn bị lời giới thiệu đại biểu). Chuẩn bị trang phục cho MC.',
      deadline: '03/06/2026', phuTrach: 'Thầy Toàn Tĩnh', ghiChu: 'Duyệt kịch bản MC với Chưởng môn.' },
    { nhom: 'C. HẬU CẦN & KỸ THUẬT', hoatDong: 'Dụng cụ & Sân bãi',
      chiTiet: 'Lên Sơ đồ thi tại Sân cỏ lớn. Chuẩn bị Thảm thi (nếu cần), Binh khí (quyền), Dụng cụ đối kháng (giáp, mũ), Dụng cụ thể lực. Mượn khăn bàn.',
      deadline: '03/06/2026', phuTrach: 'H Pháp Hỷ\nH Kiến Pháp',
      ghiChu: 'Vận chuyển và sắp đặt dụng cụ vào chiều 7/6/2026.' },
    { nhom: 'C. HẬU CẦN & KỸ THUẬT', hoatDong: 'Âm thanh/Hình ảnh (20)',
      chiTiet: 'Kiểm tra Loa tay, Micro, Hệ thống âm thanh, Hình ảnh (máy chiếu nếu có). Dự phòng pin/dây cáp.',
      deadline: '06/06/2026', buoi: 'Sáng', phuTrach: 'H Pháp Chân\nPháp Thanh', ghiChu: 'Test thử toàn bộ hệ thống.' },
    { nhom: 'C. HẬU CẦN & KỸ THUẬT', hoatDong: 'Thị giả & Hậu cần (9, 18, 21)',
      chiTiet: 'Lên danh sách vật dụng: Trà, cafe, nước uống, bánh, trái cây (cho Thầy, BGK, Võ Sinh). Chuẩn bị Quạt, khăn ướt/khô.',
      deadline: '06/06/2026', buoi: 'Chiều',
      phuTrach: 'Đức Công và Kiến Pháp (Thị giả Quý Thầy)\nCô Khiêm Nhã, Cô Khải Tuệ (Cho các em võ sinh)',
      ghiChu: 'Bày biện khu vực nghỉ của BGK/Thầy.' },
    { nhom: 'C. HẬU CẦN & KỸ THUẬT', hoatDong: 'Kiểm tra cuối (13)',
      chiTiet: 'Xác nhận võ phục thí sinh, Phiếu điểm, thống nhất Cách chấm điểm',
      deadline: '06/06/2026', buoi: 'Tối', phuTrach: 'Thầy Toàn Tĩnh', ghiChu: 'Rà soát lần cuối hồ sơ và dụng cụ.' },
  ],
  ngayThi: [
    { batDau: '06:30', ketThuc: '06:45', hoatDong: 'Bắt đầu công việc & Thiết lập',
      nhanSu: 'Tiểu ban hậu cần và Tiểu ban thị giả',
      chiTiet: 'Bật điện/chiếu sáng.\nKiểm tra lại thảm, dụng cụ và vị trí banner.\nPha trà nóng (cho Thầy), sắp xếp nước lọc và khăn tại khu vực BGK.' },
    { batDau: '06:45', ketThuc: '07:00', hoatDong: 'Điểm danh Thí sinh & Sơ bộ',
      nhanSu: 'Tiểu ban bảo vệ và Tiểu ban thư ký',
      chiTiet: 'Bắt đầu điểm danh theo danh sách chốt.\nKiểm tra nhanh võ phục thí sinh và phát số báo danh.\nHướng dẫn xe và đảm bảo khu vực an ninh.' },
    { batDau: '07:00', ketThuc: '07:30', hoatDong: 'Đón Giám khảo & Ổn định', nhanSu: 'Tiểu ban thị giả',
      chiTiet: 'Đón tiếp Quý Thầy/BGK, hướng dẫn vào khu vực nghỉ.\nCung cấp thông tin sơ bộ về chương trình.\nPhục vụ trà, nước, bánh nhẹ ngay tại chỗ.' },
    { batDau: '07:30', ketThuc: '08:00', hoatDong: 'Nghi thức Khai mạc', nhanSu: 'MC và tiểu ban âm thanh, kĩ thuật',
      chiTiet: 'MC tuyên bố lý do, Giới thiệu đại biểu.\nVận hành âm thanh (nhạc hiệu).\nTập trung Quay phim/Chụp ảnh các nghi thức quan trọng.' },
    { batDau: '08:00', ketThuc: '10:30', hoatDong: 'Thực hiện Bài thi Chính', nhanSu: 'Ban Giám Khảo',
      chiTiet: 'Điều phối thí sinh ra/vào sân thi.\nHô tên/Hô đòn to rõ ràng.\nPhát phiếu điểm cho BGK trước khi thí sinh thi, thu lại ngay sau khi thi xong.\nGiám sát cách chấm điểm và hành vi của thí sinh. Thay nước, khăn liên tục cho BGK.' },
    { batDau: '10:30', ketThuc: '11:00', hoatDong: 'Thi Thể lực & Đối kháng',
      nhanSu: 'Tiểu ban thư ký và Tiểu ban hậu cần',
      chiTiet: 'Đặt và kiểm tra dụng cụ thi thể lực/ đối kháng.\nĐảm bảo thí sinh mặc đủ giáp, mũ bảo hiểm.\nGiám sát nghiêm ngặt về an toàn và kỹ thuật.' },
    { batDau: '11:00', ketThuc: '11:30', hoatDong: 'Tổng hợp Kết quả & Nghỉ ngơi', nhanSu: 'Tiểu ban thư ký',
      chiTiet: 'Tổng hợp điểm và lập danh sách kết quả sơ bộ.\nChuẩn bị bánh trái, nước mát tại khu vực BGK.\nCùng BGK rà soát kết quả sơ bộ.' },
    { batDau: '11:30', ketThuc: '12:00', hoatDong: 'Bế mạc trao đai và gửi lời cảm ơn', nhanSu: 'MC và BTC',
      chiTiet: 'MC công bố kết quả chính thức và trao đai.\nTrao Quà và Thư cảm ơn.\nTrao Tiền hỗ trợ xe cho BGK.\nCảm ơn BGK/Quý Thầy.' },
    { batDau: '12:00', ketThuc: '13:00', hoatDong: 'Bồi dưỡng & Dọn dẹp sơ bộ',
      nhanSu: 'Tiểu ban hậu cần và Tiểu ban thị giả',
      chiTiet: 'Phục vụ bữa trưa (9) cho BGK và BTC.\nThu dọn thảm, binh khí về khu vực tập kết. Đảm bảo khu vực thi chính sạch sẽ.' },
  ],
  hauKy: [
    { hoatDong: 'Dọn dẹp Hoàn toàn & Hoàn trả', deadline: '08/06/2026', buoi: 'Sáng',
      phuTrach: 'H Pháp Hỷ', hoTro: 'Tiểu ban hậu cần',
      chiTiet: 'Vệ sinh khu vực sân cỏ, thu gom rác.\nSắp xếp dụng cụ vào kho (kiểm đếm số lượng).\nKiểm kê vật tư Hậu cần, trả lại đồ mượn (nếu có).' },
    { hoatDong: 'Xử lý Truyền thông', deadline: '08/06/2026', buoi: 'Chiều',
      phuTrach: 'H Pháp Chân', hoTro: 'Tiểu ban truyền thông',
      chiTiet: 'Sao lưu toàn bộ ảnh/video gốc.\nChỉnh sửa và chọn lọc 30-50 ảnh chất lượng cao.\nViết bài báo cáo với ảnh, đăng lên Fanpage/Website.\nDuyệt nội dung truyền thông trước khi đăng.' },
    { hoatDong: 'Hoàn thiện Hồ sơ Báo cáo', deadline: '08/06/2026', buoi: 'Sáng',
      phuTrach: 'Pháp Thanh', hoTro: 'Tiểu ban thư ký',
      chiTiet: 'Kiểm tra chéo (Cross-check) điểm với Thư ký hỗ trợ.\nSắp xếp hồ sơ gốc (Phiếu điểm, DS thí sinh) theo thứ tự.\nLập Báo cáo Kết quả Thi (có chữ ký BGK/Giám sát).\nKiểm tra tính pháp lý của hồ sơ trước khi trình Thầy.' },
    { hoatDong: 'Báo cáo Tài chính', deadline: '08/06/2026', buoi: 'Chiều', phuTrach: 'Thầy Pháp Tánh',
      chiTiet: 'Thu thập tất cả hóa đơn, biên nhận.\nLập Bảng Báo cáo chi tiết (Chi phí/Thu nhập).\nTrình Thầy Chưởng môn báo cáo.\nĐối chiếu Thu nhập (Lệ phí thi) với báo cáo của Thư ký.' },
    { hoatDong: 'Họp Rút kinh nghiệm', deadline: '08/06/2026', buoi: 'Sáng',
      phuTrach: 'Thầy Pháp Tánh', hoTro: 'Tất cả các Huynh đệ',
      chiTiet: 'Mỗi Huynh đệ báo cáo ngắn về công việc.' },
  ],
  nhanSu: [
    { nhom: 'I. BAN TỔ CHỨC', vaiTro: 'Điều hành & Đối ngoại (BTC Chung, Khách mời, MC)', phuTrach: 'Thầy Toàn Tĩnh',
      ghiChu: 'Chịu trách nhiệm chung, liên hệ BGK, điều hành Khai mạc/Bế mạc.' },
    { nhom: 'I. BAN TỔ CHỨC', vaiTro: 'Giám Sát & Kiểm tra Quy chế', phuTrach: 'Thầy Toàn Tĩnh',
      ghiChu: 'Đảm bảo tính minh bạch, kiểm tra võ phục, quy trình chấm điểm.' },
    { nhom: 'II. TIỂU BAN HÀNH CHÍNH & TÀI LIỆU', vaiTro: 'Thư ký & Hồ sơ (Danh sách, Phiếu điểm, Tổng hợp)',
      phuTrach: 'Pháp Thanh', hoTro: 'Pháp Hỷ, Pháp Tĩnh, Tỷ Minh Tường',
      ghiChu: 'Quản lý hồ sơ, điểm danh, thu/phát phiếu điểm, tổng hợp kết quả.' },
    { nhom: 'II. TIỂU BAN HÀNH CHÍNH & TÀI LIỆU', vaiTro: 'Tài chính (Kinh phí, Quà)', phuTrach: 'Thầy Pháp Tánh',
      ghiChu: 'Dự trù kinh phí, lo bữa trưa, quyết toán thu chi.' },
    { nhom: 'III. TIỂU BAN KỸ THUẬT & HỖ TRỢ HIỆN TRƯỜNG', vaiTro: 'Dụng cụ, Hỗ trợ Sân thi & Bảo vệ (Binh khí, Hô đòn)',
      phuTrach: 'H Pháp Hỷ', hoTro: 'Tiểu ban hậu cần',
      ghiChu: 'Sắp đặt thảm/dụng cụ, Hô tên/Hô đòn, giữ an ninh trật tự.' },
    { nhom: 'III. TIỂU BAN KỸ THUẬT & HỖ TRỢ HIỆN TRƯỜNG', vaiTro: 'Truyền thông & Âm thanh/Hình ảnh',
      phuTrach: 'H Pháp Chân', hoTro: 'Tiểu ban truyền thông',
      ghiChu: 'Banner, loa đài, micro, quay phim/chụp ảnh, đăng bài hậu kỳ.' },
    { nhom: 'III. TIỂU BAN KỸ THUẬT & HỖ TRỢ HIỆN TRƯỜNG', vaiTro: 'Hậu cần',
      phuTrach: 'Đức Công, Kiến Pháp, Cô Khiêm Nhã, Cô Khải Tuệ', hoTro: 'HĐ Thanh niên hỗ trợ hậu cần',
      ghiChu: 'Phục vụ trà, nước, khăn, bánh trái tại chỗ nghỉ của BGK.' },
  ],
};
