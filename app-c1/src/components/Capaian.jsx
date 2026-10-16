import { Donut, SplitBar } from './ui.jsx';

/** Panel infografis capaian satu DPD (atau gabungan). prog = hasil dpdProgress(). */
export default function Capaian({ prog, title = 'Capaian Upload C1', active, onPick }) {
  const worst = [...prog.per].sort((a, b) => b.pr - a.pr)[0];
  return (
    <section className="card" style={{ overflow: 'hidden' }}>
      <div className="card-head">
        <div>
          <h2 className="card-title">{title}</h2>
          <div className="card-sub">
            {prog.K ? `Target ${prog.K} kecamatan × 5 tingkatan = ${prog.target} dokumen` : 'Jumlah kecamatan belum diisi — progres belum bisa dihitung'}
          </div>
        </div>
        <div className="legend">
          <span><i style={{ background: 'var(--brand)' }} />Sudah diupload</span>
          <span><i style={{ background: 'var(--track)' }} />PR (belum)</span>
        </div>
      </div>
      <div className="info-grid">
        <div className="info-left">
          <Donut pct={prog.pct} />
          <div className="mini-stats">
            <div><span>SUDAH</span><b>{prog.done}</b></div>
            <div><span>PR</span><b>{prog.pr}</b></div>
          </div>
        </div>
        <div style={{ padding: '12px 8px', display: 'flex', flexDirection: 'column' }}>
          {prog.per.map((p) => (
            <button key={p.id} className="bar-row" aria-pressed={active === p.id} onClick={() => onPick && onPick(active === p.id ? '' : p.id)}
              title={`${p.label}: ${p.count} dari ${prog.K} kecamatan (${p.pct}%), PR ${p.pr}`}>
              <span><span className="nm" style={{ fontWeight: active === p.id ? 700 : 600 }}>{p.label}</span><br /><span className="sub">PR {p.pr} kecamatan</span></span>
              <SplitBar pct={p.pct} />
              <span className="val"><b>{p.pct}%</b><span className="sub">{p.count}/{prog.K || '–'}</span></span>
            </button>
          ))}
          {prog.K > 0 && (
            <div style={{ margin: '8px 12px 4px', paddingTop: 12, borderTop: '1px dashed var(--line)', fontSize: 13, color: 'var(--muted)' }}>
              {worst.pr > 0
                ? <>PR terbanyak di <b style={{ color: 'var(--ink)' }}>{worst.label}</b>: masih {worst.pr} kecamatan belum upload.{onPick ? ' Klik baris untuk memfilter tabel.' : ''}</>
                : <>Semua tingkatan sudah 100%. Alhamdulillah.</>}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
