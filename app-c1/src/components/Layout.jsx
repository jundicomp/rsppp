import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import { APP_TITLE, APP_ORG, CREDIT, YEAR } from '../lib/constants.js';
import { isDemo, resetDemo } from '../api/index.js';

export function Footer() {
  return (
    <footer className="ftr">
      <div className="ftr-in">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img src="./logo-mark.png" alt="" />
          <span>Dibuat oleh <strong>{CREDIT}</strong></span>
        </div>
        <span>© {YEAR}</span>
      </div>
    </footer>
  );
}

export default function Layout({ children, narrow }) {
  const { user, can, logout } = useAuth();
  const nav = useNavigate();
  const doLogout = async () => { await logout(); nav('/login'); };
  return (
    <div className="app">
      {isDemo && (
        <div className="demo-ribbon">
          Mode demo · data contoh tersimpan di browser ini saja ·{' '}
          <button onClick={() => { resetDemo(); location.reload(); }}>reset data demo</button>
        </div>
      )}
      <header className="hdr">
        <div className="hdr-in">
          <img className="hdr-logo" src="./logo-mark.png" alt="Logo PKS" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
            <NavLink to="/" className="hdr-title">{APP_TITLE}</NavLink>
            <span className="hdr-sub">{APP_ORG}{user ? ' · ' + (user.dpdNama || user.nama) : ''}</span>
          </div>
          {user && (
            <nav className="hdr-nav" aria-label="Menu utama">
              {can('superadmin', 'admin') && <NavLink to="/dashboard">Dashboard</NavLink>}
              {can('superadmin', 'dpd') && <NavLink to="/input">Input Data</NavLink>}
              <NavLink to="/rekap">Rekap</NavLink>
              {can('superadmin') && <NavLink to="/users">User</NavLink>}
              {can('superadmin') && <NavLink to="/pengaturan">Pengaturan</NavLink>}
              <NavLink to="/akun">Akun</NavLink>
              <button onClick={doLogout}>Keluar</button>
            </nav>
          )}
        </div>
        <div className="hdr-bar" />
      </header>
      <main className={'main' + (narrow ? ' narrow' : '')}>{children}</main>
      <Footer />
    </div>
  );
}
