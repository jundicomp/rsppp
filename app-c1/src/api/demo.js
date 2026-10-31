// MODE DEMO — meniru backend Apps Script di browser (localStorage).
// Aktif otomatis kalau VITE_API_URL kosong. Berguna untuk mencoba tampilan sebelum Google Sheet siap.
import { JENIS, TINGKAT } from '../lib/constants.js';

const KEY = 'c1pemilu_demo_v4';
const DPD_NAMES = [
  'Kota Palembang', 'Kota Prabumulih', 'Kota Pagar Alam', 'Kota Lubuklinggau',
  'Kab. Banyuasin', 'Kab. Empat Lawang', 'Kab. Lahat', 'Kab. Muara Enim',
  'Kab. Musi Banyuasin', 'Kab. Musi Rawas', 'Kab. Musi Rawas Utara', 'Kab. Ogan Ilir',
  'Kab. Ogan Komering Ilir', 'Kab. Ogan Komering Ulu', 'Kab. OKU Selatan', 'Kab. OKU Timur',
  'Kab. Penukal Abab Lematang Ilir'
];
const slug = (s) => s.replace(/^(Kota|Kab\.)\s+/, '').toLowerCase().replace(/[^a-z0-9]+/g, '');
const uid = (p) => p + Date.now().toString(36) + Math.floor(Math.random() * 1e5);

function rng(seed) {
  let s = seed;
  return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
}

function seed() {
  const r = rng(42);
  const now = Date.now();
  const dpd = DPD_NAMES.map((n, i) => ({ id: 'dpd' + String(i + 1).padStart(2, '0'), nama: 'DPD PKS ' + n,
    jumlahKecamatan: i === 16 ? '' : 6 + Math.floor(r() * 14), updatedAt: new Date(now).toISOString() }));
  const users = [
    { id: 'u1', username: 'superadmin', nama: 'Super Admin', role: 'superadmin', dpdId: '', password: 'admin123', aktif: true },
    { id: 'u2', username: 'admin', nama: 'Admin DPW', role: 'admin', dpdId: '', password: 'admin123', aktif: true },
    ...dpd.map((d, i) => ({ id: 'u' + (i + 3), username: 'dpd.' + slug(d.nama.replace('DPD PKS ', '')), nama: 'Operator ' + d.nama.replace('DPD PKS ', ''),
      role: 'dpd', dpdId: d.id, password: 'dpd123', aktif: true }))
  ].map((u) => ({ ...u, createdAt: new Date(now).toISOString(), lastLogin: '' }));
  const names = ['Ahmad Fauzi', 'Siti Rahmawati', 'Rudi Hartono', 'Nur Aisyah', 'Dedi Saputra'];
  const c1 = [];
  dpd.forEach((d, di) => {
    const K = Number(d.jumlahKecamatan) || 0;
    const level = r();
    JENIS.forEach((j) => {
      const n = Math.round(K * Math.min(1, level * (0.6 + r() * 0.6)));
      for (let i = 0; i < n; i++) {
        const t = new Date(now - Math.floor(r() * 6 * 864e5)).toISOString();
        c1.push({ id: uid('c'), dpdId: d.id, jenis: j.id, keterangan: 'D Hasil Kecamatan ' + (i + 1),
          fileName: 'DHasil_' + j.code + '_Kec' + (i + 1) + '.pdf', fileId: '', fileUrl: '', mime: 'application/pdf',
          size: 300000 + Math.floor(r() * 900000), uploader: names[(di + i) % names.length], uploadedAt: t, userId: '' });
      }
    });
  });
  const tmp = { dpd, c1: [] };
  c1.forEach((x) => { x.namaAsli = x.fileName; x.fileName = autoName(tmp, x, '.pdf'); tmp.c1.push(x); });
  const bacaleg = [
    { dpdId: 'dpd01', nama: 'H. Muhammad Ridwan, S.E.', tingkat: 'DPRD Kab/Kota', profil: 'Pengusaha UMKM, Ketua DPC periode 2019–2024, aktif di kegiatan sosial masjid.', pengusul: 'DPC PKS Kec. Ilir Timur I' },
    { dpdId: 'dpd01', nama: 'dr. Nurul Hidayah', tingkat: 'DPRD Provinsi', profil: 'Dokter puskesmas, pengurus bidang perempuan, pembina posyandu.', pengusul: 'Bidang Perempuan DPD' },
    { dpdId: 'dpd05', nama: 'Ir. Bambang Sutrisno', tingkat: 'DPR RI', profil: 'Mantan anggota DPRD dua periode, latar belakang teknik sipil.', pengusul: 'Rekomendasi Ketua DPD' }
  ].map((b) => ({ ...b, id: uid('b'), pencatat: 'Ahmad Fauzi', createdAt: new Date(now - 864e5).toISOString(), userId: '' }));
  const opOf = (dpdId) => users.find((u) => u.dpdId === dpdId) || users[0];
  const JLs = Object.fromEntries(JENIS.map((j) => [j.id, j.label]));
  const log = c1.map((x) => ({ id: uid('l'), waktu: x.uploadedAt, userId: opOf(x.dpdId).id, username: opOf(x.dpdId).username + ' (' + x.uploader + ')',
    dpdId: x.dpdId, aksi: 'UPLOAD', objek: 'D Hasil', objekId: x.id, detail: 'D Hasil ' + JLs[x.jenis] + ' · ' + x.fileName + ' · "' + x.keterangan + '"', alasan: '' }));
  const t = (h) => new Date(now - h * 3600e3).toISOString();
  log.push(
    { id: uid('l'), waktu: t(5), userId: 'u3', username: 'dpd.palembang (Operator Kota Palembang)', dpdId: 'dpd01', aksi: 'GANTI_FILE', objek: 'D Hasil', objekId: '', detail: 'File diganti: DHasil_DPR-RI_Kec2_buram.jpg → DHasil_DPR-RI_Kec2.pdf (file lama dihapus dari Drive)', alasan: 'Foto sebelumnya buram' },
    { id: uid('l'), waktu: t(3), userId: 'u3', username: 'dpd.palembang (Operator Kota Palembang)', dpdId: 'dpd01', aksi: 'EDIT', objek: 'D Hasil', objekId: '', detail: 'Jenis: DPR RI → DPRD Provinsi; Keterangan: "D Hasil Kec 3" → "D Hasil Kecamatan 3"', alasan: 'Salah pilih tingkatan' },
    { id: uid('l'), waktu: t(2), userId: 'u3', username: 'dpd.palembang (Operator Kota Palembang)', dpdId: 'dpd01', aksi: 'HAPUS', objek: 'D Hasil', objekId: '', detail: 'D Hasil Pilpres "D Hasil Kecamatan 2" · DHasil_Pilpres_Kec2_dobel.pdf (diupload Siti Rahmawati) dihapus, file dihapus dari Drive', alasan: 'File dobel' }
  );
  return { dpd, users, c1, bacaleg, submissions: [], sessions: {}, log,
    settings: { waAdmin: '', namaAdmin: 'Admin RSPP DPW PKS Sumsel', appUrl: '' } };
}

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s && s.dpd) return s;
  } catch (e) { /* abaikan */ }
  const s = seed();
  save(s);
  return s;
}
function save(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* abaikan */ } }

const pub = (db, u) => {
  const d = db.dpd.find((x) => x.id === u.dpdId);
  const { password, resetCode, ...rest } = u;
  return { ...rest, dpdNama: d ? d.nama : '' };
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const JL = Object.fromEntries(JENIS.map((j) => [j.id, j.label]));
const FRESH_MIN = 60;
const isFresh = (iso, owner, u) => owner === u.id && iso && Date.now() - new Date(iso).getTime() < FRESH_MIN * 60000;
const verify = (u, pw) => { if (!pw || pw !== u.password) throw new Error('Password salah. Perubahan dibatalkan.'); };
function addLog(db, u, dpdId, aksi, objek, objekId, detail, alasan) {
  if (!db.log) db.log = [];
  db.log.push({ id: uid('l'), waktu: new Date().toISOString(), userId: u.id, username: u.username + (u.nama ? ' (' + u.nama + ')' : ''),
    dpdId: dpdId || '', aksi, objek, objekId: objekId || '', detail: detail || '', alasan: String(alasan || '').trim() });
}
// PDF kecil yang valid, dipakai sebagai isi file di mode demo
function demoPdf(title) {
  const t = String(title).replace(/[()\\]/g, '');
  const stream = 'BT /F1 18 Tf 60 760 Td (Mode demo - file contoh) Tj 0 -30 Td /F1 12 Tf (' + t + ') Tj ET';
  const objs = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    '<< /Length ' + stream.length + ' >>\nstream\n' + stream + '\nendstream', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
  let out = '%PDF-1.4\n'; const offs = [];
  objs.forEach((o, i) => { offs.push(out.length); out += (i + 1) + ' 0 obj\n' + o + '\nendobj\n'; });
  const x = out.length;
  out += 'xref\n0 ' + (objs.length + 1) + '\n0000000000 65535 f \n' + offs.map((o) => String(o).padStart(10, '0') + ' 00000 n \n').join('');
  out += 'trailer\n<< /Size ' + (objs.length + 1) + ' /Root 1 0 R >>\nstartxref\n' + x + '\n%%EOF';
  return btoa(out);
}
const ALL = ['superadmin', 'admin', 'dpd'];

// Penamaan file otomatis — sama persis dengan autoName_ di Code.gs
const extOf = (n) => { const m = /\.([A-Za-z0-9]{1,6})$/.exec(String(n || '')); return m ? '.' + m[1].toLowerCase() : ''; };
const cleanName = (s) => String(s || '').replace(/[\\/:*?"<>|\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim();
function autoName(db, row, ext) {
  const d = db.dpd.find((x) => x.id === row.dpdId);
  const base = cleanName(String(d ? d.nama : row.dpdId).replace(/^DPD PKS\s+/i, '') + ' - ' + JL[row.jenis] + ' - ' + (cleanName(row.keterangan).slice(0, 80) || 'Belum ada keterangan'));
  const taken = new Set(db.c1.filter((x) => x.id !== row.id && x.dpdId === row.dpdId && x.jenis === row.jenis)
    .map((x) => String(x.fileName).replace(/\.[A-Za-z0-9]{1,6}$/, '').toLowerCase()));
  let name = base, n = 2;
  while (taken.has(name.toLowerCase())) name = base + ' (' + n++ + ')';
  return name + ext;
}

export function createDemo() {
  const scope = (u, dpdId) => (row) => (u.role === 'dpd' ? row.dpdId === u.dpdId : !dpdId || row.dpdId === dpdId);
  const target = (u, dpdId) => {
    if (u.role === 'dpd') return u.dpdId;
    if (!dpdId) throw new Error('dpdId wajib');
    return dpdId;
  };
  const own = (u, row) => row && (u.role !== 'dpd' || row.dpdId === u.dpdId);

  const H = {
    me: [ALL, (db, r, u) => pub(db, u)],
    logout: [ALL, (db, r) => { delete db.sessions[r.token]; return true; }],
    saveMyEmail: [ALL, (db, r, u) => {
      verify(u, r.password);
      const email = String(r.email || '').trim().toLowerCase();
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Format email tidak valid');
      if (email && db.users.some((x) => x.id !== u.id && (x.email || '').toLowerCase() === email)) throw new Error('Email sudah dipakai akun lain');
      u.email = email; return { email };
    }],
    changePassword: [ALL, (db, r, u) => {
      if (u.password !== r.oldPassword) throw new Error('Password lama salah');
      if (String(r.newPassword || '').length < 6) throw new Error('Password baru minimal 6 karakter');
      u.password = r.newPassword; return true;
    }],
    listDpd: [ALL, (db, r, u) => (u.role === 'dpd' ? db.dpd.filter((d) => d.id === u.dpdId) : db.dpd)],
    setKecamatan: [['superadmin', 'dpd'], (db, r, u) => {
      const n = parseInt(r.jumlahKecamatan, 10);
      if (!(n > 0 && n < 200)) throw new Error('Jumlah kecamatan tidak valid');
      const d = db.dpd.find((x) => x.id === (u.role === 'dpd' ? u.dpdId : r.dpdId));
      d.jumlahKecamatan = n; d.updatedAt = new Date().toISOString(); return true;
    }],
    listC1: [ALL, (db, r, u) => db.c1.filter(scope(u, r.dpdId))],
    updateC1: [['superadmin', 'dpd'], (db, r, u) => {
      const row = db.c1.find((x) => x.id === r.id);
      if (!own(u, row)) throw new Error('Data tidak ditemukan');
      if (!isFresh(row.uploadedAt, row.userId, u)) verify(u, r.password);
      const ket = String(r.keterangan || '').trim();
      if (ket === row.keterangan) return { fileName: row.fileName };
      const fileName = autoName(db, { ...row, keterangan: ket }, extOf(row.fileName));
      addLog(db, u, row.dpdId, 'EDIT', 'D Hasil', row.id, 'Keterangan: "' + row.keterangan + '" → "' + ket + '" (' + JL[row.jenis] + ', ' + fileName + ')', r.alasan);
      Object.assign(row, { keterangan: ket, fileName, updatedAt: new Date().toISOString(), updatedBy: u.username });
      return { fileName };
    }],
    editC1: [['superadmin', 'dpd'], (db, r, u) => {
      verify(u, r.password);
      const row = db.c1.find((x) => x.id === r.id);
      if (!own(u, row)) throw new Error('Data tidak ditemukan');
      const jenis = r.jenis || row.jenis;
      const ket = r.keterangan !== undefined ? String(r.keterangan).trim() : row.keterangan;
      if (!ket) throw new Error('Keterangan wajib diisi');
      const notes = [];
      if (ket !== row.keterangan) notes.push('Keterangan: "' + row.keterangan + '" → "' + ket + '"');
      if (jenis !== row.jenis) notes.push('Jenis: ' + JL[row.jenis] + ' → ' + JL[jenis]);
      let aksi = 'EDIT';
      const patch = { keterangan: ket, jenis, updatedAt: new Date().toISOString(), updatedBy: u.username };
      if (r.fileName) {
        notes.push('File diganti dengan ' + r.fileName + ' (file lama dihapus dari Drive)');
        Object.assign(patch, { namaAsli: r.fileName, mime: r.mime, size: r.size || 0 });
        aksi = 'GANTI_FILE';
      }
      if (!notes.length) return row;
      patch.fileName = autoName(db, { ...row, ...patch }, extOf(r.fileName || row.fileName));
      addLog(db, u, row.dpdId, aksi, 'D Hasil', row.id, notes.join('; '), r.alasan);
      return Object.assign(row, patch);
    }],
    deleteC1: [['superadmin', 'dpd'], (db, r, u) => {
      verify(u, r.password);
      const row = db.c1.find((x) => x.id === r.id);
      if (!own(u, row)) throw new Error('Data tidak ditemukan');
      addLog(db, u, row.dpdId, 'HAPUS', 'D Hasil', row.id, 'D Hasil ' + JL[row.jenis] + ' "' + row.keterangan + '" · ' + row.fileName + ' (diupload ' + row.uploader + ') dihapus, file dihapus dari Drive', r.alasan);
      db.c1 = db.c1.filter((x) => x.id !== r.id); return true;
    }],
    getFile: [ALL, (db, r, u) => {
      const row = db.c1.find((x) => x.id === r.id);
      if (!own(u, row)) throw new Error('Data tidak ditemukan');
      return { name: row.fileName.replace(/\.[a-z0-9]+$/i, '') + '.pdf', mime: 'application/pdf', base64: demoPdf(JL[row.jenis] + ' - ' + row.keterangan + ' - ' + row.fileName) };
    }],
    listLog: [ALL, (db, r, u) => (db.log || []).filter(scope(u, r.dpdId)).sort((a, b) => b.waktu.localeCompare(a.waktu))],
    listBacaleg: [ALL, (db, r, u) => db.bacaleg.filter(scope(u, r.dpdId))],
    saveBacaleg: [['superadmin', 'dpd'], (db, r, u) => {
      const b = r.bacaleg || {};
      ['nama', 'tingkat', 'profil', 'pengusul'].forEach((f) => { if (!String(b[f] || '').trim()) throw new Error('Field ' + f + ' wajib diisi'); });
      if (!TINGKAT.includes(b.tingkat)) throw new Error('Tingkat caleg tidak valid');
      if (b.id) {
        const old = db.bacaleg.find((x) => x.id === b.id);
        if (!own(u, old)) throw new Error('Data tidak ditemukan');
        if (!isFresh(old.createdAt, old.userId, u)) verify(u, r.password);
        const L = { nama: 'Nama', tingkat: 'Tingkat', profil: 'Profil', pengusul: 'Pengusul' };
        const notes = Object.keys(L).filter((k) => String(old[k]).trim() !== String(b[k]).trim()).map((k) => L[k] + ': "' + old[k] + '" → "' + String(b[k]).trim() + '"');
        if (notes.length) addLog(db, u, old.dpdId, 'EDIT', 'Bacaleg', old.id, notes.join('; '), r.alasan);
        Object.assign(old, { nama: b.nama.trim(), tingkat: b.tingkat, profil: b.profil.trim(), pengusul: b.pengusul.trim(), updatedAt: new Date().toISOString(), updatedBy: u.username });
        return old;
      }
      const row = { id: uid('b'), dpdId: target(u, r.dpdId), nama: b.nama.trim(), tingkat: b.tingkat, profil: b.profil.trim(),
        pengusul: b.pengusul.trim(), pencatat: r.uploader || u.nama, createdAt: new Date().toISOString(), userId: u.id };
      db.bacaleg.push(row);
      addLog(db, u, row.dpdId, 'TAMBAH', 'Bacaleg', row.id, row.nama + ' · ' + row.tingkat + ' · usul: ' + row.pengusul, '');
      return row;
    }],
    deleteBacaleg: [['superadmin', 'dpd'], (db, r, u) => {
      verify(u, r.password);
      const row = db.bacaleg.find((x) => x.id === r.id);
      if (!own(u, row)) throw new Error('Data tidak ditemukan');
      addLog(db, u, row.dpdId, 'HAPUS', 'Bacaleg', row.id, row.nama + ' · ' + row.tingkat + ' · usul: ' + row.pengusul, r.alasan);
      db.bacaleg = db.bacaleg.filter((x) => x.id !== r.id); return true;
    }],
    submit: [['superadmin', 'dpd'], (db, r, u) => {
      const dpdId = target(u, r.dpdId);
      const c1 = db.c1.filter((x) => x.dpdId === dpdId);
      const missing = c1.filter((x) => !String(x.keterangan).trim()).length;
      if (missing) throw new Error(missing + ' Rekap Kecamatan (D Hasil) belum ada keterangannya');
      c1.forEach((x) => { const n = autoName(db, x, extOf(x.fileName)); if (n !== x.fileName) { x.namaAsli = x.namaAsli || x.fileName; x.fileName = n; } });
      const row = { id: uid('s'), dpdId, userId: u.id, uploader: r.uploader || u.nama, submittedAt: new Date().toISOString(),
        totalC1: c1.length, totalBacaleg: db.bacaleg.filter((x) => x.dpdId === dpdId).length };
      db.submissions.push(row);
      addLog(db, u, dpdId, 'SUBMIT', 'Laporan', row.id, row.totalC1 + ' file D Hasil, ' + row.totalBacaleg + ' usulan bacaleg dilaporkan ke admin', '');
      return row;
    }],
    dashboard: [ALL, (db, r, u) => {
      const dpds = db.dpd;
      return dpds.map((d) => {
        const counts = Object.fromEntries(JENIS.map((j) => [j.id, 0]));
        let last = '';
        db.c1.forEach((x) => { if (x.dpdId === d.id) { counts[x.jenis]++; if (x.uploadedAt > last) last = x.uploadedAt; } });
        const subs = db.submissions.filter((s) => s.dpdId === d.id).map((s) => s.submittedAt).sort();
        return { id: d.id, nama: d.nama, jumlahKecamatan: parseInt(d.jumlahKecamatan, 10) || 0, counts,
          bacaleg: db.bacaleg.filter((x) => x.dpdId === d.id).length, lastUpload: last, lastSubmit: subs[subs.length - 1] || '' };
      });
    }],
    getSettings: [ALL, (db) => db.settings],
    saveSettings: [['superadmin'], (db, r) => { Object.assign(db.settings, r.settings || {}); return db.settings; }],
    listUsers: [['superadmin'], (db) => db.users.map((u) => pub(db, u))],
    saveUser: [['superadmin'], (db, r) => {
      const d = r.user || {};
      if (!['superadmin', 'admin', 'dpd'].includes(d.role)) throw new Error('Role tidak valid');
      if (d.role === 'dpd' && !d.dpdId) throw new Error('Pilih DPD untuk user dengan role DPD');
      if (!/^[a-z0-9._-]{3,}$/i.test(String(d.username || ''))) throw new Error('Username minimal 3 karakter (huruf, angka, titik, minus)');
      if (db.users.some((x) => x.username.toLowerCase() === d.username.toLowerCase() && x.id !== d.id)) throw new Error('Username sudah dipakai');
      if (d.id) {
        const u = db.users.find((x) => x.id === d.id);
        Object.assign(u, { username: d.username.toLowerCase(), nama: d.nama, role: d.role, dpdId: d.role === 'dpd' ? d.dpdId : '', aktif: d.aktif !== false, email: String(d.email || '').trim().toLowerCase() });
        if (u.aktif === false) Object.keys(db.sessions).forEach((t) => { if (db.sessions[t] === u.id) delete db.sessions[t]; });
        return pub(db, u);
      }
      if (String(d.password || '').length < 6) throw new Error('Password minimal 6 karakter');
      const u = { id: uid('u'), username: d.username.toLowerCase(), nama: d.nama, role: d.role, dpdId: d.role === 'dpd' ? d.dpdId : '',
        password: d.password, email: String(d.email || '').trim().toLowerCase(), aktif: true, createdAt: new Date().toISOString(), lastLogin: '' };
      db.users.push(u); return pub(db, u);
    }],
    resetPassword: [['superadmin'], (db, r) => {
      if (String(r.password || '').length < 6) throw new Error('Password minimal 6 karakter');
      const u = db.users.find((x) => x.id === r.userId);
      u.password = r.password;
      Object.keys(db.sessions).forEach((t) => { if (db.sessions[t] === u.id) delete db.sessions[t]; });
      return true;
    }],
    saveDpd: [['superadmin'], (db, r) => {
      const d = r.dpd || {};
      if (!String(d.nama || '').trim()) throw new Error('Nama DPD wajib diisi');
      if (d.id) { Object.assign(db.dpd.find((x) => x.id === d.id), { nama: d.nama, jumlahKecamatan: d.jumlahKecamatan || '' }); return d; }
      const row = { id: uid('dpd'), nama: d.nama, jumlahKecamatan: d.jumlahKecamatan || '', updatedAt: new Date().toISOString() };
      db.dpd.push(row); return row;
    }]
  };

  async function call(action, payload = {}, token) {
    await wait(150);
    const db = load();
    if (action === 'login') {
      const u = db.users.find((x) => x.username.toLowerCase() === String(payload.username || '').trim().toLowerCase());
      if (!u || u.password !== payload.password) throw new Error('Username atau password salah');
      if (!u.aktif) throw new Error('Akun dinonaktifkan. Hubungi admin.');
      const t = uid('t');
      db.sessions[t] = u.id;
      u.lastLogin = new Date().toISOString();
      save(db);
      return { token: t, user: pub(db, u) };
    }
    if (action === 'forgotPassword' || action === 'resetWithCode') {
      const key = String(payload.username || '').trim().toLowerCase();
      const u = db.users.find((x) => x.username.toLowerCase() === key || (x.email && x.email.toLowerCase() === key));
      if (action === 'forgotPassword') {
        if (!u || !u.aktif) throw new Error('Akun tidak ditemukan atau tidak aktif');
        if (!u.email) throw new Error('Akun ini belum punya email. Hubungi admin untuk reset password.');
        u.resetCode = '123456'; save(db);
        return { username: u.username, email: u.email, minutes: 15, demoCode: '123456' };
      }
      if (!u || !u.resetCode) throw new Error('Minta kode reset dulu');
      if (String(payload.code).trim() !== u.resetCode) throw new Error('Kode salah');
      if (String(payload.newPassword || '').length < 6) throw new Error('Password baru minimal 6 karakter');
      u.password = payload.newPassword; delete u.resetCode;
      Object.keys(db.sessions).forEach((t) => { if (db.sessions[t] === u.id) delete db.sessions[t]; });
      save(db); return true;
    }
    const u = db.users.find((x) => x.id === db.sessions[token]);
    if (!u || !u.aktif) throw new Error('Sesi habis, silakan login lagi');
    const h = H[action];
    if (!h) throw new Error('Aksi tidak dikenal: ' + action);
    if (!h[0].includes(u.role)) throw new Error('Akses ditolak');
    const out = h[1](db, { ...payload, token }, u);
    save(db);
    return JSON.parse(JSON.stringify(out));
  }

  async function upload(action, payload, token, onProgress) {
    for (let p = 5; p < 95; p += 7 + Math.floor(Math.random() * 10)) {
      onProgress && onProgress(p);
      await wait(120);
    }
    if (action === 'editC1') {
      const out = await call('editC1', payload, token);
      onProgress && onProgress(100);
      return out;
    }
    const db = load();
    const u = db.users.find((x) => x.id === db.sessions[token]);
    if (!u) throw new Error('Sesi habis, silakan login lagi');
    if (!['superadmin', 'dpd'].includes(u.role)) throw new Error('Akses ditolak');
    if (!String(payload.uploader || '').trim()) throw new Error('Nama pengupload wajib diisi');
    const row = { id: uid('c'), dpdId: target(u, payload.dpdId), jenis: payload.jenis, keterangan: String(payload.keterangan || '').trim(),
      fileName: payload.fileName, fileId: '', fileUrl: '', mime: payload.mime, size: payload.size || 0,
      uploader: payload.uploader.trim(), uploadedAt: new Date().toISOString(), userId: u.id, namaAsli: payload.fileName };
    row.fileName = autoName(db, row, extOf(payload.fileName));
    db.c1.push(row);
    addLog(db, u, row.dpdId, 'UPLOAD', 'D Hasil', row.id, 'D Hasil ' + JL[row.jenis] + ' · ' + row.fileName + ' (asli: ' + row.namaAsli + ')' + (row.keterangan ? ' · "' + row.keterangan + '"' : ''), '');
    save(db);
    onProgress && onProgress(100);
    return row;
  }

  return { call, upload, mode: 'demo', reset: () => { localStorage.removeItem(KEY); } };
}
