import { CREDIT } from './constants.js';
import { fmtDateTime } from './format.js';

const GREEN = 'FF14532D';
const ZEBRA = 'FFF7F6F3';
const BORDER = { style: 'thin', color: { argb: 'FFBFBAB2' } };
const BOX = { top: BORDER, left: BORDER, bottom: BORDER, right: BORDER };

/**
 * Unduh tabel sebagai file Excel (.xlsx) yang rapi:
 * judul rata tengah, subjudul, header hijau tua tulisan putih, kolom No, border, lebar kolom.
 *
 * columns: [{ label, value: 'key' | (row) => any, width, align: 'left'|'center'|'right', wrap }]
 */
export async function exportXlsx({ filename, sheetName = 'Rekap', title, subtitle, columns, rows }) {
  const mod = await import('exceljs');
  const ExcelJS = mod.default || mod;
  const wb = new ExcelJS.Workbook();
  wb.creator = CREDIT;
  wb.created = new Date();
  const cols = [{ label: 'No', value: (_, i) => i + 1, width: 6, align: 'center' }, ...columns];
  const ws = wb.addWorksheet(sheetName.slice(0, 31), {
    views: [{ state: 'frozen', ySplit: 4 }],
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 }
  });
  ws.columns = cols.map((c) => ({ width: c.width || 18 }));
  const last = cols.length;

  // Judul
  ws.mergeCells(1, 1, 1, last);
  const t = ws.getCell(1, 1);
  t.value = title;
  t.font = { bold: true, size: 15, color: { argb: 'FF1D1D1B' } };
  t.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(1).height = 26;

  // Subjudul
  ws.mergeCells(2, 1, 2, last);
  const st = ws.getCell(2, 1);
  st.value = (subtitle ? subtitle + ' · ' : '') + 'Diunduh ' + fmtDateTime(new Date().toISOString());
  st.font = { size: 11, color: { argb: 'FF3D3934' } };
  st.alignment = { horizontal: 'center', vertical: 'middle' };

  // Header
  const head = ws.getRow(4);
  cols.forEach((c, i) => {
    const cell = head.getCell(i + 1);
    cell.value = c.label.toUpperCase();
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GREEN } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = BOX;
  });
  head.height = 24;

  // Isi
  rows.forEach((r, ri) => {
    const row = ws.getRow(5 + ri);
    cols.forEach((c, ci) => {
      const cell = row.getCell(ci + 1);
      const v = typeof c.value === 'function' ? c.value(r, ri) : r[c.value];
      cell.value = v === undefined || v === null ? '' : v;
      cell.alignment = { horizontal: c.align || 'left', vertical: 'top', wrapText: c.wrap !== false };
      cell.border = BOX;
      cell.font = { size: 11 };
      if (ri % 2 === 1) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ZEBRA } };
    });
  });
  if (rows.length) ws.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4 + rows.length, column: last } };

  // Catatan kaki
  const foot = ws.getCell(6 + rows.length, 1);
  foot.value = rows.length ? 'Total: ' + rows.length + ' baris · Dibuat oleh ' + CREDIT : 'Belum ada data · Dibuat oleh ' + CREDIT;
  foot.font = { italic: true, size: 10, color: { argb: 'FF3D3934' } };

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.xlsx') ? filename : filename + '.xlsx';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
