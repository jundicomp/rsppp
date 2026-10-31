import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { call } from '../api/index.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { useDpdList, useDpdRecords } from '../hooks/useDpdData.js';
import { JENIS, JENIS_LABEL, TINGKAT } from '../lib/constants.js';
import { dpdProgress, countsFromC1 } from '../lib/progress.js';
import { fmtDate, fmtDateTime, fmtTime } from '../lib/format.js';
import { exportXlsx } from '../lib/excel.js';
import { openC1File } from '../lib/files.js';
import Icon from '../components/Icon.jsx';
import Capaian from '../components/Capaian.jsx';
import DpdPicker from '../components/DpdPicker.jsx';
import { DeleteBacalegModal, DeleteC1Modal, EditBacalegModal, EditC1Modal } from '../components/EditModals.jsx';
import { IconBtn, Loading, ScrollRow, SearchBox, TableTabs, useToast } from '../components/ui.jsx';

const LIMIT = 15;
const AKSI = [
  { id: '', label: 'Semua' }, { id: 'UPLOAD', label: 'Upload' }, { id: 'TAMBAH', label: 'Tambah' }, { id: 'EDIT', label: 'Edit' },
  { id: 'GANTI_FILE', label: 'Ganti File' }, { id: 'HAPUS', label: 'Hapus' }, { id: 'SUBMIT', label: 'Submit' }
];
const AKSI_LABEL = Object.fromEntries(AKSI.map((a) => [a.id, a.label]));

export default function Rekap() {
  const { user, can } = useAuth();
  const toast = useToast();
  const { dpds, dpdId, setDpdId, dpd } = useDpdList();
  const { c1, setC1, bacaleg, setBacaleg, err } = useDpdRecords(dpdId);
  const [cat, setCat] = useState('c1');
  const [jenis, setJenis] = useState('');
  const [tingkat, setTingkat] = useState('');
  const [aksi, setAksi] = useState('');
  const [q, setQ] = useState('');
  const [all, setAll] = useState(false);
  const [log, setLog] = useState(null);
  const [modal, setModal] = useState(null);
  const [busyFile, setBusyFile] = useState('');
  const [exporting, setExporting] = useState(false);
  const canEdit = can('dpd', 'superadmin');

  const loadLog = useCallback(() => {
    if (!dpdId) return;
    call('listLog', { dpdId }).then(setLog).catch((e) => toast(e.message, 'err'));
  }, [dpdId, toast]);
  useEffect(() => { setLog(null); }, [dpdId]);
  useEffect(() => { if (cat === 'log' && !log) loadLog(); }, [cat, log, loadLog]);

  const c1Sorted = useMemo(() => [...(c1 || [])].sort((a, b) => String(b.uploadedAt).localeCompare(String(a.uploadedAt))), [c1]);
  const prog = useMemo(() => dpdProgress({ jumlahKecamatan: dpd?.jumlahKecamatan, counts: countsFromC1(c1 || []) }), [dpd, c1]);
  const ql = q.toLowerCase().trim();
  const c1Rows = c1Sorted.filter((d) => (!jenis || d.jenis === jenis) && (!ql || [d.keterangan, d.fileName, d.namaAsli, d.uploader].join(' ').toLowerCase().includes(ql)));
  const bRows = [...(bacaleg || [])].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    .filter((d) => (!tingkat || d.tingkat === tingkat) && (!ql || [d.nama, d.pengusul, d.pencatat].join(' ').toLowerCase().includes(ql)));
  const logRows = (log || []).filter((d) => (!aksi || d.aksi === aksi) && (!ql || [d.username, d.detail, d.alasan].join(' ').toLowerCase().includes(ql)));
  const visible = all ? c1Rows : c1Rows.slice(0, LIMIT);
  const dpdNama = dpd?.nama || '';
  const short = dpdNama.replace('DPD PKS ', '').replace(/\s+/g, '_');

  const run = async (fn) => { setExporting(true); try { await fn(); } catch (e) { toast('Gagal membuat Excel: ' + e.message, 'err'); } setExporting(false); };
  const exportC1 = () => run(() => exportXlsx({
    filename: `Rekap_DHasil_${short}${jenis ? '_' + JENIS_LABEL[jenis].replace(/\W+/g, '') : ''}`, sheetName: 'Rekap D Hasil',
    title: 'REKAP KECAMATAN (D HASIL) PEMILU 2024', subtitle: dpdNama + ' · Tingkatan: ' + (jenis ? JENIS_LABEL[jenis] : 'Semua'),
    rows: c1Rows,
    columns: [
      { label: 'Tingkatan', value: (r) => JENIS_LABEL[r.jenis], width: 16 },
      { label: 'Keterangan', value: 'keterangan', width: 38 },
      { label: 'Nama File', value: 'fileName', width: 48 },
      { label: 'Nama File Asli', value: (r) => r.namaAsli || '', width: 26 },
      { label: 'Diupload Oleh', value: 'uploader', width: 20 },
      { label: 'Tanggal', value: (r) => fmtDate(r.uploadedAt), width: 14, align: 'center' },
      { label: 'Waktu (WIB)', value: (r) => fmtTime(r.uploadedAt), width: 12, align: 'center' },
      { label: 'Terakhir Diubah', value: (r) => (r.updatedAt ? fmtDateTime(r.updatedAt) + ' oleh ' + r.updatedBy : ''), width: 30 }
    ]
  }));
  const exportB = () => run(() => exportXlsx({
    filename: `Usulan_Bacaleg_${short}`, sheetName: 'Usulan Bacaleg',
    title: 'REKAP USULAN NAMA BACALEG', subtitle: dpdNama + ' · Tingkat: ' + (tingkat || 'Semua'),
    rows: bRows,
    columns: [
      { label: 'Nama Bacaleg', value: 'nama', width: 28 },
      { label: 'Caleg Tingkat', value: 'tingkat', width: 16 },
      { label: 'Profil Singkat / Latar Belakang', value: 'profil', width: 50 },
      { label: 'Pengusul / Rekomendasi', value: 'pengusul', width: 30 },
      { label: 'Dicatat Oleh', value: 'pencatat', width: 20 },
      { label: 'Tanggal', value: (r) => fmtDate(r.createdAt), width: 14, align: 'center' },
      { label: 'Waktu (WIB)', value: (r) => fmtTime(r.createdAt), width: 12, align: 'center' }
    ]
  }));
  const exportLog = () => run(() => exportXlsx({
    filename: `Riwayat_Perubahan_${short}`, sheetName: 'Riwayat',
    title: 'RIWAYAT PERUBAHAN DATA', subtitle: dpdNama + ' · Aksi: ' + (aksi ? AKSI_LABEL[aksi] : 'Semua'),
    rows: logRows,
    columns: [
      { label: 'Tanggal', value: (r) => fmtDate(r.waktu), width: 14, align: 'center' },
      { label: 'Waktu (WIB)', value: (r) => fmtTime(r.waktu), width: 12, align: 'center' },
      { label: 'Pengguna', value: 'username', width: 30 },
      { label: 'Aksi', value: (r) => AKSI_LABEL[r.aksi] || r.aksi, width: 12, align: 'center' },
      { label: 'Data', value: 'objek', width: 10, align: 'center' },
      { label: 'Detail', value: 'detail', width: 60 },
      { label: 'Alasan', value: 'alasan', width: 30 }
    ]
  }));

  const openFile = async (row, mode) => {
    setBusyFile(row.id + mode);
    try { await openC1File(row, mode); } catch (e) { toast(e.message, 'err'); }
    setBusyFile('');
  };
  const afterChange = (msg) => { toast(msg); setModal(null); setLog(null); };

  return (
    <>
      <section className="page-head">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div className="eyebrow">{dpdNama || 'Memuat…'}</div>
          <h1 className="page-title">Rekap Data</h1>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          {user.role !== 'dpd' && dpds.length > 0 && <DpdPicker dpds={dpds} value={dpdId} onChange={(v) => { setDpdId(v); setJenis(''); setAll(false); }} />}
          {canEdit && <Link className="btn btn-primary" to="/input"><Icon name="plus" size={16} /> Lanjutkan Input</Link>}
        </div>
      </section>

      {err && <div className="notice err">{err}</div>}
      {!c1 || !bacaleg ? <Loading rows={4} /> : (
        <>
          <ScrollRow className="tabs-line" label="Kategori">
            <button role="tab" aria-selected={cat === 'c1'} onClick={() => { setCat('c1'); setQ(''); }}>Rekap Kecamatan (D Hasil) <span className="pill-count">{c1.length}</span></button>
            <button role="tab" aria-selected={cat === 'bacaleg'} onClick={() => { setCat('bacaleg'); setQ(''); }}>Usulan Bacaleg <span className="pill-count">{bacaleg.length}</span></button>
            <button role="tab" aria-selected={cat === 'log'} onClick={() => { setCat('log'); setQ(''); }}><Icon name="history" size={18} /> Riwayat Perubahan</button>
          </ScrollRow>

          {cat === 'c1' && (
            <>
              <Capaian prog={prog} active={jenis} onPick={(j) => { setJenis(j); setAll(false); }} />
              <section className="card" style={{ overflow: 'hidden' }}>
                <div className="card-head">
                  <div>
                    <h2 className="card-title">Rekap Kecamatan (D Hasil) · {jenis ? JENIS_LABEL[jenis] : 'Semua jenis'}</h2>
                    <div className="card-sub">Menampilkan {c1Rows.length} dari {c1.length} dokumen</div>
                  </div>
                  <div className="tools">
                    <SearchBox value={q} onChange={setQ} placeholder="Cari keterangan / file / nama" />
                    <button className="btn btn-ghost btn-sm" style={{ height: 40 }} onClick={exportC1} disabled={exporting}><Icon name="download" size={16} /> {exporting ? 'Menyiapkan…' : 'Unduh Excel'}</button>
                  </div>
                </div>
                <TableTabs label="Tingkatan D Hasil" value={jenis} onChange={(j) => { setJenis(j); setAll(false); }}
                  tabs={[{ id: '', label: 'Semua', count: c1.length }, ...JENIS.map((j) => ({ id: j.id, label: j.label, count: c1.filter((x) => x.jenis === j.id).length }))]} />
                <div className="table-wrap">
                  <table className="tbl" style={{ minWidth: 980 }}>
                    <thead><tr><th>No</th><th>Jenis</th><th>Keterangan</th><th>Nama File</th><th>Diupload oleh</th><th>Tanggal</th><th>Waktu</th><th style={{ textAlign: 'center' }}>Aksi</th></tr></thead>
                    <tbody>
                      {visible.map((r, i) => (
                        <tr key={r.id}>
                          <td className="num">{i + 1}</td>
                          <td className="nowrap muted"><span className="dot" />{JENIS_LABEL[r.jenis]}</td>
                          <td className="strong">{r.keterangan || <span className="badge warn">Belum ada keterangan</span>}{r.updatedAt && <div className="help" title={'Diubah ' + fmtDateTime(r.updatedAt)}>diubah {r.updatedBy}</div>}</td>
                          <td className="muted" style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.fileName}>{r.fileName}</td>
                          <td className="nowrap">{r.uploader}</td>
                          <td className="nowrap">{fmtDate(r.uploadedAt)}</td>
                          <td className="nowrap">{fmtTime(r.uploadedAt)}</td>
                          <td style={{ textAlign: 'right' }}>
                            <span className="acts">
                              <IconBtn icon="eye" tone="view" label={'Lihat ' + r.fileName} disabled={!!busyFile} onClick={() => openFile(r, 'view')} />
                              <IconBtn icon="download" label={'Unduh ' + r.fileName} disabled={!!busyFile} onClick={() => openFile(r, 'download')} />
                              {canEdit && <IconBtn icon="edit" label="Edit dokumen" onClick={() => setModal({ type: 'editC1', row: r })} />}
                              {canEdit && <IconBtn icon="trash" tone="danger" label="Hapus dokumen" onClick={() => setModal({ type: 'delC1', row: r })} />}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {!c1Rows.length && <div className="empty">Belum ada Rekap Kecamatan (D Hasil){jenis ? ' untuk ' + JENIS_LABEL[jenis] : ''}.</div>}
                {c1Rows.length > LIMIT && (
                  <div style={{ padding: 10, textAlign: 'center' }}>
                    <button className="btn btn-plain btn-sm" onClick={() => setAll(!all)}>{all ? 'Tampilkan lebih sedikit' : `Tampilkan semua (${c1Rows.length})`}</button>
                  </div>
                )}
              </section>
            </>
          )}

          {cat === 'bacaleg' && (
            <section className="card" style={{ overflow: 'hidden' }}>
              <div className="card-head">
                <div>
                  <h2 className="card-title">Usulan Bacaleg · {tingkat || 'Semua tingkat'}</h2>
                  <div className="card-sub">Menampilkan {bRows.length} dari {bacaleg.length} usulan</div>
                </div>
                <div className="tools">
                  <SearchBox value={q} onChange={setQ} placeholder="Cari nama / pengusul" />
                  <button className="btn btn-ghost btn-sm" style={{ height: 40 }} onClick={exportB} disabled={exporting}><Icon name="download" size={16} /> {exporting ? 'Menyiapkan…' : 'Unduh Excel'}</button>
                </div>
              </div>
              <TableTabs label="Tingkat caleg" value={tingkat} onChange={setTingkat}
                tabs={[{ id: '', label: 'Semua', count: bacaleg.length }, ...TINGKAT.map((t) => ({ id: t, label: t, count: bacaleg.filter((b) => b.tingkat === t).length }))]} />
              <div className="table-wrap">
                <table className="tbl" style={{ minWidth: 1040 }}>
                  <thead><tr><th>No</th><th>Nama Bacaleg</th><th>Tingkat</th><th style={{ width: 300 }}>Profil Singkat</th><th>Pengusul / Rekomendasi</th><th>Dicatat oleh</th><th>Tanggal &amp; Waktu</th>{canEdit && <th style={{ textAlign: 'center' }}>Aksi</th>}</tr></thead>
                  <tbody>
                    {bRows.map((r, i) => (
                      <tr key={r.id} style={{ verticalAlign: 'top' }}>
                        <td className="num">{i + 1}</td>
                        <td className="strong">{r.nama}{r.updatedAt && <div className="help">diubah {r.updatedBy}</div>}</td>
                        <td className="nowrap muted"><span className="dot" />{r.tingkat}</td>
                        <td className="muted" style={{ lineHeight: 1.55 }}>{r.profil}</td>
                        <td>{r.pengusul}</td>
                        <td className="nowrap">{r.pencatat}</td>
                        <td className="nowrap">{fmtDate(r.createdAt)} · {fmtTime(r.createdAt)}</td>
                        {canEdit && (
                          <td style={{ textAlign: 'right' }}>
                            <span className="acts">
                              <IconBtn icon="edit" label={'Edit usulan ' + r.nama} onClick={() => setModal({ type: 'editB', row: r })} />
                              <IconBtn icon="trash" tone="danger" label={'Hapus usulan ' + r.nama} onClick={() => setModal({ type: 'delB', row: r })} />
                            </span>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!bRows.length && <div className="empty">Belum ada usulan{tingkat ? ' untuk ' + tingkat : ''}.</div>}
            </section>
          )}

          {cat === 'log' && (
            <section className="card" style={{ overflow: 'hidden' }}>
              <div className="card-head">
                <div>
                  <h2 className="card-title">Riwayat Perubahan</h2>
                  <div className="card-sub hint-text">Semua upload, edit, ganti file, dan hapus tercatat di sini beserta alasannya.</div>
                </div>
                <div className="tools">
                  <SearchBox value={q} onChange={setQ} placeholder="Cari nama / detail / alasan" />
                  <button className="btn btn-ghost btn-sm" style={{ height: 40 }} onClick={exportLog} disabled={exporting || !log}><Icon name="download" size={16} /> {exporting ? 'Menyiapkan…' : 'Unduh Excel'}</button>
                </div>
              </div>
              <TableTabs label="Jenis aksi" value={aksi} onChange={setAksi}
                tabs={AKSI.map((a) => ({ id: a.id, label: a.label, count: (log || []).filter((x) => !a.id || x.aksi === a.id).length }))} />
              {!log ? <div style={{ padding: 20 }}><Loading rows={3} /></div> : (
                <div className="table-wrap">
                  <table className="tbl" style={{ minWidth: 980 }}>
                    <thead><tr><th>No</th><th>Waktu</th><th>Pengguna</th><th>Aksi</th><th>Data</th><th style={{ width: 380 }}>Detail</th><th>Alasan</th></tr></thead>
                    <tbody>
                      {logRows.slice(0, all ? undefined : 50).map((r, i) => (
                        <tr key={r.id} style={{ verticalAlign: 'top' }}>
                          <td className="num">{i + 1}</td>
                          <td className="nowrap">{fmtDate(r.waktu)}<div className="help" style={{ color: 'var(--ink)' }}>{fmtTime(r.waktu)} WIB</div></td>
                          <td>{r.username}</td>
                          <td><span className={'aksi-badge aksi-' + r.aksi}>{AKSI_LABEL[r.aksi] || r.aksi}</span></td>
                          <td className="nowrap">{r.objek}</td>
                          <td style={{ lineHeight: 1.5 }}>{r.detail}</td>
                          <td>{r.alasan || '–'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {log && !logRows.length && <div className="empty">Belum ada riwayat{aksi ? ' untuk aksi ' + AKSI_LABEL[aksi] : ''}.</div>}
              {log && logRows.length > 50 && (
                <div style={{ padding: 10, textAlign: 'center' }}>
                  <button className="btn btn-plain btn-sm" onClick={() => setAll(!all)}>{all ? 'Tampilkan lebih sedikit' : `Tampilkan semua (${logRows.length})`}</button>
                </div>
              )}
            </section>
          )}
        </>
      )}

      {modal?.type === 'editC1' && (
        <EditC1Modal row={modal.row} onClose={() => setModal(null)}
          onSaved={(out, replaced) => { setC1((l) => l.map((x) => (x.id === out.id ? { ...x, ...out } : x))); afterChange(replaced ? 'File diganti, file lama dihapus dari Drive' : 'Perubahan disimpan'); }} />
      )}
      {modal?.type === 'delC1' && (
        <DeleteC1Modal row={modal.row} onClose={() => setModal(null)}
          onDeleted={(r) => { setC1((l) => l.filter((x) => x.id !== r.id)); afterChange('Dokumen dihapus'); }} />
      )}
      {modal?.type === 'editB' && (
        <EditBacalegModal row={modal.row} dpdId={dpdId} onClose={() => setModal(null)}
          onSaved={(out) => { setBacaleg((l) => l.map((x) => (x.id === out.id ? { ...x, ...out } : x))); afterChange('Usulan diperbarui'); }} />
      )}
      {modal?.type === 'delB' && (
        <DeleteBacalegModal row={modal.row} onClose={() => setModal(null)}
          onDeleted={(r) => { setBacaleg((l) => l.filter((x) => x.id !== r.id)); afterChange('Usulan dihapus'); }} />
      )}
    </>
  );
}
