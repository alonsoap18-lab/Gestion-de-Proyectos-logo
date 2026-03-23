// src/pages/Users.jsx
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import api from '../lib/api';
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

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users'], queryFn: () => api.get('/users').then(r => r.data),
  });

  const save = useMutation({
    mutationFn: d => form.id ? api.put(`/users/${form.id}`, d) : api.post('/users', d),
    onSuccess:  () => { qc.invalidateQueries(['users']); setModal(false); setErr(''); },
    onError:    e  => setErr(e.response?.data?.error || 'Error al guardar.'),
  });
  const del = useMutation({
    mutationFn: id => api.delete(`/users/${id}`),
    onSuccess:  () => qc.invalidateQueries(['users']),
  });

  const shown = users.filter(u => {
    const q = search.toLowerCase();
    if (q && !u.name.toLowerCase().includes(q) && !u.email.toLowerCase().includes(q)) return false;
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
                  <div className="flex items-center gap-2.5">
                    <Avatar name={u.name} size="sm"/>
                    <div>
                      <div className="font-semibold text-slate-200 text-sm">{u.name}</div>
                      {u.id === me?.id && <div className="text-[10px] text-brand-400 font-bold">Tú</div>}
                    </div>
                  </div>
                </td>
                <td className="td text-slate-400 text-xs">{u.email}</td>
                <td className="td">
                  <span className={`text-[11px] font-bold border px-2 py-0.5 rounded-full ${ROLE_BADGE[u.role]||ROLE_BADGE.Worker}`}>
                    {u.role}
                  </span>
                </td>
                <td className="td text-slate-400 text-xs">{u.position || '—'}</td>
                <td className="td text-slate-400 text-xs">{u.specialty || '—'}</td>
                <td className="td text-slate-400 text-xs">{u.phone || '—'}</td>
                <td className="td text-slate-500 text-xs font-mono">
                  {u.created_at ? format(new Date(u.created_at),'dd/MM/yyyy') : '—'}
                </td>
                <td className="td">
                  <div className="flex gap-1">
                    <button className="btn-icon"
                      onClick={() => { setForm({...u, password:''}); setErr(''); setModal(true); }}>
                      <Pencil size={12}/>
                    </button>
                    <button className="btn-icon hover:text-red-400"
                      disabled={u.id === me?.id}
                      title={u.id === me?.id ? 'No puedes eliminarte a ti mismo' : ''}
                      onClick={() => u.id !== me?.id && setDelTgt(u)}>
                      <Trash2 size={12}/>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {shown.length === 0 && (
              <tr><td colSpan={8} className="td text-center text-slate-500 py-10">Sin resultados</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Form modal */}
      <Modal open={modal} onClose={() => setModal(false)} title={form.id ? 'Editar Usuario' : 'Nuevo Usuario'}>
        <form onSubmit={e => { e.preventDefault(); save.mutate(form); }} className="grid grid-cols-2 gap-4">
          {err && (
            <div className="col-span-2 text-sm text-red-400 bg-red-500/10 rounded-lg px-3 py-2 border border-red-500/20">
              {err}
            </div>
          )}
          <div className="col-span-2">
            <Field label="Nombre Completo" required>
              <input className="input" value={form.name} onChange={e => setForm({...form,name:e.target.value})} required/>
            </Field>
          </div>
          <Field label="Correo Electrónico" required>
            <input type="email" className="input" value={form.email} onChange={e => setForm({...form,email:e.target.value})} required/>
          </Field>
          <Field label={form.id ? 'Nueva Contraseña (opcional)' : 'Contraseña'} required={!form.id}>
            <input type="password" className="input" value={form.password}
              onChange={e => setForm({...form,password:e.target.value})}
              required={!form.id} minLength={6}
              placeholder={form.id ? 'Dejar vacío para no cambiar' : 'Mínimo 6 caracteres'}/>
          </Field>
          <Field label="Rol">
            <select className="input" value={form.role} onChange={e => setForm({...form,role:e.target.value})}>
              {ROLES.map(r => <option key={r}>{r}</option>)}
            </select>
          </Field>
          <Field label="Cargo / Posición">
            <input className="input" value={form.position||''} onChange={e => setForm({...form,position:e.target.value})} placeholder="Ingeniero Civil…"/>
          </Field>
          <Field label="Especialidad">
            <input className="input" value={form.specialty||''} onChange={e => setForm({...form,specialty:e.target.value})} placeholder="Estructuras, Electricidad…"/>
          </Field>
          <Field label="Teléfono">
            <input className="input" value={form.phone||''} onChange={e => setForm({...form,phone:e.target.value})} placeholder="+506 8888-0000"/>
          </Field>
          <div className="col-span-2 flex justify-end gap-2 pt-1">
            <button type="button" className="btn-ghost" onClick={() => setModal(false)}>Cancelar</button>
            <button type="submit" className="btn-primary" disabled={save.isPending}>
              {save.isPending ? 'Guardando…' : form.id ? 'Actualizar Usuario' : 'Crear Usuario'}
            </button>
          </div>
        </form>
      </Modal>

      <Confirm open={!!delTgt} onClose={() => setDelTgt(null)} onConfirm={() => del.mutate(delTgt.id)}
        title="Eliminar Usuario"
        message={`¿Eliminar al usuario "${delTgt?.name}"? Esta acción no se puede deshacer.`}/>
    </div>
  );
}
