import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import { useDpdList, useDpdRecords } from '../hooks/useDpdData.js';
import { JENIS, JENIS_LABEL, TINGKAT } from '../lib/constants.js';
import { dpdProgress, countsFromC1 } from '../lib/progress.js';
import { downloadText, fmtDate, fmtTime, toCsv } from '../lib/format.js';
import Icon from '../components/Icon.jsx';
import Capaian from '../components/Capaian.jsx';
import DpdPicker from '../components/DpdPicker.jsx';
import { Loading, ScrollRow, SearchBox, TableTabs } from '../components/ui.jsx';

const LIMIT = 15;

export default function Rekap() {
  const { user, can } = useAuth();
  const { dpds, dpdId, setDpdId, dpd } = useDpdList();
  const { c1, bacaleg, err } = useDpdRecords(dpdId);
  const [cat, setCat] = useState('c1');
  const [jenis, setJenis] = useState('');
  const [tingkat, setTingkat] = useState('');
  const [q, setQ] = useState('');
  const [all, setAll] = useState(false);

  const c1Sorted = useMemo(() => [...(c1 || [])].sort((a, b) => String(b.uploadedAt).localeCompare(String(a.uploadedAt))), [c1]);
  const prog = useMemo(() => dpdProgress({ jumlahKecamatan: dpd?.jumlahKecamatan, counts: countsFromC1(c1 || []) }), [dpd, c1]);
  const ql = q.toLowerCase().trim();
  const c1Rows = c1Sorted.filter((d) => (!jenis || d.jenis === jenis) && (!ql || [d.keterangan, d.fileName, d.uploader].join(' ').toLowerCase().includes(ql)));
  const bRows = [...(bacaleg || [])].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    .filter((d) => (!tingkat || d.tingkat === tingkat) && (!ql || [d.nama, d.pengusul, d.pencatat].join(' ').toLowerCase().includes(ql)));
  const visible = all ? c1Rows : c1Rows.slice(0, LIMIT);
  const short = (dpd?.nama || '').replace('DPD PKS ', '').replace(/\s+/g, '_');

  const exportC1 = () => downloadText(`Rekap_C1_${short}.csv`, toCsv(c1Rows, [
    { label: 'No', value: (r) => c1Rows.indexOf(r) + 1 }, { label: 'Jenis', value: (r) => JENIS_LABEL[r.jenis] },
    { label: 'Keterangan', value: 'keterangan' }, { label: 'Nama File', value: 'fileName' }, { label: 'Link File', value: 'fileUrl' },
    { label: 'Diupload Oleh', value: 'uploader' }, { label: 'Tanggal', value: (r) => fmtDate(r.uploadedAt) }, { label: 'Waktu', value: (r) => fmtTime(r.uploadedAt) }
  ]));
  const exportB = () => downloadText(`Usulan_Bacaleg_${short}.csv`, toCsv(bRows, [
    { label: 'No', value: (r) => bRows.indexOf(r) + 1 }, { label: 'Nama Bacaleg', value: 'nama' }, { label: 'Tingkat', value: 'tingkat' },
    { label: 'Profil Singkat', value: 'profil' }, { label: 'Pengusul / Rekomendasi', value: 'pengusul' }, { label: 'Dicatat Oleh', value: 'pencatat' },
    { label: 'Tanggal', value: (r) => fmtDate(r.createdAt) }, { label: 'Waktu', value: (r) => fmtTime(r.createdAt) }
  ]));

  return (
    <>
      <section className="page-head">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div className="eyebrow">{dpd?.nama || 'Memuat…'}</div>
          <h1 className="page-title">Rekap Data</h1>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          {user.role !== 'dpd' && dpds.length > 0 && <DpdPicker dpds={dpds} value={dpdId} onChange={(v) => { setDpdId(v); setJenis(''); setAll(false); }} />}
          {can('dpd', 'superadmin') && <Link className="btn btn-primary" to="/input"><Icon name="plus" size={16} /> Lanjutkan Input</Link>}
        </div>
      </section>

      {err && <div className="notice err">{err}</div>}
      {!c1 || !bacaleg ? <Loading rows={4} /> : (
        <>
          <ScrollRow className="tabs-line" label="Kategori">
            <button role="tab" aria-selected={cat === 'c1'} onClick={() => { setCat('c1'); setQ(''); }}>Dokumen C1 <span className="pill-count">{c1.length}</span></button>
            <button role="tab" aria-selected={cat === 'bacaleg'} onClick={() => { setCat('bacaleg'); setQ(''); }}>Usulan Bacaleg <span className="pill-count">{bacaleg.length}</span></button>
          </ScrollRow>

          {cat === 'c1' && (
            <>
              <Capaian prog={prog} active={jenis} onPick={(j) => { setJenis(j); setAll(false); }} />
              <section className="card" style={{ overflow: 'hidden' }}>
                <div className="card-head">
                  <div>
                    <h2 className="card-title">Dokumen C1 · {jenis ? JENIS_LABEL[jenis] : 'Semua jenis'}</h2>
                    <div className="card-sub">Menampilkan {c1Rows.length} dari {c1.length} dokumen</div>
                  </div>
                  <div className="tools">
                    <SearchBox value={q} onChange={setQ} placeholder="Cari keterangan / file / nama" />
                    <button className="btn btn-ghost btn-sm" style={{ height: 40 }} onClick={exportC1}><Icon name="download" size={16} /> Unduh Excel (CSV)</button>
                  </div>
                </div>
                <TableTabs label="Tingkatan C1" value={jenis} onChange={(j) => { setJenis(j); setAll(false); }}
                  tabs={[{ id: '', label: 'Semua', count: c1.length }, ...JENIS.map((j) => ({ id: j.id, label: j.label, count: c1.filter((x) => x.jenis === j.id).length }))]} />
                <div className="table-wrap">
                  <table className="tbl" style={{ minWidth: 900 }}>
                    <thead><tr><th>No</th><th>Jenis</th><th>Keterangan</th><th>Nama File</th><th>Diupload oleh</th><th>Tanggal</th><th>Waktu</th><th>File</th></tr></thead>
                    <tbody>
                      {visible.map((r, i) => (
                        <tr key={r.id}>
                          <td className="num">{i + 1}</td>
                          <td className="nowrap muted"><span className="dot" />{JENIS_LABEL[r.jenis]}</td>
                          <td className="strong">{r.keterangan || <span className="badge warn">Belum ada keterangan</span>}</td>
                          <td className="muted" style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.fileName}</td>
                          <td className="nowrap">{r.uploader}</td>
                          <td className="nowrap">{fmtDate(r.uploadedAt)}</td>
                          <td className="nowrap">{fmtTime(r.uploadedAt)}</td>
                          <td style={{ textAlign: 'right' }}>{r.fileUrl ? <a href={r.fileUrl} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 700, color: 'var(--hint)' }}>Lihat</a> : <span className="muted">–</span>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {!c1Rows.length && <div className="empty">Belum ada dokumen C1{jenis ? ' untuk ' + JENIS_LABEL[jenis] : ''}.</div>}
                {c1Rows.length > LIMIT && (
                  <div style={{ padding: 10, textAlign: 'center' }}>
                    <button className="btn btn-plain btn-sm" onClick={() => setAll(!all)}>{all ? 'Tampilkan lebih sedikit' : `Tampilkan semua (${c1Rows.length})`}</button>
                  </div>
                )}
              </section>
            </>
          )}

          {cat === 'bacaleg' && (
            <>
              <section className="card" style={{ overflow: 'hidden' }}>
                <div className="card-head">
                  <div>
                    <h2 className="card-title">Usulan Bacaleg · {tingkat || 'Semua tingkat'}</h2>
                    <div className="card-sub">Menampilkan {bRows.length} dari {bacaleg.length} usulan</div>
                  </div>
                  <div className="tools">
                    <SearchBox value={q} onChange={setQ} placeholder="Cari nama / pengusul" />
                    <button className="btn btn-ghost btn-sm" style={{ height: 40 }} onClick={exportB}><Icon name="download" size={16} /> Unduh Excel (CSV)</button>
                  </div>
                </div>
                <TableTabs label="Tingkat caleg" value={tingkat} onChange={setTingkat}
                  tabs={[{ id: '', label: 'Semua', count: bacaleg.length }, ...TINGKAT.map((t) => ({ id: t, label: t, count: bacaleg.filter((b) => b.tingkat === t).length }))]} />
                <div className="table-wrap">
                  <table className="tbl" style={{ minWidth: 980 }}>
                    <thead><tr><th>No</th><th>Nama Bacaleg</th><th>Tingkat</th><th style={{ width: 300 }}>Profil Singkat</th><th>Pengusul / Rekomendasi</th><th>Dicatat oleh</th><th>Tanggal &amp; Waktu</th></tr></thead>
                    <tbody>
                      {bRows.map((r, i) => (
                        <tr key={r.id} style={{ verticalAlign: 'top' }}>
                          <td className="num">{i + 1}</td>
                          <td className="strong">{r.nama}</td>
                          <td className="nowrap muted"><span className="dot" />{r.tingkat}</td>
                          <td className="muted" style={{ lineHeight: 1.55 }}>{r.profil}</td>
                          <td>{r.pengusul}</td>
                          <td className="nowrap">{r.pencatat}</td>
                          <td className="nowrap">{fmtDate(r.createdAt)} · {fmtTime(r.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {!bRows.length && <div className="empty">Belum ada usulan{tingkat ? ' untuk ' + tingkat : ''}.</div>}
              </section>
            </>
          )}
        </>
      )}
    </>
  );
}

