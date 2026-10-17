import { JENIS } from './constants.js';

/**
 * Hitung capaian satu DPD.
 * Target = jumlah kecamatan untuk tiap tingkatan (1 Rekap Kecamatan (D Hasil) per kecamatan per tingkatan).
 * Jumlah file per tingkatan dibatasi maksimal = jumlah kecamatan, supaya tidak lewat 100%.
 */
export function dpdProgress(row) {
  const K = Number(row.jumlahKecamatan) || 0;
  const per = JENIS.map((j) => {
    const count = Number(row.counts?.[j.id]) || 0;
    const capped = K ? Math.min(count, K) : 0;
    const pct = K ? Math.round((capped / K) * 100) : 0;
    return { ...j, count, pct, pr: K ? Math.max(0, K - count) : 0 };
  });
  const target = K * JENIS.length;
  const done = per.reduce((s, p) => s + (K ? Math.min(p.count, K) : 0), 0);
  const totalFiles = per.reduce((s, p) => s + p.count, 0);
  return {
    ...row,
    K,
    per,
    target,
    done,
    totalFiles,
    pct: target ? Math.round((done / target) * 100) : 0,
    pctExact: target ? done / target : 0,
    pr: Math.max(0, target - done),
    hasTarget: K > 0
  };
}

export function rankDpd(rows) {
  return rows
    .map(dpdProgress)
    .sort((a, b) => b.pctExact - a.pctExact || b.totalFiles - a.totalFiles || a.nama.localeCompare(b.nama))
    .map((r, i) => ({ ...r, rank: i + 1 }));
}

export function countsFromC1(list) {
  const counts = Object.fromEntries(JENIS.map((j) => [j.id, 0]));
  list.forEach((x) => { counts[x.jenis] = (counts[x.jenis] || 0) + 1; });
  return counts;
}
