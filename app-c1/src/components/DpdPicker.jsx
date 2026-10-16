export default function DpdPicker({ dpds, value, onChange, label = 'Pilih DPD' }) {
  return (
    <div className="field" style={{ minWidth: 260 }}>
      <label className="label" htmlFor="dpd-pick">{label}</label>
      <select id="dpd-pick" className="select" value={value} onChange={(e) => onChange(e.target.value)}>
        {dpds.map((d) => <option key={d.id} value={d.id}>{d.nama}</option>)}
      </select>
    </div>
  );
}
