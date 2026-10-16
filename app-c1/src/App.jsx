import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './auth/AuthContext.jsx';
import Layout from './components/Layout.jsx';
import { Loading } from './components/ui.jsx';
import Login from './pages/Login.jsx';
import Input from './pages/Input.jsx';
import Rekap from './pages/Rekap.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Users from './pages/Users.jsx';
import Settings from './pages/Settings.jsx';
import Akun from './pages/Akun.jsx';

function Guard({ roles, children, narrow }) {
  const { user, checking } = useAuth();
  const loc = useLocation();
  if (!user) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  if (checking) return <Layout narrow={narrow}><Loading /></Layout>;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return <Layout narrow={narrow}>{children}</Layout>;
}

function Home() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={user.role === 'dpd' ? '/rekap' : '/dashboard'} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<Home />} />
      <Route path="/dashboard" element={<Guard roles={['superadmin', 'admin']}><Dashboard /></Guard>} />
      <Route path="/input" element={<Guard roles={['superadmin', 'dpd']} narrow><Input /></Guard>} />
      <Route path="/rekap" element={<Guard><Rekap /></Guard>} />
      <Route path="/users" element={<Guard roles={['superadmin']}><Users /></Guard>} />
      <Route path="/pengaturan" element={<Guard roles={['superadmin']}><Settings /></Guard>} />
      <Route path="/akun" element={<Guard narrow><Akun /></Guard>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
