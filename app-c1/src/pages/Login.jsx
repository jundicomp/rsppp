import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import { isDemo } from '../api/index.js';
import { CREDIT, YEAR } from '../lib/constants.js';

export default function Login() {
  const { user, login } = useAuth();
  const nav = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  if (user) return <Navigate to="/" replace />;

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    setBusy(true);
    try {
      const u = await login(username, password);
      nav(u.role === 'dpd' ? '/rekap' : '/dashboard', { replace: true });
    } catch (e2) {
      setErr(e2.message);
      setBusy(false);
    }
  };

  return (
    <div className="login">
      <aside className="login-aside">
        <img src="./logo-light.png" alt="Logo PKS" />
        <div>
          <h1>Upload Dokumen <span>C1 Pemilu 2024</span></h1>
          <p>Untuk DPD PKS Kota/Kabupaten se-Sumatera Selatan: upload C1 DPR RI, DPRD Provinsi, DPRD Kab/Kota, DPD RI, dan Pilpres, serta usulan nama bacaleg. Bisa dicicil dan dilanjutkan kapan saja.</p>
        </div>
        <div style={{ fontSize: 14, color: '#fff' }}>Akun dibuat oleh admin. Lupa password? Hubungi admin.</div>
      </aside>
      <main className="login-main">
        <form className="login-form" onSubmit={submit}>
          <div>
            <h2 style={{ fontSize: 24, fontWeight: 700 }}>Masuk</h2>
            <p className="lead" style={{ margin: '4px 0 0' }}>Gunakan akun yang diberikan admin.</p>
          </div>
          {isDemo && (
            <div className="notice">
              <div><b>Mode demo.</b> Coba: <code>superadmin</code> / <code>admin123</code>, <code>admin</code> / <code>admin123</code>, atau <code>dpd.palembang</code> / <code>dpd123</code>.</div>
            </div>
          )}
          {err && <div className="notice err" role="alert">{err}</div>}
          <div className="field">
            <label className="label" htmlFor="u">Username</label>
            <input id="u" className="input" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} required autoFocus />
          </div>
          <div className="field">
            <label className="label" htmlFor="p">Password</label>
            <div className="input-addon">
              <input id="p" className="input" type={show ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              <span style={{ padding: 0 }}>
                <button type="button" className="btn btn-plain btn-sm" style={{ height: 42, borderRadius: 0 }} onClick={() => setShow(!show)}>{show ? 'Sembunyi' : 'Lihat'}</button>
              </span>
            </div>
          </div>
          <button className="btn btn-primary" type="submit" disabled={busy} style={{ height: 46 }}>{busy ? 'Memeriksa…' : 'Masuk'}</button>
          <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--ink)', flexWrap: 'wrap', gap: 8 }}>
            <span>Dibuat oleh <strong style={{ color: 'var(--ink)', fontWeight: 600 }}>{CREDIT}</strong></span>
            <span>© {YEAR}</span>
          </div>
        </form>
      </main>
    </div>
  );
}
