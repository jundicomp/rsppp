import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { call } from '../api/index.js';
import { JENIS } from '../lib/constants.js';
import { rankDpd } from '../lib/progress.js';
import { downloadText, fmtDateTime, toCsv } from '../lib/format.js';
import Icon from '../components/Icon.jsx';
import Capaian from '../components/Capaian.jsx';
import { Loading, MiniBars, ProgressLine, SearchBox } from '../components/ui.jsx';

function status(r) {
  if (!r.hasTarget) return { label: 'Kecamatan belum diisi', cls: 'off' };
  if (!r.totalFiles) return { label: 'Belum mulai', cls: '' };
  if (r.pct >= 100) return { label: 'Selesai', cls: 'ok' };
  return { label: 'Berjalan', cls: 'warn' };
}

export default function Dashboard() {
  const nav = useNavigate();
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState('');
  const [at, setAt] = useState(null);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setBusy(true);
    return call('dashboard')
      .then((d) => { setRows(d); setAt(new Date().toISOString()); setErr(''); })
      .catch((e) => setErr(e.message))
      .finally(() => setBusy(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const ranked = useMemo(() => (rows ? rankDpd(rows) : []), [rows]);
  const agg = useMemo(() => {
    const withT = ranked.filter((r) => r.hasTarget);
    const K = withT.reduce((s, r) => s + r.K, 0);
    const per = JENIS.map((j) => {
      const capped = withT.reduce((s, r) => s + Math.min(r.per.find((p) => p.id === j.id).count, r.K), 0);
      return { ...j, count: capped, pct: K ? Math.round((capped / K) * 100) : 0, pr: Math.max(0, K - capped) };
    });
    const target = K * JENIS.length;
    const done = per.reduce((s, p) => s + p.count, 0);
    return { K, per, target, done, pr: target - done, pct: target ? Math.round((done / target) * 100) : 0 };
  }, [ranked]);

  if (!rows) return err ? <div className="notice err">{err}</div> : <Loading rows={5} />;

  const totalFiles = ranked.reduce((s, r) => s + r.totalFiles, 0);
  const totalBacaleg = ranked.reduce((s, r) => s + r.bacaleg, 0);
  const active = ranked.filter((r) => r.totalFiles > 0).length;
  const top = ranked.filter((r) => r.hasTarget && r.totalFiles > 0).slice(0, 3);
  const attention = ranked.filter((r) => !r.hasTarget || !r.totalFiles);
  const ql = q.toLowerCase().trim();
  const list = ranked.filter((r) => !ql || r.nama.toLowerCase().includes(ql));

  const openRekap = (id) => { sessionStorage.setItem('c1_dpd', id); nav('/rekap'); };
  const exportCsv = () => downloadText('Peringkat_Capaian_DPD.csv', toCsv(ranked, [
    { label: 'Peringkat', value: 'rank' }, { label: 'DPD', value: 'nama' }, { label: 'Jumlah Kecamatan', value: 'K' },
    ...JENIS.map((j) => ({ label: j.label + ' (file)', value: (r) => r.per.find((p) => p.id === j.id).count })),
    ...JENIS.map((j) => ({ label: j.label + ' (%)', value: (r) => r.per.find((p) => p.id === j.id).pct })),
    { label: 'Capaian (%)', value: 'pct' }, { label: 'Total File C1', value: 'totalFiles' }, { label: 'Usulan Bacaleg', value: 'bacaleg' },
    { label: 'Upload Terakhir', value: (r) => (r.lastUpload ? fmtDateTime(r.lastUpload) : '') }, { label: 'Status', value: (r) => status(r).label }
  ]));

  return (
    <>
      <section className="page-head">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div className="eyebrow">DPW PKS Sumatera Selatan · diperbarui {at ? fmtDateTime(at) : '-'}</div>
          <h1 className="page-title">Dashboard Capaian</h1>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost" onClick={load} disabled={busy}>{busy ? 'Memuat…' : 'Muat ulang'}</button>
          <button className="btn btn-primary" onClick={exportCsv}><Icon name="download" size={16} /> Unduh peringkat</button>
        </div>
      </section>
      {err && <div className="notice err">{err}</div>}

      <section className="kpis">
        <div className="kpi"><span>Capaian se-provinsi</span><b>{agg.pct}%</b><small>{agg.done} dari {agg.target} dokumen target</small></div>
        <div className="kpi"><span>Total file C1</span><b>{totalFiles}</b><small>dari semua DPD</small></div>
        <div className="kpi"><span>DPD sudah upload</span><b>{active}<span style={{ fontSize: 16, color: 'var(--muted)', fontWeight: 600 }}> / {ranked.length}</span></b><small>{ranked.length - active} belum mulai</small></div>
        <div className="kpi"><span>Usulan bacaleg</span><b>{totalBacaleg}</b><small>nama diusulkan</small></div>
      </section>

      <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
          <h2 className="card-title" style={{ fontSize: 16 }}>Capaian tertinggi</h2>
          <span className="card-sub">Persentase upload C1 terhadap target kecamatan</span>
        </div>
        {top.length ? (
          <div className="podium">
            {top.map((r, i) => (
              <button key={r.id} className={'pod' + (i === 0 ? ' first' : '')} onClick={() => openRekap(r.id)} style={{ textAlign: 'left', cursor: 'pointer', font: 'inherit', color: 'inherit' }}>
                <span className="pod-rank">{i === 0 && <Icon name="trophy" size={14} />}PERINGKAT {i + 1}</span>
                <span className="pod-name">{r.nama.replace('DPD PKS ', '')}</span>
                <span style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <span className="pod-pct">{r.pct}%</span>
                  <span className="card-sub">{r.done}/{r.target} dokumen</span>
                </span>
                <ProgressLine pct={r.pct} />
              </button>
            ))}
          </div>
        ) : <div className="card empty">Belum ada DPD yang mengupload.</div>}
      </section>

      <Capaian prog={agg} title="Capaian per tingkatan · se-provinsi" />

      <section className="card" style={{ overflow: 'hidden' }}>
        <div className="card-head">
          <div>
            <h2 className="card-title">Peringkat capaian DPD</h2>
            <div className="card-sub">Diurutkan dari persentase tertinggi · klik baris untuk lihat rekap DPD</div>
          </div>
          <div className="tools"><SearchBox value={q} onChange={setQ} placeholder="Cari DPD" /></div>
        </div>
        <div className="table-wrap">
          <table className="tbl" style={{ minWidth: 920 }}>
            <thead>
              <tr><th>#</th><th>DPD</th><th>Kec.</th><th title="DPR RI · DPRD Prov · DPRD Kab/Kota · DPD RI · Pilpres">Per tingkatan</th><th style={{ width: 220 }}>Capaian</th><th>File</th><th>Bacaleg</th><th>Upload terakhir</th><th>Status</th></tr>
            </thead>
            <tbody>
              {list.map((r) => {
                const st = status(r);
                return (
                  <tr key={r.id} style={{ cursor: 'pointer' }} onClick={() => openRekap(r.id)}>
                    <td className="num" style={{ fontWeight: r.rank <= 3 ? 700 : 400, color: r.rank <= 3 ? 'var(--ink)' : undefined }}>{r.rank}</td>
                    <td className="strong">{r.nama.replace('DPD PKS ', '')}</td>
                    <td className="muted">{r.K || '–'}</td>
                    <td><MiniBars per={r.per} /></td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ flex: 1 }}><ProgressLine pct={r.pct} /></div>
                        <b style={{ width: 40, textAlign: 'right' }}>{r.pct}%</b>
                      </div>
                    </td>
                    <td>{r.totalFiles}</td>
                    <td>{r.bacaleg}</td>
                    <td className="muted nowrap">{r.lastUpload ? fmtDateTime(r.lastUpload) : '–'}</td>
                    <td><span className={'badge ' + st.cls}>{st.label}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="card-sub" style={{ padding: '10px 20px', borderTop: '1px solid var(--line-2)' }}>
          Batang kecil = DPR RI · DPRD Provinsi · DPRD Kab/Kota · DPD RI · Pilpres (arahkan kursor untuk detail).
        </div>
      </section>

      {attention.length > 0 && (
        <section className="card card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <h2 className="card-title">Perlu ditindaklanjuti ({attention.length})</h2>
          <div className="card-sub">DPD yang belum mengisi jumlah kecamatan atau belum mengupload sama sekali.</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {attention.map((r) => (
              <button key={r.id} className="badge" style={{ border: '1px solid var(--line)', cursor: 'pointer', padding: '6px 10px' }} onClick={() => openRekap(r.id)}>
                {r.nama.replace('DPD PKS ', '')} · {status(r).label.toLowerCase()}
              </button>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
