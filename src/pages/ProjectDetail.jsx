// src/pages/ProjectDetail.jsx
import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { Modal, Confirm, Badge, Progress, Spinner, Field, Avatar } from '../components/ui';
import GanttChart from '../components/gantt/GanttChart';
import { ArrowLeft, Plus, Trash2, MapPin, Calendar, Clock, DollarSign, Download } from 'lucide-react';
import { format } from 'date-fns';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable'; // <-- Añadido para el Gantt corporativo

const BLANK_TASK = { name:'', assigned_to:'', start_week:1, end_week:2, status:'Pending', progress:0, priority:'Medium', description:'' };

const TABS = ['Gantt','Tareas','Equipo','Información'];

export default function ProjectDetail() {
  const { id }   = useParams();
  const navigate = useNavigate();
  const qc       = useQueryClient();
  
  const [tab,        setTab]        = useState('Gantt');
  const [taskMod,    setTaskMod]    = useState(false);
  const [taskForm,   setTaskForm]   = useState(BLANK_TASK);
  const [delTask,    setDelTask]    = useState(null);
  const [mbMod,      setMbMod]      = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // 1. CARGAMOS DATOS DEL PROYECTO
  const { data: projectData, isLoading: isLoadingProject } = useQuery({
    queryKey: ['project', id],
    queryFn:  async () => {
      const { data: pData, error: pError } = await supabase.from('projects').select('*').eq('id', id).single();
      if (pError) throw pError;
      
      const { data: tData } = await supabase.from('tasks').select('*').eq('project_id', id);
      const { data: mData } = await supabase.from('project_members').select('*, users(*)').eq('project_id', id);
      
      return {
        ...pData,
        tasks: tData || [],
        members: (mData || []).map(m => ({
          id: m.users.id,
          name: m.users.name,
          role: m.users.role,
          project_role: m.project_role,
          specialty: m.users.specialty
        }))
      };
    },
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ['users'],
    queryFn:  async () => {
      const { data } = await supabase.from('users').select('*');
      return data || [];
    },
  });

  // MUTACIONES (Tareas y Equipo)
  const saveTask = useMutation({
    mutationFn: async (d) => {
      if (taskForm.id) {
        const { error } = await supabase.from('tasks').update(d).eq('id', taskForm.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('tasks').insert([d]);
        if (error) throw error;
      }
    },
    onSuccess:  () => { qc.invalidateQueries(['project', id]); setTaskMod(false); },
  });

  const delTaskMut = useMutation({
    mutationFn: async (tid) => {
      const { error } = await supabase.from('tasks').delete().eq('id', tid);
      if(error) throw error;
    },
    onSuccess:  () => { qc.invalidateQueries(['project', id]); setDelTask(null); },
  });

  const moveTask = useMutation({
    mutationFn: async ({ tid, sw, ew }) => {
      const { error } = await supabase.from('tasks').update({ start_week: sw, end_week: ew }).eq('id', tid);
      if(error) throw error;
    },
    onSuccess:  () => qc.invalidateQueries(['project', id]),
  });

  const addMember = useMutation({
    mutationFn: async (d) => {
      const { error } = await supabase.from('project_members').insert([{ project_id: id, ...d }]);
      if (error) throw error;
    },
    onSuccess:  () => { qc.invalidateQueries(['project', id]); setMbMod(false); },
  });

  const removeMember = useMutation({
    mutationFn: async (uid) => {
      const { error } = await supabase.from('project_members').delete().eq('project_id', id).eq('user_id', uid);
      if (error) throw error;
    },
    onSuccess:  () => qc.invalidateQueries(['project', id]),
  });

  // =======================================================================
  // NUEVA FUNCIÓN PARA EXPORTAR GANTT A PDF CORPORATIVO
  // =======================================================================
  const exportGanttToPDF = async () => {
    setIsExporting(true);
    try {
      const doc = new jsPDF('landscape');
      const azulICAA = [45, 79, 160]; 
      const azulGanttBarra = [74, 127, 212]; 
      const totalWeeks = projectData.duration_weeks || 12;

      // 1. Ordenar tareas cronológicamente
      const sortedTasks = [...(projectData.tasks || [])].sort((a, b) => {
        if (a.start_week !== b.start_week) return a.start_week - b.start_week;
        return a.end_week - b.end_week;
      });

      // 2. Cargar Logo
      const logoImg = new Image();
      logoImg.src = '/icaa-logo.png';
      await new Promise((resolve) => {
        logoImg.onload = resolve;
        logoImg.onerror = resolve; 
      });

      // 3. Encabezado
      if (logoImg.width > 0) {
        doc.addImage(logoImg, 'PNG', 14, 10, 20, 20);
      }

      doc.setFontSize(18);
      doc.setTextColor(azulICAA[0], azulICAA[1], azulICAA[2]);
      doc.text("GRUPO ICAA CONSTRUCTORA", logoImg.width > 0 ? 38 : 14, 18);
      
      doc.setFontSize(12);
      doc.setTextColor(100, 116, 139); 
      doc.text("Cronograma de Obra (Diagrama Gantt)", logoImg.width > 0 ? 38 : 14, 24);
      
      doc.setFontSize(10);
      doc.text(`Proyecto: ${projectData.name} - Duración: ${totalWeeks} semanas`, logoImg.width > 0 ? 38 : 14, 29);

      const fechaActual = new Date().toLocaleDateString('es-CR', { year: 'numeric', month: 'long', day: 'numeric' });
      doc.text(`Generado: ${fechaActual}`, 240, 29); 

      // 4. Configurar Columnas
      const colHeaders = ["TAREA"]; 
      for (let i = 1; i <= totalWeeks; i++) colHeaders.push(`S${i}`);
      const head = [colHeaders];

      // 5. Configurar Filas
      const body = sortedTasks.map(task => {
        const row = [task.name]; 
        for (let i = 1; i <= totalWeeks; i++) row.push(""); 
        return row;
      });

      // 6. Dibujar la Tabla y las Barras
      autoTable(doc, {
        head: head,
        body: body,
        startY: 35, 
        theme: 'plain', 
        styles: { 
          fontSize: 6, // Letra pequeña para que quepan muchas semanas
          cellPadding: 1,
          lineColor: [226, 232, 240], 
          lineWidth: 0.1,
        },
        headStyles: { 
          fillColor: [248, 250, 252], 
          textColor: [100, 116, 139], 
          fontStyle: 'bold',
          halign: 'center' 
        },
        columnStyles: {
          0: { cellWidth: 50, fontStyle: 'bold', textColor: [51, 65, 85], halign: 'left' } 
        },
        // MAGIA: Pintar las celdas para hacer las barras
        didDrawCell: function (data) {
          if (data.section === 'body' && data.column.index > 0) {
            const taskData = sortedTasks[data.row.index];
            const currentWeekColumn = data.column.index; 

            if (currentWeekColumn >= taskData.start_week && currentWeekColumn <= taskData.end_week) {
              const paddingVertical = data.cell.height * 0.2; 
              // Quitamos el padding horizontal para que las semanas se unan visualmente como una sola barra
              const paddingHorizontal = 0; 

              const barX = data.cell.x + paddingHorizontal;
              const barY = data.cell.y + paddingVertical;
              const barWidth = data.cell.width - (paddingHorizontal * 2);
              const barHeight = data.cell.height - (paddingVertical * 2);

              // Dibujar barra clara (Semana completa)
              doc.setFillColor(azulGanttBarra[0], azulGanttBarra[1], azulGanttBarra[2]);
              doc.rect(barX, barY, barWidth, barHeight, 'F'); 

              // Dibujar barra oscura (Progreso real sobre esa semana)
              if (taskData.progress > 0) {
                const progressWidth = barWidth * (taskData.progress / 100);
                doc.setFillColor(azulICAA[0], azulICAA[1], azulICAA[2]); 
                doc.rect(barX, barY, progressWidth, barHeight, 'F');
              }
            }
          }
        },
        didDrawPage: function (data) {
          doc.setFontSize(8);
          doc.setTextColor(150);
          doc.text(`Página ${doc.internal.getNumberOfPages()}`, data.settings.margin.left, doc.internal.pageSize.height - 10);
          doc.text("Grupo ICAA Constructora - Confidencial", 200, doc.internal.pageSize.height - 10);
        }
      });

      doc.save(`Gantt_${projectData.name.replace(/\s+/g, '_')}_ICAA.pdf`);
    } catch (error) {
      alert("Hubo un error al generar el PDF del Gantt.");
      console.error(error);
    } finally {
      setIsExporting(false);
    }
  };

  if (isLoadingProject) return <Spinner/>;
  if (!projectData)  return <div className="text-slate-400 p-8">Proyecto no encontrado.</div>;

  const totalWeeks = projectData.duration_weeks || 12;

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
          <h1 className="page-title">{projectData.name}</h1>
          <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-slate-500">
            {projectData.client   && <span className="flex items-center gap-1"><MapPin size={10}/>{projectData.client}</span>}
            {projectData.location && <span className="flex items-center gap-1"><MapPin size={10}/>{projectData.location}</span>}
            {projectData.start_date && <span className="flex items-center gap-1"><Calendar size={10}/>{format(new Date(projectData.start_date),'dd/MM/yyyy')}</span>}
            <span className="flex items-center gap-1"><Clock size={10}/>{totalWeeks} semanas</span>
            {projectData.budget > 0 && <span className="flex items-center gap-1"><DollarSign size={10}/>Presupuesto: ${Number(projectData.budget).toLocaleString()}</span>}
          </div>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <Badge status={projectData.status}/>
          <div className="w-28"><Progress value={projectData.progress || 0} size="sm"/></div>
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
          <div className="flex items-center justify-between mb-4">
            <h3 className="section-title text-sm">
              Diagrama Gantt · {totalWeeks} semanas ·{' '}
              {projectData.start_date && format(new Date(projectData.start_date), 'dd/MM/yyyy')}
            </h3>
            <div className="flex gap-2">
              <button 
                className="btn-ghost border border-red-600/30 text-red-400 hover:bg-red-500/10" 
                onClick={exportGanttToPDF}
                disabled={isExporting}
              >
                {isExporting ? <Spinner size="sm" /> : <Download size={14} className="mr-1"/>}
                {isExporting ? 'Generando...' : 'Descargar PDF'}
              </button>
              <button className="btn-primary" onClick={openNewTask}><Plus size={14}/>Nueva Tarea</button>
            </div>
          </div>
          
          <div className="p-2 rounded-xl bg-surface-900">
            <h2 className="text-white font-display font-bold text-lg mb-2 pl-2 border-l-4 border-brand-500">
              Cronograma: {projectData.name}
            </h2>
            <GanttChart
              project={projectData}
              tasks={projectData.tasks || []}
              onEditTask={openEditTask}
              onDeleteTask={t => setDelTask(t)}
              onMoveTask={(tid, sw, ew) => moveTask.mutate({ tid, sw, ew })}
            />
          </div>
        </div>
      )}

      {/* ── TASKS ─────────────────────────────────────────── */}
      {tab === 'Tareas' && (
        <div className="table-wrap">
          <div className="flex items-center justify-between px-5 py-4 border-b border-surface-600 bg-surface-700">
            <h3 className="section-title text-sm">Tareas ({projectData.tasks?.length || 0})</h3>
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
              {([...(projectData.tasks || [])].sort((a,b) => {
                  if (a.start_week !== b.start_week) return a.start_week - b.start_week;
                  return a.end_week - b.end_week;
                })).map(t => {
                const assignedUser = allUsers.find(u => u.id === t.assigned_to);
                return (
                  <tr key={t.id} className="tr-hover">
                    <td className="td font-medium text-slate-200">{t.name}</td>
                    <td className="td text-slate-400">{assignedUser ? assignedUser.name : '—'}</td>
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
                );
              })}
              {!projectData.tasks?.length && (
                <tr><td colSpan={7} className="td text-center text-slate-500 py-10">Sin tareas</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── EQUIPO E INFORMACIÓN ── */}
      {tab === 'Equipo' && (
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="section-title text-sm">Equipo del Proyecto</h3>
            <button className="btn-primary" onClick={() => setMbMod(true)}><Plus size={14}/>Agregar</button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {(projectData.members || []).map(m => (
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
            {!projectData.members?.length && (
              <p className="col-span-2 text-slate-500 text-sm text-center py-8">Sin miembros asignados</p>
            )}
          </div>
        </div>
      )}

      {tab === 'Información' && (
        <div className="card p-6">
          <h3 className="section-title text-sm mb-4">Información del Proyecto</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
            {[
              ['Cliente',       projectData.client],
              ['Ubicación',     projectData.location],
              ['Inicio',        projectData.start_date ? format(new Date(projectData.start_date),'dd/MM/yyyy') : null],
              ['Duración',      `${projectData.duration_weeks} semanas`],
              ['Estado',        projectData.status],
              ['Presupuesto',   projectData.budget ? `$${Number(projectData.budget).toLocaleString()}` : null],
              ['Progreso',      `${projectData.progress || 0}%`],
              ['Tareas',        projectData.tasks?.length ?? 0],
              ['Miembros',      projectData.members?.length ?? 0],
            ].map(([l, v]) => (
              <div key={l} className="bg-surface-700 rounded-lg p-3 border border-surface-600">
                <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">{l}</div>
                <div className="text-slate-200 font-semibold">{v || '—'}</div>
              </div>
            ))}
          </div>
          {projectData.description && (
            <div className="mt-3 bg-surface-700 rounded-lg p-3 border border-surface-600">
              <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Descripción</div>
              <div className="text-slate-200 text-sm leading-relaxed">{projectData.description}</div>
            </div>
          )}
        </div>
      )}

      {/* Modal Tareas */}
      <Modal open={taskMod} onClose={() => setTaskMod(false)}
        title={taskForm.id ? 'Editar Tarea' : 'Nueva Tarea'}>
        <form onSubmit={e => { 
          e.preventDefault(); 
          saveTask.mutate({ ...taskForm, project_id: id, assigned_to: taskForm.assigned_to || null }); 
        }}
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
            <button type="submit" className="btn-primary" disabled={saveTask.isPending}>
              {saveTask.isPending ? 'Guardando...' : (taskForm.id ? 'Actualizar' : 'Crear Tarea')}
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={mbMod} onClose={() => setMbMod(false)} title="Agregar Miembro" size="sm">
        <AddMemberForm
          allUsers={allUsers}
          existing={projectData.members || []}
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
