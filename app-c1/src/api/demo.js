// MODE DEMO — meniru backend Apps Script di browser (localStorage).
// Aktif otomatis kalau VITE_API_URL kosong. Berguna untuk mencoba tampilan sebelum Google Sheet siap.
import { JENIS, TINGKAT } from '../lib/constants.js';

const KEY = 'c1pemilu_demo_v1';
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
        c1.push({ id: uid('c'), dpdId: d.id, jenis: j.id, keterangan: 'C1 Kecamatan ' + (i + 1),
          fileName: 'C1_' + j.code + '_Kec' + (i + 1) + '.pdf', fileId: '', fileUrl: '', mime: 'application/pdf',
          size: 300000 + Math.floor(r() * 900000), uploader: names[(di + i) % names.length], uploadedAt: t, userId: '' });
      }
    });
  });
  const bacaleg = [
    { dpdId: 'dpd01', nama: 'H. Muhammad Ridwan, S.E.', tingkat: 'DPRD Kab/Kota', profil: 'Pengusaha UMKM, Ketua DPC periode 2019–2024, aktif di kegiatan sosial masjid.', pengusul: 'DPC PKS Kec. Ilir Timur I' },
    { dpdId: 'dpd01', nama: 'dr. Nurul Hidayah', tingkat: 'DPRD Provinsi', profil: 'Dokter puskesmas, pengurus bidang perempuan, pembina posyandu.', pengusul: 'Bidang Perempuan DPD' },
    { dpdId: 'dpd05', nama: 'Ir. Bambang Sutrisno', tingkat: 'DPR RI', profil: 'Mantan anggota DPRD dua periode, latar belakang teknik sipil.', pengusul: 'Rekomendasi Ketua DPD' }
  ].map((b) => ({ ...b, id: uid('b'), pencatat: 'Ahmad Fauzi', createdAt: new Date(now - 864e5).toISOString(), userId: '' }));
  return { dpd, users, c1, bacaleg, submissions: [], sessions: {},
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
  const { password, ...rest } = u;
  return { ...rest, dpdNama: d ? d.nama : '' };
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const ALL = ['superadmin', 'admin', 'dpd'];

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
      row.keterangan = String(r.keterangan || '').trim(); return true;
    }],
    deleteC1: [['superadmin', 'dpd'], (db, r, u) => {
      const row = db.c1.find((x) => x.id === r.id);
      if (!own(u, row)) throw new Error('Data tidak ditemukan');
      db.c1 = db.c1.filter((x) => x.id !== r.id); return true;
    }],
    listBacaleg: [ALL, (db, r, u) => db.bacaleg.filter(scope(u, r.dpdId))],
    saveBacaleg: [['superadmin', 'dpd'], (db, r, u) => {
      const b = r.bacaleg || {};
      ['nama', 'tingkat', 'profil', 'pengusul'].forEach((f) => { if (!String(b[f] || '').trim()) throw new Error('Field ' + f + ' wajib diisi'); });
      if (!TINGKAT.includes(b.tingkat)) throw new Error('Tingkat caleg tidak valid');
      if (b.id) {
        const old = db.bacaleg.find((x) => x.id === b.id);
        if (!own(u, old)) throw new Error('Data tidak ditemukan');
        Object.assign(old, { nama: b.nama, tingkat: b.tingkat, profil: b.profil, pengusul: b.pengusul });
        return old;
      }
      const row = { id: uid('b'), dpdId: target(u, r.dpdId), nama: b.nama.trim(), tingkat: b.tingkat, profil: b.profil.trim(),
        pengusul: b.pengusul.trim(), pencatat: r.uploader || u.nama, createdAt: new Date().toISOString(), userId: u.id };
      db.bacaleg.push(row); return row;
    }],
    deleteBacaleg: [['superadmin', 'dpd'], (db, r, u) => {
      const row = db.bacaleg.find((x) => x.id === r.id);
      if (!own(u, row)) throw new Error('Data tidak ditemukan');
      db.bacaleg = db.bacaleg.filter((x) => x.id !== r.id); return true;
    }],
    submit: [['superadmin', 'dpd'], (db, r, u) => {
      const dpdId = target(u, r.dpdId);
      const c1 = db.c1.filter((x) => x.dpdId === dpdId);
      const missing = c1.filter((x) => !String(x.keterangan).trim()).length;
      if (missing) throw new Error(missing + ' dokumen C1 belum ada keterangannya');
      const row = { id: uid('s'), dpdId, userId: u.id, uploader: r.uploader || u.nama, submittedAt: new Date().toISOString(),
        totalC1: c1.length, totalBacaleg: db.bacaleg.filter((x) => x.dpdId === dpdId).length };
      db.submissions.push(row); return row;
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
        Object.assign(u, { username: d.username.toLowerCase(), nama: d.nama, role: d.role, dpdId: d.role === 'dpd' ? d.dpdId : '', aktif: d.aktif !== false });
        if (u.aktif === false) Object.keys(db.sessions).forEach((t) => { if (db.sessions[t] === u.id) delete db.sessions[t]; });
        return pub(db, u);
      }
      if (String(d.password || '').length < 6) throw new Error('Password minimal 6 karakter');
      const u = { id: uid('u'), username: d.username.toLowerCase(), nama: d.nama, role: d.role, dpdId: d.role === 'dpd' ? d.dpdId : '',
        password: d.password, aktif: true, createdAt: new Date().toISOString(), lastLogin: '' };
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
    const u = db.users.find((x) => x.id === db.sessions[token]);
    if (!u || !u.aktif) throw new Error('Sesi habis, silakan login lagi');
    const h = H[action];
    if (!h) throw new Error('Aksi tidak dikenal: ' + action);
    if (!h[0].includes(u.role)) throw new Error('Akses ditolak');
    const out = h[1](db, { ...payload, token }, u);
    save(db);
    return JSON.parse(JSON.stringify(out));
  }

  async function upload(payload, token, onProgress) {
    for (let p = 5; p < 95; p += 7 + Math.floor(Math.random() * 10)) {
      onProgress && onProgress(p);
      await wait(120);
    }
    const db = load();
    const u = db.users.find((x) => x.id === db.sessions[token]);
    if (!u) throw new Error('Sesi habis, silakan login lagi');
    if (!['superadmin', 'dpd'].includes(u.role)) throw new Error('Akses ditolak');
    if (!String(payload.uploader || '').trim()) throw new Error('Nama pengupload wajib diisi');
    const row = { id: uid('c'), dpdId: target(u, payload.dpdId), jenis: payload.jenis, keterangan: String(payload.keterangan || '').trim(),
      fileName: payload.fileName, fileId: '', fileUrl: '', mime: payload.mime, size: payload.size || 0,
      uploader: payload.uploader.trim(), uploadedAt: new Date().toISOString(), userId: u.id };
    db.c1.push(row);
    save(db);
    onProgress && onProgress(100);
    return row;
  }

  return { call, upload, mode: 'demo', reset: () => { localStorage.removeItem(KEY); } };
}
