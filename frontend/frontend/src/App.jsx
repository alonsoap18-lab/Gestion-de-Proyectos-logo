// src/App.jsx
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Layout from './components/layout/Layout';

import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Projects from './pages/Projects';
import ProjectDetail from './pages/ProjectDetail';
import Tasks from './pages/Tasks';
import Employees from './pages/Employees';
import Calendar from './pages/Calendar';
import Reports from './pages/Reports';
import Machinery from './pages/Machinery';
import Materials from './pages/Materials';
import Users from './pages/Users';

function Private({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="text-white flex justify-center items-center h-screen">Cargando...</div>;
  return user ? children : <Navigate to="/login" replace />;
}

function AdminOnly({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="text-white flex justify-center items-center h-screen">Cargando...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'Admin') return <Navigate to="/" replace />;
  return children;
}

const P = ({ el }) => <Private><Layout>{el}</Layout></Private>;
const A = ({ el }) => <AdminOnly><Layout>{el}</Layout></AdminOnly>;

export default function App() {
  const { loading } = useAuth();
  if (loading) return <div className="text-white flex justify-center items-center h-screen">Cargando...</div>;

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<P el={<Dashboard />} />} />
      <Route path="/projects" element={<P el={<Projects />} />} />
      <Route path="/projects/:id" element={<P el={<ProjectDetail />} />} />
      <Route path="/tasks" element={<P el={<Tasks />} />} />
      <Route path="/employees" element={<P el={<Employees />} />} />
      <Route path="/calendar" element={<P el={<Calendar />} />} />
      <Route path="/reports" element={<P el={<Reports />} />} />
      <Route path="/machinery" element={<P el={<Machinery />} />} />
      <Route path="/materials" element={<P el={<Materials />} />} />
      <Route path="/users" element={<A el={<Users />} />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
