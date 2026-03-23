// src/pages/Tasks.jsx
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import { Modal, Confirm, Badge, Progress, Spinner, Empty, Field } from '../components/ui';
import { Plus, Pencil, Trash2, CheckSquare, Filter } from 'lucide-react';

const BLANK = { name:'', project_id:'', assigned_to:'', start_week:1, end_week:2, status:'Pending', progress:0, priority:'Medium', description:'' };

export default function Tasks() {
  const qc = useQueryClient();
  const [modal,   setModal]   = useState(false);
  const [form,    setForm]    = useState(BLANK);
  const [delTgt,  setDelTgt]  = useState(null);
  const [fpj,     setFpj]     = useState('');
  const [fst,     setFst]     = useState('');
  const [fpr,     setFpr]     = useState('');

  const { data: tasks    = [], isLoading } = useQuery({ queryKey:['tasks'],    queryFn: () => api.get('/tasks').then(r => r.data) });
  const { data: projects = [] }            = useQuery({ queryKey:['projects'], queryFn: () => api.get('/projects').then(r => r.data) });
  const { data: users    = [] }            = useQuery({ queryKey:['users'],    queryFn: () => api.get('/users').then(r => r.data) });

  const save = useMutation({
    mutationFn: d => form.id ? api.put(`/tasks/${form.id}`, d) : api.post('/tasks', d),
    onSuccess:  () => { qc.invalidateQueries(['tasks']); qc.invalidateQueries(['projects']); setModal(false); },
  });
  const del = useMutation({
    mutationFn: id => api.delete(`/tasks/${id}`),
    onSuccess:  () => { qc.invalidateQueries(['tasks']); qc.invalidateQueries(['projects']); },
  });

  const filtered = tasks.filter(t => {
    if (fpj && t.project_id !== fpj)   return false;
    if (fst && t.status    !== fst)    return false;
    if (fpr && t.priority  !== fpr)    return false;
    return true;
  });

  // Group by project
  const grouped = filtered.reduce((acc, t) => {
    const key = t.project_name || 'Sin proyecto';
    (acc[key] = acc[key] || []).push(t);
    return acc;
  }, {});

  const STATUSES = ['Pending','Started','In Progress','Completed'];
  const STATUS_COLORS = { Pending:'text-slate-400', Started:'text-blue-400', 'In Progress':'text-brand-400', Completed:'text-green-400' };

  if (isLoading) return <Spinner/>;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Tareas</h1>
          <p className="text-slate-400 text-sm mt-0.5">{filtered.length} tarea(s)</p>
        </div>
        <button className="btn-primary" onClick={() => { setForm(BLANK); setModal(true); }}>
          <Plus size={15}/> Nueva Tarea
        </button>
      </div>

      {/* KPI pills */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        {STATUSES.map(s => {
          const cnt = tasks.filter(t => t.status === s).length;
          return (
            <div key={s}
              className={`card p-3 cursor-pointer transition-all hover:border-surface-400
                ${fst === s ? 'border-brand-500/50' : ''}`}
              onClick={() => setFst(fst === s ? '' : s)}>
              <div className={`text-2xl font-display font-black ${STATUS_COLORS[s]}`}>{cnt}</div>
              <div className="text-[10px] text-slate-500 uppercase tracking-wider">{s}</div>
            </div>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-5 items-center">
        <Filter size={13} className="text-slate-500"/>
        <select className="input max-w-[200px]" value={fpj} onChange={e => setFpj(e.target.value)}>
          <option value="">Todos los proyectos</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select className="input max-w-[160px]" value={fst} onChange={e => setFst(e.target.value)}>
          <option value="">Todos los estados</option>
          {STATUSES.map(s => <option key={s}>{s}</option>)}
        </select>
        <select className="input max-w-[150px]" value={fpr} onChange={e => setFpr(e.target.value)}>
          <option value="">Toda prioridad</option>
          <option>High</option><option>Medium</option><option>Low</option>
        </select>
        {(fpj||fst||fpr) && (
          <button className="btn-ghost text-xs" onClick={() => { setFpj(''); setFst(''); setFpr(''); }}>
            Limpiar filtros
          </button>
        )}
      </div>

      {/* Grouped table */}
      {Object.entries(grouped).map(([projName, projTasks]) => (
        <div key={projName} className="table-wrap mb-4">
          <div className="flex items-center gap-2 px-4 py-3 bg-surface-700 border-b border-surface-600">
            <CheckSquare size={13} className="text-brand-500"/>
            <span className="font-display font-bold text-white uppercase tracking-wide text-sm">{projName}</span>
            <span className="ml-auto text-xs text-slate-500">{projTasks.length} tarea(s)</span>
          </div>
          <table className="w-full">
            <thead>
              <tr>
                <th className="th">Tarea</th>
                <th className="th">Asignado</th>
                <th className="th">Semanas</th>
                <th className="th">Estado</th>
                <th className="th w-36">Progreso</th>
                <th className="th">Prioridad</th>
                <th className="th w-20"/>
              </tr>
            </thead>
            <tbody>
              {projTasks.map(t => (
                <tr key={t.id} className="tr-hover">
                  <td className="td font-medium text-slate-200">{t.name}</td>
                  <td className="td text-slate-400 text-xs">{t.assigned_name || '—'}</td>
                  <td className="td font-mono text-slate-500 text-xs">S{t.start_week}–S{t.end_week}</td>
                  <td className="td"><Badge status={t.status}/></td>
                  <td className="td"><Progress value={t.progress} size="sm"/></td>
                  <td className="td">
                    <span className={`text-xs font-semibold
                      ${t.priority==='High'?'text-red-400':t.priority==='Low'?'text-slate-500':'text-yellow-400'}`}>
                      {t.priority}
                    </span>
                  </td>
                  <td className="td">
                    <div className="flex gap-1">
                      <button className="btn-icon" onClick={() => { setForm({...t}); setModal(true); }}><Pencil size={12}/></button>
                      <button className="btn-icon hover:text-red-400" onClick={() => setDelTgt(t)}><Trash2 size={12}/></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      {filtered.length === 0 && (
        <Empty icon={CheckSquare} title="Sin Tareas" message="No hay tareas que coincidan con los filtros."
          action={<button className="btn-primary" onClick={() => { setForm(BLANK); setModal(true); }}><Plus size={14}/>Nueva Tarea</button>}/>
      )}

      {/* Form modal */}
      <Modal open={modal} onClose={() => setModal(false)} title={form.id ? 'Editar Tarea' : 'Nueva Tarea'} size="lg">
        <form onSubmit={e => { e.preventDefault(); save.mutate(form); }} className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <Field label="Nombre" required>
              <input className="input" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required/>
            </Field>
          </div>
          <Field label="Proyecto" required>
            <select className="input" value={form.project_id} onChange={e => setForm({...form, project_id: e.target.value})} required>
              <option value="">— Seleccionar —</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
          <Field label="Asignado a">
            <select className="input" value={form.assigned_to||''} onChange={e => setForm({...form, assigned_to: e.target.value})}>
              <option value="">— Sin asignar —</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </Field>
          <Field label="Semana Inicio">
            <input type="number" className="input" value={form.start_week} min={1}
              onChange={e => setForm({...form, start_week: parseInt(e.target.value)||1})}/>
          </Field>
          <Field label="Semana Fin">
            <input type="number" className="input" value={form.end_week} min={1}
              onChange={e => setForm({...form, end_week: parseInt(e.target.value)||2})}/>
          </Field>
          <Field label="Estado">
            <select className="input" value={form.status} onChange={e => setForm({...form, status: e.target.value})}>
              <option>Pending</option><option>Started</option><option>In Progress</option><option>Completed</option>
            </select>
          </Field>
          <Field label="Prioridad">
            <select className="input" value={form.priority} onChange={e => setForm({...form, priority: e.target.value})}>
              <option>Low</option><option>Medium</option><option>High</option>
            </select>
          </Field>
          <div className="col-span-2">
            <Field label="Progreso (%)">
              <input type="range" className="w-full accent-brand-500" value={form.progress} min={0} max={100}
                onChange={e => setForm({...form, progress: parseInt(e.target.value)})}/>
              <div className="text-right text-xs text-slate-400 mt-1">{form.progress}%</div>
            </Field>
          </div>
          <div className="col-span-2">
            <Field label="Descripción">
              <textarea className="input" rows={2} value={form.description||''}
                onChange={e => setForm({...form, description: e.target.value})}/>
            </Field>
          </div>
          <div className="col-span-2 flex justify-end gap-2 pt-1">
            <button type="button" className="btn-ghost" onClick={() => setModal(false)}>Cancelar</button>
            <button type="submit" className="btn-primary" disabled={save.isPending}>
              {form.id ? 'Actualizar' : 'Crear Tarea'}
            </button>
          </div>
        </form>
      </Modal>

      <Confirm open={!!delTgt} onClose={() => setDelTgt(null)} onConfirm={() => del.mutate(delTgt.id)}
        title="Eliminar Tarea" message={`¿Eliminar "${delTgt?.name}"?`}/>
    </div>
  );
}
