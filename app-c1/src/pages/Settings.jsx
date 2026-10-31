import { useEffect, useState } from 'react';
import { call, isDemo } from '../api/index.js';
import { Loading, useToast } from '../components/ui.jsx';
import Icon from '../components/Icon.jsx';

export default function Settings() {
  const toast = useToast();
  const [s, setS] = useState(null);
  const [dpds, setDpds] = useState(null);
  const [edits, setEdits] = useState({});
  const [newDpd, setNewDpd] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () => Promise.all([call('getSettings'), call('listDpd')]).then(([a, b]) => { setS(a); setDpds(b); setEdits({}); });
  useEffect(() => { load().catch((e) => toast(e.message, 'err')); }, [toast]);

  const saveSettings = async () => {
    setBusy(true);
    try { setS(await call('saveSettings', { settings: s })); toast('Pengaturan disimpan'); } catch (e) { toast(e.message, 'err'); }
    setBusy(false);
  };

  const saveDpds = async () => {
    setBusy(true);
    try {
      for (const id of Object.keys(edits)) {
        const d = dpds.find((x) => x.id === id);
        await call('saveDpd', { dpd: { ...d, ...edits[id] } });
      }
      if (newDpd.trim()) await call('saveDpd', { dpd: { nama: newDpd.trim() } });
      setNewDpd('');
      await load();
      toast('Data DPD disimpan');
    } catch (e) { toast(e.message, 'err'); }
    setBusy(false);
  };

  if (!s || !dpds) return <Loading rows={4} />;
  const val = (d, k) => (edits[d.id] && edits[d.id][k] !== undefined ? edits[d.id][k] : d[k]);
  const setVal = (d, k, v) => setEdits((e) => ({ ...e, [d.id]: { ...(e[d.id] || {}), [k]: v } }));
  const dirty = Object.keys(edits).length > 0 || newDpd.trim();

  return (
    <>
      <section style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div className="eyebrow">Super Admin</div>
        <h1 className="page-title">Pengaturan</h1>
      </section>

      <section className="card card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <h2 className="card-title">Laporan WhatsApp</h2>
          <div className="card-sub hint-text">Setelah DPD menekan Submit, laporan dikirim ke nomor ini.</div>
        </div>
        <div className="grid-2">
          <div className="field">
            <label className="label" htmlFor="wa">Nomor WA admin</label>
            <input id="wa" className="input" inputMode="tel" value={s.waAdmin || ''} onChange={(e) => setS({ ...s, waAdmin: e.target.value })} placeholder="contoh: 0812xxxxxxx" />
            <div className="help">Format 08… atau 62… keduanya bisa.</div>
          </div>
          <div className="field">
            <label className="label" htmlFor="na">Nama penerima</label>
            <input id="na" className="input" value={s.namaAdmin || ''} onChange={(e) => setS({ ...s, namaAdmin: e.target.value })} />
          </div>
          <div className="field span-all">
            <label className="label" htmlFor="url">Alamat aplikasi (dicantumkan di laporan)</label>
            <input id="url" className="input" value={s.appUrl || ''} onChange={(e) => setS({ ...s, appUrl: e.target.value })} placeholder="https://jundicomp.github.io/rsppp/dhasil/" />
          </div>
        </div>
        <div><button className="btn btn-primary" onClick={saveSettings} disabled={busy}>Simpan pengaturan</button></div>
      </section>

      <section className="card" style={{ overflow: 'hidden' }}>
        <div className="card-head">
          <div>
            <h2 className="card-title">Data DPD & jumlah kecamatan</h2>
            <div className="card-sub hint-text">Jumlah kecamatan jadi target progres. Operator DPD juga bisa mengisi sendiri di halaman Input.</div>
          </div>
          <button className="btn btn-primary btn-sm" style={{ height: 40 }} disabled={!dirty || busy} onClick={saveDpds}>Simpan perubahan</button>
        </div>
        <div className="table-wrap">
          <table className="tbl" style={{ minWidth: 560 }}>
            <thead><tr><th>Nama DPD</th><th style={{ width: 180 }}>Jumlah kecamatan</th></tr></thead>
            <tbody>
              {dpds.map((d) => (
                <tr key={d.id}>
                  <td><input className="input" style={{ height: 38 }} value={val(d, 'nama')} onChange={(e) => setVal(d, 'nama', e.target.value)} aria-label="Nama DPD" /></td>
                  <td><input className="input" style={{ height: 38 }} type="number" min="1" value={val(d, 'jumlahKecamatan')} onChange={(e) => setVal(d, 'jumlahKecamatan', e.target.value)} aria-label={'Jumlah kecamatan ' + d.nama} /></td>
                </tr>
              ))}
              <tr>
                <td colSpan={2}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <Icon name="plus" size={16} style={{ color: 'var(--muted)' }} />
                    <input className="input" style={{ height: 38 }} value={newDpd} onChange={(e) => setNewDpd(e.target.value)} placeholder="Tambah DPD baru, contoh: DPD PKS Kab. …" />
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="card card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <h2 className="card-title">Penyimpanan file</h2>
        <div className="card-sub hint-text" style={{ lineHeight: 1.6 }}>
          {isDemo
            ? 'Mode demo: file tidak benar-benar disimpan. Isi VITE_API_URL agar file masuk ke folder Google Drive.'
            : 'File Rekap Kecamatan (D Hasil) disimpan di folder Google Drive yang ID-nya diatur di Script Properties (FOLDER_ID), dengan subfolder otomatis per DPD lalu per jenis pemilihan.'}
        </div>
      </section>
    </>
  );
}
