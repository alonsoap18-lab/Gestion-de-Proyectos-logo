// src/pages/Projects.jsx
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { Modal, Confirm, Badge, Progress, Spinner, Empty, Field, StatCard } from '../components/ui';
import { Plus, Pencil, Trash2, FolderKanban, MapPin, Calendar, Clock, Users, ChevronRight, DollarSign } from 'lucide-react';
import { format } from 'date-fns';

const BLANK = { name:'', client:'', location:'', start_date:'', duration_weeks:12, status:'Planning', description:'', budget:'' };

export default function Projects() {
  const qc       = useQueryClient();
  const navigate = useNavigate();
  const [modal,  setModal]  = useState(false);
  const [form,   setForm]   = useState(BLANK);
  const [delTgt, setDelTgt] = useState(null);
  const [filter, setFilter] = useState('');

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn:  () => api.get('/projects').then(r => r.data),
  });

  const save = useMutation({
    mutationFn: d => form.id ? api.put(`/projects/${form.id}`, d) : api.post('/projects', d),
    onSuccess:  () => { qc.invalidateQueries(['projects']); setModal(false); },
  });
  const del = useMutation({
    mutationFn: id => api.delete(`/projects/${id}`),
    onSuccess:  () => qc.invalidateQueries(['projects']),
  });

  const shown = filter ? projects.filter(p => p.status === filter) : projects;

  const counts = { all: projects.length };
  ['Planning','Active','Delayed','Completed'].forEach(s => {
    counts[s] = projects.filter(p => p.status === s).length;
  });

  if (isLoading) return <Spinner/>;

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Proyectos</h1>
          <p className="text-slate-400 text-sm mt-0.5">{projects.length} proyecto(s) en el sistema</p>
        </div>
        <button className="btn-primary" onClick={() => { setForm(BLANK); setModal(true); }}>
          <Plus size={15}/> Nuevo Proyecto
        </button>
      </div>

      {/* Status filter pills */}
      <div className="flex flex-wrap gap-2 mb-5">
        {[['', 'Todos', counts.all], ['Planning','Planificación',counts.Planning],
          ['Active','Activos',counts.Active], ['Delayed','Retrasados',counts.Delayed],
          ['Completed','Completados',counts.Completed]].map(([val, label, cnt]) => (
          <button key={val}
            onClick={() => setFilter(val)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all
              ${filter === val
                ? 'bg-brand-500 text-white border-brand-600'
                : 'bg-surface-700 text-slate-400 border-surface-600 hover:text-slate-200'}`}>
            {label} <span className="opacity-60 ml-1">{cnt}</span>
          </button>
        ))}
      </div>

      {/* Cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {shown.map(p => (
          <div key={p.id}
            className="card p-5 cursor-pointer hover:border-surface-400 transition-all group"
            onClick={() => navigate(`/projects/${p.id}`)}>

            <div className="flex items-start justify-between mb-3">
              <div className="flex-1 min-w-0 pr-2">
                <h3 className="font-display text-lg font-bold text-white uppercase tracking-wide truncate
                               group-hover:text-brand-400 transition-colors">
                  {p.name}
                </h3>
                <p className="text-slate-500 text-xs truncate">{p.client || 'Sin cliente'}</p>
              </div>
              <div className="flex gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
                <button className="btn-icon"
                  onClick={() => { setForm({ ...p, budget: p.budget?.toString() || '' }); setModal(true); }}>
                  <Pencil size={13}/>
                </button>
                <button className="btn-icon hover:text-red-400" onClick={() => setDelTgt(p)}>
                  <Trash2 size={13}/>
                </button>
              </div>
            </div>

            <div className="space-y-1 mb-3 text-xs text-slate-500">
              {p.location && (
                <div className="flex items-center gap-1.5"><MapPin size={11} className="text-brand-500"/>{p.location}</div>
              )}
              {p.start_date && (
                <div className="flex items-center gap-1.5"><Calendar size={11} className="text-brand-500"/>
                  {format(new Date(p.start_date), 'dd/MM/yyyy')}
                </div>
              )}
              <div className="flex items-center gap-1.5"><Clock size={11} className="text-brand-500"/>{p.duration_weeks} semanas</div>
              {p.budget > 0 && (
                <div className="flex items-center gap-1.5"><DollarSign size={11} className="text-brand-500"/>
                  ${Number(p.budget).toLocaleString()}
                </div>
              )}
              {p.members?.length > 0 && (
                <div className="flex items-center gap-1.5"><Users size={11} className="text-brand-500"/>{p.members.length} miembro(s)</div>
              )}
            </div>

            <Progress value={p.progress || 0} size="sm"/>

            <div className="flex items-center justify-between mt-3">
              <Badge status={p.status}/>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                {p.taskStats && <>
                  <span>{p.taskStats.total} tareas</span>
                  <span className="text-green-400">{p.taskStats.completed}✓</span>
                </>}
                <ChevronRight size={13} className="text-slate-600 group-hover:text-brand-500 transition-colors"/>
              </div>
            </div>
          </div>
        ))}

        {shown.length === 0 && (
          <div className="col-span-3">
            <Empty icon={FolderKanban} title="Sin Proyectos"
              message="No hay proyectos que coincidan con el filtro seleccionado."
              action={<button className="btn-primary" onClick={() => { setForm(BLANK); setModal(true); }}>
                <Plus size={14}/> Nuevo Proyecto
              </button>}/>
          </div>
        )}
      </div>

      {/* Form modal */}
      <Modal open={modal} onClose={() => setModal(false)}
        title={form.id ? 'Editar Proyecto' : 'Nuevo Proyecto'} size="lg">
        <form onSubmit={e => { e.preventDefault(); save.mutate({ ...form, duration_weeks: parseInt(form.duration_weeks)||12, budget: parseFloat(form.budget)||0 }); }}
          className="grid grid-cols-2 gap-4">

          <div className="col-span-2">
            <Field label="Nombre del Proyecto" required>
              <input className="input" value={form.name}
                onChange={e => setForm({...form, name: e.target.value})} required placeholder="Residencial Las Palmas…"/>
            </Field>
          </div>
          <Field label="Cliente">
            <input className="input" value={form.client||''} onChange={e => setForm({...form, client: e.target.value})} placeholder="Nombre del cliente"/>
          </Field>
          <Field label="Ubicación">
            <input className="input" value={form.location||''} onChange={e => setForm({...form, location: e.target.value})} placeholder="San José, Costa Rica"/>
          </Field>
          <Field label="Fecha de Inicio">
            <input type="date" className="input" value={form.start_date||''} onChange={e => setForm({...form, start_date: e.target.value})}/>
          </Field>
          <Field label="Duración (semanas)">
            <input type="number" className="input" value={form.duration_weeks} min={1} max={200}
              onChange={e => setForm({...form, duration_weeks: e.target.value})}/>
          </Field>
          <Field label="Presupuesto ($)">
            <input type="number" className="input" value={form.budget||''} min={0} step="0.01"
              onChange={e => setForm({...form, budget: e.target.value})} placeholder="0.00"/>
          </Field>
          <Field label="Estado">
            <select className="input" value={form.status} onChange={e => setForm({...form, status: e.target.value})}>
              <option>Planning</option><option>Active</option>
              <option>Delayed</option><option>Completed</option><option>On Hold</option>
            </select>
          </Field>
          <div className="col-span-2">
            <Field label="Descripción">
              <textarea className="input" rows={3} value={form.description||''}
                onChange={e => setForm({...form, description: e.target.value})} placeholder="Descripción del proyecto…"/>
            </Field>
          </div>

          <div className="col-span-2 flex justify-end gap-2 pt-2">
            <button type="button" className="btn-ghost" onClick={() => setModal(false)}>Cancelar</button>
            <button type="submit" className="btn-primary" disabled={save.isPending}>
              {save.isPending ? 'Guardando…' : form.id ? 'Actualizar' : 'Crear Proyecto'}
            </button>
          </div>
        </form>
      </Modal>

      <Confirm open={!!delTgt} onClose={() => setDelTgt(null)} onConfirm={() => del.mutate(delTgt.id)}
        title="Eliminar Proyecto"
        message={`¿Eliminar "${delTgt?.name}"? Se eliminarán todas sus tareas, fotos y materiales asociados.`}/>
    </div>
  );
}
