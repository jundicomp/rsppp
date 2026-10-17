# Upload Dokumen Hasil Suara Pemilu 2024

Aplikasi web untuk DPD PKS Kota/Kabupaten se-Sumatera Selatan:

- **Upload Rekap Kecamatan (D Hasil)** per tingkatan (DPR RI, DPRD Provinsi, DPRD Kab/Kota, DPD RI, Pilpres). Ada progress upload, keterangan wajib, serta nama pengupload dan tanggal/jam yang tercatat otomatis.
- **Usulan bacaleg**: nama, tingkat caleg, profil singkat, dan pemberi usul/rekomendasi.
- **Rekap per DPD** dengan infografis capaian dan PR per tingkatan (target = jumlah kecamatan), plus unduh Excel (CSV).
- **Dashboard DPW** yang menampilkan capaian se-provinsi, peringkat DPD dari persentase tertinggi, dan DPD yang perlu ditindaklanjuti.
- **Hak akses bertingkat**: Super Admin, Admin DPW, dan Operator DPD, lengkap dengan manajemen user.
- **Laporan WhatsApp**: setelah submit, laporan otomatis tersusun dan dikirim ke WA admin.

Dibuat oleh **RSPP DPW PKS Sumsel**, 2026.

---

## Struktur di repo `rsppp`

```
rsppp/
├─ index.html      ← halaman Hasil Rekap DPRD (TIDAK diubah)
├─ app-c1/         ← source code aplikasi ini (React + Apps Script)
└─ c1/             ← hasil build, diakses di https://jundicomp.github.io/rsppp/c1/
```

Aplikasi ini berdiri sendiri di folder `app-c1/` dan `c1/`, jadi halaman lain di repo tetap aman.

```
GitHub Pages /rsppp/c1/ (React, file statis)
        │  fetch POST (JSON)
        ▼
Google Apps Script Web App  ──►  Google Sheet (database)
                            └─►  Folder Google Drive (file D Hasil)
```

**Mode demo.** Kalau `VITE_API_URL` kosong saat build, aplikasi berjalan dengan data contoh yang disimpan di browser. Mode ini cocok untuk mencoba tampilan sebelum Google Sheet siap. Akun demo yang tersedia:

- `superadmin` / `admin123`
- `admin` / `admin123`
- `dpd.palembang` / `dpd123`

---

## Hak akses

| Role | Bisa |
|---|---|
| **Super Admin** | Semua: dashboard, input untuk DPD mana pun, rekap semua DPD, kelola user, pengaturan (nomor WA admin, data DPD dan jumlah kecamatan) |
| **Admin DPW** | Dashboard dan rekap semua DPD (hanya lihat) |
| **Operator DPD** | Input D Hasil dan bacaleg serta rekap **DPD-nya sendiri** saja |

Akun dibuat oleh Super Admin di menu **User**. Setiap user bisa mengganti passwordnya sendiri di menu **Akun**.

---

## Setup Backend (Google Sheet + Apps Script)

1. **Buat Google Sheet baru**, misalnya dengan nama `Database Hasil Suara Pemilu 2024`.
2. Di Sheet, buka **Extensions → Apps Script**.
3. Hapus isi `Code.gs` bawaan, lalu tempel isi `apps-script/Code.gs` dari repo ini.
4. Klik ikon ⚙️ **Project Settings**:
   - Centang **Show "appsscript.json" manifest file in editor**, lalu ganti isinya dengan `apps-script/appsscript.json`.
   - Di bagian **Script Properties**, tambahkan property `FOLDER_ID` berisi ID folder Drive tempat file D Hasil disimpan. ID folder adalah bagian URL setelah `/folders/`.
5. Kembali ke editor, pilih fungsi **`setup`**, klik **Run**, lalu izinkan aksesnya.
   - Sheet `Users`, `Sessions`, `DPD`, `C1`, `Bacaleg`, `Submissions`, dan `Settings` dibuat otomatis.
   - 17 DPD se-Sumsel terisi otomatis.
   - **Password superadmin** muncul di **Execution log**. Catat, lalu segera ganti setelah login.
6. Buat Web App melalui **Deploy → New deployment → Web app**:
   - *Execute as*: **Me**
   - *Who has access*: **Anyone**
   - Klik **Deploy**, lalu salin **Web app URL** yang diakhiri `/exec`.

> Setiap kali `Code.gs` diubah, buat versi baru lewat **Deploy → Manage deployments → Edit → Version: New version**. Dengan cara ini URL tidak berubah.

### Struktur folder file

```
[Folder FOLDER_ID]
 └─ DPD PKS Kota Palembang
     ├─ D Hasil DPR RI
     ├─ D Hasil DPRD Provinsi
     ├─ D Hasil DPRD Kab/Kota
     ├─ D Hasil DPD RI
     └─ D Hasil Pilpres
```

Subfolder dibuat otomatis. File tersimpan atas nama akun Google pemilik script. Supaya admin DPW bisa membuka file dari tombol **Lihat**, bagikan folder induknya ke email para admin (cukup akses *Viewer*).

---

## Setup Frontend (GitHub Pages)

Di sini tidak dipakai GitHub Actions. Hasil build langsung di-commit ke folder `c1/`, jadi pengaturan GitHub Pages yang sudah ada tidak perlu diubah.

```bash
cd app-c1
npm install
cp .env.example .env      # isi VITE_API_URL dengan Web app URL (/exec)
npm run build             # hasilnya masuk ke ../c1
```

Setelah itu commit dan push folder `app-c1/` dan `c1/`. Aplikasi bisa dibuka di `https://jundicomp.github.io/rsppp/c1/`. Folder `c1/` hanya tayang kalau ada di branch yang dipakai GitHub Pages, biasanya `main`.

Setelah login pertama kali sebagai `superadmin`, lakukan langkah awal berikut:

- **Akun**: ganti password superadmin.
- **Pengaturan**: isi nomor WA admin, alamat aplikasi (`https://jundicomp.github.io/rsppp/c1/`), dan jumlah kecamatan tiap DPD.
- **User**: buat akun Operator DPD untuk tiap kab/kota dan akun Admin DPW.

Untuk mencoba di komputer sendiri: `npm run dev` di dalam folder `app-c1`.

---

## Edit, hapus, dan riwayat perubahan

- **Konfirmasi password.** Setiap edit, ganti file, dan hapus (D Hasil maupun bacaleg) wajib dikonfirmasi dengan password akun yang sedang login. Pengecualian: keterangan yang baru diupload boleh langsung dikoreksi tanpa password selama 1 jam oleh akun yang sama.
- **Riwayat Perubahan.** Semua upload, edit, ganti file, hapus, dan submit tercatat di sheet `Log`, lengkap dengan siapa yang mengubah, kapan, apa yang berubah (sebelum → sesudah), dan alasannya. Riwayat bisa dilihat di menu Rekap, tab **Riwayat Perubahan**.
- **File yang dihapus atau diganti** langsung dipindahkan ke *Trash* Google Drive. Drive mengosongkan Trash otomatis setelah 30 hari, jadi file yang terhapus karena salah klik masih bisa dipulihkan dalam rentang itu.
- **Lihat / unduh file** dilakukan lewat aplikasi, jadi operator DPD tidak perlu diberi akses ke folder Drive.
- **Unduh Excel** menghasilkan file `.xlsx` rapi: judul rata tengah, header hijau, kolom No, border, dan filter.

> **Setelah mengganti `Code.gs` dengan versi baru**, jalankan lagi fungsi `setup` sekali. Langkah ini menambahkan sheet `Log` dan kolom baru tanpa mengubah data lama. Setelah itu buat versi deployment baru.

---

## Cara menghitung progres

- **Target per tingkatan** = jumlah kecamatan DPD tersebut. Targetnya adalah 1 Rekap Kecamatan (D Hasil) per kecamatan per tingkatan.
- **Capaian per tingkatan** = jumlah file pada tingkatan itu ÷ jumlah kecamatan. Angka ini dibatasi maksimal 100%.
- **Capaian DPD** = total capaian 5 tingkatan ÷ (jumlah kecamatan × 5).
- **Peringkat dashboard** diurutkan dari capaian DPD tertinggi.

## Catatan teknis

- **Ukuran file.** Batas aman per file adalah **35 MB**. Ini karena batas payload Apps Script, ditambah file dikirim sebagai base64 yang ukurannya bertambah sekitar 33%. Foto/scan D Hasil dari HP biasanya jauh di bawah batas ini.
- **Login.** Password disimpan sebagai hash SHA-256 dengan salt per user. Sesi login berlaku 7 hari, dan token sesi disimpan di sheet `Sessions`.
- **Tulis bersamaan.** Penulisan ke Sheet memakai `LockService`, jadi upload dari banyak DPD di waktu yang sama tetap aman.
- **Sumber data.** Sheet adalah database utama. Jangan ubah urutan atau nama kolom di baris pertama.

> Catatan penamaan: di layar dokumen ini disebut **Rekap Kecamatan (D Hasil)**. Nama teknis di balik layar tetap `C1` (nama sheet, kolom `totalC1`, folder `app-c1`/`c1`, dan alamat `/rsppp/c1/`) supaya data dan link lama tidak rusak.
