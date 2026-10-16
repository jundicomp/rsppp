/**
 * Upload Dokumen C1 Pemilu 2024 — Backend Google Apps Script
 * Dibuat oleh RSPP DPW PKS Sumsel, 2026.
 *
 * Database : Google Sheet tempat script ini ditempel (Extensions > Apps Script)
 * File     : Folder Google Drive, ID-nya disimpan di Script Properties "FOLDER_ID"
 *
 * Langkah setup ada di README.md (bagian "Setup Backend").
 */

// ====== KONFIGURASI ======
var SESSION_DAYS = 7;            // lama login berlaku
var MAX_FILE_MB = 35;            // batas aman payload Apps Script (base64 menambah ~33%)
var JENIS = ['dprri', 'prov', 'kab', 'dpd', 'pilpres'];
var JENIS_LABEL = { dprri: 'DPR RI', prov: 'DPRD Provinsi', kab: 'DPRD Kab/Kota', dpd: 'DPD RI', pilpres: 'Pilpres' };
var TINGKAT = ['DPR RI', 'DPRD Provinsi', 'DPRD Kab/Kota', 'DPD RI'];
var ROLES = ['superadmin', 'admin', 'dpd'];

var SHEETS = {
  Users: ['id', 'username', 'nama', 'role', 'dpdId', 'passHash', 'salt', 'aktif', 'createdAt', 'lastLogin'],
  Sessions: ['token', 'userId', 'expires'],
  DPD: ['id', 'nama', 'jumlahKecamatan', 'updatedAt'],
  C1: ['id', 'dpdId', 'jenis', 'keterangan', 'fileName', 'fileId', 'fileUrl', 'mime', 'size', 'uploader', 'uploadedAt', 'userId'],
  Bacaleg: ['id', 'dpdId', 'nama', 'tingkat', 'profil', 'pengusul', 'pencatat', 'createdAt', 'userId'],
  Submissions: ['id', 'dpdId', 'userId', 'uploader', 'submittedAt', 'totalC1', 'totalBacaleg'],
  Settings: ['key', 'value']
};

var DPD_SUMSEL = [
  'Kota Palembang', 'Kota Prabumulih', 'Kota Pagar Alam', 'Kota Lubuklinggau',
  'Kab. Banyuasin', 'Kab. Empat Lawang', 'Kab. Lahat', 'Kab. Muara Enim',
  'Kab. Musi Banyuasin', 'Kab. Musi Rawas', 'Kab. Musi Rawas Utara', 'Kab. Ogan Ilir',
  'Kab. Ogan Komering Ilir', 'Kab. Ogan Komering Ulu', 'Kab. OKU Selatan', 'Kab. OKU Timur',
  'Kab. Penukal Abab Lematang Ilir'
];

// ====== SETUP (jalankan sekali dari editor) ======
function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(SHEETS).forEach(function (name) {
    var sh = ss.getSheetByName(name) || ss.insertSheet(name);
    if (sh.getLastRow() === 0) {
      sh.appendRow(SHEETS[name]);
      sh.setFrozenRows(1);
      sh.getRange(1, 1, 1, SHEETS[name].length).setFontWeight('bold');
    }
  });
  if (rows_('DPD').length === 0) {
    DPD_SUMSEL.forEach(function (n, i) {
      append_('DPD', { id: 'dpd' + pad_(i + 1), nama: 'DPD PKS ' + n, jumlahKecamatan: '', updatedAt: now_() });
    });
  }
  if (rows_('Settings').length === 0) {
    append_('Settings', { key: 'waAdmin', value: '' });
    append_('Settings', { key: 'namaAdmin', value: 'Admin RSPP DPW PKS Sumsel' });
    append_('Settings', { key: 'appUrl', value: '' });
  }
  var msg = 'Setup selesai.';
  if (!rows_('Users').some(function (u) { return u.role === 'superadmin'; })) {
    var pass = Utilities.getUuid().slice(0, 10);
    createUser_({ username: 'superadmin', nama: 'Super Admin', role: 'superadmin', dpdId: '', password: pass });
    msg += '\nAkun superadmin dibuat.\nUsername: superadmin\nPassword: ' + pass + '\n(SEGERA ganti setelah login)';
  }
  if (!PropertiesService.getScriptProperties().getProperty('FOLDER_ID')) {
    msg += '\n\nPERHATIAN: Script Property FOLDER_ID belum diisi.';
  }
  Logger.log(msg);
  return msg;
}

// ====== HTTP ENTRY ======
function doGet() {
  return json_({ ok: true, app: 'Upload Dokumen C1 Pemilu 2024', time: now_() });
}

function doPost(e) {
  try {
    var req = JSON.parse(e.postData.contents || '{}');
    var action = req.action;
    if (action === 'login') return json_(login_(req));
    var user = auth_(req.token);
    var h = HANDLERS[action];
    if (!h) throw new Error('Aksi tidak dikenal: ' + action);
    if (h.roles && h.roles.indexOf(user.role) < 0) throw new Error('Akses ditolak');
    return json_({ ok: true, data: h.fn(req, user) });
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message || err) });
  }
}

var ALL = ['superadmin', 'admin', 'dpd'];
var ADM = ['superadmin', 'admin'];
var SUP = ['superadmin'];

var HANDLERS = {
  me: { roles: ALL, fn: function (r, u) { return publicUser_(u); } },
  logout: { roles: ALL, fn: function (r) { deleteWhere_('Sessions', 'token', r.token); return true; } },
  changePassword: { roles: ALL, fn: changePassword_ },

  listDpd: { roles: ALL, fn: function (r, u) {
    var all = rows_('DPD');
    return u.role === 'dpd' ? all.filter(function (d) { return d.id === u.dpdId; }) : all;
  } },
  setKecamatan: { roles: ALL, fn: setKecamatan_ },

  listC1: { roles: ALL, fn: function (r, u) { return rows_('C1').filter(scopeFilter_(r, u)); } },
  uploadC1: { roles: ['dpd', 'superadmin'], fn: uploadC1_ },
  updateC1: { roles: ['dpd', 'superadmin'], fn: updateC1_ },
  deleteC1: { roles: ['dpd', 'superadmin'], fn: deleteC1_ },

  listBacaleg: { roles: ALL, fn: function (r, u) { return rows_('Bacaleg').filter(scopeFilter_(r, u)); } },
  saveBacaleg: { roles: ['dpd', 'superadmin'], fn: saveBacaleg_ },
  deleteBacaleg: { roles: ['dpd', 'superadmin'], fn: deleteBacaleg_ },

  submit: { roles: ['dpd', 'superadmin'], fn: submit_ },
  dashboard: { roles: ALL, fn: dashboard_ },

  getSettings: { roles: ALL, fn: function () { return settings_(); } },
  saveSettings: { roles: SUP, fn: saveSettings_ },
  listUsers: { roles: SUP, fn: function () { return rows_('Users').map(publicUser_); } },
  saveUser: { roles: SUP, fn: saveUser_ },
  resetPassword: { roles: SUP, fn: resetPassword_ },
  saveDpd: { roles: SUP, fn: saveDpd_ }
};

// ====== AUTH ======
function login_(req) {
  var uname = String(req.username || '').trim().toLowerCase();
  var u = rows_('Users').filter(function (x) { return String(x.username).toLowerCase() === uname; })[0];
  if (!u || hash_(String(req.password || ''), u.salt) !== u.passHash) return { ok: false, error: 'Username atau password salah' };
  if (!truthy_(u.aktif)) return { ok: false, error: 'Akun dinonaktifkan. Hubungi admin.' };
  var token = Utilities.getUuid() + Utilities.getUuid().slice(0, 8);
  var exp = new Date(Date.now() + SESSION_DAYS * 864e5).toISOString();
  withLock_(function () {
    append_('Sessions', { token: token, userId: u.id, expires: exp });
    update_('Users', u.id, { lastLogin: now_() });
    // bersihkan sesi kedaluwarsa
    var nowIso = new Date().toISOString();
    rows_('Sessions').filter(function (s) { return s.expires < nowIso; })
      .forEach(function (s) { deleteWhere_('Sessions', 'token', s.token); });
  });
  return { ok: true, data: { token: token, user: publicUser_(u) } };
}

function auth_(token) {
  if (!token) throw new Error('Sesi habis, silakan login lagi');
  var cache = CacheService.getScriptCache();
  var cached = cache.get('s_' + token);
  var userId = cached;
  if (!userId) {
    var s = rows_('Sessions').filter(function (x) { return x.token === token; })[0];
    if (!s || s.expires < new Date().toISOString()) throw new Error('Sesi habis, silakan login lagi');
    userId = s.userId;
    cache.put('s_' + token, userId, 1800);
  }
  var u = rows_('Users').filter(function (x) { return x.id === userId; })[0];
  if (!u || !truthy_(u.aktif)) throw new Error('Akun tidak aktif');
  return u;
}

function publicUser_(u) {
  var dpd = u.dpdId ? rows_('DPD').filter(function (d) { return d.id === u.dpdId; })[0] : null;
  return { id: u.id, username: u.username, nama: u.nama, role: u.role, dpdId: u.dpdId || '',
    dpdNama: dpd ? dpd.nama : '', aktif: truthy_(u.aktif), lastLogin: u.lastLogin || '', createdAt: u.createdAt || '' };
}

function changePassword_(r, u) {
  if (hash_(String(r.oldPassword || ''), u.salt) !== u.passHash) throw new Error('Password lama salah');
  if (String(r.newPassword || '').length < 6) throw new Error('Password baru minimal 6 karakter');
  var salt = Utilities.getUuid();
  update_('Users', u.id, { salt: salt, passHash: hash_(r.newPassword, salt) });
  return true;
}

// ====== USERS (superadmin) ======
function createUser_(d) {
  var salt = Utilities.getUuid();
  var row = { id: 'u' + Date.now().toString(36) + Math.floor(Math.random() * 1e4), username: String(d.username).trim().toLowerCase(),
    nama: d.nama || '', role: d.role, dpdId: d.role === 'dpd' ? d.dpdId : '', passHash: hash_(String(d.password), salt),
    salt: salt, aktif: true, createdAt: now_(), lastLogin: '' };
  append_('Users', row);
  return row;
}

function saveUser_(r) {
  var d = r.user || {};
  if (ROLES.indexOf(d.role) < 0) throw new Error('Role tidak valid');
  if (d.role === 'dpd' && !d.dpdId) throw new Error('Pilih DPD untuk user dengan role DPD');
  if (!/^[a-z0-9._-]{3,}$/i.test(String(d.username || ''))) throw new Error('Username minimal 3 karakter (huruf, angka, titik, minus)');
  return withLock_(function () {
    var users = rows_('Users');
    var dup = users.filter(function (x) { return String(x.username).toLowerCase() === String(d.username).toLowerCase() && x.id !== d.id; })[0];
    if (dup) throw new Error('Username sudah dipakai');
    if (d.id) {
      update_('Users', d.id, { username: String(d.username).toLowerCase(), nama: d.nama, role: d.role,
        dpdId: d.role === 'dpd' ? d.dpdId : '', aktif: d.aktif !== false });
      if (d.aktif === false) clearSessions_(d.id);
      return publicUser_(rows_('Users').filter(function (x) { return x.id === d.id; })[0]);
    }
    if (String(d.password || '').length < 6) throw new Error('Password minimal 6 karakter');
    return publicUser_(createUser_(d));
  });
}

function resetPassword_(r) {
  if (String(r.password || '').length < 6) throw new Error('Password minimal 6 karakter');
  var salt = Utilities.getUuid();
  update_('Users', r.userId, { salt: salt, passHash: hash_(r.password, salt) });
  clearSessions_(r.userId);
  return true;
}

function clearSessions_(userId) {
  rows_('Sessions').filter(function (s) { return s.userId === userId; })
    .forEach(function (s) { deleteWhere_('Sessions', 'token', s.token); CacheService.getScriptCache().remove('s_' + s.token); });
}

// ====== DPD ======
function setKecamatan_(r, u) {
  var dpdId = u.role === 'dpd' ? u.dpdId : r.dpdId;
  if (u.role === 'admin') throw new Error('Akses ditolak');
  var n = parseInt(r.jumlahKecamatan, 10);
  if (!(n > 0 && n < 200)) throw new Error('Jumlah kecamatan tidak valid');
  update_('DPD', dpdId, { jumlahKecamatan: n, updatedAt: now_() });
  return true;
}

function saveDpd_(r) {
  var d = r.dpd || {};
  return withLock_(function () {
    if (d.id) { update_('DPD', d.id, { nama: d.nama, jumlahKecamatan: d.jumlahKecamatan || '', updatedAt: now_() }); return d; }
    var row = { id: 'dpd' + Date.now().toString(36), nama: d.nama, jumlahKecamatan: d.jumlahKecamatan || '', updatedAt: now_() };
    append_('DPD', row);
    return row;
  });
}

// ====== C1 ======
function scopeFilter_(r, u) {
  return function (row) {
    if (u.role === 'dpd') return row.dpdId === u.dpdId;
    return !r.dpdId || row.dpdId === r.dpdId;
  };
}

function targetDpd_(r, u) {
  if (u.role === 'dpd') return u.dpdId;
  if (!r.dpdId) throw new Error('dpdId wajib');
  return r.dpdId;
}

function uploadC1_(r, u) {
  var dpdId = targetDpd_(r, u);
  if (JENIS.indexOf(r.jenis) < 0) throw new Error('Jenis C1 tidak valid');
  if (!String(r.uploader || '').trim()) throw new Error('Nama pengupload wajib diisi');
  if (!r.base64) throw new Error('File kosong');
  var bytes = Utilities.base64Decode(r.base64);
  if (bytes.length > MAX_FILE_MB * 1024 * 1024) throw new Error('File terlalu besar (maks ' + MAX_FILE_MB + ' MB)');
  var folder = jenisFolder_(dpdId, r.jenis);
  var safe = String(r.fileName || 'file').replace(/[\\/:*?"<>|]/g, '_');
  var file = folder.createFile(Utilities.newBlob(bytes, r.mime || 'application/octet-stream', safe));
  var row = { id: 'c' + Date.now().toString(36) + Math.floor(Math.random() * 1e4), dpdId: dpdId, jenis: r.jenis,
    keterangan: String(r.keterangan || '').trim(), fileName: safe, fileId: file.getId(), fileUrl: file.getUrl(),
    mime: r.mime || '', size: bytes.length, uploader: String(r.uploader).trim(), uploadedAt: now_(), userId: u.id };
  withLock_(function () { append_('C1', row); });
  return row;
}

function updateC1_(r, u) {
  var row = rows_('C1').filter(function (x) { return x.id === r.id; })[0];
  if (!row || (u.role === 'dpd' && row.dpdId !== u.dpdId)) throw new Error('Data tidak ditemukan');
  update_('C1', r.id, { keterangan: String(r.keterangan || '').trim() });
  return true;
}

function deleteC1_(r, u) {
  var row = rows_('C1').filter(function (x) { return x.id === r.id; })[0];
  if (!row || (u.role === 'dpd' && row.dpdId !== u.dpdId)) throw new Error('Data tidak ditemukan');
  try { DriveApp.getFileById(row.fileId).setTrashed(true); } catch (e) {}
  withLock_(function () { deleteWhere_('C1', 'id', r.id); });
  return true;
}

function rootFolder_() {
  var id = PropertiesService.getScriptProperties().getProperty('FOLDER_ID');
  if (!id) throw new Error('FOLDER_ID belum diatur di Script Properties');
  return DriveApp.getFolderById(id);
}

function subFolder_(parent, name) {
  var it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : parent.createFolder(name);
}

function jenisFolder_(dpdId, jenis) {
  var dpd = rows_('DPD').filter(function (d) { return d.id === dpdId; })[0];
  var dpdFolder = subFolder_(rootFolder_(), dpd ? dpd.nama : dpdId);
  return subFolder_(dpdFolder, 'C1 ' + JENIS_LABEL[jenis]);
}

// ====== BACALEG ======
function saveBacaleg_(r, u) {
  var b = r.bacaleg || {};
  var dpdId = targetDpd_(r, u);
  ['nama', 'tingkat', 'profil', 'pengusul'].forEach(function (f) {
    if (!String(b[f] || '').trim()) throw new Error('Field ' + f + ' wajib diisi');
  });
  if (TINGKAT.indexOf(b.tingkat) < 0) throw new Error('Tingkat caleg tidak valid');
  return withLock_(function () {
    if (b.id) {
      var old = rows_('Bacaleg').filter(function (x) { return x.id === b.id; })[0];
      if (!old || (u.role === 'dpd' && old.dpdId !== u.dpdId)) throw new Error('Data tidak ditemukan');
      update_('Bacaleg', b.id, { nama: b.nama, tingkat: b.tingkat, profil: b.profil, pengusul: b.pengusul });
      return Object.assign(old, b);
    }
    var row = { id: 'b' + Date.now().toString(36) + Math.floor(Math.random() * 1e4), dpdId: dpdId, nama: b.nama.trim(),
      tingkat: b.tingkat, profil: b.profil.trim(), pengusul: b.pengusul.trim(), pencatat: String(r.uploader || u.nama),
      createdAt: now_(), userId: u.id };
    append_('Bacaleg', row);
    return row;
  });
}

function deleteBacaleg_(r, u) {
  var row = rows_('Bacaleg').filter(function (x) { return x.id === r.id; })[0];
  if (!row || (u.role === 'dpd' && row.dpdId !== u.dpdId)) throw new Error('Data tidak ditemukan');
  withLock_(function () { deleteWhere_('Bacaleg', 'id', r.id); });
  return true;
}

// ====== SUBMIT & DASHBOARD ======
function submit_(r, u) {
  var dpdId = targetDpd_(r, u);
  var c1 = rows_('C1').filter(function (x) { return x.dpdId === dpdId; });
  var missing = c1.filter(function (x) { return !String(x.keterangan).trim(); }).length;
  if (missing) throw new Error(missing + ' dokumen C1 belum ada keterangannya');
  var bc = rows_('Bacaleg').filter(function (x) { return x.dpdId === dpdId; });
  var row = { id: 's' + Date.now().toString(36), dpdId: dpdId, userId: u.id, uploader: r.uploader || u.nama,
    submittedAt: now_(), totalC1: c1.length, totalBacaleg: bc.length };
  withLock_(function () { append_('Submissions', row); });
  return row;
}

function dashboard_(r, u) {
  var dpds = rows_('DPD');
  if (u.role === 'dpd') dpds = dpds.filter(function (d) { return d.id === u.dpdId; });
  var c1 = rows_('C1'), bc = rows_('Bacaleg'), subs = rows_('Submissions');
  return dpds.map(function (d) {
    var counts = {};
    JENIS.forEach(function (j) { counts[j] = 0; });
    var last = '';
    c1.forEach(function (x) {
      if (x.dpdId !== d.id) return;
      counts[x.jenis] = (counts[x.jenis] || 0) + 1;
      if (String(x.uploadedAt) > last) last = String(x.uploadedAt);
    });
    var lastSubmit = '';
    subs.forEach(function (s) { if (s.dpdId === d.id && String(s.submittedAt) > lastSubmit) lastSubmit = String(s.submittedAt); });
    return { id: d.id, nama: d.nama, jumlahKecamatan: parseInt(d.jumlahKecamatan, 10) || 0, counts: counts,
      bacaleg: bc.filter(function (x) { return x.dpdId === d.id; }).length, lastUpload: last, lastSubmit: lastSubmit };
  });
}

// ====== SETTINGS ======
function settings_() {
  var o = {};
  rows_('Settings').forEach(function (s) { o[s.key] = s.value; });
  return o;
}

function saveSettings_(r) {
  var s = r.settings || {};
  return withLock_(function () {
    Object.keys(s).forEach(function (k) {
      var ex = rows_('Settings').filter(function (x) { return x.key === k; })[0];
      if (ex) updateBy_('Settings', 'key', k, { value: String(s[k]) });
      else append_('Settings', { key: k, value: String(s[k]) });
    });
    return settings_();
  });
}

// ====== SHEET HELPERS ======
function sheet_(name) {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!sh) throw new Error('Sheet ' + name + ' belum ada. Jalankan setup().');
  return sh;
}

function rows_(name) {
  var sh = sheet_(name);
  var last = sh.getLastRow();
  if (last < 2) return [];
  var vals = sh.getRange(1, 1, last, sh.getLastColumn()).getValues();
  var head = vals[0];
  return vals.slice(1).map(function (v) {
    var o = {};
    head.forEach(function (h, i) { o[h] = v[i] instanceof Date ? v[i].toISOString() : v[i]; });
    return o;
  });
}

function append_(name, obj) {
  var head = SHEETS[name];
  sheet_(name).appendRow(head.map(function (h) { return obj[h] === undefined ? '' : obj[h]; }));
}

function update_(name, id, patch) { return updateBy_(name, 'id', id, patch); }

function updateBy_(name, keyCol, keyVal, patch) {
  var sh = sheet_(name);
  var head = SHEETS[name];
  var col = head.indexOf(keyCol) + 1;
  var last = sh.getLastRow();
  if (last < 2) return false;
  var keys = sh.getRange(2, col, last - 1, 1).getValues();
  for (var i = 0; i < keys.length; i++) {
    if (String(keys[i][0]) === String(keyVal)) {
      Object.keys(patch).forEach(function (k) {
        var c = head.indexOf(k);
        if (c >= 0) sh.getRange(i + 2, c + 1).setValue(patch[k]);
      });
      return true;
    }
  }
  return false;
}

function deleteWhere_(name, keyCol, keyVal) {
  var sh = sheet_(name);
  var col = SHEETS[name].indexOf(keyCol) + 1;
  var last = sh.getLastRow();
  if (last < 2) return;
  var keys = sh.getRange(2, col, last - 1, 1).getValues();
  for (var i = keys.length - 1; i >= 0; i--) {
    if (String(keys[i][0]) === String(keyVal)) sh.deleteRow(i + 2);
  }
}

function withLock_(fn) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try { return fn(); } finally { lock.releaseLock(); }
}

function hash_(pass, salt) {
  var raw = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + '|' + pass, Utilities.Charset.UTF_8);
  return raw.map(function (b) { return ('0' + (b & 0xff).toString(16)).slice(-2); }).join('');
}

function truthy_(v) { return v === true || String(v).toUpperCase() === 'TRUE'; }
function now_() { return new Date().toISOString(); }
function pad_(n) { return ('0' + n).slice(-2); }
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
