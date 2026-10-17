export const APP_TITLE = 'Upload Dokumen Hasil Suara Pemilu 2024';
export const APP_ORG = 'Partai Keadilan Sejahtera';
export const CREDIT = 'RSPP DPW PKS Sumsel';
export const YEAR = 2026;

export const JENIS = [
  { id: 'dprri', label: 'DPR RI', code: 'DPR-RI' },
  { id: 'prov', label: 'DPRD Provinsi', code: 'DPRD-Prov' },
  { id: 'kab', label: 'DPRD Kab/Kota', code: 'DPRD-Kab' },
  { id: 'dpd', label: 'DPD RI', code: 'DPD-RI' },
  { id: 'pilpres', label: 'Pilpres', code: 'Pilpres' }
];
export const JENIS_LABEL = Object.fromEntries(JENIS.map((j) => [j.id, j.label]));

export const TINGKAT = ['DPR RI', 'DPRD Provinsi', 'DPRD Kab/Kota', 'DPD RI'];

export const ROLES = [
  { id: 'superadmin', label: 'Super Admin', desc: 'Semua akses, kelola user & pengaturan' },
  { id: 'admin', label: 'Admin DPW', desc: 'Lihat dashboard & rekap semua DPD' },
  { id: 'dpd', label: 'Operator DPD', desc: 'Input & rekap DPD sendiri' }
];
export const ROLE_LABEL = Object.fromEntries(ROLES.map((r) => [r.id, r.label]));

export const ACCEPT = '.pdf,.jpg,.jpeg,.png,.webp,.heic,application/pdf,image/*';
export const MAX_FILE_MB = 35;
