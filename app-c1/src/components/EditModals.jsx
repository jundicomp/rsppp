import { useRef, useState } from 'react';
import { call, editC1 } from '../api/index.js';
import { ACCEPT, JENIS, JENIS_LABEL, TINGKAT } from '../lib/constants.js';
import { fmtDateTime } from '../lib/format.js';
import { PasswordConfirm } from './ui.jsx';

/** Edit satu dokumen C1: keterangan, tingkatan, dan/atau ganti file. */
export function EditC1Modal({ row, onClose, onSaved }) {
  const [ket, setKet] = useState(row.keterangan || '');
  const [jenis, setJenis] = useState(row.jenis);
  const [file, setFile] = useState(null);
  const [progress, setProgress] = useState(0);
  const ref = useRef(null);
  const changed = ket.trim() !== String(row.keterangan || '') || jenis !== row.jenis || !!file;
  return (
    <PasswordConfirm title="Edit dokumen C1" sub={row.fileName + ' · diupload ' + row.uploader + ', ' + fmtDateTime(row.uploadedAt)}
      confirmLabel="Simpan perubahan" canSubmit={changed && !!ket.trim()} progress={progress} onClose={onClose}
      onConfirm={async (password, alasan) => {
        const out = await editC1({ id: row.id, keterangan: ket.trim(), jenis, password, alasan }, file, setProgress);
        onSaved(out, !!file);
      }}>
      <div className="grid-2">
        <div className="field">
          <label className="label" htmlFor="e-jenis">Tingkatan</label>
          <select id="e-jenis" className="select" value={jenis} onChange={(e) => setJenis(e.target.value)}>
            {JENIS.map((j) => <option key={j.id} value={j.id}>{j.label}</option>)}
          </select>
        </div>
        <div className="field">
          <label className="label" htmlFor="e-ket">Keterangan <span className="req">*</span></label>
          <input id="e-ket" className={'input' + (!ket.trim() ? ' invalid' : '')} value={ket} onChange={(e) => setKet(e.target.value)} />
        </div>
      </div>
      <div className="field">
        <span className="label">File</span>
        <input ref={ref} type="file" accept={ACCEPT} hidden onChange={(e) => setFile(e.target.files[0] || null)} />
        <div className="file-swap">
          <div style={{ minWidth: 0 }}>
            <div className="file-name">{file ? file.name : row.fileName}</div>
            <div className="help" style={{ color: file ? 'var(--brand-ink)' : undefined }}>
              {file ? 'File baru · file lama akan dihapus dari Google Drive' : 'File saat ini'}
            </div>
          </div>
          {file
            ? <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setFile(null); ref.current.value = ''; }}>Batal ganti</button>
            : <button type="button" className="btn btn-ghost btn-sm" onClick={() => ref.current.click()}>Ganti file…</button>}
        </div>
      </div>
      {jenis !== row.jenis && <div className="notice">Dokumen akan dipindah dari {JENIS_LABEL[row.jenis]} ke {JENIS_LABEL[jenis]}.</div>}
    </PasswordConfirm>
  );
}

/** Konfirmasi hapus dokumen C1 (file ikut dihapus dari Drive). */
export function DeleteC1Modal({ row, onClose, onDeleted }) {
  return (
    <PasswordConfirm danger title="Hapus dokumen C1?" confirmLabel="Ya, hapus" onClose={onClose}
      sub="File akan dihapus dari Google Drive dan tercatat di Riwayat Perubahan."
      onConfirm={async (password, alasan) => { await call('deleteC1', { id: row.id, password, alasan }); onDeleted(row); }}>
      <div className="del-box">
        <b>{row.keterangan || '(tanpa keterangan)'}</b>
        <span>C1 {JENIS_LABEL[row.jenis]} · {row.fileName}</span>
        <span>Diupload {row.uploader} · {fmtDateTime(row.uploadedAt)}</span>
      </div>
    </PasswordConfirm>
  );
}

/** Edit usulan bacaleg. */
export function EditBacalegModal({ row, dpdId, onClose, onSaved }) {
  const [v, setV] = useState({ nama: row.nama, tingkat: row.tingkat, profil: row.profil, pengusul: row.pengusul });
  const set = (k, x) => setV((o) => ({ ...o, [k]: x }));
  const complete = ['nama', 'tingkat', 'profil', 'pengusul'].every((k) => String(v[k] || '').trim());
  const changed = ['nama', 'tingkat', 'profil', 'pengusul'].some((k) => String(v[k]).trim() !== String(row[k]).trim());
  return (
    <PasswordConfirm title="Edit usulan bacaleg" sub={'Dicatat oleh ' + row.pencatat + ' · ' + fmtDateTime(row.createdAt)}
      confirmLabel="Simpan perubahan" canSubmit={complete && changed} onClose={onClose}
      onConfirm={async (password, alasan) => {
        const out = await call('saveBacaleg', { dpdId, password, alasan, bacaleg: { id: row.id, ...v } });
        onSaved(out);
      }}>
      <div className="grid-2">
        <div className="field">
          <label className="label" htmlFor="b-nama">Nama Bacaleg <span className="req">*</span></label>
          <input id="b-nama" className="input" value={v.nama} onChange={(e) => set('nama', e.target.value)} />
        </div>
        <div className="field">
          <label className="label" htmlFor="b-tk">Caleg Tingkat <span className="req">*</span></label>
          <select id="b-tk" className="select" value={v.tingkat} onChange={(e) => set('tingkat', e.target.value)}>
            {TINGKAT.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div className="field span-all">
          <label className="label" htmlFor="b-pr">Profil Singkat / Latar Belakang <span className="req">*</span></label>
          <textarea id="b-pr" className="textarea" rows={3} value={v.profil} onChange={(e) => set('profil', e.target.value)} />
        </div>
        <div className="field span-all">
          <label className="label" htmlFor="b-pg">Pemberi Usul / Rekomendasi Dari <span className="req">*</span></label>
          <input id="b-pg" className="input" value={v.pengusul} onChange={(e) => set('pengusul', e.target.value)} />
        </div>
      </div>
    </PasswordConfirm>
  );
}

/** Konfirmasi hapus usulan bacaleg. */
export function DeleteBacalegModal({ row, onClose, onDeleted }) {
  return (
    <PasswordConfirm danger title="Hapus usulan bacaleg?" confirmLabel="Ya, hapus" onClose={onClose}
      sub="Tercatat di Riwayat Perubahan."
      onConfirm={async (password, alasan) => { await call('deleteBacaleg', { id: row.id, password, alasan }); onDeleted(row); }}>
      <div className="del-box">
        <b>{row.nama}</b>
        <span>{row.tingkat} · usul: {row.pengusul}</span>
      </div>
    </PasswordConfirm>
  );
}
