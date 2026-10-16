// Adapter ke Google Apps Script Web App.
// Content-Type text/plain dipakai supaya browser tidak mengirim preflight CORS (Apps Script tidak melayani OPTIONS).

export function createRemote(url) {
  async function call(action, payload = {}, token) {
    let res;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action, token, ...payload }),
        redirect: 'follow'
      });
    } catch (e) {
      throw new Error('Tidak bisa terhubung ke server. Periksa koneksi internet.');
    }
    const json = await res.json().catch(() => ({ ok: false, error: 'Respon server tidak valid' }));
    if (!json.ok) throw new Error(json.error || 'Terjadi kesalahan');
    return json.data;
  }

  function upload(payload, token, onProgress) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', url);
      xhr.setRequestHeader('Content-Type', 'text/plain;charset=utf-8');
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress) onProgress(Math.min(95, Math.round((e.loaded / e.total) * 95)));
      };
      xhr.onload = () => {
        try {
          const json = JSON.parse(xhr.responseText);
          if (!json.ok) return reject(new Error(json.error || 'Upload gagal'));
          onProgress && onProgress(100);
          resolve(json.data);
        } catch (e) {
          reject(new Error('Respon server tidak valid'));
        }
      };
      xhr.onerror = () => reject(new Error('Upload terputus. Periksa koneksi lalu coba lagi.'));
      xhr.send(JSON.stringify({ action: 'uploadC1', token, ...payload }));
    });
  }

  return { call, upload, mode: 'remote' };
}
