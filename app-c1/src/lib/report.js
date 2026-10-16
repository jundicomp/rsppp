import { JENIS } from './constants.js';
import { fmtDateTime } from './format.js';
import { dpdProgress, countsFromC1 } from './progress.js';

/** Susun teks laporan WhatsApp untuk admin setelah DPD submit. */
export function buildWaReport({ dpd, uploader, c1, bacaleg, submittedAt, appUrl }) {
  const prog = dpdProgress({ ...dpd, counts: countsFromC1(c1) });
  const L = [];
  L.push('*LAPORAN INPUT DATA C1 PEMILU 2024*');
  L.push(dpd.nama);
  L.push('Pengupload: ' + uploader);
  L.push('Waktu submit: ' + fmtDateTime(submittedAt));
  L.push('');
  L.push('*Dokumen C1: ' + c1.length + ' file*' + (prog.K ? ' (target ' + prog.K + ' kecamatan/tingkatan)' : ''));
  JENIS.forEach((j) => {
    const list = c1.filter((x) => x.jenis === j.id);
    if (!list.length) return;
    L.push('▪ ' + j.label + ' (' + list.length + ')');
    list.forEach((x, i) => L.push('   ' + (i + 1) + '. ' + (x.keterangan || x.fileName)));
  });
  if (prog.K) {
    L.push('');
    L.push('*Progres per tingkatan* — total ' + prog.pct + '%');
    prog.per.forEach((p) => L.push('▪ ' + p.label + ': ' + p.count + '/' + prog.K + ' (' + p.pct + '%) · PR ' + p.pr));
  }
  L.push('');
  L.push('*Usulan Bacaleg: ' + bacaleg.length + ' nama*');
  bacaleg.forEach((b, i) => L.push((i + 1) + '. ' + b.nama + ' — ' + b.tingkat + ' (usul: ' + b.pengusul + ')'));
  if (appUrl) {
    L.push('');
    L.push('Rekap lengkap: ' + appUrl);
  }
  return L.join('\n');
}
