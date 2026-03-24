// src/pages/Login.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, Loader2, Lock, Mail } from 'lucide-react';
import { useAuth } from '../context/AuthContext'; // Importamos el hook del context

export default function Login() {
  const { login, error: authError, loading: authLoading } = useAuth();
  const [email, setEmail] = useState('admin@grupoicaa.com');
  const [password, setPassword] = useState('ICAAadmin2026');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  async function submit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const res = await login(email, password); // usamos login del AuthContext

    if (!res.ok) {
      setError(res.error);
      setLoading(false);
      return;
    }

    setLoading(false);
    navigate('/'); // redirige al dashboard
  }

  return (
    <div className="min-h-screen bg-surface-900 flex items-center justify-center p-4 relative overflow-hidden">

      {/* Background grid */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              'radial-gradient(circle at 1px 1px, rgba(45,79,160,0.25) 1px, transparent 0)',
            backgroundSize: '40px 40px'
          }}
        />
        <div className="absolute -top-72 -right-72 w-[700px] h-[700px] bg-[#2d4fa0]/5 rounded-full blur-3xl"/>
        <div className="absolute -bottom-72 -left-72 w-[700px] h-[700px] bg-[#2d4fa0]/4 rounded-full blur-3xl"/>
      </div>

      <div className="w-full max-w-sm relative z-10">

        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="bg-white rounded-2xl p-5 shadow-2xl mb-5 w-40 h-40 flex items-center justify-center">
            <img
              src="/icaa-logo.png"
              alt="Grupo ICAA Constructora"
              className="w-full h-full object-contain"
            />
          </div>
          <p className="text-slate-500 text-xs uppercase tracking-[0.3em] font-semibold">
            Sistema de Gestión de Construcción
          </p>
        </div>

        {/* Card */}
        <div className="card p-7 shadow-2xl border-surface-600">
          <h2 className="font-display text-2xl font-bold text-white uppercase tracking-widest mb-6 text-center">
            Iniciar Sesión
          </h2>

          {(error || authError) && (
            <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/25 text-red-400 text-sm rounded-lg px-4 py-3 mb-4">
              <AlertCircle size={15} className="flex-shrink-0"/>
              {error || authError}
            </div>
          )}

          <form onSubmit={submit} className="space-y-4">
            <div className="field">
              <label className="label">Correo electrónico</label>
              <div className="relative">
                <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"/>
                <input
                  type="email"
                  className="input pl-9"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  placeholder="correo@grupoicaa.com"
                />
              </div>
            </div>

            <div className="field">
              <label className="label">Contraseña</label>
              <div className="relative">
                <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"/>
                <input
                  type="password"
                  className="input pl-9"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || authLoading}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-display text-base font-bold uppercase tracking-widest text-white transition-all mt-2"
              style={{ background: 'linear-gradient(135deg, #2d4fa0 0%, #1e3a7a 100%)' }}
            >
              {(loading || authLoading) && <Loader2 size={16} className="animate-spin"/>}
              {loading || authLoading ? 'Autenticando...' : 'Ingresar al Sistema'}
            </button>
          </form>

          {/* Credenciales */}
          <div className="mt-5 pt-5 border-t border-surface-600">
            <div className="bg-surface-700 rounded-lg p-3 font-mono text-xs space-y-1 border border-surface-600">
              <div>
                <span className="text-slate-500">usuario: </span>
                <span className="text-[#4a7fd4]">admin@grupoicaa.com</span>
              </div>
              <div>
                <span className="text-slate-500">clave: </span>
                <span className="text-[#4a7fd4]">ICAAadmin2026</span>
              </div>
            </div>
          </div>
        </div>

        <p className="text-center text-slate-600 text-xs mt-6">
          © {new Date().getFullYear()} Grupo ICAA Constructora · Todos los derechos reservados
        </p>
      </div>
    </div>
  );
}
