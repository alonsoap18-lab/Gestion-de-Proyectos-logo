// src/pages/Profile.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom'; // <-- Importamos la navegación
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { Field } from '../components/ui';
import { User, Shield, KeyRound, Mail, Briefcase, CheckCircle2, ArrowLeft } from 'lucide-react'; // <-- Agregamos ArrowLeft

export default function Profile() {
  const { user, logout } = useAuth();
  const navigate = useNavigate(); // <-- Inicializamos la navegación
  
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess(false);

    if (newPassword !== confirmPassword) {
      setError('Las contraseñas nuevas no coinciden.');
      return;
    }
    if (newPassword.length < 6) {
      setError('La nueva contraseña debe tener al menos 6 caracteres.');
      return;
    }

    setLoading(true);
    try {
      // 1. Verificamos que la clave actual sea correcta
      const { data: dbUser, error: checkError } = await supabase
        .from('users')
        .select('password')
        .eq('id', user.id)
        .single();

      if (checkError) throw new Error('Error al verificar el usuario.');
      
      if (dbUser.password !== currentPassword) {
        throw new Error('La contraseña actual es incorrecta.');
      }

      // 2. Actualizamos la clave en la base de datos
      const { error: updateError } = await supabase
        .from('users')
        .update({ password: newPassword })
        .eq('id', user.id);

      if (updateError) throw new Error('Error al actualizar la contraseña.');

      // 3. Éxito
      setSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      
      // Forzamos cierre de sesión a los 3 segundos
      setTimeout(() => {
        logout();
      }, 3000);

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Función para el botón cancelar
  const handleCancel = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    navigate(-1); // Te devuelve a la pantalla donde estabas antes
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      
      {/* HEADER MEJORADO CON FLECHA DE VOLVER */}
      <div className="flex items-start gap-3">
        <button onClick={handleCancel} className="btn-icon p-2 mt-0.5" title="Volver">
          <ArrowLeft size={18}/>
        </button>
        <div>
          <h1 className="page-title">Mi Perfil</h1>
          <p className="text-slate-400 text-sm mt-0.5">Gestiona tu información y seguridad</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* COLUMNA IZQUIERDA: Info del Usuario */}
        <div className="col-span-1 space-y-4">
          <div className="card p-6 flex flex-col items-center text-center">
            <div className="w-24 h-24 bg-surface-600 rounded-full flex items-center justify-center mb-4 border-4 border-surface-700 shadow-xl">
              <User size={40} className="text-slate-400"/>
            </div>
            <h2 className="text-xl font-display font-bold text-white">{user?.name}</h2>
            <div className="text-brand-400 font-semibold text-sm mb-4">{user?.role}</div>
            
            <div className="w-full space-y-3 mt-2 text-left">
              <div className="flex items-center gap-3 text-slate-400 text-sm p-2 bg-surface-700/50 rounded-lg">
                <Mail size={16} className="text-slate-500"/>
                <span className="truncate">{user?.email}</span>
              </div>
              <div className="flex items-center gap-3 text-slate-400 text-sm p-2 bg-surface-700/50 rounded-lg">
                <Briefcase size={16} className="text-slate-500"/>
                <span>{user?.specialty || 'Sin especialidad asignada'}</span>
              </div>
              <div className="flex items-center gap-3 text-slate-400 text-sm p-2 bg-surface-700/50 rounded-lg">
                <Shield size={16} className="text-slate-500"/>
                <span>Nivel de acceso: {user?.role}</span>
              </div>
            </div>
          </div>
        </div>

        {/* COLUMNA DERECHA: Cambio de Contraseña */}
        <div className="col-span-1 md:col-span-2">
          <div className="card p-6">
            <div className="flex items-center gap-2 mb-6 border-b border-surface-600 pb-4">
              <KeyRound size={20} className="text-brand-500"/>
              <h3 className="section-title text-lg m-0">Cambiar Contraseña</h3>
            </div>

            {success ? (
              <div className="bg-green-500/10 border border-green-500/30 p-5 rounded-xl text-center space-y-2">
                <CheckCircle2 size={30} className="text-green-400 mx-auto mb-2"/>
                <h4 className="text-green-400 font-bold text-lg">¡Contraseña Actualizada!</h4>
                <p className="text-slate-300 text-sm">Tu contraseña ha sido cambiada en la base de datos de manera segura.</p>
                <p className="text-slate-400 text-xs mt-4 animate-pulse">Cerrando sesión por seguridad en 3 segundos...</p>
              </div>
            ) : (
              <form onSubmit={handleChangePassword} className="space-y-5 max-w-md">
                
                {error && (
                  <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-3 rounded-lg text-sm">
                    {error}
                  </div>
                )}

                <Field label="Contraseña Actual" required>
                  <input type="password" className="input" value={currentPassword} 
                    onChange={e => setCurrentPassword(e.target.value)} required placeholder="Ingresa tu contraseña actual"/>
                </Field>

                <div className="grid grid-cols-2 gap-4">
                  <Field label="Nueva Contraseña" required>
                    <input type="password" className="input" value={newPassword} 
                      onChange={e => setNewPassword(e.target.value)} required placeholder="Mínimo 6 caracteres"/>
                  </Field>
                  <Field label="Confirmar Contraseña" required>
                    <input type="password" className="input" value={confirmPassword} 
                      onChange={e => setConfirmPassword(e.target.value)} required placeholder="Repite la nueva"/>
                  </Field>
                </div>

                {/* BOTONES MEJORADOS */}
                <div className="pt-4 border-t border-surface-600 flex justify-end gap-2">
                  <button type="button" className="btn-ghost w-full sm:w-auto" onClick={handleCancel} disabled={loading}>
                    Cancelar
                  </button>
                  <button type="submit" className="btn-primary w-full sm:w-auto" disabled={loading}>
                    {loading ? 'Validando...' : 'Actualizar Contraseña'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
