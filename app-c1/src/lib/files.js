import { fetchFile } from '../api/index.js';

/**
 * Lihat atau unduh file C1 lewat server. Jendela untuk "lihat" dibuka langsung saat diklik
 * supaya tidak diblokir browser, lalu diisi setelah file selesai dimuat.
 */
export async function openC1File(row, mode = 'view') {
  let win = null;
  if (mode === 'view') {
    win = window.open('', '_blank');
    if (win) {
      win.document.title = row.fileName;
      win.document.body.style.cssText = 'font-family:system-ui,sans-serif;padding:40px;color:#1d1d1b';
      win.document.body.textContent = 'Memuat ' + row.fileName + '…';
    }
  }
  try {
    const { name, blob } = await fetchFile(row.id);
    const url = URL.createObjectURL(blob);
    if (mode === 'view' && win) {
      win.location.href = url;
    } else {
      const a = document.createElement('a');
      a.href = url;
      a.download = name || row.fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
    }
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch (e) {
    if (win) win.close();
    throw e;
  }
}
