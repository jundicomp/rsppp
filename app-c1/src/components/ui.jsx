import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import Icon from './Icon.jsx';

/* ---------- Toast ---------- */
const ToastCtx = createContext(() => {});
export function ToastProvider({ children }) {
  const [t, setT] = useState(null);
  const show = useCallback((msg, type = 'ok') => {
    setT({ msg, type, id: Date.now() });
  }, []);
  useEffect(() => {
    if (!t) return;
    const h = setTimeout(() => setT(null), 3500);
    return () => clearTimeout(h);
  }, [t]);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      {t && <div role="status" className={'toast' + (t.type === 'err' ? ' err' : '')}>{t.msg}</div>}
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx);

/* ---------- Modal ---------- */
export function Modal({ title, sub, onClose, children, footer, width }) {
  useEffect(() => {
    const k = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', k);
    return () => document.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div className="modal-bg" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={width ? { maxWidth: width } : undefined}>
        <div className="modal-head">
          <div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{title}</div>
            {sub && <div className="help" style={{ fontSize: 13 }}>{sub}</div>}
          </div>
          <button className="btn-icon" aria-label="Tutup" onClick={onClose}><Icon name="close" /></button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

/* ---------- Progress visuals ---------- */
export function Donut({ pct, size = 168, stroke = 16, label = 'total capaian' }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="donut" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`Capaian ${pct} persen`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--track)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--brand)" strokeWidth={stroke}
          strokeDasharray={`${(c * pct) / 100} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dasharray .6s ease-out' }} />
      </svg>
      <div className="donut-c"><b>{pct}%</b><span>{label}</span></div>
    </div>
  );
}

export function SplitBar({ pct }) {
  const cls = 'split-bar' + (pct >= 100 ? ' full' : '') + (pct <= 0 ? ' empty' : '');
  return (
    <span className={cls}>
      {pct > 0 && <span className="done" style={{ width: pct + '%' }} />}
      {pct < 100 && <span className="todo" />}
    </span>
  );
}

export function ProgressLine({ pct, done, thin }) {
  return (
    <div className={'pbar' + (thin ? ' thin' : '') + (done ? ' done' : '')} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
      <div style={{ width: pct + '%' }} />
    </div>
  );
}

export function MiniBars({ per }) {
  return (
    <span className="mini-bars" title={per.map((p) => `${p.label}: ${p.pct}%`).join('\n')}>
      {per.map((p) => (
        <span key={p.id} aria-label={`${p.label} ${p.pct}%`}><i style={{ height: p.pct + '%' }} /></span>
      ))}
    </span>
  );
}

export function Loading({ rows = 3 }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }} aria-busy="true">
      {Array.from({ length: rows }).map((_, i) => <div key={i} className="skeleton" style={{ height: 64 }} />)}
    </div>
  );
}

export function SearchBox({ value, onChange, placeholder = 'Cari…' }) {
  return (
    <div className="search">
      <Icon name="search" size={16} />
      <input className="input" type="search" aria-label={placeholder} placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

/**
 * Baris tab yang bisa digeser. Kalau tab tidak muat, muncul tombol panah berdenyut
 * sebagai tanda masih ada tab lain di samping.
 */
export function ScrollRow({ className, label, children }) {
  const ref = useRef(null);
  const lastActive = useRef(null);
  const [left, setLeft] = useState(false);
  const [right, setRight] = useState(false);
  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setLeft(el.scrollLeft > 4);
    setRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    update();
    el.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null;
    if (ro) ro.observe(el);
    return () => { el.removeEventListener('scroll', update); window.removeEventListener('resize', update); if (ro) ro.disconnect(); };
  }, [update]);
  useEffect(() => {
    update();
    const el = ref.current;
    const act = el && el.querySelector('[aria-selected="true"]');
    if (act && act !== lastActive.current) {
      if (lastActive.current) act.scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' });
      lastActive.current = act;
    }
  });
  const go = (d) => ref.current && ref.current.scrollBy({ left: d * ref.current.clientWidth * 0.7, behavior: 'smooth' });
  return (
    <div className={'srow' + (left ? ' has-l' : '') + (right ? ' has-r' : '')}>
      <div ref={ref} className={className} role="tablist" aria-label={label}>{children}</div>
      {left && <button type="button" className="srow-btn left" aria-label="Geser tab ke kiri" onClick={() => go(-1)}><Icon name="chevronLeft" size={20} stroke={2.5} /></button>}
      {right && <button type="button" className="srow-btn right pulse" aria-label="Geser tab ke kanan" onClick={() => go(1)}><Icon name="chevronRight" size={20} stroke={2.5} /></button>}
    </div>
  );
}

/** Tab di atas tabel, dikelompokkan per tingkatan. tabs: [{ id, label, count }] */
export function TableTabs({ tabs, value, onChange, label = 'Kelompok' }) {
  return (
    <ScrollRow className="ttabs" label={label}>
      {tabs.map((t) => (
        <button key={t.id || 'all'} role="tab" aria-selected={value === t.id} onClick={() => onChange(t.id)}>
          {t.label}{t.count !== undefined && <span>{t.count}</span>}
        </button>
      ))}
    </ScrollRow>
  );
}

/** Tombol ikon kecil untuk kolom aksi tabel (tooltip + label aksesibel). */
export function IconBtn({ icon, label, onClick, tone, disabled }) {
  return (
    <button type="button" className={'icon-act' + (tone ? ' ' + tone : '')} title={label} aria-label={label} onClick={onClick} disabled={disabled}>
      <Icon name={icon} size={18} />
    </button>
  );
}

/**
 * Modal konfirmasi dengan password. Isi form tambahan lewat children.
 * onConfirm(password, alasan) harus mengembalikan Promise; error ditampilkan di modal.
 */
export function PasswordConfirm({ title, sub, danger, confirmLabel = 'Simpan', onConfirm, onClose, children, canSubmit = true, progress }) {
  const [pw, setPw] = useState('');
  const [alasan, setAlasan] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const submit = async (e) => {
    e && e.preventDefault();
    if (!pw || busy || !canSubmit) return;
    setBusy(true); setErr('');
    try {
      await onConfirm(pw, alasan.trim());
    } catch (e2) {
      setErr(e2.message);
      setBusy(false);
    }
  };
  return (
    <Modal title={title} sub={sub} onClose={() => !busy && onClose()}
      footer={<>
        <button className="btn btn-ghost" onClick={onClose} disabled={busy}>Batal</button>
        <button className={'btn ' + (danger ? 'btn-danger-solid' : 'btn-primary')} onClick={submit} disabled={!pw || busy || !canSubmit}>
          {busy ? 'Memproses…' : confirmLabel}
        </button>
      </>}>
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {children}
        <div className="field">
          <label className="label" htmlFor="pc-alasan">Alasan perubahan <span style={{ fontWeight: 500 }}>(opsional)</span></label>
          <input id="pc-alasan" className="input" value={alasan} onChange={(e) => setAlasan(e.target.value)} placeholder="Contoh: salah pilih tingkatan, foto buram, file dobel" />
          <div className="help">Tercatat di Riwayat Perubahan.</div>
        </div>
        <div className="field pc-pass">
          <label className="label" htmlFor="pc-pass"><Icon name="lock" size={16} style={{ verticalAlign: '-3px', marginRight: 6 }} />Konfirmasi dengan password Anda <span className="req">*</span></label>
          <input id="pc-pass" className="input" type="password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} autoFocus />
          <div className="help">Password akun yang sedang login.</div>
        </div>
        {progress > 0 && <ProgressLine pct={progress} />}
        {err && <div className="notice err" role="alert">{err}</div>}
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}
