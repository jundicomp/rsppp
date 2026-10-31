/**
 * Upload Dokumen Hasil Suara Pemilu 2024 — Backend Google Apps Script
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
var FRESH_MINUTES = 60;          // keterangan boleh dikoreksi tanpa password selama 60 menit setelah upload oleh orang yang sama
var JENIS = ['dprri', 'prov', 'kab', 'dpd', 'pilpres'];
var JENIS_LABEL = { dprri: 'DPR RI', prov: 'DPRD Provinsi', kab: 'DPRD Kab/Kota', dpd: 'DPD RI', pilpres: 'Pilpres' };
var TINGKAT = ['DPR RI', 'DPRD Provinsi', 'DPRD Kab/Kota', 'DPD RI'];
var ROLES = ['superadmin', 'admin', 'dpd'];
var RESET_MINUTES = 15;          // kode lupa password berlaku 15 menit
var APP_NAME = 'Upload Dokumen Hasil Suara Pemilu 2024';

var SHEETS = {
  Users: ['id', 'username', 'nama', 'role', 'dpdId', 'passHash', 'salt', 'aktif', 'createdAt', 'lastLogin', 'email', 'resetHash', 'resetExp', 'resetTries'],
  Sessions: ['token', 'userId', 'expires'],
  DPD: ['id', 'nama', 'jumlahKecamatan', 'updatedAt'],
  C1: ['id', 'dpdId', 'jenis', 'keterangan', 'fileName', 'fileId', 'fileUrl', 'mime', 'size', 'uploader', 'uploadedAt', 'userId', 'updatedAt', 'updatedBy', 'namaAsli'],
  Bacaleg: ['id', 'dpdId', 'nama', 'tingkat', 'profil', 'pengusul', 'pencatat', 'createdAt', 'userId', 'updatedAt', 'updatedBy'],
  Log: ['id', 'waktu', 'userId', 'username', 'dpdId', 'aksi', 'objek', 'objekId', 'detail', 'alasan'],
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
    } else {
      // migrasi: tambahkan kolom baru di ujung kanan kalau belum ada (data lama aman)
      var head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
      SHEETS[name].forEach(function (col) {
        if (head.indexOf(col) < 0) {
          var c = sh.getLastColumn() + 1;
          sh.getRange(1, c).setValue(col).setFontWeight('bold');
          head.push(col);
        }
      });
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
  var akun = buatAkunDpd_();
  if (akun.length) {
    msg += '\n\nAkun operator DPD dibuat (' + akun.length + '). Catat dan bagikan ke masing-masing DPD:\n' +
      akun.map(function (a) { return '- ' + a.dpd + ' → username: ' + a.username + ' | password: ' + a.password; }).join('\n') +
      '\nOperator bisa mengisi email di menu Akun Saya supaya bisa reset password sendiri.';
  }
  if (!PropertiesService.getScriptProperties().getProperty('FOLDER_ID')) {
    msg += '\n\nPERHATIAN: Script Property FOLDER_ID belum diisi.';
  }
  Logger.log(msg);
  return msg;
}

// Buat akun operator untuk setiap DPD yang belum punya. Username: dpd.<nama kab/kota>, contoh dpd.palembang
function buatAkunDpd_() {
  var users = rows_('Users');
  var out = [];
  rows_('DPD').forEach(function (d) {
    if (users.some(function (u) { return u.role === 'dpd' && u.dpdId === d.id; })) return;
    var nm = String(d.nama).replace(/^DPD PKS\s+/i, '');
    var uname = 'dpd.' + nm.replace(/^(Kota|Kab\.?|Kabupaten)\s+/i, '').toLowerCase().replace(/[^a-z0-9]+/g, '');
    if (users.some(function (u) { return String(u.username).toLowerCase() === uname; })) uname += '.' + d.id;
    var pass = randPass_();
    users.push(createUser_({ username: uname, nama: 'Operator ' + nm, role: 'dpd', dpdId: d.id, password: pass }));
    out.push({ dpd: nm, username: uname, password: pass });
  });
  return out;
}

function randPass_() {
  var c = 'abcdefghjkmnpqrstuvwxyz23456789', s = '';
  for (var i = 0; i < 8; i++) s += c.charAt(Math.floor(Math.random() * c.length));
  return s;
}

// ====== HTTP ENTRY ======
function doGet() {
  return json_({ ok: true, app: 'Upload Dokumen Hasil Suara Pemilu 2024', time: now_() });
}

function doPost(e) {
  try {
    var req = JSON.parse(e.postData.contents || '{}');
    var action = req.action;
    if (action === 'login') return json_(login_(req));
    if (action === 'forgotPassword') return json_({ ok: true, data: forgotPassword_(req) });
    if (action === 'resetWithCode') return json_({ ok: true, data: resetWithCode_(req) });
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
  saveMyEmail: { roles: ALL, fn: saveMyEmail_ },

  listDpd: { roles: ALL, fn: function (r, u) {
    var all = rows_('DPD');
    return u.role === 'dpd' ? all.filter(function (d) { return d.id === u.dpdId; }) : all;
  } },
  setKecamatan: { roles: ALL, fn: setKecamatan_ },

  listC1: { roles: ALL, fn: function (r, u) { return rows_('C1').filter(scopeFilter_(r, u)); } },
  uploadC1: { roles: ['dpd', 'superadmin'], fn: uploadC1_ },
  updateC1: { roles: ['dpd', 'superadmin'], fn: updateC1_ },
  editC1: { roles: ['dpd', 'superadmin'], fn: editC1_ },
  deleteC1: { roles: ['dpd', 'superadmin'], fn: deleteC1_ },
  getFile: { roles: ALL, fn: getFile_ },
  listLog: { roles: ALL, fn: function (r, u) {
    return rows_('Log').filter(scopeFilter_(r, u)).sort(function (a, b) { return String(b.waktu).localeCompare(String(a.waktu)); });
  } },

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
    dpdNama: dpd ? dpd.nama : '', aktif: truthy_(u.aktif), lastLogin: u.lastLogin || '', createdAt: u.createdAt || '', email: u.email || '' };
}

function changePassword_(r, u) {
  if (hash_(String(r.oldPassword || ''), u.salt) !== u.passHash) throw new Error('Password lama salah');
  if (String(r.newPassword || '').length < 6) throw new Error('Password baru minimal 6 karakter');
  var salt = Utilities.getUuid();
  update_('Users', u.id, { salt: salt, passHash: hash_(r.newPassword, salt) });
  return true;
}

// ====== EMAIL & LUPA PASSWORD ======
function normEmail_(e) {
  var v = String(e || '').trim().toLowerCase();
  if (v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) throw new Error('Format email tidak valid');
  return v;
}

function checkEmailFree_(email, userId) {
  if (!email) return;
  var dup = rows_('Users').filter(function (x) { return String(x.email).toLowerCase() === email && x.id !== userId; })[0];
  if (dup) throw new Error('Email sudah dipakai akun lain');
}

// User mengisi / mengganti email sendiri (perlu password supaya aman)
function saveMyEmail_(r, u) {
  verifyPass_(u, r.password);
  var email = normEmail_(r.email);
  return withLock_(function () {
    checkEmailFree_(email, u.id);
    update_('Users', u.id, { email: email });
    return { email: email };
  });
}

function maskEmail_(e) {
  var p = String(e).split('@');
  var n = p[0];
  return (n.length <= 2 ? n.charAt(0) + '*' : n.slice(0, 2) + new Array(Math.max(2, n.length - 2) + 1).join('*')) + '@' + p[1];
}

// Langkah 1: kirim kode 6 angka ke email akun. Input: username atau email.
function forgotPassword_(req) {
  var key = String(req.username || '').trim().toLowerCase();
  if (!key) throw new Error('Isi username atau email');
  var u = rows_('Users').filter(function (x) {
    return String(x.username).toLowerCase() === key || (x.email && String(x.email).toLowerCase() === key);
  })[0];
  if (!u || !truthy_(u.aktif)) throw new Error('Akun tidak ditemukan atau tidak aktif');
  if (!u.email) throw new Error('Akun ini belum punya email. Hubungi admin untuk reset password.');
  // cegah kirim berulang: tunggu 60 detik
  if (u.resetExp && new Date(u.resetExp).getTime() - Date.now() > (RESET_MINUTES - 1) * 60000) {
    throw new Error('Kode baru saja dikirim. Tunggu 1 menit sebelum minta lagi.');
  }
  var code = String(Math.floor(100000 + Math.random() * 900000));
  var exp = new Date(Date.now() + RESET_MINUTES * 60000).toISOString();
  withLock_(function () { update_('Users', u.id, { resetHash: hash_(code, u.salt), resetExp: exp, resetTries: 0 }); });
  MailApp.sendEmail({
    to: u.email,
    subject: 'Kode reset password - ' + APP_NAME,
    body: 'Halo ' + (u.nama || u.username) + ',\n\n' +
      'Kode untuk reset password akun "' + u.username + '":\n\n    ' + code + '\n\n' +
      'Kode berlaku ' + RESET_MINUTES + ' menit. Kalau Anda tidak meminta reset password, abaikan email ini.\n\n' +
      APP_NAME + '\nRSPP DPW PKS Sumsel'
  });
  return { username: u.username, email: maskEmail_(u.email), minutes: RESET_MINUTES };
}

// Langkah 2: cek kode lalu ganti password.
function resetWithCode_(req) {
  var key = String(req.username || '').trim().toLowerCase();
  var u = rows_('Users').filter(function (x) {
    return String(x.username).toLowerCase() === key || (x.email && String(x.email).toLowerCase() === key);
  })[0];
  if (!u || !u.resetHash) throw new Error('Minta kode reset dulu');
  if (!u.resetExp || new Date(u.resetExp).getTime() < Date.now()) throw new Error('Kode sudah kedaluwarsa. Minta kode baru.');
  var tries = parseInt(u.resetTries, 10) || 0;
  if (tries >= 5) throw new Error('Terlalu banyak percobaan. Minta kode baru.');
  if (hash_(String(req.code || '').trim(), u.salt) !== u.resetHash) {
    update_('Users', u.id, { resetTries: tries + 1 });
    throw new Error('Kode salah. Sisa percobaan: ' + (4 - tries));
  }
  if (String(req.newPassword || '').length < 6) throw new Error('Password baru minimal 6 karakter');
  var salt = Utilities.getUuid();
  withLock_(function () {
    update_('Users', u.id, { salt: salt, passHash: hash_(String(req.newPassword), salt), resetHash: '', resetExp: '', resetTries: 0 });
    clearSessions_(u.id);
  });
  return true;
}

// ====== USERS (superadmin) ======
function createUser_(d) {
  var salt = Utilities.getUuid();
  var row = { id: 'u' + Date.now().toString(36) + Math.floor(Math.random() * 1e4), username: String(d.username).trim().toLowerCase(),
    nama: d.nama || '', role: d.role, dpdId: d.role === 'dpd' ? d.dpdId : '', passHash: hash_(String(d.password), salt),
    salt: salt, aktif: true, createdAt: now_(), lastLogin: '', email: d.email ? normEmail_(d.email) : '' };
  append_('Users', row);
  return row;
}

function saveUser_(r) {
  var d = r.user || {};
  if (ROLES.indexOf(d.role) < 0) throw new Error('Role tidak valid');
  if (d.role === 'dpd' && !d.dpdId) throw new Error('Pilih DPD untuk user dengan role DPD');
  if (!/^[a-z0-9._-]{3,}$/i.test(String(d.username || ''))) throw new Error('Username minimal 3 karakter (huruf, angka, titik, minus)');
  var email = normEmail_(d.email);
  return withLock_(function () {
    checkEmailFree_(email, d.id);
    var users = rows_('Users');
    var dup = users.filter(function (x) { return String(x.username).toLowerCase() === String(d.username).toLowerCase() && x.id !== d.id; })[0];
    if (dup) throw new Error('Username sudah dipakai');
    if (d.id) {
      update_('Users', d.id, { username: String(d.username).toLowerCase(), nama: d.nama, role: d.role,
        dpdId: d.role === 'dpd' ? d.dpdId : '', aktif: d.aktif !== false, email: email });
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

// ====== REKAP KECAMATAN (D HASIL) — sheet 'C1' ======
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
  if (JENIS.indexOf(r.jenis) < 0) throw new Error('Tingkatan tidak valid');
  if (!String(r.uploader || '').trim()) throw new Error('Nama pengupload wajib diisi');
  if (!r.base64) throw new Error('File kosong');
  var bytes = Utilities.base64Decode(r.base64);
  if (bytes.length > MAX_FILE_MB * 1024 * 1024) throw new Error('File terlalu besar (maks ' + MAX_FILE_MB + ' MB)');
  var folder = jenisFolder_(dpdId, r.jenis);
  var safe = String(r.fileName || 'file').replace(/[\\/:*?"<>|]/g, '_');
  var file = folder.createFile(Utilities.newBlob(bytes, r.mime || 'application/octet-stream', safe));
  var row = { id: 'c' + Date.now().toString(36) + Math.floor(Math.random() * 1e4), dpdId: dpdId, jenis: r.jenis,
    keterangan: String(r.keterangan || '').trim(), fileName: safe, fileId: file.getId(), fileUrl: file.getUrl(),
    mime: r.mime || '', size: bytes.length, uploader: String(r.uploader).trim(), uploadedAt: now_(), userId: u.id, namaAsli: safe };
  withLock_(function () {
    row.fileName = applyName_(row, extOf_(safe), rows_('C1'));
    append_('C1', row);
    log_(u, dpdId, 'UPLOAD', 'D Hasil', row.id, 'D Hasil ' + JENIS_LABEL[r.jenis] + ' · ' + row.fileName + ' (asli: ' + safe + ')' + (row.keterangan ? ' · "' + row.keterangan + '"' : ''), '');
  });
  return row;
}

function c1Row_(id, u) {
  var row = rows_('C1').filter(function (x) { return x.id === id; })[0];
  if (!row || (u.role === 'dpd' && row.dpdId !== u.dpdId)) throw new Error('Data tidak ditemukan');
  return row;
}

function isFresh_(createdIso, ownerId, u) {
  return ownerId === u.id && createdIso && (Date.now() - new Date(createdIso).getTime()) < FRESH_MINUTES * 60000;
}

function verifyPass_(u, password) {
  if (!password || hash_(String(password), u.salt) !== u.passHash) throw new Error('Password salah. Perubahan dibatalkan.');
}

// Koreksi cepat keterangan dari halaman Input. Tanpa password hanya untuk upload sendiri < 60 menit.
function updateC1_(r, u) {
  var row = c1Row_(r.id, u);
  if (!isFresh_(row.uploadedAt, row.userId, u)) verifyPass_(u, r.password);
  var ket = String(r.keterangan || '').trim();
  if (ket === String(row.keterangan)) return { fileName: row.fileName };
  var patch = { keterangan: ket, updatedAt: now_(), updatedBy: u.username };
  withLock_(function () {
    patch.fileName = applyName_(Object.assign({}, row, { keterangan: ket }), extOf_(row.fileName), rows_('C1'));
    update_('C1', r.id, patch);
    log_(u, row.dpdId, 'EDIT', 'D Hasil', row.id, 'Keterangan: "' + row.keterangan + '" → "' + ket + '" (' + JENIS_LABEL[row.jenis] + ', ' + patch.fileName + ')', r.alasan);
  });
  return { fileName: patch.fileName };
}

// Edit dari tabel: keterangan, jenis, dan/atau ganti file. Selalu butuh password.
function editC1_(r, u) {
  verifyPass_(u, r.password);
  var row = c1Row_(r.id, u);
  var jenis = r.jenis || row.jenis;
  if (JENIS.indexOf(jenis) < 0) throw new Error('Tingkatan tidak valid');
  var ket = r.keterangan !== undefined ? String(r.keterangan).trim() : String(row.keterangan);
  if (!ket) throw new Error('Keterangan wajib diisi');
  var patch = { keterangan: ket, jenis: jenis, updatedAt: now_(), updatedBy: u.username };
  var notes = [];
  if (ket !== String(row.keterangan)) notes.push('Keterangan: "' + row.keterangan + '" → "' + ket + '"');
  if (jenis !== row.jenis) notes.push('Jenis: ' + JENIS_LABEL[row.jenis] + ' → ' + JENIS_LABEL[jenis]);
  var aksi = 'EDIT';
  if (r.base64) {
    var bytes = Utilities.base64Decode(r.base64);
    if (bytes.length > MAX_FILE_MB * 1024 * 1024) throw new Error('File terlalu besar (maks ' + MAX_FILE_MB + ' MB)');
    var safe = String(r.fileName || 'file').replace(/[\\/:*?"<>|]/g, '_');
    var file = jenisFolder_(row.dpdId, jenis).createFile(Utilities.newBlob(bytes, r.mime || 'application/octet-stream', safe));
    trashFile_(row.fileId);
    patch.fileName = safe; patch.namaAsli = safe; patch.fileId = file.getId(); patch.fileUrl = file.getUrl();
    patch.mime = r.mime || ''; patch.size = bytes.length;
    notes.push('File diganti dengan ' + safe + ' (file lama dihapus dari Drive)');
    aksi = 'GANTI_FILE';
  } else if (jenis !== row.jenis && row.fileId) {
    try { DriveApp.getFileById(row.fileId).moveTo(jenisFolder_(row.dpdId, jenis)); } catch (e) {}
  }
  if (!notes.length) return row;
  withLock_(function () {
    var next = Object.assign({}, row, patch);
    patch.fileName = applyName_(next, extOf_(patch.namaAsli || row.fileName), rows_('C1'));
    update_('C1', row.id, patch);
    log_(u, row.dpdId, aksi, 'D Hasil', row.id, notes.join('; '), r.alasan);
  });
  return Object.assign(row, patch);
}

function deleteC1_(r, u) {
  verifyPass_(u, r.password);
  var row = c1Row_(r.id, u);
  trashFile_(row.fileId);
  withLock_(function () {
    deleteWhere_('C1', 'id', r.id);
    log_(u, row.dpdId, 'HAPUS', 'D Hasil', row.id, 'D Hasil ' + JENIS_LABEL[row.jenis] + ' "' + row.keterangan + '" · ' + row.fileName + ' (diupload ' + row.uploader + ') dihapus, file dihapus dari Drive', r.alasan);
  });
  return true;
}

// ====== PENAMAAN FILE OTOMATIS ======
// Format: "<Kab/Kota> - <Tingkatan> - <Keterangan>.<ext>"
// contoh : "Kota Palembang - DPR RI - Kec. Ilir Barat I.pdf"
// Nama asli dari operator tetap disimpan di kolom namaAsli.
function extOf_(name) {
  var m = /\.([A-Za-z0-9]{1,6})$/.exec(String(name || ''));
  return m ? '.' + m[1].toLowerCase() : '';
}

function cleanName_(s) {
  return String(s || '').replace(/[\\/:*?"<>|\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function autoName_(row, ext, all) {
  var dpd = rows_('DPD').filter(function (d) { return d.id === row.dpdId; })[0];
  var dpdName = String(dpd ? dpd.nama : row.dpdId).replace(/^DPD PKS\s+/i, '');
  var ket = cleanName_(row.keterangan).slice(0, 80) || 'Belum ada keterangan';
  var base = cleanName_(dpdName + ' - ' + JENIS_LABEL[row.jenis] + ' - ' + ket);
  var taken = {};
  (all || []).forEach(function (x) {
    // dibandingkan tanpa ekstensi, supaya "X.pdf" dan "X.jpg" tetap dibedakan dengan nomor
    if (x.id !== row.id && x.dpdId === row.dpdId && x.jenis === row.jenis) taken[String(x.fileName).replace(/\.[A-Za-z0-9]{1,6}$/, '').toLowerCase()] = true;
  });
  var name = base, n = 2;
  while (taken[name.toLowerCase()]) name = base + ' (' + (n++) + ')';
  return name + ext;
}

// Hitung nama baru dan ganti nama file di Drive. Mengembalikan nama baru (belum ditulis ke sheet).
function applyName_(row, ext, all) {
  var name = autoName_(row, ext, all);
  if (name !== row.fileName && row.fileId) {
    try { DriveApp.getFileById(row.fileId).setName(name); } catch (e) { /* file tidak ada */ }
  }
  return name;
}

// Samakan nama semua file satu DPD (dipakai saat submit, juga merapikan file lama).
function renameAll_(dpdId) {
  var all = rows_('C1');
  all.filter(function (x) { return x.dpdId === dpdId; }).forEach(function (x) {
    var name = applyName_(x, extOf_(x.fileName), all);
    if (name !== x.fileName) {
      var patch = { fileName: name };
      if (!x.namaAsli) patch.namaAsli = x.fileName;
      update_('C1', x.id, patch);
      x.fileName = name;
    }
  });
}

// Jalankan manual dari editor Apps Script untuk merapikan nama file SEMUA DPD sekaligus.
function rapikanNamaFile() {
  rows_('DPD').forEach(function (d) { renameAll_(d.id); });
  Logger.log('Nama file semua DPD sudah dirapikan.');
}

function trashFile_(fileId) {
  if (!fileId) return;
  try { DriveApp.getFileById(fileId).setTrashed(true); } catch (e) { /* file sudah tidak ada */ }
}

function getFile_(r, u) {
  var row = c1Row_(r.id, u);
  if (!row.fileId) throw new Error('File tidak tersedia');
  var blob = DriveApp.getFileById(row.fileId).getBlob();
  return { name: row.fileName, mime: blob.getContentType() || row.mime, base64: Utilities.base64Encode(blob.getBytes()) };
}

function log_(u, dpdId, aksi, objek, objekId, detail, alasan) {
  append_('Log', { id: 'l' + Date.now().toString(36) + Math.floor(Math.random() * 1e4), waktu: now_(), userId: u.id,
    username: u.username + (u.nama ? ' (' + u.nama + ')' : ''), dpdId: dpdId || '', aksi: aksi, objek: objek,
    objekId: objekId || '', detail: detail || '', alasan: String(alasan || '').trim() });
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
  return subFolder_(dpdFolder, 'D Hasil ' + JENIS_LABEL[jenis]);
}

// ====== BACALEG ======
function saveBacaleg_(r, u) {
  var b = r.bacaleg || {};
  var dpdId = targetDpd_(r, u);
  ['nama', 'tingkat', 'profil', 'pengusul'].forEach(function (f) {
    if (!String(b[f] || '').trim()) throw new Error('Field ' + f + ' wajib diisi');
  });
  if (TINGKAT.indexOf(b.tingkat) < 0) throw new Error('Tingkat caleg tidak valid');
  if (b.id) {
    var old = rows_('Bacaleg').filter(function (x) { return x.id === b.id; })[0];
    if (!old || (u.role === 'dpd' && old.dpdId !== u.dpdId)) throw new Error('Data tidak ditemukan');
    if (!isFresh_(old.createdAt, old.userId, u)) verifyPass_(u, r.password);
    var labels = { nama: 'Nama', tingkat: 'Tingkat', profil: 'Profil', pengusul: 'Pengusul' };
    var notes = [];
    Object.keys(labels).forEach(function (k) {
      if (String(old[k]).trim() !== String(b[k]).trim()) notes.push(labels[k] + ': "' + old[k] + '" → "' + String(b[k]).trim() + '"');
    });
    return withLock_(function () {
      var patch = { nama: b.nama.trim(), tingkat: b.tingkat, profil: b.profil.trim(), pengusul: b.pengusul.trim(), updatedAt: now_(), updatedBy: u.username };
      update_('Bacaleg', b.id, patch);
      if (notes.length) log_(u, old.dpdId, 'EDIT', 'Bacaleg', b.id, notes.join('; '), r.alasan);
      return Object.assign(old, patch);
    });
  }
  return withLock_(function () {
    var row = { id: 'b' + Date.now().toString(36) + Math.floor(Math.random() * 1e4), dpdId: dpdId, nama: b.nama.trim(),
      tingkat: b.tingkat, profil: b.profil.trim(), pengusul: b.pengusul.trim(), pencatat: String(r.uploader || u.nama),
      createdAt: now_(), userId: u.id };
    append_('Bacaleg', row);
    log_(u, dpdId, 'TAMBAH', 'Bacaleg', row.id, row.nama + ' · ' + row.tingkat + ' · usul: ' + row.pengusul, '');
    return row;
  });
}

function deleteBacaleg_(r, u) {
  verifyPass_(u, r.password);
  var row = rows_('Bacaleg').filter(function (x) { return x.id === r.id; })[0];
  if (!row || (u.role === 'dpd' && row.dpdId !== u.dpdId)) throw new Error('Data tidak ditemukan');
  withLock_(function () {
    deleteWhere_('Bacaleg', 'id', r.id);
    log_(u, row.dpdId, 'HAPUS', 'Bacaleg', row.id, row.nama + ' · ' + row.tingkat + ' · usul: ' + row.pengusul, r.alasan);
  });
  return true;
}

// ====== SUBMIT & DASHBOARD ======
function submit_(r, u) {
  var dpdId = targetDpd_(r, u);
  var c1 = rows_('C1').filter(function (x) { return x.dpdId === dpdId; });
  var missing = c1.filter(function (x) { return !String(x.keterangan).trim(); }).length;
  if (missing) throw new Error(missing + ' Rekap Kecamatan (D Hasil) belum ada keterangannya');
  var bc = rows_('Bacaleg').filter(function (x) { return x.dpdId === dpdId; });
  // Rapikan nama file: semua file DPD ini diberi nama otomatis sesuai keterangan terakhir
  withLock_(function () { renameAll_(dpdId); });
  var row = { id: 's' + Date.now().toString(36), dpdId: dpdId, userId: u.id, uploader: r.uploader || u.nama,
    submittedAt: now_(), totalC1: c1.length, totalBacaleg: bc.length };
  withLock_(function () {
    append_('Submissions', row);
    log_(u, dpdId, 'SUBMIT', 'Laporan', row.id, c1.length + ' file D Hasil, ' + bc.length + ' usulan bacaleg dilaporkan ke admin', '');
  });
  return row;
}

function dashboard_(r, u) {
  // Semua role melihat ringkasan semua DPD (hanya angka agregat, bukan isi dokumen),
  // supaya operator DPD bisa membandingkan progresnya dengan DPD lain.
  var dpds = rows_('DPD');
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

function header_(name) {
  var sh = sheet_(name);
  var n = sh.getLastColumn();
  return n ? sh.getRange(1, 1, 1, n).getValues()[0].map(String) : SHEETS[name];
}

function append_(name, obj) {
  var head = header_(name);
  sheet_(name).appendRow(head.map(function (h) { return obj[h] === undefined ? '' : obj[h]; }));
}

function update_(name, id, patch) { return updateBy_(name, 'id', id, patch); }

function updateBy_(name, keyCol, keyVal, patch) {
  var sh = sheet_(name);
  var head = header_(name);
  var col = head.indexOf(keyCol) + 1;
  var last = sh.getLastRow();
  if (last < 2 || col < 1) return false;
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
  var col = header_(name).indexOf(keyCol) + 1;
  var last = sh.getLastRow();
  if (last < 2 || col < 1) return;
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
