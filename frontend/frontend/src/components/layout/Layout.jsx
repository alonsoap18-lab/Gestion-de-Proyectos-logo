// src/components/layout/Layout.jsx
import { useAuth } from '../../context/AuthContext';

export default function Layout({ children }) {
  const { user, logout, loading } = useAuth();
  if (loading) return <div className="text-white flex justify-center items-center h-screen">Cargando...</div>;

  return (
    <div className="min-h-screen bg-surface-900 text-white flex flex-col">
      <header className="bg-surface-800 p-4 flex justify-between items-center">
        <div>Logo / Menú</div>
        <div className="flex items-center gap-4">
          <span>{user?.email}</span>
          <button onClick={logout} className="text-red-400 hover:text-red-600">Cerrar sesión</button>
        </div>
      </header>
      <main className="flex-1 p-4 overflow-auto">{children}</main>
    </div>
  );
}
