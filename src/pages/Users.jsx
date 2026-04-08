// src/pages/Users.jsx
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { supabase } from '../lib/supabase'; 
import { Modal, Confirm, Spinner, Field, Avatar } from '../components/ui';
import { Plus, Pencil, Trash2, Shield, Search } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const ROLES = ['Admin','Engineer','Supervisor','Worker'];
const ROLE_BADGE = {
  Admin:      'bg-brand-500/15 text-brand-400 border-brand-500/25',
  Engineer:   'bg-blue-500/15  text-blue-400  border-blue-500/25',
  Supervisor: 'bg-purple-500/15 text-purple-400 border-purple-500/25',
  Worker:     'bg-slate-500/15  text-slate-400  border-slate-500/25',
};
const BLANK = { name:'', email:'', password:'', role:'Worker', phone:'', specialty:'', position:'' };

export default function Users() {
  const qc       = useQueryClient();
  const { user: me } = useAuth();
  const [modal,  setModal]  = useState(false);
  const [form,   setForm]   = useState(BLANK);
  const [delTgt, setDelTgt] = useState(null);
  const [search, setSearch] = useState('');
  const [fRole,  setFRole]  = useState('');
  const [err,    setErr]    = useState('');

  // 1. LEER USUARIOS DESDE SUPABASE
  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users'], 
    queryFn: async () => {
      const { data, error } = await supabase.from('users').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // 2. CREAR O ACTUALIZAR USUARIO EN SUPABASE
  const save = useMutation({
    mutationFn: async (d) => {
      const payload = { ...d };
      
      if (!payload.password) {
        delete payload.password;
      }

      if (payload.id) {
        const { data, error } = await supabase.from('users').update(payload).eq('id', payload.id).select();
        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase.from('users').insert([payload]).select();
        if (error) throw error;
        return data;
      }
    },
    onSuccess:  () => { qc.invalidateQueries(['users']); setModal(false); setErr(''); },
    onError:    (e)  => setErr(e.message || 'Error al guardar en la base de datos.') 
  });

  // 3. ELIMINAR USUARIO EN SUPABASE
  const del = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('users').delete().eq('id', id);
      if (error) throw error;
      return true;
    },
    onSuccess:  () => { qc.invalidateQueries(['users']); setDelTgt(null); },
    onError:    (e) => alert(e.message || 'Error al eliminar el usuario')
  });

  const shown = users.filter(u => {
    const q = search.toLowerCase();
    if (q && !u.name?.toLowerCase().includes(q) && !u.email?.toLowerCase().includes(q)) return false;
    if (fRole && u.role !== fRole) return false;
    return true;
  });

  if (isLoading) return <Spinner/>;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Gestión de Usuarios</h1>
          <p className="text-slate-400 text-sm mt-0.5">{users.length} usuario(s) en el sistema</p>
        </div>
        <button className="btn-primary" onClick={() => { setForm(BLANK); setErr(''); setModal(true); }}>
          <Plus size={15}/> Nuevo Usuario
        </button>
      </div>

      {/* Role summary */}
      <div className="grid grid-cols-5 gap-3 mb-5">
        <div className={`card p-3 cursor-pointer transition-all text-center ${!fRole?'border-brand-500/40':''}`}
          onClick={() => setFRole('')}>
          <div className="text-2xl font-display font-black text-white">{users.length}</div>
          <div className="text-[10px] text-slate-500 uppercase tracking-wider">Todos</div>
        </div>
        {ROLES.map(r => (
          <div key={r}
            className={`card p-3 cursor-pointer transition-all text-center hover:border-surface-400 ${fRole===r?'border-brand-500/40':''}`}
            onClick={() => setFRole(fRole===r?'':r)}>
            <div className="text-2xl font-display font-black text-white">{users.filter(u=>u.role===r).length}</div>
            <div className="text-[10px] text-slate-500 uppercase tracking-wider">{r}</div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative mb-4 max-w-xs">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"/>
        <input className="input pl-8" placeholder="Buscar usuario…" value={search} onChange={e => setSearch(e.target.value)}/>
      </div>

      {/* Tabla de usuarios */}
      <div className="table-wrap">
        <table className="w-full">
          <thead>
            <tr>
              <th className="th">Usuario</th>
              <th className="th">Correo</th>
              <th className="th">Rol</th>
              <th className="th">Cargo</th>
              <th className="th">Especialidad</th>
              <th className="th">Teléfono</th>
              <th className="th">Creado</th>
              <th className="th w-20"/>
            </tr>
          </thead>
          <tbody>
            {shown.map(u => (
              <tr key={u.id} className="tr-hover">
                <td className="td">
                  <div className="flex items-center gap-3">
                    <Avatar text={u.name} />
                    <span className="font-medium text-white">{u.name}</span>
                  </div>
                </td>
                <td className="td text-slate-400">{u.email}</td>
                <td className="td">
                  <span className={`px-2 py-1 rounded text-[10px] uppercase font-bold tracking-wider border ${ROLE_BADGE[u.role] || ROLE_BADGE.Worker}`}>
                    {u.role}
                  </span>
                </td>
                <td className="td text-slate-400">{u.position || '-'}</td>
                <td className="td text-slate-400">{u.specialty || '-'}</td>
                <td className="td text-slate-400">{u.phone || '-'}</td>
                <td className="td text-slate-400">
                  {u.created_at ? format(new Date(u.created_at), 'dd MMM yyyy') : '-'}
                </td>
                <td className="td">
                  <div className="flex justify-end gap-2">
                    <button className="btn-icon text-slate-400 hover:text-brand-400" onClick={() => { setForm(u); setErr(''); setModal(true); }}>
                      <Pencil size={15}/>
                    </button>
                    {u.id !== me?.id && ( // Evitar que el usuario se borre a sí mismo
                      <button className="btn-icon text-slate-400 hover:text-red-400" onClick={() => setDelTgt(u)}>
                        <Trash2 size={15}/>
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal Crear/Editar Usuario */}
      {modal && (
        <Modal title={form.id ? 'Editar Usuario' : 'Nuevo Usuario'} onClose={() => setModal(false)}>
          <form className="p-4 space-y-4" onSubmit={e => { e.preventDefault(); save.mutate(form); }}>
            {err && <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded">{err}</div>}
            
            <Field label="Nombre Completo">
              <input required className="input w-full" value={form.name || ''} onChange={e => setForm({...form, name: e.target.value})} />
            </Field>
            
            <Field label="Correo Electrónico">
              <input required type="email" className="input w-full" value={form.email || ''} onChange={e => setForm({...form, email: e.target.value})} />
            </Field>
            
            <Field label={form.id ? "Nueva Contraseña (opcional)" : "Contraseña"}>
              <input type="password" required={!form.id} className="input w-full" value={form.password || ''} onChange={e => setForm({...form, password: e.target.value})} />
            </Field>

            <Field label="Rol en el Sistema">
              <select className="input w-full" value={form.role || 'Worker'} onChange={e => setForm({...form, role: e.target.value})}>
                {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Cargo / Puesto">
                <input className="input w-full" value={form.position || ''} onChange={e => setForm({...form, position: e.target.value})} />
              </Field>
              <Field label="Especialidad">
                <input className="input w-full" value={form.specialty || ''} onChange={e => setForm({...form, specialty: e.target.value})} />
              </Field>
            </div>
            
            <Field label="Teléfono">
              <input className="input w-full" value={form.phone || ''} onChange={e => setForm({...form, phone: e.target.value})} />
            </Field>

            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-surface-400">
              <button type="button" className="btn-ghost" onClick={() => setModal(false)}>Cancelar</button>
              <button type="submit" className="btn-primary" disabled={save.isPending}>
                {save.isPending ? 'Guardando...' : 'Guardar Usuario'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal Confirmar Eliminación */}
      {delTgt && (
        <Confirm 
          title="Eliminar usuario" 
          text={`¿Estás seguro que deseas eliminar permanentemente a ${delTgt.name}?`}
          confirmText="Eliminar"
          onCancel={() => setDelTgt(null)}
          onConfirm={() => del.mutate(delTgt.id)}
          loading={del.isPending}
        />
      )}
    </div>
  );
}
