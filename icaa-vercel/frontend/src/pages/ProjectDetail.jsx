// src/pages/ProjectDetail.jsx
import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import { Modal, Confirm, Badge, Progress, Spinner, Field, Avatar } from '../components/ui';
import GanttChart from '../components/gantt/GanttChart';
import { ArrowLeft, Plus, Trash2, MapPin, Calendar, Clock, DollarSign } from 'lucide-react';
import { format } from 'date-fns';

const BLANK_TASK = { name:'', assigned_to:'', start_week:1, end_week:2, status:'Pending', progress:0, priority:'Medium', description:'' };

const TABS = ['Gantt','Tareas','Equipo','Información'];

export default function ProjectDetail() {
  const { id }   = useParams();
  const navigate = useNavigate();
  const qc       = useQueryClient();
  const [tab,      setTab]      = useState('Gantt');
  const [taskMod,  setTaskMod]  = useState(false);
  const [taskForm, setTaskForm] = useState(BLANK_TASK);
  const [delTask,  setDelTask]  = useState(null);
  const [mbMod,    setMbMod]    = useState(false);

  const { data: project, isLoading } = useQuery({
    queryKey: ['project', id],
    queryFn:  () => api.get(`/projects/${id}`).then(r => r.data),
  });
  const { data: allUsers = [] } = useQuery({
    queryKey: ['users'],
    queryFn:  () => api.get('/users').then(r => r.data),
  });

  const saveTask = useMutation({
    mutationFn: d => taskForm.id ? api.put(`/tasks/${taskForm.id}`, d) : api.post('/tasks', d),
    onSuccess:  () => { qc.invalidateQueries(['project', id]); setTaskMod(false); },
  });
  const delTaskMut = useMutation({
    mutationFn: tid => api.delete(`/tasks/${tid}`),
    onSuccess:  () => qc.invalidateQueries(['project', id]),
  });
  const moveTask = useMutation({
    mutationFn: ({ tid, sw, ew }) => api.patch(`/tasks/${tid}/position`, { start_week: sw, end_week: ew }),
    onSuccess:  () => qc.invalidateQueries(['project', id]),
  });
  const addMember = useMutation({
    mutationFn: d => api.post(`/projects/${id}/members`, d),
    onSuccess:  () => { qc.invalidateQueries(['project', id]); setMbMod(false); },
  });
  const removeMember = useMutation({
    mutationFn: uid => api.delete(`/projects/${id}/members/${uid}`),
    onSuccess:  () => qc.invalidateQueries(['project', id]),
  });

  if (isLoading) return <Spinner/>;
  if (!project)  return <div className="text-slate-400 p-8">Proyecto no encontrado.</div>;

  const totalWeeks = project.duration_weeks || 12;

  function openNewTask() { setTaskForm({ ...BLANK_TASK, project_id: id }); setTaskMod(true); }
  function openEditTask(t) { setTaskForm({ ...t, project_id: id }); setTaskMod(true); }

  return (
    <div className="space-y-5">
      {/* Top bar */}
      <div className="flex items-start gap-3 flex-wrap">
        <button onClick={() => navigate('/projects')} className="btn-icon p-2 mt-0.5">
          <ArrowLeft size={16}/>
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="page-title">{project.name}</h1>
          <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-slate-500">
            {project.client   && <span className="flex items-center gap-1"><MapPin size={10}/>{project.client}</span>}
            {project.location && <span className="flex items-center gap-1"><MapPin size={10}/>{project.location}</span>}
            {project.start_date && <span className="flex items-center gap-1"><Calendar size={10}/>{format(new Date(project.start_date),'dd/MM/yyyy')}</span>}
            <span className="flex items-center gap-1"><Clock size={10}/>{totalWeeks} semanas</span>
            {project.budget > 0 && <span className="flex items-center gap-1"><DollarSign size={10}/>Budget: ${Number(project.budget).toLocaleString()}</span>}
          </div>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <Badge status={project.status}/>
          <div className="w-28"><Progress value={project.progress || 0} size="sm"/></div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-surface-800 border border-surface-600 rounded-xl p-1 w-fit">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all
              ${tab === t ? 'bg-brand-500 text-white' : 'text-slate-400 hover:text-white'}`}>
            {t}
          </button>
        ))}
      </div>

      {/* ── GANTT ─────────────────────────────────────────── */}
      {tab === 'Gantt' && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="section-title text-sm">
              Diagrama Gantt · {totalWeeks} semanas ·{' '}
              {project.start_date && format(new Date(project.start_date), 'dd/MM/yyyy')}
            </h3>
            <button className="btn-primary" onClick={openNewTask}><Plus size={14}/>Nueva Tarea</button>
          </div>
          <GanttChart
            project={project}
            tasks={project.tasks || []}
            onEditTask={openEditTask}
            onDeleteTask={t => setDelTask(t)}
            onMoveTask={(tid, sw, ew) => moveTask.mutate({ tid, sw, ew })}
          />
        </div>
      )}

      {/* ── TASKS ─────────────────────────────────────────── */}
      {tab === 'Tareas' && (
        <div className="table-wrap">
          <div className="flex items-center justify-between px-5 py-4 border-b border-surface-600 bg-surface-700">
            <h3 className="section-title text-sm">Tareas ({project.tasks?.length || 0})</h3>
            <button className="btn-primary" onClick={openNewTask}><Plus size={14}/>Nueva Tarea</button>
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
              {(project.tasks || []).map(t => (
                <tr key={t.id} className="tr-hover">
                  <td className="td font-medium text-slate-200">{t.name}</td>
                  <td className="td text-slate-400">{t.assigned_name || '—'}</td>
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
                      <button className="btn-icon" onClick={() => openEditTask(t)}><Plus size={12} className="rotate-45"/></button>
                      <button className="btn-icon hover:text-red-400" onClick={() => setDelTask(t)}><Trash2 size={12}/></button>
                    </div>
                  </td>
                </tr>
              ))}
              {!project.tasks?.length && (
                <tr><td colSpan={7} className="td text-center text-slate-500 py-10">Sin tareas</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── TEAM ──────────────────────────────────────────── */}
      {tab === 'Equipo' && (
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="section-title text-sm">Equipo del Proyecto</h3>
            <button className="btn-primary" onClick={() => setMbMod(true)}><Plus size={14}/>Agregar</button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {(project.members || []).map(m => (
              <div key={m.id} className="flex items-center gap-3 p-3 bg-surface-700 rounded-xl border border-surface-600">
                <Avatar name={m.name}/>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-slate-200 text-sm">{m.name}</div>
                  <div className="text-xs text-slate-500">{m.specialty || m.role}</div>
                </div>
                <span className="text-xs bg-surface-600 text-slate-400 px-2 py-1 rounded-lg flex-shrink-0">
                  {m.project_role}
                </span>
                <button className="btn-icon hover:text-red-400 flex-shrink-0"
                  onClick={() => removeMember.mutate(m.id)}><Trash2 size={12}/></button>
              </div>
            ))}
            {!project.members?.length && (
              <p className="col-span-2 text-slate-500 text-sm text-center py-8">Sin miembros asignados</p>
            )}
          </div>
        </div>
      )}

      {/* ── INFO ──────────────────────────────────────────── */}
      {tab === 'Información' && (
        <div className="card p-6">
          <h3 className="section-title text-sm mb-4">Información del Proyecto</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
            {[
              ['Cliente',       project.client],
              ['Ubicación',     project.location],
              ['Inicio',        project.start_date ? format(new Date(project.start_date),'dd/MM/yyyy') : null],
              ['Duración',      `${project.duration_weeks} semanas`],
              ['Estado',        project.status],
              ['Presupuesto',   project.budget ? `$${Number(project.budget).toLocaleString()}` : null],
              ['Progreso',      `${project.progress}%`],
              ['Tareas',        project.tasks?.length ?? 0],
              ['Miembros',      project.members?.length ?? 0],
            ].map(([l, v]) => (
              <div key={l} className="bg-surface-700 rounded-lg p-3 border border-surface-600">
                <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">{l}</div>
                <div className="text-slate-200 font-semibold">{v || '—'}</div>
              </div>
            ))}
          </div>
          {project.description && (
            <div className="mt-3 bg-surface-700 rounded-lg p-3 border border-surface-600">
              <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Descripción</div>
              <div className="text-slate-200 text-sm leading-relaxed">{project.description}</div>
            </div>
          )}
        </div>
      )}

      {/* Task form modal */}
      <Modal open={taskMod} onClose={() => setTaskMod(false)}
        title={taskForm.id ? 'Editar Tarea' : 'Nueva Tarea'}>
        <form onSubmit={e => { e.preventDefault(); saveTask.mutate({ ...taskForm, project_id: id }); }}
          className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <Field label="Nombre" required>
              <input className="input" value={taskForm.name}
                onChange={e => setTaskForm({...taskForm, name: e.target.value})} required/>
            </Field>
          </div>
          <Field label="Semana Inicio">
            <input type="number" className="input" value={taskForm.start_week} min={1} max={totalWeeks}
              onChange={e => setTaskForm({...taskForm, start_week: parseInt(e.target.value)||1})}/>
          </Field>
          <Field label="Semana Fin">
            <input type="number" className="input" value={taskForm.end_week} min={1} max={totalWeeks}
              onChange={e => setTaskForm({...taskForm, end_week: parseInt(e.target.value)||2})}/>
          </Field>
          <Field label="Estado">
            <select className="input" value={taskForm.status}
              onChange={e => setTaskForm({...taskForm, status: e.target.value})}>
              <option>Pending</option><option>Started</option>
              <option>In Progress</option><option>Completed</option>
            </select>
          </Field>
          <Field label="Prioridad">
            <select className="input" value={taskForm.priority}
              onChange={e => setTaskForm({...taskForm, priority: e.target.value})}>
              <option>Low</option><option>Medium</option><option>High</option>
            </select>
          </Field>
          <Field label="Progreso (%)">
            <input type="number" className="input" value={taskForm.progress} min={0} max={100}
              onChange={e => setTaskForm({...taskForm, progress: parseInt(e.target.value)||0})}/>
          </Field>
          <Field label="Asignado a">
            <select className="input" value={taskForm.assigned_to||''}
              onChange={e => setTaskForm({...taskForm, assigned_to: e.target.value})}>
              <option value="">— Sin asignar —</option>
              {allUsers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </Field>
          <div className="col-span-2">
            <Field label="Descripción">
              <textarea className="input" rows={2} value={taskForm.description||''}
                onChange={e => setTaskForm({...taskForm, description: e.target.value})}/>
            </Field>
          </div>
          <div className="col-span-2 flex justify-end gap-2 pt-1">
            <button type="button" className="btn-ghost" onClick={() => setTaskMod(false)}>Cancelar</button>
            <button type="submit" className="btn-primary">
              {taskForm.id ? 'Actualizar' : 'Crear Tarea'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Add member modal */}
      <Modal open={mbMod} onClose={() => setMbMod(false)} title="Agregar Miembro" size="sm">
        <AddMemberForm
          allUsers={allUsers}
          existing={project.members || []}
          onAdd={d => addMember.mutate(d)}
          onClose={() => setMbMod(false)}
        />
      </Modal>

      <Confirm open={!!delTask} onClose={() => setDelTask(null)}
        onConfirm={() => delTaskMut.mutate(delTask.id)}
        title="Eliminar Tarea" message={`¿Eliminar la tarea "${delTask?.name}"?`}/>
    </div>
  );
}

function AddMemberForm({ allUsers, existing, onAdd, onClose }) {
  const [userId, setUserId]   = useState('');
  const [role,   setRole]     = useState('Member');
  const existIds = existing.map(m => m.id);
  const available = allUsers.filter(u => !existIds.includes(u.id));

  return (
    <div className="space-y-4">
      <Field label="Usuario">
        <select className="input" value={userId} onChange={e => setUserId(e.target.value)}>
          <option value="">— Seleccionar —</option>
          {available.map(u => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
        </select>
      </Field>
      <Field label="Rol en el Proyecto">
        <select className="input" value={role} onChange={e => setRole(e.target.value)}>
          <option>Engineer</option><option>Supervisor</option>
          <option>Member</option><option>Observer</option>
        </select>
      </Field>
      <div className="flex justify-end gap-2">
        <button className="btn-ghost" onClick={onClose}>Cancelar</button>
        <button className="btn-primary" disabled={!userId}
          onClick={() => { onAdd({ user_id: userId, project_role: role }); }}>
          Agregar
        </button>
      </div>
    </div>
  );
}
