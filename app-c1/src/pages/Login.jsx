import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import { call, isDemo } from '../api/index.js';
import { CREDIT, YEAR } from '../lib/constants.js';

function Forgot({ initial, onDone, onCancel }) {
  const [step, setStep] = useState(1);
  const [key, setKey] = useState(initial || '');
  const [info, setInfo] = useState(null);
  const [code, setCode] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const mismatch = pw2 && pw2 !== pw;

  const send = async (e) => {
    e && e.preventDefault();
    setErr(''); setBusy(true);
    try { setInfo(await call('forgotPassword', { username: key.trim() })); setStep(2); } catch (e2) { setErr(e2.message); }
    setBusy(false);
  };
  const reset = async (e) => {
    e.preventDefault();
    if (mismatch) return;
    setErr(''); setBusy(true);
    try { await call('resetWithCode', { username: info.username, code: code.trim(), newPassword: pw }); onDone(info.username); } catch (e2) { setErr(e2.message); setBusy(false); }
  };

  return (
    <form className="login-form" onSubmit={step === 1 ? send : reset}>
      <div>
        <h2 style={{ fontSize: 24, fontWeight: 700 }}>Lupa password</h2>
        <p className="lead" style={{ margin: '4px 0 0' }}>
          {step === 1 ? 'Kami kirim kode 6 angka ke email yang terdaftar di akun Anda.' : <>Kode sudah dikirim ke <b>{info.email}</b>. Cek kotak masuk atau folder spam. Berlaku {info.minutes} menit.</>}
        </p>
      </div>
      {isDemo && info?.demoCode && <div className="notice"><div><b>Mode demo:</b> kodenya <code>{info.demoCode}</code></div></div>}
      {err && <div className="notice err" role="alert">{err}</div>}
      {step === 1 ? (
        <div className="field">
          <label className="label" htmlFor="fk">Username atau email</label>
          <input id="fk" className="input" value={key} onChange={(e) => setKey(e.target.value)} required autoFocus />
        </div>
      ) : (
        <>
          <div className="field">
            <label className="label" htmlFor="fc">Kode dari email</label>
            <input id="fc" className="input" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} required autoFocus style={{ letterSpacing: 6, fontSize: 20, fontWeight: 700 }} />
          </div>
          <div className="field">
            <label className="label" htmlFor="fp">Password baru</label>
            <input id="fp" className="input" type="password" autoComplete="new-password" minLength={6} value={pw} onChange={(e) => setPw(e.target.value)} required />
            <div className="help">Minimal 6 karakter.</div>
          </div>
          <div className="field">
            <label className="label" htmlFor="fp2">Ulangi password baru</label>
            <input id="fp2" className={'input' + (mismatch ? ' invalid' : '')} type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} required />
            {mismatch && <div className="help err">Tidak sama dengan password baru.</div>}
          </div>
        </>
      )}
      <button className="btn btn-primary" type="submit" disabled={busy || mismatch} style={{ height: 46 }}>
        {busy ? 'Memproses…' : step === 1 ? 'Kirim kode' : 'Simpan password baru'}
      </button>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" className="btn btn-plain btn-sm" onClick={onCancel}>← Kembali ke login</button>
        {step === 2 && <button type="button" className="btn btn-plain btn-sm" disabled={busy} onClick={() => { setStep(1); setCode(''); }}>Kirim ulang kode</button>}
      </div>
      <div className="help">Belum mengisi email di akun? Minta admin mereset password Anda.</div>
    </form>
  );
}

export default function Login() {
  const { user, login } = useAuth();
  const nav = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [forgot, setForgot] = useState(false);
  const [ok, setOk] = useState('');

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
          <h1>Upload Dokumen <span>Hasil Suara Pemilu 2024</span></h1>
          <p>Untuk DPD PKS Kota/Kabupaten se-Sumatera Selatan: upload Rekap Kecamatan (D Hasil) DPR RI, DPRD Provinsi, DPRD Kab/Kota, DPD RI, dan Pilpres, serta usulan nama bacaleg. Bisa dicicil dan dilanjutkan kapan saja.</p>
        </div>
        <div style={{ fontSize: 14, color: '#fff' }}>Akun dibuat oleh admin. Lupa password? Klik "Lupa password" kalau email sudah terdaftar di akun Anda.</div>
      </aside>
      <main className="login-main">
        {forgot ? (
          <Forgot initial={username} onCancel={() => setForgot(false)}
            onDone={(u) => { setForgot(false); setUsername(u); setPassword(''); setErr(''); setOk('Password berhasil diganti. Silakan masuk dengan password baru.'); }} />
        ) : (
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
          {ok && <div className="notice ok" role="status">{ok}</div>}
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
          <button type="button" className="btn btn-plain btn-sm" style={{ alignSelf: 'center' }} onClick={() => { setOk(''); setForgot(true); }}>Lupa password?</button>
          <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--ink)', flexWrap: 'wrap', gap: 8 }}>
            <span>Dibuat oleh <strong style={{ color: 'var(--ink)', fontWeight: 600 }}>{CREDIT}</strong></span>
            <span>© {YEAR}</span>
          </div>
        </form>
        )}
      </main>
    </div>
  );
}
