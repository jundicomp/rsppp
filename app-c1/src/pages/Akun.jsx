import { useEffect, useState } from 'react';
import { call } from '../api/index.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { ROLE_LABEL } from '../lib/constants.js';
import { useToast } from '../components/ui.jsx';

function EmailCard({ user }) {
  const toast = useToast();
  const [email, setEmail] = useState(user.email || '');
  const [saved, setSaved] = useState(user.email || '');
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { call('me').then((u) => { setSaved(u.email || ''); setEmail(u.email || ''); }).catch(() => {}); }, []);
  const changed = email.trim().toLowerCase() !== saved;
  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const out = await call('saveMyEmail', { email: email.trim(), password: pw });
      setSaved(out.email); setEmail(out.email); setPw('');
      toast(out.email ? 'Email disimpan' : 'Email dihapus');
    } catch (e2) { toast(e2.message, 'err'); }
    setBusy(false);
  };
  return (
    <form className="card card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 480 }} onSubmit={save}>
      <div>
        <h2 className="card-title">Email untuk lupa password</h2>
        <div className="help" style={{ marginTop: 4 }}>
          {saved ? <>Terdaftar: <b style={{ color: 'var(--ink)' }}>{saved}</b>. Kalau lupa password, kode reset dikirim ke email ini.</> : 'Belum ada email. Isi supaya bisa reset password sendiri kalau lupa.'}
        </div>
      </div>
      <div className="field"><label className="label" htmlFor="em">Alamat email</label><input id="em" type="email" className="input" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="contoh: nama@gmail.com" /></div>
      {changed && (
        <div className="field"><label className="label" htmlFor="em-p">Password saat ini</label><input id="em-p" type="password" className="input" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} required /><div className="help">Untuk memastikan ini memang Anda.</div></div>
      )}
      <div><button className="btn btn-primary" disabled={busy || !changed}>{busy ? 'Menyimpan…' : 'Simpan email'}</button></div>
    </form>
  );
}

export default function Akun() {
  const { user } = useAuth();
  const toast = useToast();
  const [f, setF] = useState({ oldPassword: '', newPassword: '', confirm: '' });
  const [busy, setBusy] = useState(false);
  const mismatch = f.confirm && f.confirm !== f.newPassword;

  const save = async (e) => {
    e.preventDefault();
    if (mismatch) return;
    setBusy(true);
    try {
      await call('changePassword', { oldPassword: f.oldPassword, newPassword: f.newPassword });
      toast('Password berhasil diganti');
      setF({ oldPassword: '', newPassword: '', confirm: '' });
    } catch (e2) { toast(e2.message, 'err'); }
    setBusy(false);
  };

  return (
    <>
      <section style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div className="eyebrow">{ROLE_LABEL[user.role]}{user.dpdNama ? ' · ' + user.dpdNama : ''}</div>
        <h1 className="page-title">Akun Saya</h1>
      </section>
      <section className="card card-pad" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
        <div><div className="help">Username</div><b>{user.username}</b></div>
        <div><div className="help">Nama</div><b>{user.nama || '–'}</b></div>
        <div><div className="help">Hak akses</div><b>{ROLE_LABEL[user.role]}</b></div>
      </section>
      <EmailCard user={user} />
      <form className="card card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 480 }} onSubmit={save}>
        <h2 className="card-title">Ganti password</h2>
        <div className="field"><label className="label" htmlFor="o">Password lama</label><input id="o" type="password" className="input" autoComplete="current-password" value={f.oldPassword} onChange={(e) => setF({ ...f, oldPassword: e.target.value })} required /></div>
        <div className="field"><label className="label" htmlFor="n">Password baru</label><input id="n" type="password" className="input" autoComplete="new-password" minLength={6} value={f.newPassword} onChange={(e) => setF({ ...f, newPassword: e.target.value })} required /><div className="help">Minimal 6 karakter.</div></div>
        <div className="field"><label className="label" htmlFor="c">Ulangi password baru</label><input id="c" type="password" className={'input' + (mismatch ? ' invalid' : '')} autoComplete="new-password" value={f.confirm} onChange={(e) => setF({ ...f, confirm: e.target.value })} required />{mismatch && <div className="help err">Tidak sama dengan password baru.</div>}</div>
        <div><button className="btn btn-primary" disabled={busy || mismatch}>{busy ? 'Menyimpan…' : 'Simpan password'}</button></div>
      </form>
    </>
  );
}
