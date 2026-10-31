import { useEffect, useMemo, useState } from 'react';
import { call } from '../api/index.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { ROLES, ROLE_LABEL } from '../lib/constants.js';
import { fmtDateTime } from '../lib/format.js';
import Icon from '../components/Icon.jsx';
import { Loading, Modal, SearchBox, TableTabs, useToast } from '../components/ui.jsx';

const blank = { id: '', username: '', nama: '', role: 'dpd', dpdId: '', password: '', aktif: true, email: '' };

function genPass() {
  const c = 'abcdefghjkmnpqrstuvwxyz23456789';
  return Array.from({ length: 8 }, () => c[Math.floor(Math.random() * c.length)]).join('');
}

export default function Users() {
  const { user: me } = useAuth();
  const toast = useToast();
  const [users, setUsers] = useState(null);
  const [dpds, setDpds] = useState([]);
  const [q, setQ] = useState('');
  const [role, setRole] = useState('');
  const [form, setForm] = useState(null);
  const [reset, setReset] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const load = () => Promise.all([call('listUsers'), call('listDpd')]).then(([u, d]) => { setUsers(u); setDpds(d); }).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, []);

  const list = useMemo(() => (users || []).filter((u) => (!role || u.role === role) &&
    (!q || [u.username, u.nama, u.dpdNama, u.email].join(' ').toLowerCase().includes(q.toLowerCase()))), [users, q, role]);

  const save = async () => {
    setBusy(true);
    try {
      await call('saveUser', { user: form });
      toast(form.id ? 'User diperbarui' : 'User ditambahkan');
      setForm(null);
      await load();
    } catch (e) { toast(e.message, 'err'); }
    setBusy(false);
  };

  const doReset = async () => {
    setBusy(true);
    try {
      await call('resetPassword', { userId: reset.user.id, password: reset.password });
      toast('Password ' + reset.user.username + ' direset');
      setReset(null);
    } catch (e) { toast(e.message, 'err'); }
    setBusy(false);
  };

  const toggle = async (u) => {
    if (u.id === me.id) return toast('Tidak bisa menonaktifkan akun sendiri', 'err');
    try {
      await call('saveUser', { user: { ...u, aktif: !u.aktif } });
      await load();
    } catch (e) { toast(e.message, 'err'); }
  };

  const usedDpd = new Set((users || []).filter((u) => u.role === 'dpd').map((u) => u.dpdId));
  const noAccount = dpds.filter((d) => !usedDpd.has(d.id));

  return (
    <>
      <section className="page-head">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div className="eyebrow">Hak akses</div>
          <h1 className="page-title">Manajemen User</h1>
        </div>
        <button className="btn btn-primary" onClick={() => setForm({ ...blank, password: genPass() })}><Icon name="plus" size={16} /> Tambah user</button>
      </section>

      <section className="kpis" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
        {ROLES.map((r) => (
          <div className="kpi" key={r.id}><span>{r.label}</span><b>{(users || []).filter((u) => u.role === r.id).length}</b><small>{r.desc}</small></div>
        ))}
      </section>

      {noAccount.length > 0 && users && (
        <div className="notice">
          <div><b>{noAccount.length} DPD belum punya akun operator:</b> {noAccount.map((d) => d.nama.replace('DPD PKS ', '')).join(', ')}.</div>
        </div>
      )}
      {err && <div className="notice err">{err}</div>}

      <section className="card" style={{ overflow: 'hidden' }}>
        <div className="card-head">
          <div><h2 className="card-title">Daftar user</h2><div className="card-sub">{list.length} user</div></div>
          <div className="tools">
            <SearchBox value={q} onChange={setQ} placeholder="Cari username / nama / email / DPD" />
          </div>
        </div>
        <TableTabs label="Hak akses" value={role} onChange={setRole}
          tabs={[{ id: '', label: 'Semua', count: (users || []).length }, ...ROLES.map((r) => ({ id: r.id, label: r.label, count: (users || []).filter((u) => u.role === r.id).length }))]} />
        {!users ? <div style={{ padding: 20 }}><Loading /></div> : (
          <div className="table-wrap">
            <table className="tbl" style={{ minWidth: 1000 }}>
              <thead><tr><th>Username</th><th>Nama</th><th>Email</th><th>Role</th><th>DPD</th><th>Login terakhir</th><th>Status</th><th /></tr></thead>
              <tbody>
                {list.map((u) => (
                  <tr key={u.id}>
                    <td className="strong">{u.username}</td>
                    <td>{u.nama}</td>
                    <td>{u.email || <span className="hint-text">belum diisi</span>}</td>
                    <td><span className="badge">{ROLE_LABEL[u.role]}</span></td>
                    <td className="muted">{u.dpdNama ? u.dpdNama.replace('DPD PKS ', '') : '–'}</td>
                    <td className="muted nowrap">{u.lastLogin ? fmtDateTime(u.lastLogin) : 'Belum pernah'}</td>
                    <td>
                      <button className={'badge ' + (u.aktif ? 'ok' : 'off')} style={{ border: 0, cursor: 'pointer' }} onClick={() => toggle(u)} title="Klik untuk mengubah">
                        {u.aktif ? 'Aktif' : 'Nonaktif'}
                      </button>
                    </td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button className="btn-icon" aria-label={'Ubah ' + u.username} onClick={() => setForm({ ...u, password: '' })}><Icon name="edit" /></button>
                      <button className="btn-icon" aria-label={'Reset password ' + u.username} onClick={() => setReset({ user: u, password: genPass() })}><Icon name="key" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {form && (
        <Modal title={form.id ? 'Ubah user' : 'Tambah user'} onClose={() => setForm(null)}
          footer={<><button className="btn btn-ghost" onClick={() => setForm(null)}>Batal</button><button className="btn btn-primary" disabled={busy} onClick={save}>{busy ? 'Menyimpan…' : 'Simpan'}</button></>}>
          <div className="field">
            <label className="label">Role / hak akses</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {ROLES.map((r) => (
                <label key={r.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 12px', border: '1px solid ' + (form.role === r.id ? 'var(--ink)' : 'var(--line)'), borderRadius: 8, cursor: 'pointer' }}>
                  <input type="radio" name="role" checked={form.role === r.id} onChange={() => setForm({ ...form, role: r.id })} style={{ marginTop: 3, accentColor: 'var(--brand)' }} />
                  <span><b style={{ fontWeight: 600 }}>{r.label}</b><br /><span className="help">{r.desc}</span></span>
                </label>
              ))}
            </div>
          </div>
          {form.role === 'dpd' && (
            <div className="field">
              <label className="label" htmlFor="f-dpd">DPD <span className="req">*</span></label>
              <select id="f-dpd" className="select" value={form.dpdId} onChange={(e) => {
                const d = dpds.find((x) => x.id === e.target.value);
                const auto = d ? 'dpd.' + d.nama.replace('DPD PKS ', '').replace(/^(Kota|Kab\.)\s+/, '').toLowerCase().replace(/[^a-z0-9]+/g, '') : '';
                setForm({ ...form, dpdId: e.target.value, username: form.id || form.username ? form.username : auto, nama: form.nama || (d ? 'Operator ' + d.nama.replace('DPD PKS ', '') : '') });
              }}>
                <option value="">Pilih DPD…</option>
                {dpds.map((d) => <option key={d.id} value={d.id}>{d.nama}</option>)}
              </select>
            </div>
          )}
          <div className="grid-2">
            <div className="field">
              <label className="label" htmlFor="f-u">Username <span className="req">*</span></label>
              <input id="f-u" className="input" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value.trim() })} placeholder="contoh: dpd.palembang" />
            </div>
            <div className="field">
              <label className="label" htmlFor="f-n">Nama</label>
              <input id="f-n" className="input" value={form.nama} onChange={(e) => setForm({ ...form, nama: e.target.value })} />
            </div>
          </div>
          <div className="field">
            <label className="label" htmlFor="f-e">Email</label>
            <input id="f-e" className="input" type="email" value={form.email || ''} onChange={(e) => setForm({ ...form, email: e.target.value.trim() })} placeholder="contoh: operator@gmail.com" />
            <div className="help">Dipakai untuk reset password sendiri lewat tombol "Lupa password" di halaman login. Boleh dikosongkan, operator bisa mengisinya sendiri di menu Akun Saya.</div>
          </div>
          {!form.id && (
            <div className="field">
              <label className="label" htmlFor="f-p">Password awal <span className="req">*</span></label>
              <div className="input-addon">
                <input id="f-p" className="input" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
                <span style={{ padding: 0 }}><button type="button" className="btn btn-plain btn-sm" style={{ height: 42, borderRadius: 0 }} onClick={() => setForm({ ...form, password: genPass() })}>Acak</button></span>
              </div>
              <div className="help">Catat dan kirim ke operator. Mereka bisa mengganti sendiri di menu Akun.</div>
            </div>
          )}
        </Modal>
      )}

      {reset && (
        <Modal title={'Reset password ' + reset.user.username} sub="Sesi login user ini akan diakhiri." onClose={() => setReset(null)}
          footer={<><button className="btn btn-ghost" onClick={() => setReset(null)}>Batal</button><button className="btn btn-primary" disabled={busy} onClick={doReset}>Reset password</button></>}>
          <div className="field">
            <label className="label" htmlFor="r-p">Password baru</label>
            <div className="input-addon">
              <input id="r-p" className="input" value={reset.password} onChange={(e) => setReset({ ...reset, password: e.target.value })} />
              <span style={{ padding: 0 }}><button type="button" className="btn btn-plain btn-sm" style={{ height: 42, borderRadius: 0 }} onClick={() => setReset({ ...reset, password: genPass() })}>Acak</button></span>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
