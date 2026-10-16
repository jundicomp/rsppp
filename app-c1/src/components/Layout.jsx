import { useEffect, useRef, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import { APP_TITLE, APP_ORG, CREDIT, ROLE_LABEL, YEAR } from '../lib/constants.js';
import { isDemo, resetDemo } from '../api/index.js';
import Icon from './Icon.jsx';

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

function navItems(can) {
  return [
    { to: '/dashboard', label: 'Dashboard', show: true },
    { to: '/input', label: 'Input Data', show: can('superadmin', 'dpd') },
    { to: '/rekap', label: 'Rekap', show: true },
    { to: '/users', label: 'User', show: can('superadmin') },
    { to: '/pengaturan', label: 'Pengaturan', show: can('superadmin') }
  ].filter((x) => x.show);
}

function ProfileMenu({ user, onLogout }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const loc = useLocation();
  useEffect(() => { setOpen(false); }, [loc.pathname]);
  useEffect(() => {
    if (!open) return;
    const off = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', off);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', off); document.removeEventListener('keydown', esc); };
  }, [open]);
  const initial = (user.nama || user.username || '?').trim().charAt(0).toUpperCase();
  return (
    <div className="profile" ref={ref}>
      <button className="profile-btn" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span className="avatar" aria-hidden="true">{initial}</span>
        <span className="profile-name">{user.nama || user.username}</span>
        <Icon name="chevron" size={16} />
      </button>
      {open && (
        <div className="profile-menu" role="menu">
          <div className="profile-head">
            <span className="avatar lg" aria-hidden="true">{initial}</span>
            <div style={{ minWidth: 0 }}>
              <div className="pm-name">{user.nama || user.username}</div>
              <div className="pm-sub">{user.username} · {ROLE_LABEL[user.role]}</div>
              {user.dpdNama && <div className="pm-sub">{user.dpdNama}</div>}
            </div>
          </div>
          <NavLink to="/akun" role="menuitem" className="pm-item"><Icon name="user" /> Akun Saya</NavLink>
          <button role="menuitem" className="pm-item danger" onClick={onLogout}><Icon name="logout" /> Keluar</button>
        </div>
      )}
    </div>
  );
}

export default function Layout({ children, narrow }) {
  const { user, can, logout } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [menu, setMenu] = useState(false);
  useEffect(() => { setMenu(false); }, [loc.pathname]);
  const doLogout = async () => { await logout(); nav('/login'); };
  const items = user ? navItems(can) : [];

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
          <NavLink to="/" className="hdr-brand">
            <img className="hdr-logo" src="./logo-mark.png" alt="Logo PKS" />
            <span className="hdr-text">
              <span className="hdr-title">{APP_TITLE}</span>
              <span className="hdr-sub">{user?.dpdNama || APP_ORG}</span>
            </span>
          </NavLink>
          {user && (
            <>
              <nav className="hdr-nav" aria-label="Menu utama">
                {items.map((it) => <NavLink key={it.to} to={it.to}>{it.label}</NavLink>)}
              </nav>
              <div className="hdr-right">
                <ProfileMenu user={user} onLogout={doLogout} />
                <button className="burger" aria-label={menu ? 'Tutup menu' : 'Buka menu'} aria-expanded={menu} onClick={() => setMenu(!menu)}>
                  <Icon name={menu ? 'close' : 'menu'} size={22} />
                </button>
              </div>
            </>
          )}
        </div>
        {user && menu && (
          <nav className="mnav" aria-label="Menu">
            {items.map((it) => <NavLink key={it.to} to={it.to}>{it.label}<Icon name="chevronRight" size={18} /></NavLink>)}
          </nav>
        )}
        <div className="hdr-bar" />
      </header>
      <main className={'main' + (narrow ? ' narrow' : '')}>{children}</main>
      <Footer />
    </div>
  );
}
