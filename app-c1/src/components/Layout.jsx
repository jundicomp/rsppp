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
    { to: '/dashboard', label: 'Dashboard', icon: 'grid', show: true },
    { to: '/input', label: 'Input Data', icon: 'upload', show: can('superadmin', 'dpd') },
    { to: '/rekap', label: 'Rekap', icon: 'table', show: true },
    { to: '/users', label: 'User', icon: 'users', show: can('superadmin'), group: 'Admin' },
    { to: '/pengaturan', label: 'Pengaturan', icon: 'settings', show: can('superadmin'), group: 'Admin' }
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

function Brand({ compact }) {
  return (
    <NavLink to="/" className={'brand' + (compact ? ' compact' : '')} title={APP_TITLE}>
      <img src="./logo-mark.png" alt="Logo PKS" />
      <span className="brand-text">
        <span className="brand-title">D Hasil</span>
        <span className="brand-sub">Pemilu 2024</span>
      </span>
    </NavLink>
  );
}

export default function Layout({ children, narrow }) {
  const { user, can, logout } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [open, setOpen] = useState(false);
  const [mini, setMini] = useState(() => { try { return localStorage.getItem('c1_side_mini') === '1'; } catch (e) { return false; } });
  const toggleMini = () => setMini((m) => { try { localStorage.setItem('c1_side_mini', m ? '0' : '1'); } catch (e) { /* abaikan */ } return !m; });
  useEffect(() => { setOpen(false); }, [loc.pathname]);
  useEffect(() => {
    if (!open) return;
    const esc = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', esc);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', esc); document.body.style.overflow = ''; };
  }, [open]);
  const doLogout = async () => { await logout(); nav('/login'); };
  const items = user ? navItems(can) : [];
  const main = items.filter((i) => !i.group);
  const admin = items.filter((i) => i.group === 'Admin');

  return (
    <div className="shell">
      <aside className={'side' + (open ? ' open' : '') + (mini ? ' mini' : '')} aria-label="Menu utama">
        <div className="side-top">
          <button className="side-toggle" aria-label={mini ? 'Lebarkan menu' : 'Ciutkan menu'} title={mini ? 'Lebarkan menu' : 'Ciutkan menu'} aria-expanded={!mini} onClick={toggleMini}>
            <Icon name="menu" size={22} />
          </button>
          <Brand />
          <button className="side-close" aria-label="Tutup menu" onClick={() => setOpen(false)}><Icon name="close" size={22} /></button>
        </div>
        <nav className="side-nav">
          <div className="side-label">Menu</div>
          {main.map((it) => (
            <NavLink key={it.to} to={it.to} title={mini ? it.label : undefined}><Icon name={it.icon} size={20} /><span>{it.label}</span></NavLink>
          ))}
          {admin.length > 0 && <div className="side-label">Admin</div>}
          {admin.map((it) => (
            <NavLink key={it.to} to={it.to} title={mini ? it.label : undefined}><Icon name={it.icon} size={20} /><span>{it.label}</span></NavLink>
          ))}
        </nav>
        <div className="side-credit">
          <img src="./logo-mark.png" alt="" />
          <span className="side-credit-text">Dibuat oleh <strong>{CREDIT}</strong><br />© {YEAR}</span>
        </div>
      </aside>
      {open && <div className="side-backdrop" onClick={() => setOpen(false)} aria-hidden="true" />}

      <div className="content">
        {isDemo && (
          <div className="demo-ribbon">
            Mode demo · data contoh tersimpan di browser ini saja ·{' '}
            <button onClick={() => { resetDemo(); location.reload(); }}>reset data demo</button>
          </div>
        )}
        <header className="topbar">
          <button className="burger" aria-label="Buka menu" aria-expanded={open} onClick={() => setOpen(true)}><Icon name="menu" size={22} /></button>
          <div className="topbar-mobile-brand"><Brand compact /></div>
          <div className="topbar-ctx">
            <span className="topbar-ctx-sub">{APP_ORG}</span>
            <span className="topbar-ctx-main">{user?.dpdNama || 'DPW PKS Sumatera Selatan'}</span>
          </div>
          {user && <div className="hdr-right"><ProfileMenu user={user} onLogout={doLogout} /></div>}
        </header>
        <main className={'main' + (narrow ? ' narrow' : '')}>{children}</main>
      </div>
    </div>
  );
}
