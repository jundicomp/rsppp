import { useCallback, useEffect, useState } from 'react';
import { call } from '../api/index.js';
import { useAuth } from '../auth/AuthContext.jsx';

/** Muat daftar DPD + pilih DPD aktif (operator DPD otomatis DPD-nya sendiri). */
export function useDpdList() {
  const { user } = useAuth();
  const [dpds, setDpds] = useState([]);
  const [dpdId, setDpdId] = useState(() => user?.dpdId || sessionStorage.getItem('c1_dpd') || '');
  const [err, setErr] = useState('');
  const reload = useCallback(() => call('listDpd').then((list) => {
    setDpds(list);
    setDpdId((cur) => cur && list.some((d) => d.id === cur) ? cur : (user?.dpdId || list[0]?.id || ''));
  }).catch((e) => setErr(e.message)), [user]);
  useEffect(() => { reload(); }, [reload]);
  useEffect(() => { if (dpdId && user?.role !== 'dpd') sessionStorage.setItem('c1_dpd', dpdId); }, [dpdId, user]);
  return { dpds, dpdId, setDpdId, dpd: dpds.find((d) => d.id === dpdId) || null, reloadDpd: reload, err };
}

/** Muat C1 + bacaleg satu DPD. */
export function useDpdRecords(dpdId) {
  const [c1, setC1] = useState(null);
  const [bacaleg, setBacaleg] = useState(null);
  const [err, setErr] = useState('');
  const reload = useCallback(() => {
    if (!dpdId) return Promise.resolve();
    setErr('');
    return Promise.all([call('listC1', { dpdId }), call('listBacaleg', { dpdId })])
      .then(([a, b]) => { setC1(a); setBacaleg(b); })
      .catch((e) => setErr(e.message));
  }, [dpdId]);
  useEffect(() => { setC1(null); setBacaleg(null); reload(); }, [reload]);
  return { c1, setC1, bacaleg, setBacaleg, reload, err };
}
