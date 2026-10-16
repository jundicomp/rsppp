import { createRemote } from './remote.js';
import { createDemo } from './demo.js';
import { MAX_FILE_MB } from '../lib/constants.js';

const URL_API = (import.meta.env.VITE_API_URL || '').trim();
const adapter = URL_API ? createRemote(URL_API) : createDemo();

export const isDemo = adapter.mode === 'demo';
export const resetDemo = () => adapter.reset && adapter.reset();

let token = null;
let onUnauthorized = null;
export const setToken = (t) => { token = t; };
export const setUnauthorizedHandler = (fn) => { onUnauthorized = fn; };

async function guard(p) {
  try {
    return await p;
  } catch (e) {
    if (/Sesi habis|Akun tidak aktif/.test(e.message) && onUnauthorized) onUnauthorized();
    throw e;
  }
}

export function call(action, payload) {
  return guard(adapter.call(action, payload, token));
}

function readBase64(file) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result).split(',')[1] || '');
    fr.onerror = () => reject(new Error('Gagal membaca file'));
    fr.readAsDataURL(file);
  });
}

/** Upload satu file C1. onProgress(0..100) */
export async function uploadC1(file, meta, onProgress) {
  if (file.size > MAX_FILE_MB * 1024 * 1024) throw new Error('File lebih dari ' + MAX_FILE_MB + ' MB. Perkecil dulu (kompres/scan ulang).');
  onProgress && onProgress(2);
  const base64 = isDemo ? '' : await readBase64(file);
  return guard(adapter.upload('uploadC1', { ...meta, fileName: file.name, mime: file.type, size: file.size, base64 }, token, onProgress));
}

/** Edit C1 dari tabel (butuh password). Kalau `file` diisi, file lama diganti dan dihapus dari Drive. */
export async function editC1(meta, file, onProgress) {
  if (!file) return call('editC1', meta);
  if (file.size > MAX_FILE_MB * 1024 * 1024) throw new Error('File lebih dari ' + MAX_FILE_MB + ' MB. Perkecil dulu (kompres/scan ulang).');
  onProgress && onProgress(2);
  const base64 = isDemo ? '' : await readBase64(file);
  return guard(adapter.upload('editC1', { ...meta, fileName: file.name, mime: file.type, size: file.size, base64 }, token, onProgress));
}

/** Ambil isi file C1 lewat server (tidak perlu akses Drive langsung). */
export async function fetchFile(id) {
  const d = await call('getFile', { id });
  const bin = atob(d.base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return { name: d.name, blob: new Blob([bytes], { type: d.mime || 'application/octet-stream' }) };
}
