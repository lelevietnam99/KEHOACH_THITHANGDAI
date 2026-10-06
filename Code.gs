/**
 * =====================================================================
 *  KẾ HOẠCH THI THĂNG ĐAI — Máy chủ Google Apps Script
 * =====================================================================
 *  - Dữ liệu lưu trong Google Sheets, mỗi phần của kế hoạch là một trang tính.
 *  - Cung cấp API cho giao diện (file Index.html): đọc / thêm / sửa / xóa.
 *  - Cách cài đặt từng bước: xem README.md.
 *
 *  Tốc độ: mỗi trang tính chỉ được đọc 1 lần cho mỗi lượt tải, và kết quả được
 *  giữ trong bộ nhớ đệm (CacheService) cho tới khi dữ liệu thay đổi.
 *  Ngoài ra script có thể ghi bản chụp dữ liệu ra file data.json trên GitHub
 *  (GitHub Pages) để trang web hiển thị tức thì — xem phần "DATA.JSON / GITHUB".
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
const PROP_KEY = 'MA_QUAN_TRI';            // Mã quản trị (bảo vệ thao tác sửa/xóa)
const PROP_SHEET_ID = 'SPREADSHEET_ID';    // Chỉ cần khi script KHÔNG gắn với Google Sheet
const PROP_VER = 'PHIEN_BAN_DU_LIEU';      // Tự đổi mỗi khi dữ liệu thay đổi (để làm mới bộ nhớ đệm)
const CACHE_PREFIX = 'getAll:v2:';
const CACHE_TTL = 120;                     // Lưới an toàn: bộ nhớ đệm tự hết hạn sau 2 phút

// Ghi data.json lên GitHub (tùy chọn). Cài đặt qua menu "🥋 Thi thăng đai → Cài đặt cập nhật data.json".
const PROP_GH_TOKEN = 'GITHUB_TOKEN';      // Mã truy cập GitHub (fine-grained, quyền Contents: Read and write)
const PROP_GH_REPO = 'GITHUB_REPO';        // Kho GitHub, ví dụ: lelevietnam99/KEHOACH_THITHANGDAI
const PROP_GH_BRANCH = 'GITHUB_BRANCH';    // Nhánh chạy GitHub Pages (mặc định: main)
const PROP_GH_PATH = 'GITHUB_PATH';        // Đường dẫn file (mặc định: data.json)
const PROP_PUB_LAST = 'DATA_JSON_LAST';    // Thông tin lần ghi data.json gần nhất
const PROP_PUB_AUTO = 'DATA_JSON_AUTO';    // 'off' = tắt tự động cập nhật data.json sau khi sửa
const SNAPSHOT_FORMAT = 'kehoach-thithangdai/1';

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

// Bộ nhớ tạm trong MỘT lần chạy script (mỗi lần gọi API là một lần chạy mới).
let SS_MEMO_ = null;
let TZ_MEMO_ = null;
let PROPS_MEMO_ = null;

// ------------------------- WEB APP / API -------------------------

/** Mở trang web. Thêm ?action=getAll vào URL để xem dữ liệu dạng JSON. */
function doGet(e) {
  const p = (e && e.parameter) || {};
  if (p.action === 'getAll') {
    return json_(api({ action: 'getAll', fresh: p.fresh === '1' }));
  }
  // Gửi kèm dữ liệu ngay trong trang -> trình duyệt không phải gọi máy chủ thêm lần nữa.
  const t = HtmlService.createTemplateFromFile('Index');
  t.initialData = JSON.stringify(api({ action: 'getAll' })).replace(/</g, '\\u003c');
  return t.evaluate()
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

// auth: cần mã quản trị · write: thay đổi dữ liệu (khóa ghi + làm mới bộ nhớ đệm)
const ACTIONS = {
  getAll: { run: req => getAll_(!!req.fresh) },
  checkKey: { auth: true, run: () => true },
  create: { auth: true, write: true, run: req => createItem_(req.table, req.item) },
  update: { auth: true, write: true, run: req => updateItem_(req.table, req.id, req.item) },
  remove: { auth: true, write: true, run: req => removeItem_(req.table, req.id) },
  saveSettings: { auth: true, write: true, run: req => saveSettings_(req.settings) },
  seed: { auth: true, write: true, run: req => seed_(!!req.overwrite) },
  rollover: { auth: true, write: true, run: req => rollover_(req.ngayThi, !!req.resetStatus) },
  snapshot: { run: () => buildSnapshot_().snap },          // nội dung data.json (để tải về máy)
  status: { run: () => publishStatus_() },                 // trạng thái data.json cho trang capnhat.html
  publish: { auth: true, run: req => publish_(!!req.force) }, // ghi data.json lên GitHub
};

/** Điểm vào duy nhất của API (gọi qua google.script.run hoặc doPost). */
function api(req) {
  try {
    req = req || {};
    const action = String(req.action || '');
    if (!Object.prototype.hasOwnProperty.call(ACTIONS, action)) throw err_('Thao tác không hợp lệ: ' + action);
    const handler = ACTIONS[action];
    if (handler.auth) checkKey_(req.key);
    const data = handler.write ? writeOp_(() => handler.run(req)) : handler.run(req);
    return { ok: true, data: data };
  } catch (e) {
    return { ok: false, error: (e && e.message) || String(e), code: (e && e.code) || 'ERROR' };
  }
}

// ----------------------------- NGHIỆP VỤ -----------------------------

/**
 * Đọc toàn bộ kế hoạch. Ưu tiên lấy từ bộ nhớ đệm (không cần khóa). Khóa của bộ
 * nhớ đệm gắn với "phiên bản dữ liệu", đổi sau mỗi lần ghi qua web, khi sửa tay
 * trong Sheets (onEdit) và khi thêm/xóa dòng, trang tính (trình kích hoạt onChange).
 * fresh = bỏ qua bộ nhớ đệm.
 */
function getAll_(fresh) {
  const t0 = Date.now();
  let data = fresh ? null : cacheGet_(CACHE_PREFIX + (getProp_(PROP_VER) || '0'));
  const hit = !!data;
  if (!data) data = readFresh_(!fresh);
  data.meta.version = getProp_(PROP_VER) || '0';
  data.meta.authRequired = !!getProp_(PROP_KEY);
  data.meta.publish = publishInfo_();
  data.meta.cached = hit;
  data.meta.serverMs = Date.now() - t0;
  return data;
}

/**
 * Đọc thẳng từ Google Sheets DƯỚI KHÓA (không đọc trúng lúc một thao tác nhiều bước
 * như "dời lịch" đang ghi dở), rồi lưu vào bộ nhớ đệm. useCache = trong lúc chờ khóa,
 * nếu lượt khác vừa đọc xong thì dùng luôn kết quả của lượt đó.
 */
function readFresh_(useCache) {
  return withLock_(() => {
    PROPS_MEMO_ = null; // phiên bản dữ liệu có thể vừa đổi trong lúc chờ khóa
    const key = CACHE_PREFIX + (getProp_(PROP_VER) || '0');
    const cached = useCache ? cacheGet_(key) : null;
    if (cached) return cached;
    const data = readAll_(false);
    cachePut_(key, data);
    return data;
  });
}

/** Đọc toàn bộ (gọi khi đang giữ khóa; được phép tạo trang tính / cấp ID còn thiếu). */
function readAll_() {
  const data = {};
  Object.keys(TABLES).forEach(name => {
    data[name] = readRows_(table_(name)).map(r => r.item);
  });
  data.settings = settingsFromValues_(settingsSheet_().values);
  data.meta = { sheetUrl: ss_().getUrl() };
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
  writeRows_(t, t.rows.length + 2, [item]);
  return pick_(t, item);
}

function updateItem_(name, id, input) {
  const t = table_(name);
  const rowNum = findRow_(t, id);
  const cur = t.rows[rowNum - 2];
  const item = {};
  Object.keys(t.map).forEach(k => { item[k] = cleanRead_(k, cur[t.map[k]]); });
  Object.assign(item, sanitize_(name, input, false));
  item.id = String(id);
  item.capNhat = now_();
  validateRequired_(name, item);
  writeRows_(t, rowNum, [item]);
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
  const next = {};
  SETTINGS.forEach(([key, label]) => { // kiểm tra hết trước, rồi mới ghi
    if (!(key in input)) return;
    let v = String(input[key] == null ? '' : input[key]).trim();
    if (v.length > 300) throw err_('"' + label + '" quá dài.');
    if (v && SETTING_DATES.indexOf(key) >= 0) {
      const d = toDMY_(v);
      if (!d) throw err_('Ngày không hợp lệ ở mục "' + label + '": ' + v);
      v = d;
    }
    next[key] = v;
  });
  const s = settingsSheet_();
  Object.keys(next).forEach(key => {
    const r = s.values.findIndex(row => String(row[2] || '').trim() === key);
    if (r < 0) return;
    s.sh.getRange(r + 1, 2).setNumberFormat('@').setValue(safeCell_(next[key]));
    s.values[r][1] = next[key];
  });
  return settingsFromValues_(s.values);
}

/** Nạp dữ liệu mẫu (theo kế hoạch PDF 07/06/2026). overwrite = xóa dữ liệu cũ. */
function seed_(overwrite) {
  const added = {};
  Object.keys(DU_LIEU_MAU).forEach(name => {
    const t = table_(name);
    if (!isBlank_(t.rows)) {
      if (!overwrite) { added[name] = 0; return; }
      t.sh.getRange(2, 1, t.rows.length, t.width).clearContent();
    }
    const stamp = now_();
    const items = DU_LIEU_MAU[name].map((raw, i) => {
      const item = sanitize_(name, raw, true);
      item.id = newId_();
      item.capNhat = stamp;
      if ('thuTu' in t.map && !item.thuTu) item.thuTu = String(i + 1);
      if ('trangThai' in t.map && !item.trangThai) item.trangThai = TRANG_THAI[0];
      return item;
    });
    writeRows_(t, 2, items);
    added[name] = items.length;
  });
  settingsSheet_();
  if (overwrite) {
    const defaults = {};
    SETTINGS.forEach(([key, , def]) => { defaults[key] = def; });
    saveSettings_(defaults);
  }
  return { added: added };
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
    const entries = readRows_(t);
    entries.forEach(({ item }) => {
      if (hasDeadline && toDMY_(item.deadline)) item.deadline = shiftDMY_(item.deadline, delta);
      if (hasStatus && resetStatus) item.trangThai = TRANG_THAI[0];
      item.capNhat = stamp;
    });
    writeEntries_(t, entries);
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
  if (SS_MEMO_) return SS_MEMO_;
  const id = getProp_(PROP_SHEET_ID);
  const ss = id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    throw err_('Không tìm thấy Google Sheet. Hãy mở Apps Script từ menu "Tiện ích mở rộng" của Google Sheet, ' +
      'hoặc khai báo thuộc tính tập lệnh ' + PROP_SHEET_ID + '.');
  }
  SS_MEMO_ = ss;
  return ss;
}

/**
 * Lấy (hoặc tạo) trang tính của một bảng. Đọc cả trang tính bằng MỘT lệnh gọi.
 * Trả về: sh, map (khóa -> vị trí cột), width, rows (giá trị các dòng dữ liệu; rows[i] là dòng i + 2).
 */
function table_(name) {
  if (!Object.prototype.hasOwnProperty.call(TABLES, name)) throw err_('Bảng dữ liệu không tồn tại: ' + name);
  const def = TABLES[name];
  const ss = ss_();
  let sh = ss.getSheetByName(def.sheet);
  if (!sh) { sh = ss.insertSheet(def.sheet); }
  let values = sh.getDataRange().getDisplayValues();
  if (isBlank_(values)) {
    values = [def.cols.map(c => c[1])];
    sh.getRange(1, 1, 1, values[0].length).setValues(values);
    formatSheet_(sh, def.cols);
  }
  const header = values[0].map(h => String(h).trim());
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
  return { sh: sh, map: map, width: header.length, rows: values.slice(1) };
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

/** Các dòng có dữ liệu: [{row, item}]. Dòng thiếu ID hoặc trùng ID sẽ được cấp ID mới. */
function readRows_(t) {
  const keys = Object.keys(t.map);
  const seen = {};
  const out = [];
  t.rows.forEach((cells, i) => {
    if (cells.every(v => String(v).trim() === '')) return;
    const item = {};
    keys.forEach(k => { item[k] = cleanRead_(k, cells[t.map[k]]); });
    if (!item.id || seen[item.id]) {
      item.id = newId_();
      t.sh.getRange(i + 2, t.map.id + 1).setNumberFormat('@').setValue(item.id);
      cells[t.map.id] = item.id;
    }
    seen[item.id] = true;
    out.push({ row: i + 2, item: item });
  });
  return out;
}

function findRow_(t, id) {
  id = String(id || '').trim();
  if (id) {
    for (let i = 0; i < t.rows.length; i++) {
      if (String(t.rows[i][t.map.id] || '').trim() === id) return i + 2;
    }
  }
  throw err_('Không tìm thấy dữ liệu (có thể đã bị xóa). Hãy bấm "Tải lại".', 'NOT_FOUND');
}

/** Ghi nhiều dòng liền nhau bắt đầu từ startRow (chỉ các cột đã biết, không đụng cột người dùng tự thêm). */
function writeRows_(t, startRow, items) {
  if (!items.length) return;
  const keys = Object.keys(t.map);
  const idxs = keys.map(k => t.map[k]);
  const min = Math.min.apply(null, idxs);
  const max = Math.max.apply(null, idxs);
  if (max - min + 1 === keys.length) {
    const block = items.map(item => {
      const row = new Array(keys.length);
      keys.forEach(k => { row[t.map[k] - min] = safeCell_(item[k]); });
      return row;
    });
    t.sh.getRange(startRow, min + 1, items.length, keys.length).setNumberFormat('@').setValues(block);
  } else {
    items.forEach((item, i) => keys.forEach(k => {
      t.sh.getRange(startRow + i, t.map[k] + 1).setNumberFormat('@').setValue(safeCell_(item[k]));
    }));
  }
}

/** Ghi lại các dòng [{row, item}], gộp các dòng liền nhau thành một lệnh ghi. */
function writeEntries_(t, entries) {
  let start = 0;
  for (let i = 1; i <= entries.length; i++) {
    if (i === entries.length || entries[i].row !== entries[i - 1].row + 1) {
      writeRows_(t, entries[start].row, entries.slice(start, i).map(e => e.item));
      start = i;
    }
  }
}

function maxThuTu_(t) {
  return t.rows.reduce((m, cells) => {
    const n = parseInt(cells[t.map.thuTu], 10);
    return isNaN(n) ? m : Math.max(m, n);
  }, 0);
}

/** Trang tính Cài đặt: {sh, values}. Tự tạo trang tính và các mục còn thiếu. */
function settingsSheet_() {
  const ss = ss_();
  let sh = ss.getSheetByName(SETTINGS_SHEET);
  if (!sh) { sh = ss.insertSheet(SETTINGS_SHEET); }
  let values = sh.getDataRange().getDisplayValues();
  if (isBlank_(values)) {
    values = [['Mục', 'Giá trị', 'Khóa (không sửa)']];
    sh.getRange(1, 1, 1, 3).setValues(values);
    formatSheet_(sh, [['muc', '', 300], ['giaTri', '', 320], ['khoa', '', 140]]);
    sh.getRange(1, 3, sh.getMaxRows(), 1).setFontColor('#888888');
    sh.getRange(1, 1, 1, 3).setFontColor('#cc0000');
  }
  const keys = values.map(r => String(r[2] || '').trim());
  const missing = SETTINGS.filter(s => keys.indexOf(s[0]) < 0);
  if (missing.length) {
    const rows = missing.map(([key, label, def]) => [label, def, key]);
    sh.getRange(values.length + 1, 1, rows.length, 3).setNumberFormat('@').setValues(rows);
    values = values.concat(rows);
  }
  return { sh: sh, values: values };
}

function readSettings_() {
  return settingsFromValues_(settingsSheet_().values);
}

function settingsFromValues_(values) {
  const out = {};
  SETTINGS.forEach(([key, , def]) => { out[key] = def; });
  values.forEach(row => {
    const key = String(row[2] || '').trim();
    if (!Object.prototype.hasOwnProperty.call(out, key)) return;
    const v = String(row[1] == null ? '' : row[1]).trim();
    out[key] = SETTING_DATES.indexOf(key) >= 0 ? (toDMY_(v) || v) : v;
  });
  return out;
}

// ------------------------- DATA.JSON / GITHUB -------------------------
//
// data.json = bản chụp toàn bộ kế hoạch, đặt cạnh index.html trên GitHub Pages.
// Trang web đọc data.json (rất nhanh, qua CDN của GitHub) để hiển thị ngay,
// rồi mới hỏi Apps Script ở nền xem có dữ liệu mới hơn không.
// Cấu trúc:
//   { format, version, publishedAt, hash, data: { settings, chuanBi, ngayThi, hauKy, nhanSu } }
//   hash = SHA-256 của JSON phần "data" -> so sánh để biết data.json đã khớp Google Sheets chưa.

/** Phần dữ liệu đưa vào data.json (không có thông tin máy chủ như đường link Google Sheet). */
function dataPart_(all) {
  return { settings: all.settings, chuanBi: all.chuanBi, ngayThi: all.ngayThi, hauKy: all.hauKy, nhanSu: all.nhanSu };
}

/** Đọc mới từ Google Sheets và dựng nội dung data.json. Đồng thời làm mới bộ nhớ đệm của getAll. */
function buildSnapshot_() {
  const all = readFresh_(false);
  const version = getProp_(PROP_VER) || '0';
  const data = dataPart_(all);
  const snap = {
    format: SNAPSHOT_FORMAT,
    version: version,
    publishedAt: new Date().toISOString(),
    hash: sha256_(JSON.stringify(data)),
    data: data,
  };
  return { snap: snap };
}

function publishInfo_() {
  const last = lastPublish_();
  return {
    configured: !!(getProp_(PROP_GH_TOKEN) && getProp_(PROP_GH_REPO)),
    auto: getProp_(PROP_PUB_AUTO) !== 'off',
    lastError: last && last.error ? String(last.error) : '',
  };
}

/** Trạng thái cho trang capnhat.html (không bao giờ trả mã truy cập GitHub). */
function publishStatus_() {
  const all = readFresh_(false);
  const info = publishInfo_();
  const last = lastPublish_();
  return {
    configured: info.configured,
    auto: info.auto,
    repo: getProp_(PROP_GH_REPO),
    branch: getProp_(PROP_GH_BRANCH) || 'main',
    path: getProp_(PROP_GH_PATH) || 'data.json',
    last: last,
    current: {
      hash: sha256_(JSON.stringify(dataPart_(all))),
      counts: { chuanBi: all.chuanBi.length, ngayThi: all.ngayThi.length, hauKy: all.hauKy.length, nhanSu: all.nhanSu.length },
    },
    authRequired: !!getProp_(PROP_KEY),
  };
}

/** true nếu phiên bản a mới hơn b (chỉ so được khi cả hai có dạng thời gian). */
function isNewerVersion_(a, b) {
  const re = /^\d{15}-/;
  return re.test(String(a || '')) && re.test(String(b || '')) && String(a) > String(b);
}

function lastPublish_() {
  try { return JSON.parse(getProp_(PROP_PUB_LAST) || 'null'); } catch (e) { return null; }
}

/** Ghi data.json lên GitHub. Bỏ qua nếu nội dung không đổi (trừ khi force). Lưu lại lỗi nếu có. */
function publish_(force) {
  try {
    return publishInner_(force);
  } catch (e) {
    if (e.code !== 'NOT_CONFIGURED') recordPublish_({ changed: false, error: e.message });
    throw e;
  }
}

function publishInner_(force) {
  const cfg = ghConfig_();
  const snap = buildSnapshot_().snap;
  const last = lastPublish_();
  const recentCommit = !!(last && last.lastCommit && last.lastCommit.at &&
    Date.now() - new Date(last.lastCommit.at).getTime() < 20000);
  const url = '/repos/' + cfg.repo + '/contents/' + cfg.path.split('/').map(encodeURIComponent).join('/');
  let lastMsg = '';
  for (let attempt = 0; attempt < 3; attempt++) {
    const cur = gh_('get', url + '?ref=' + encodeURIComponent(cfg.branch));
    if (cur.code !== 200 && cur.code !== 404) throw ghError_(cur, cfg);
    const sha = cur.code === 200 ? cur.json.sha : null;
    const old = sha ? decodeGhJson_(cur.json.content) : null;
    if (old && isNewerVersion_(old.version, snap.version)) {
      // Một lượt khác vừa ghi bản MỚI HƠN -> không ghi đè bằng dữ liệu cũ
      return recordPublish_({ changed: false, newer: true, hash: old.hash, version: old.version, publishedAt: old.publishedAt || '' });
    }
    if (old && old.hash === snap.hash && (!force || recentCommit)) {
      // Không đổi. "Ghi lại" (force) chỉ được phép cách lần commit trước ít nhất 20 giây (chống tạo hàng loạt commit)
      return recordPublish_({ changed: false, throttled: !!force, hash: snap.hash, version: snap.version, publishedAt: old.publishedAt || '' });
    }
    const body = {
      message: 'Cập nhật ' + cfg.path + ' từ Google Sheets (' + now_() + ')',
      content: Utilities.base64Encode(JSON.stringify(snap), Utilities.Charset.UTF_8),
      branch: cfg.branch,
    };
    if (sha) body.sha = sha;
    const put = gh_('put', url, body);
    if (put.code === 200 || put.code === 201) {
      const commit = (put.json && put.json.commit) || {};
      return recordPublish_({
        changed: true, hash: snap.hash, version: snap.version, publishedAt: snap.publishedAt,
        commit: commit.sha ? String(commit.sha).slice(0, 7) : '', commitUrl: commit.html_url || '',
      });
    }
    lastMsg = (put.json && put.json.message) || ('HTTP ' + put.code);
    // Chỉ thử lại khi data.json vừa bị lượt khác ghi (sha đã đổi); lỗi khác báo ngay
    if (put.code !== 409 && !(put.code === 422 && /sha/i.test(lastMsg))) throw ghError_(put, cfg);
  }
  throw err_('Không ghi được data.json sau 3 lần thử vì file liên tục bị thay đổi (' + lastMsg + '). Vui lòng thử lại sau giây lát.', 'GITHUB');
}

function recordPublish_(res) {
  const prev = lastPublish_();
  res.at = new Date().toISOString();
  // Lần commit gần nhất được giữ riêng: lần bấm "không đổi" / lỗi không che mất thông tin này
  res.lastCommit = res.changed
    ? { at: res.at, commit: res.commit || '', commitUrl: res.commitUrl || '', hash: res.hash }
    : (prev && prev.lastCommit) || null;
  PROPS_MEMO_ = null;
  try {
    PropertiesService.getScriptProperties().setProperty(PROP_PUB_LAST, JSON.stringify(res));
  } catch (e) { /* không quan trọng */ }
  return res;
}

function ghConfig_() {
  const token = getProp_(PROP_GH_TOKEN);
  const repo = getProp_(PROP_GH_REPO);
  if (!token || !repo) {
    throw err_('Chưa cài đặt cập nhật data.json lên GitHub. Trong Google Sheet, chọn menu ' +
      '"🥋 Thi thăng đai → Cài đặt cập nhật data.json (GitHub)".', 'NOT_CONFIGURED');
  }
  return {
    token: token,
    repo: repo.replace(/^https?:\/\/github\.com\//, '').replace(/\.git$/, '').replace(/\/+$/, ''),
    branch: getProp_(PROP_GH_BRANCH) || 'main',
    path: getProp_(PROP_GH_PATH) || 'data.json',
  };
}

function gh_(method, path, payload, token) {
  const res = UrlFetchApp.fetch('https://api.github.com' + path, {
    method: method,
    contentType: 'application/json',
    payload: payload ? JSON.stringify(payload) : undefined,
    headers: {
      Authorization: 'Bearer ' + (token || getProp_(PROP_GH_TOKEN)),
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    muteHttpExceptions: true,
  });
  let json = null;
  try { json = JSON.parse(res.getContentText() || 'null'); } catch (e) { json = null; }
  return { code: res.getResponseCode(), json: json };
}

function ghError_(res, cfg) {
  const msg = (res.json && res.json.message) || ('HTTP ' + res.code);
  if (res.code === 401) return err_('GitHub từ chối mã truy cập (sai hoặc đã hết hạn). Hãy tạo mã mới rồi cài đặt lại.', 'GITHUB');
  if (res.code === 403) return err_('Mã truy cập GitHub không có quyền ghi vào kho ' + cfg.repo + ' (cần quyền "Contents: Read and write"). ' + msg, 'GITHUB');
  if (res.code === 404) return err_('Không tìm thấy kho "' + cfg.repo + '" hoặc nhánh "' + cfg.branch + '" (hoặc mã truy cập không được cấp quyền cho kho này).', 'GITHUB');
  return err_('GitHub báo lỗi: ' + msg, 'GITHUB');
}

function decodeGhJson_(content) {
  try {
    const bytes = Utilities.base64Decode(String(content || '').replace(/\s/g, ''));
    return JSON.parse(Utilities.newBlob(bytes).getDataAsString('UTF-8'));
  } catch (e) {
    return null;
  }
}

function sha256_(s) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s, Utilities.Charset.UTF_8)
    .map(b => ('0' + (b & 0xff).toString(16)).slice(-2)).join('');
}

// ------------------------- BỘ NHỚ ĐỆM / KHÓA -------------------------

function cacheGet_(key) {
  try {
    const raw = CacheService.getScriptCache().get(key);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function cachePut_(key, data) {
  try {
    CacheService.getScriptCache().put(key, JSON.stringify(data), CACHE_TTL);
  } catch (e) { /* dữ liệu quá lớn (>100KB) hoặc bộ nhớ đệm lỗi: bỏ qua, lần sau đọc trực tiếp */ }
}

/** Đánh dấu dữ liệu đã thay đổi -> lần tải sau sẽ đọc lại từ Google Sheets. */
function bumpVersion_() {
  try {
    // Dạng "<mili giây, 15 chữ số>-<ngẫu nhiên>": so sánh được bản nào mới hơn
    PropertiesService.getScriptProperties().setProperty(PROP_VER, String(Date.now()).padStart(15, '0') + '-' + newId_().slice(0, 6));
  } catch (e) { /* bỏ qua: bộ nhớ đệm vẫn tự hết hạn sau CACHE_TTL giây */ }
  PROPS_MEMO_ = null;
}

/** Thao tác ghi: khóa để tránh ghi chồng lên nhau; đổi phiên bản dữ liệu ngay trong khóa. */
function writeOp_(fn) {
  return withLock_(() => {
    try {
      return fn();
    } finally {
      bumpVersion_();
    }
  });
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

function isBlank_(values) {
  return values.every(row => row.every(v => String(v).trim() === ''));
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
  if (!TZ_MEMO_) TZ_MEMO_ = ss_().getSpreadsheetTimeZone();
  return Utilities.formatDate(new Date(), TZ_MEMO_, 'dd/MM/yyyy HH:mm');
}

function newId_() {
  return Utilities.getUuid().replace(/-/g, '').slice(0, 12);
}

/** Thuộc tính tập lệnh: chỉ đọc 1 lần cho mỗi lần chạy. */
function getProp_(k) {
  if (!PROPS_MEMO_) PROPS_MEMO_ = PropertiesService.getScriptProperties().getProperties();
  return PROPS_MEMO_[k] || '';
}

function checkKey_(key) {
  const k = getProp_(PROP_KEY);
  if (k && String(key || '') !== k) {
    throw err_(key ? 'Mã quản trị không đúng.' : 'Cần nhập mã quản trị để chỉnh sửa.', 'AUTH');
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
    .addItem('Cài đặt cập nhật data.json (GitHub)', 'menuCaiDatGitHub')
    .addItem('Cập nhật data.json ngay', 'menuCapNhatDataJson')
    .addItem('Bật / tắt tự động cập nhật data.json', 'menuTuDongDataJson')
    .addSeparator()
    .addItem('Nạp lại dữ liệu mẫu (XÓA dữ liệu hiện có)', 'menuNapLaiDuLieuMau')
    .addToUi();
}

/** Sửa trực tiếp trong Google Sheets -> làm mới bộ nhớ đệm để trang web thấy ngay thay đổi. */
function onEdit() {
  bumpVersion_();
}

/** Trình kích hoạt "Khi thay đổi" (thêm/xóa dòng, cột, trang tính...) — onEdit không bắt được các thay đổi này. */
function khiThayDoiCauTruc() {
  bumpVersion_();
}

/** Cài trình kích hoạt "Khi thay đổi" (một lần). Trả về true nếu vừa cài mới. */
function caiTrinhKichHoat_() {
  const exists = ScriptApp.getProjectTriggers().some(t => t.getHandlerFunction() === 'khiThayDoiCauTruc');
  if (exists) return false;
  ScriptApp.newTrigger('khiThayDoiCauTruc').forSpreadsheet(ss_()).onChange().create();
  return true;
}

/** Chạy hàm này 1 lần (từ trình soạn thảo hoặc menu) để tạo trang tính và dữ liệu mẫu. */
function caiDatBanDau() {
  const res = writeOp_(() => seed_(false));
  const total = Object.keys(res.added).reduce((s, k) => s + res.added[k], 0);
  let msg = total
    ? 'Đã tạo các trang tính và nạp ' + total + ' dòng dữ liệu mẫu.'
    : 'Các trang tính đã có dữ liệu nên không nạp thêm dữ liệu mẫu.';
  try {
    if (caiTrinhKichHoat_()) msg += ' Đã bật tự làm mới khi thêm/xóa dòng trong Sheets.';
  } catch (e) {
    msg += ' (Chưa bật được tự làm mới khi xóa dòng: ' + e.message + ')';
  }
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

/** Lưu kho / nhánh / mã truy cập GitHub rồi thử kết nối. */
function menuCaiDatGitHub() {
  const ui = SpreadsheetApp.getUi();
  const props = PropertiesService.getScriptProperties();
  const curRepo = props.getProperty(PROP_GH_REPO) || '';
  const curBranch = props.getProperty(PROP_GH_BRANCH) || 'main';
  const ask = (title, msg) => {
    const r = ui.prompt(title, msg, ui.ButtonSet.OK_CANCEL);
    if (r.getSelectedButton() !== ui.Button.OK) throw err_('CANCEL', 'CANCEL');
    return r.getResponseText().trim();
  };
  try {
    const repo = ask('1/3 · Kho GitHub', 'Nhập tên kho dạng  chủ-sở-hữu/tên-kho  (ví dụ: lelevietnam99/KEHOACH_THITHANGDAI).' +
      (curRepo ? '\nĐang dùng: ' + curRepo + ' — để trống = giữ nguyên.' : '')) || curRepo;
    if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) { ui.alert('Tên kho không hợp lệ: "' + repo + '"'); return; }
    const branch = ask('2/3 · Nhánh', 'Nhánh đang chạy GitHub Pages. Đang dùng: ' + curBranch + ' — để trống = giữ nguyên.') || curBranch;
    const token = ask('3/3 · Mã truy cập GitHub', 'Dán mã truy cập (Personal access token) có quyền "Contents: Read and write" cho kho ' + repo + '.' +
      (props.getProperty(PROP_GH_TOKEN) ? '\nĐể trống = giữ mã cũ.' : '')) || props.getProperty(PROP_GH_TOKEN) || '';
    if (!token) { ui.alert('Chưa nhập mã truy cập GitHub.'); return; }
    const test = gh_('get', '/repos/' + repo, null, token);
    if (test.code !== 200) { ui.alert('Không kết nối được: ' + ghError_(test, { repo: repo, branch: branch }).message); return; }
    if (test.json && test.json.permissions && test.json.permissions.push === false) {
      ui.alert('Mã truy cập này chỉ có quyền đọc kho ' + repo + '. Hãy cấp quyền "Contents: Read and write".');
      return;
    }
    props.setProperties({ [PROP_GH_REPO]: repo, [PROP_GH_BRANCH]: branch, [PROP_GH_TOKEN]: token });
    PROPS_MEMO_ = null;
    try { caiTrinhKichHoat_(); } catch (e) { /* không bắt buộc */ }
    ui.alert('Đã kết nối GitHub. ' + publishMessage_(publish_(true)));
  } catch (e) {
    if (e.code !== 'CANCEL') ui.alert('Lỗi: ' + e.message);
  }
}

function publishMessage_(res) {
  if (res.changed) return 'Đã ghi data.json lên GitHub' + (res.commit ? ' (commit ' + res.commit + ')' : '') +
    '.\nGitHub Pages sẽ phát hành bản mới sau khoảng 1 phút.';
  if (res.newer) return 'data.json trên GitHub đã là bản mới hơn — không cần ghi.';
  if (res.throttled) return 'data.json vừa được ghi cách đây chưa tới 20 giây và dữ liệu không đổi — không ghi lại.';
  return 'data.json đã khớp với Google Sheets — không cần ghi lại.';
}

function menuCapNhatDataJson() {
  const ui = SpreadsheetApp.getUi();
  try {
    ui.alert(publishMessage_(publish_(true)));
  } catch (e) {
    ui.alert('Lỗi: ' + e.message);
  }
}

function menuTuDongDataJson() {
  const ui = SpreadsheetApp.getUi();
  const props = PropertiesService.getScriptProperties();
  const on = props.getProperty(PROP_PUB_AUTO) !== 'off';
  if (ui.alert(on ? 'Đang BẬT tự động cập nhật data.json' : 'Đang TẮT tự động cập nhật data.json',
    on ? 'Sau mỗi lần sửa trên trang web, data.json được cập nhật sau ~20 giây. Bạn muốn TẮT?'
       : 'Bạn muốn BẬT lại? (data.json sẽ tự cập nhật ~20 giây sau mỗi lần sửa trên trang web)',
    ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
  props.setProperty(PROP_PUB_AUTO, on ? 'off' : 'on');
  ui.alert(on ? 'Đã tắt. Dùng trang capnhat.html hoặc menu để cập nhật thủ công.' : 'Đã bật.');
}

function menuNapLaiDuLieuMau() {
  const ui = SpreadsheetApp.getUi();
  if (ui.alert('Nạp lại dữ liệu mẫu?', 'Toàn bộ dữ liệu hiện có ở 4 trang tính kế hoạch sẽ bị XÓA và thay bằng dữ liệu mẫu.',
    ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
  writeOp_(() => seed_(true));
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
