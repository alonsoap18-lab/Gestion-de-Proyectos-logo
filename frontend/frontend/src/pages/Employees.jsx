// src/pages/Employees.jsx
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import { Modal, Confirm, Spinner, Empty, Field, Avatar } from '../components/ui';
import { Plus, Pencil, Trash2, Users, Mail, Phone, Briefcase, Star, Search } from 'lucide-react';

const ROLES = ['Admin','Engineer','Supervisor','Worker'];
const ROLE_BADGE = {
  Admin:      'bg-brand-500/15 text-brand-400 border-brand-500/25',
  Engineer:   'bg-blue-500/15  text-blue-400  border-blue-500/25',
  Supervisor: 'bg-purple-500/15 text-purple-400 border-purple-500/25',
  Worker:     'bg-slate-500/15  text-slate-400  border-slate-500/25',
};
const BLANK = { name:'', email:'', password:'', role:'Worker', phone:'', specialty:'', position:'' };

export default function Employees() {
  const qc = useQueryClient();
  const [modal,   setModal]   = useState(false);
  const [form,    setForm]    = useState(BLANK);
  const [delTgt,  setDelTgt]  = useState(null);
  const [search,  setSearch]  = useState('');
  const [fRole,   setFRole]   = useState('');

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users'], queryFn: () => api.get('/users').then(r => r.data),
  });

  const save = useMutation({
    mutationFn: d => form.id ? api.put(`/users/${form.id}`, d) : api.post('/users', d),
    onSuccess:  () => { qc.invalidateQueries(['users']); setModal(false); },
  });
  const del = useMutation({
    mutationFn: id => api.delete(`/users/${id}`),
    onSuccess:  () => qc.invalidateQueries(['users']),
  });

  const [err, setErr] = useState('');

  const shown = users.filter(u => {
    const q = search.toLowerCase();
    if (q && !u.name.toLowerCase().includes(q) && !u.email.toLowerCase().includes(q)) return false;
    if (fRole && u.role !== fRole) return false;
    return true;
  });

  async function handleSubmit(e) {
    e.preventDefault();
    setErr('');
    const res = await save.mutateAsync(form).catch(e => e.response?.data);
    if (res?.error) setErr(res.error);
  }

  if (isLoading) return <Spinner/>;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Empleados</h1>
          <p className="text-slate-400 text-sm mt-0.5">{users.length} persona(s) en el sistema</p>
        </div>
        <button className="btn-primary" onClick={() => { setForm(BLANK); setErr(''); setModal(true); }}>
          <Plus size={15}/> Nuevo Empleado
        </button>
      </div>

      {/* Role pills */}
      <div className="grid grid-cols-5 gap-3 mb-5">
        <div className={`card p-3 cursor-pointer transition-all text-center ${!fRole ? 'border-brand-500/50' : ''}`}
          onClick={() => setFRole('')}>
          <div className="text-2xl font-display font-black text-white">{users.length}</div>
          <div className="text-[10px] text-slate-500 uppercase tracking-wider">Todos</div>
        </div>
        {ROLES.map(r => (
          <div key={r} className={`card p-3 cursor-pointer transition-all text-center ${fRole===r ? 'border-brand-500/50' : ''}`}
            onClick={() => setFRole(fRole === r ? '' : r)}>
            <div className="text-2xl font-display font-black text-white">{users.filter(u => u.role===r).length}</div>
            <div className="text-[10px] text-slate-500 uppercase tracking-wider">{r}</div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative mb-5 max-w-xs">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"/>
        <input className="input pl-9" placeholder="Buscar por nombre o email…"
          value={search} onChange={e => setSearch(e.target.value)}/>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {shown.map(u => (
          <div key={u.id} className="card p-5 group hover:border-surface-400 transition-all">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <Avatar name={u.name} size="lg"/>
                <div>
                  <div className="font-display font-bold text-white text-base tracking-wide">{u.name}</div>
                  <span className={`text-[10px] font-bold border px-1.5 py-0.5 rounded-full ${ROLE_BADGE[u.role]||ROLE_BADGE.Worker}`}>
                    {u.role}
                  </span>
                </div>
              </div>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button className="btn-icon" onClick={() => { setForm({...u, password:''}); setErr(''); setModal(true); }}>
                  <Pencil size={13}/>
                </button>
                <button className="btn-icon hover:text-red-400" onClick={() => setDelTgt(u)}>
                  <Trash2 size={13}/>
                </button>
              </div>
            </div>
            <div className="space-y-1.5 text-xs text-slate-500">
              {u.position  && <div className="flex items-center gap-2"><Briefcase size={11} className="text-brand-500 flex-shrink-0"/><span className="truncate">{u.position}</span></div>}
              {u.specialty && <div className="flex items-center gap-2"><Star      size={11} className="text-brand-500 flex-shrink-0"/><span className="truncate">{u.specialty}</span></div>}
              {u.email     && <div className="flex items-center gap-2"><Mail      size={11} className="text-brand-500 flex-shrink-0"/><span className="truncate">{u.email}</span></div>}
              {u.phone     && <div className="flex items-center gap-2"><Phone     size={11} className="text-brand-500 flex-shrink-0"/><span>{u.phone}</span></div>}
            </div>
          </div>
        ))}
        {shown.length === 0 && (
          <div className="col-span-3">
            <Empty icon={Users} title="Sin Resultados" message="No hay empleados que coincidan con los filtros."/>
          </div>
        )}
      </div>

      {/* Form */}
      <Modal open={modal} onClose={() => setModal(false)} title={form.id ? 'Editar Empleado' : 'Nuevo Empleado'}>
        <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
          {err && <div className="col-span-2 text-sm text-red-400 bg-red-500/10 rounded-lg px-3 py-2 border border-red-500/20">{err}</div>}
          <div className="col-span-2">
            <Field label="Nombre Completo" required>
              <input className="input" value={form.name} onChange={e => setForm({...form,name:e.target.value})} required/>
            </Field>
          </div>
          <Field label="Correo" required>
            <input type="email" className="input" value={form.email} onChange={e => setForm({...form,email:e.target.value})} required/>
          </Field>
          <Field label={form.id ? 'Nueva Contraseña (opcional)' : 'Contraseña'} required={!form.id}>
            <input type="password" className="input" value={form.password} onChange={e => setForm({...form,password:e.target.value})}
              required={!form.id} minLength={6} placeholder={form.id ? 'Dejar en blanco para no cambiar' : ''}/>
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
              {save.isPending ? 'Guardando…' : form.id ? 'Actualizar' : 'Crear Empleado'}
            </button>
          </div>
        </form>
      </Modal>

      <Confirm open={!!delTgt} onClose={() => setDelTgt(null)} onConfirm={() => del.mutate(delTgt.id)}
        title="Eliminar Empleado" message={`¿Eliminar a "${delTgt?.name}"? Esta acción no se puede deshacer.`}/>
    </div>
  );
}
