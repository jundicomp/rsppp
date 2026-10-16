import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { call, uploadC1 } from '../api/index.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { useDpdList, useDpdRecords } from '../hooks/useDpdData.js';
import { ACCEPT, JENIS, TINGKAT } from '../lib/constants.js';
import { extOf, fmtDateTime, fmtSize, waLink } from '../lib/format.js';
import { dpdProgress, countsFromC1 } from '../lib/progress.js';
import { buildWaReport } from '../lib/report.js';
import Icon from '../components/Icon.jsx';
import DpdPicker from '../components/DpdPicker.jsx';
import { IconBtn, Loading, Modal, ProgressLine, ScrollRow, useToast } from '../components/ui.jsx';
import { DeleteBacalegModal, DeleteC1Modal, EditBacalegModal, EditC1Modal } from '../components/EditModals.jsx';
import { openC1File } from '../lib/files.js';

// keterangan boleh dikoreksi langsung (tanpa password) selama 55 menit setelah upload oleh akun yang sama
const FRESH_MS = 55 * 60000;
const isFresh = (iso, ownerId, user) => ownerId === user.id && iso && Date.now() - new Date(iso).getTime() < FRESH_MS;

let slotSeq = 0;
const newSlot = () => ({ key: 's' + ++slotSeq, status: 'empty', progress: 0, keterangan: '', fileName: '', error: '' });
const emptyDraft = () => ({ key: 'd' + ++slotSeq, nama: '', tingkat: '', profil: '', pengusul: '' });
const FIELDS = ['nama', 'tingkat', 'profil', 'pengusul'];
const filled = (b) => FIELDS.filter((f) => String(b[f] || '').trim()).length;

export default function Input() {
  const { user } = useAuth();
  const toast = useToast();
  const { dpds, dpdId, setDpdId, dpd, reloadDpd } = useDpdList();
  const { c1, setC1, bacaleg, setBacaleg, err } = useDpdRecords(dpdId);

  const [uploader, setUploader] = useState(() => localStorage.getItem('c1_uploader') || '');
  const [kec, setKec] = useState('');
  const [cat, setCat] = useState('c1');
  const [tab, setTab] = useState('dprri');
  const [slots, setSlots] = useState(() => Object.fromEntries(JENIS.map((j) => [j.id, []])));
  const [notes, setNotes] = useState({});
  const [saving, setSaving] = useState({});
  const [drafts, setDrafts] = useState([]);
  const [modal, setModal] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [report, setReport] = useState(null);
  const [settings, setSettings] = useState({});
  const timers = useRef({});
  const pending = useRef({});

  useEffect(() => { try { localStorage.setItem('c1_uploader', uploader); } catch (e) { /* abaikan */ } }, [uploader]);
  useEffect(() => { setKec(dpd?.jumlahKecamatan ? String(dpd.jumlahKecamatan) : ''); }, [dpd]);
  useEffect(() => { call('getSettings').then(setSettings).catch(() => {}); }, []);
  useEffect(() => {
    setSlots(Object.fromEntries(JENIS.map((j) => [j.id, []])));
    setNotes({});
    setDrafts([]);
  }, [dpdId]);
  useEffect(() => () => Object.values(timers.current).forEach(clearTimeout), []);
  // selalu sediakan satu area upload kosong per tingkatan, supaya operator tidak perlu klik "Tambah" dulu
  useEffect(() => {
    setSlots((s) => {
      let changed = false;
      const n = { ...s };
      JENIS.forEach((j) => {
        if (!n[j.id].some((x) => x.status !== 'uploading')) { n[j.id] = [...n[j.id], newSlot()]; changed = true; }
      });
      return changed ? n : s;
    });
  }, [slots]);

  const noUploader = !uploader.trim();
  const K = parseInt(dpd?.jumlahKecamatan, 10) || 0;

  /* ---------- kecamatan ---------- */
  const saveKec = async () => {
    const n = parseInt(kec, 10);
    if (!n || n === K) return;
    try {
      await call('setKecamatan', { dpdId, jumlahKecamatan: n });
      await reloadDpd();
      toast('Jumlah kecamatan disimpan');
    } catch (e) { toast(e.message, 'err'); }
  };

  /* ---------- slots ---------- */
  const patchSlot = (jenis, key, patch) => setSlots((s) => ({ ...s, [jenis]: s[jenis].map((x) => (x.key === key ? { ...x, ...patch } : x)) }));
  const addSlot = (jenis) => setSlots((s) => ({ ...s, [jenis]: [...s[jenis], newSlot()] }));
  const removeSlot = (jenis, key) => setSlots((s) => ({ ...s, [jenis]: s[jenis].filter((x) => x.key !== key) }));

  const doUpload = async (jenis, key, file, keterangan) => {
    patchSlot(jenis, key, { status: 'uploading', progress: 1, fileName: file.name, size: file.size, error: '' });
    try {
      const row = await uploadC1(file, { dpdId, jenis, keterangan, uploader: uploader.trim() }, (p) => patchSlot(jenis, key, { progress: p }));
      patchSlot(jenis, key, { progress: 100 });
      await new Promise((r) => setTimeout(r, 350));
      setC1((list) => [...(list || []), { ...row, justDone: true }]);
      setNotes((n) => ({ ...n, [row.id]: row.keterangan }));
      removeSlot(jenis, key);
    } catch (e) {
      patchSlot(jenis, key, { status: 'error', error: e.message });
    }
  };

  const onFiles = (jenis, slot, fileList) => {
    if (noUploader) { toast('Isi nama pengupload dulu', 'err'); return; }
    const files = Array.from(fileList || []);
    if (!files.length) return;
    doUpload(jenis, slot.key, files[0], slot.keterangan);
    const extra = files.slice(1).map((f) => ({ f, s: newSlot() }));
    if (extra.length) {
      setSlots((s) => ({ ...s, [jenis]: [...s[jenis], ...extra.map((x) => x.s)] }));
      extra.forEach((x) => doUpload(jenis, x.s.key, x.f, ''));
    }
  };

  /* ---------- keterangan autosave ---------- */
  const flushNote = useCallback((id) => {
    clearTimeout(timers.current[id]);
    const value = pending.current[id];
    if (value === undefined) return Promise.resolve();
    delete pending.current[id];
    setSaving((s) => ({ ...s, [id]: 'saving' }));
    return call('updateC1', { id, keterangan: value })
      .then(() => {
        setSaving((s) => ({ ...s, [id]: 'saved' }));
        setC1((list) => list.map((x) => (x.id === id ? { ...x, keterangan: value } : x)));
      })
      .catch((e) => { setSaving((s) => ({ ...s, [id]: 'error' })); toast(e.message, 'err'); });
  }, [setC1, toast]);

  const onNote = (id, value) => {
    setNotes((n) => ({ ...n, [id]: value }));
    pending.current[id] = value;
    clearTimeout(timers.current[id]);
    timers.current[id] = setTimeout(() => flushNote(id), 700);
  };

  const viewFile = (row) => openC1File(row, 'view').catch((e) => toast(e.message, 'err'));

  /* ---------- bacaleg ---------- */
  const saveBacaleg = async (b, onDone) => {
    try {
      const row = await call('saveBacaleg', { dpdId, uploader: uploader.trim(), bacaleg: { id: b.id, nama: b.nama, tingkat: b.tingkat, profil: b.profil, pengusul: b.pengusul } });
      setBacaleg((list) => (b.id ? list.map((x) => (x.id === b.id ? { ...x, ...row } : x)) : [...list, row]));
      onDone && onDone();
      toast('Usulan bacaleg disimpan');
    } catch (e) { toast(e.message, 'err'); }
  };
  /* ---------- derived ---------- */
  const c1List = c1 || [];
  const tabMeta = JENIS.find((j) => j.id === tab);
  const savedHere = c1List.filter((x) => x.jenis === tab);
  const prog = useMemo(() => dpdProgress({ jumlahKecamatan: K, counts: countsFromC1(c1List) }), [K, c1List]);
  const tabProg = prog.per.find((p) => p.id === tab);

  const allSlots = Object.values(slots).flat();
  const anyUploading = allSlots.some((s) => s.status === 'uploading');
  const missingNotes = c1List.filter((x) => !String(notes[x.id] ?? x.keterangan ?? '').trim()).length;
  const halfDrafts = drafts.filter((d) => filled(d) > 0).length;
  const total = c1List.length + (bacaleg || []).length;

  let hint = c1List.length + ' file C1 dan ' + (bacaleg || []).length + ' usulan bacaleg siap disubmit.';
  let hintCls = 'ok';
  if (noUploader) { hint = 'Nama pengupload belum diisi.'; hintCls = 'err'; }
  else if (!K) { hint = 'Jumlah kecamatan belum disimpan.'; hintCls = 'err'; }
  else if (anyUploading) { hint = 'Menunggu upload selesai…'; hintCls = ''; }
  else if (missingNotes) { hint = missingNotes + ' keterangan C1 belum diisi.'; hintCls = 'err'; }
  else if (halfDrafts) { hint = halfDrafts + ' usulan bacaleg belum disimpan.'; hintCls = 'err'; }
  else if (!total) { hint = 'Belum ada data.'; hintCls = ''; }
  const ready = hintCls === 'ok';

  const doSubmit = async () => {
    setSubmitting(true);
    try {
      await Promise.all(Object.keys(pending.current).map(flushNote));
      const res = await call('submit', { dpdId, uploader: uploader.trim() });
      const c1Now = c1List.map((x) => ({ ...x, keterangan: notes[x.id] ?? x.keterangan }));
      const text = buildWaReport({ dpd, uploader: uploader.trim(), c1: c1Now, bacaleg: bacaleg || [], submittedAt: res.submittedAt, appUrl: settings.appUrl });
      setReport(text);
    } catch (e) { toast(e.message, 'err'); }
    setSubmitting(false);
  };

  if (!dpdId || !c1 || !bacaleg) {
    return <>
      <PageHead user={user} dpd={dpd} />
      {err ? <div className="notice err">{err}</div> : <Loading rows={4} />}
    </>;
  }

  return (
    <>
      <PageHead user={user} dpd={dpd} />

      {user.role === 'superadmin' && (
        <div className="card card-pad"><DpdPicker dpds={dpds} value={dpdId} onChange={setDpdId} label="Input untuk DPD" /></div>
      )}

      <section className="card card-pad grid-2">
        <div className="field">
          <label className="label" htmlFor="uploader">Nama Pengupload <span className="req">*</span></label>
          <input id="uploader" className={'input' + (noUploader ? ' invalid' : '')} value={uploader} onChange={(e) => setUploader(e.target.value)} placeholder="Nama lengkap petugas" />
          <div className={'help' + (noUploader ? ' err' : '')}>{noUploader ? 'Isi dulu sebelum mengupload.' : 'Tercatat di setiap data yang masuk.'}</div>
        </div>
        <div className="field">
          <label className="label" htmlFor="kec">Jumlah Kecamatan <span className="req">*</span></label>
          <div className="input-addon" style={!K ? { borderColor: 'var(--err)' } : undefined}>
            <input id="kec" className="input" type="number" min="1" inputMode="numeric" value={kec} onChange={(e) => setKec(e.target.value.replace(/[^0-9]/g, ''))} onBlur={saveKec} onKeyDown={(e) => e.key === 'Enter' && saveKec()} placeholder="0" />
            <span>kecamatan</span>
          </div>
          <div className="help">Target upload C1 per tingkatan di {dpd?.nama.replace('DPD PKS ', '')}. Tersimpan otomatis.</div>
        </div>
      </section>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <ScrollRow className="tabs-line" label="Kategori">
          <button role="tab" aria-selected={cat === 'c1'} onClick={() => setCat('c1')}>Dokumen C1 <span className="pill-count">{c1List.length}</span></button>
          <button role="tab" aria-selected={cat === 'bacaleg'} onClick={() => setCat('bacaleg')}>Usulan Bacaleg <span className="pill-count">{bacaleg.length}</span></button>
        </ScrollRow>

        {cat === 'c1' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <ScrollRow className="segmented" label="Jenis pemilihan">
              {JENIS.map((j) => (
                <button key={j.id} role="tab" aria-selected={tab === j.id} onClick={() => setTab(j.id)}>
                  {j.label} <small>{c1List.filter((x) => x.jenis === j.id).length}</small>
                </button>
              ))}
            </ScrollRow>

            <div className="card" style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', fontSize: 13, color: 'var(--muted)' }}>
                <span>Progres <b style={{ color: 'var(--ink)' }}>{tabMeta.label}</b></span>
                {K ? (
                  <span><b style={{ color: 'var(--ink)', fontSize: 15 }}>{tabProg.pct}%</b> · {tabProg.count}/{K} kecamatan · PR <b style={{ color: 'var(--ink)' }}>{tabProg.pr}</b></span>
                ) : <span>Isi jumlah kecamatan untuk melihat progres</span>}
              </div>
              <ProgressLine pct={tabProg.pct} />
            </div>

            {savedHere.map((row, i) => (
              <SavedItem key={row.id} no={i + 1} row={row} label={tabMeta.label} note={notes[row.id] ?? row.keterangan ?? ''}
                fresh={isFresh(row.uploadedAt, row.userId, user)}
                state={saving[row.id]} onNote={(v) => onNote(row.id, v)} onBlur={() => flushNote(row.id)}
                onView={() => viewFile(row)} onEdit={() => setModal({ type: 'editC1', row })} onDelete={() => setModal({ type: 'delC1', row })} />
            ))}
            {slots[tab].map((s, i) => (
              <SlotItem key={s.key} no={savedHere.length + i + 1} slot={s} label={tabMeta.label} disabled={noUploader}
                onFiles={(files) => onFiles(tab, s, files)}
                onNote={(v) => patchSlot(tab, s.key, { keterangan: v })}
                onRemove={slots[tab].filter((x) => x.status !== 'uploading').length > 1 ? () => removeSlot(tab, s.key) : null} />
            ))}
            <button className="btn-dashed" onClick={() => addSlot(tab)}><Icon name="plus" size={16} /> Tambah file C1 {tabMeta.label}</button>
          </div>
        )}

        {cat === 'bacaleg' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {bacaleg.map((b, i) => (
              <BacalegView key={b.id} no={i + 1} b={b} onEdit={() => setModal({ type: 'editB', row: b })} onDelete={() => setModal({ type: 'delB', row: b })} />
            ))}
            {drafts.map((d, i) => (
              <BacalegForm key={d.key} no={bacaleg.length + i + 1} value={d} disabled={noUploader}
                onChange={(v) => setDrafts((ds) => ds.map((x) => (x.key === d.key ? { ...x, ...v } : x)))}
                onCancel={() => setDrafts((ds) => ds.filter((x) => x.key !== d.key))}
                onSave={(v) => saveBacaleg(v, () => setDrafts((ds) => ds.filter((x) => x.key !== d.key)))} />
            ))}
            {!bacaleg.length && !drafts.length && <div className="card empty">Belum ada usulan bacaleg.</div>}
            <button className="btn-dashed" onClick={() => setDrafts((ds) => [...ds, emptyDraft()])}><Icon name="plus" size={16} /> Tambah usulan bacaleg</button>
          </div>
        )}
      </div>

      <div className="actions">
        <div className={'hint ' + hintCls}>{hint}</div>
        <Link className="btn btn-ghost" to="/rekap">Lihat Rekap</Link>
        <button className="btn btn-primary" disabled={!ready || submitting} onClick={doSubmit}>{submitting ? 'Mengirim…' : 'Submit & Laporkan ke Admin'}</button>
      </div>

      {modal?.type === 'editC1' && (
        <EditC1Modal row={modal.row} onClose={() => setModal(null)}
          onSaved={(out, replaced) => {
            setC1((l) => l.map((x) => (x.id === out.id ? { ...x, ...out } : x)));
            setNotes((n) => ({ ...n, [out.id]: out.keterangan }));
            setModal(null);
            toast(replaced ? 'File diganti, file lama dihapus dari Drive' : 'Perubahan disimpan');
          }} />
      )}
      {modal?.type === 'delC1' && (
        <DeleteC1Modal row={modal.row} onClose={() => setModal(null)}
          onDeleted={(r) => { setC1((l) => l.filter((x) => x.id !== r.id)); setModal(null); toast('Dokumen dihapus, file dihapus dari Drive'); }} />
      )}
      {modal?.type === 'editB' && (
        <EditBacalegModal row={modal.row} dpdId={dpdId} onClose={() => setModal(null)}
          onSaved={(out) => { setBacaleg((l) => l.map((x) => (x.id === out.id ? { ...x, ...out } : x))); setModal(null); toast('Usulan diperbarui'); }} />
      )}
      {modal?.type === 'delB' && (
        <DeleteBacalegModal row={modal.row} onClose={() => setModal(null)}
          onDeleted={(r) => { setBacaleg((l) => l.filter((x) => x.id !== r.id)); setModal(null); toast('Usulan dihapus'); }} />
      )}

      {report && (
        <Modal title="Data tersimpan" sub="Kirim laporan ini ke WhatsApp admin supaya bisa langsung dicek." onClose={() => setReport(null)}
          footer={<>
            <button className="btn btn-ghost" onClick={() => { navigator.clipboard?.writeText(report); toast('Laporan disalin'); }}>Salin teks</button>
            <a className="btn btn-primary" href={waLink(settings.waAdmin, report)} target="_blank" rel="noopener noreferrer"><Icon name="wa" /> Kirim via WhatsApp</a>
          </>}>
          <div className="kicker" style={{ textTransform: 'none', letterSpacing: 0 }}>Pratinjau pesan</div>
          <div className="wa-wrap"><div className="wa-bubble">{report}</div></div>
          <div className="help">Dikirim ke: <b style={{ color: 'var(--ink)' }}>{settings.namaAdmin || 'Admin'}</b>{settings.waAdmin ? ' · ' + settings.waAdmin : ' · nomor admin belum diatur, pilih kontak manual di WhatsApp'}</div>
        </Modal>
      )}
    </>
  );
}

function PageHead({ user, dpd }) {
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div className="eyebrow">{dpd?.nama || user.dpdNama || 'Memuat…'} · {user.username}</div>
      <h1 className="page-title">Input Data</h1>
      <div className="lead">Setiap file yang selesai diupload langsung tersimpan. Boleh keluar dan lanjutkan kapan saja.</div>
    </section>
  );
}

function SavedItem({ no, row, label, note, fresh, state, onNote, onBlur, onView, onEdit, onDelete }) {
  const missing = !note.trim();
  return (
    <section className={'item' + (row.justDone ? ' fade-in' : '')}>
      <div className="item-top">
        <span className="kicker">C1 {label} · #{no}</span>
        <span className="acts">
          <IconBtn icon="eye" tone="view" label={'Lihat ' + row.fileName} onClick={onView} />
          <IconBtn icon="edit" label="Edit / ganti file" onClick={onEdit} />
          <IconBtn icon="trash" tone="danger" label="Hapus dokumen" onClick={onDelete} />
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="file-row">
          <div className="file-ico">{extOf(row.fileName)}</div>
          <div className="file-meta">
            <div className="file-name">{row.fileName}</div>
            <div className="file-sub"><span className="ok-text">✓ Selesai</span> · {row.uploader} · {fmtDateTime(row.uploadedAt)}{row.size ? ' · ' + fmtSize(row.size) : ''}</div>
          </div>
        </div>
        <ProgressLine pct={100} done thin />
      </div>
      {fresh ? (
        <div className="field">
          <label className="label" htmlFor={'k' + row.id}>Keterangan <span className="req">*</span></label>
          <input id={'k' + row.id} className={'input' + (missing ? ' invalid' : '')} value={note} onChange={(e) => onNote(e.target.value)} onBlur={onBlur} placeholder="Contoh: C1 TPS 012 Kel. Ilir Barat, Kec. Bukit Kecil" />
          <div className={'help' + (missing ? ' err' : '')}>
            {missing ? 'Wajib diisi karena ada file.' : state === 'saving' ? 'Menyimpan…' : state === 'saved' ? 'Tersimpan' : state === 'error' ? 'Gagal menyimpan, coba ketik ulang' : 'Bisa langsung dikoreksi selama 1 jam setelah upload.'}
          </div>
        </div>
      ) : (
        <div className="field">
          <span className="label">Keterangan <span className="req">*</span></span>
          <div className="ket-ro">
            <span style={{ fontWeight: 600 }}>{note || <span className="help err">Belum diisi</span>}</span>
            <button className="btn btn-ghost btn-sm" onClick={onEdit}><Icon name="edit" size={16} /> Ubah</button>
          </div>
          <div className="help">Perubahan data lama perlu konfirmasi password dan tercatat di riwayat.</div>
        </div>
      )}
    </section>
  );
}

function SlotItem({ no, slot, label, disabled, onFiles, onNote, onRemove }) {
  const ref = useRef(null);
  const [over, setOver] = useState(false);
  const busy = slot.status === 'uploading';
  return (
    <section className="item">
      <div className="item-top">
        <span className="kicker">C1 {label} · #{no}</span>
        {onRemove && !busy && <button className="btn-icon" aria-label="Hapus slot" onClick={onRemove}><Icon name="trash" /></button>}
      </div>
      {busy ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="file-row">
            <div className="file-ico">{extOf(slot.fileName)}</div>
            <div className="file-meta">
              <div className="file-name">{slot.fileName}</div>
              <div className="file-sub" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Icon name="spin" size={12} stroke={3} className="spin" style={{ color: 'var(--brand-ink)' }} />
                Mengupload {slot.progress}%{slot.size ? ' · ' + fmtSize(slot.size) : ''}
              </div>
            </div>
          </div>
          <ProgressLine pct={slot.progress} thin />
        </div>
      ) : (
        <>
          <input ref={ref} type="file" accept={ACCEPT} multiple hidden onChange={(e) => { onFiles(e.target.files); e.target.value = ''; }} />
          <button type="button" className={'drop' + (over ? ' over' : '')} aria-disabled={disabled}
            onClick={() => !disabled && ref.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setOver(true); }}
            onDragLeave={() => setOver(false)}
            onDrop={(e) => { e.preventDefault(); setOver(false); if (!disabled) onFiles(e.dataTransfer.files); }}>
            <Icon name="upload" size={22} stroke={2} style={{ color: 'var(--hint)' }} />
            <span><b style={{ fontWeight: 600 }}>Pilih file C1</b> <span className="hint-text">atau seret ke sini · PDF / foto · bisa pilih beberapa sekaligus</span></span>
          </button>
          {slot.status === 'error' && <div className="notice err">Upload "{slot.fileName}" gagal: {slot.error}. Pilih file lagi untuk mencoba ulang.</div>}
        </>
      )}
      <div className="field">
        <label className="label">Keterangan <span className="req">*</span></label>
        <input className="input" value={slot.keterangan} onChange={(e) => onNote(e.target.value)} placeholder="Contoh: C1 TPS 012 Kel. Ilir Barat, Kec. Bukit Kecil" disabled={busy} />
        <div className="help">Boleh diisi sebelum atau sesudah upload.</div>
      </div>
    </section>
  );
}

function BacalegView({ no, b, onEdit, onDelete }) {
  return (
    <section className="item">
      <div className="item-top">
        <span className="kicker">Usulan Bacaleg · #{no}</span>
        <span className="acts">
          <IconBtn icon="edit" label="Edit usulan" onClick={onEdit} />
          <IconBtn icon="trash" tone="danger" label="Hapus usulan" onClick={onDelete} />
        </span>
      </div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap' }}>
        <div style={{ fontSize: 16, fontWeight: 700 }}>{b.nama}</div>
        <span className="badge"><span className="dot" style={{ marginRight: 4 }} />{b.tingkat}</span>
      </div>
      <div style={{ color: 'var(--ink-2)' }}>{b.profil}</div>
      <div className="help">Usul/rekomendasi: <b style={{ color: 'var(--ink)' }}>{b.pengusul}</b> · dicatat oleh {b.pencatat} · {fmtDateTime(b.createdAt)}</div>
    </section>
  );
}

function BacalegForm({ no, value, onChange, onSave, onCancel, disabled }) {
  const [v, setV] = useState(value);
  const set = (k, x) => { const nv = { ...v, [k]: x }; setV(nv); onChange && onChange(nv); };
  const started = filled(v) > 0;
  const bad = (k) => started && !String(v[k] || '').trim();
  const complete = filled(v) === 4;
  return (
    <section className="item">
      <div className="item-top">
        <span className="kicker">Usulan Bacaleg · #{no}</span>
        <button className="btn-icon" aria-label="Batal" onClick={onCancel}><Icon name="close" /></button>
      </div>
      <div className="grid-2">
        <div className="field">
          <label className="label">Nama Bacaleg <span className="req">*</span></label>
          <input className={'input' + (bad('nama') ? ' invalid' : '')} value={v.nama} onChange={(e) => set('nama', e.target.value)} placeholder="Nama lengkap" />
        </div>
        <div className="field">
          <label className="label">Caleg Tingkat <span className="req">*</span></label>
          <select className={'select' + (bad('tingkat') ? ' invalid' : '')} value={v.tingkat} onChange={(e) => set('tingkat', e.target.value)}>
            <option value="">Pilih tingkat…</option>
            {TINGKAT.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div className="field span-all">
          <label className="label">Profil Singkat / Latar Belakang <span className="req">*</span></label>
          <textarea className={'textarea' + (bad('profil') ? ' invalid' : '')} rows={3} value={v.profil} onChange={(e) => set('profil', e.target.value)} placeholder="Pendidikan, pekerjaan, pengalaman organisasi…" />
        </div>
        <div className="field span-all">
          <label className="label">Pemberi Usul / Rekomendasi Dari <span className="req">*</span></label>
          <input className={'input' + (bad('pengusul') ? ' invalid' : '')} value={v.pengusul} onChange={(e) => set('pengusul', e.target.value)} placeholder="Contoh: DPC PKS Kec. Ilir Timur I" />
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span className={'help' + (started && !complete ? ' err' : '')}>{started && !complete ? 'Lengkapi semua field bertanda *.' : disabled ? 'Isi nama pengupload dulu.' : ' '}</span>
        <button className="btn btn-primary btn-sm" disabled={!complete || disabled} onClick={() => onSave(v)}>Simpan usulan</button>
      </div>
    </section>
  );
}
