// src/pages/Reports.jsx
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { supabase } from '../lib/supabase'; // Conexión real
import { Spinner, Badge, Progress } from '../components/ui';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { BarChart3, CheckSquare, Users, Download } from 'lucide-react';

const TIP = (p) => (
  <Tooltip {...p} contentStyle={{ background:'#1c2333', border:'1px solid #2d3a4f', borderRadius:8, color:'#e2e8f0', fontSize:12 }}/>
);

const TABS = [
  { id:'projects',  label:'Proyectos',  icon: BarChart3  },
  { id:'tasks',     label:'Tareas',     icon: CheckSquare },
  { id:'employees', label:'Empleados',  icon: Users       },
];

const TASK_COLORS = { Pending:'#64748b', Started:'#4a7fd4', 'In Progress':'#f97316', Completed:'#22c55e' };

// Función para exportar a Excel (CSV)
function exportCSV(filename, rows, cols) {
  const header = cols.map(c => `"${c.label}"`).join(',');
  const body   = rows.map(r => cols.map(c => `"${r[c.key]??''}"`).join(',')).join('\n');
  const blob   = new Blob([header + '\n' + body], { type: 'text/csv;charset=utf-8;' });
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: filename });
  a.click();
}

export default function Reports() {
  const [tab, setTab] = useState('projects');

  // 1. LEER DATOS DIRECTO DE SUPABASE
  const { data: projects  = [], isLoading: lp } = useQuery({ queryKey:['projects'], queryFn: async () => { const { data } = await supabase.from('projects').select('*'); return data || []; } });
  const { data: tasks     = [], isLoading: lt } = useQuery({ queryKey:['tasks'],    queryFn: async () => { const { data } = await supabase.from('tasks').select('*'); return data || []; } });
  const { data: users     = [], isLoading: lu } = useQuery({ queryKey:['users'],    queryFn: async () => { const { data } = await supabase.from('users').select('*'); return data || []; } });
  const { data: materials = [], isLoading: lm } = useQuery({ queryKey:['materials'],queryFn: async () => { const { data } = await supabase.from('materials').select('*'); return data || []; } });

  if (lp || lt || lu || lm) return <Spinner/>;

  // 2. CÁLCULOS MATEMÁTICOS PARA KPIs
  const totalBudget  = projects.reduce((s,p) => s + (Number(p.budget)||0), 0);
  const totalMatCost = materials.reduce((s,m) => s + ((Number(m.quantity)||0) * (Number(m.cost_per_unit)||0)), 0);
  const taskDoneRate = tasks.length ? Math.round((tasks.filter(t=>t.status==='Completed').length / tasks.length)*100) : 0;
  const avgProgress  = projects.length ? Math.round(projects.reduce((s,p) => s+(Number(p.progress)||0),0)/projects.length) : 0;

  // 3. PROCESAR DATOS PARA GRÁFICAS Y TABLAS
  const barData = projects.map(p => ({
    name: p.name.length > 15 ? p.name.substring(0,15) + '...' : p.name,
    Progreso: p.progress || 0
  }));

  const taskPieData = [
    { name:'Pendientes',  value: tasks.filter(t=>t.status==='Pending').length,    color: TASK_COLORS.Pending },
    { name:'Iniciadas',   value: tasks.filter(t=>t.status==='Started').length,    color: TASK_COLORS.Started },
    { name:'En Progreso', value: tasks.filter(t=>t.status==='In Progress').length,color: TASK_COLORS['In Progress'] },
    { name:'Completadas', value: tasks.filter(t=>t.status==='Completed').length,  color: TASK_COLORS.Completed },
  ].filter(d => d.value > 0);

  // Cruzar datos de tareas con proyectos y usuarios
  const enrichedTasks = tasks.map(t => {
    const p = projects.find(proj => proj.id === t.project_id);
    const u = users.find(user => user.id === t.assigned_to);
    return { ...t, project_name: p ? p.name : '—', assigned_name: u ? u.name : '—' };
  });

  return (
    <div>
      {/* HEADER */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Reportes y Estadísticas</h1>
          <p className="text-slate-400 text-sm mt-0.5">Métricas generales del sistema</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          ['Presupuesto Total', `$${(totalBudget/1000).toFixed(1)}K`, 'text-green-400'],
          ['Avance Promedio', `${avgProgress}%`, 'text-brand-400'],
          ['Eficiencia Tareas', `${taskDoneRate}%`, 'text-blue-400'],
          ['Costo Materiales', `$${(totalMatCost/1000).toFixed(1)}K`, 'text-yellow-400'],
        ].map(([l, v, c]) => (
          <div key={l} className="card p-4 text-center">
            <div className={`text-3xl font-display font-black ${c}`}>{v}</div>
            <div className="text-xs text-slate-500 mt-1">{l}</div>
          </div>
        ))}
      </div>

      {/* TABS */}
      <div className="flex gap-2 mb-6 border-b border-surface-600 pb-2">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm transition-all
              ${tab === id ? 'bg-brand-500 text-white' : 'text-slate-400 hover:bg-surface-700'}`}>
            <Icon size={16}/> {label}
          </button>
        ))}
      </div>

      {/* PROJECTS TAB */}
      {tab === 'projects' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="card p-5">
              <h3 className="section-title text-sm mb-4">Progreso por Proyecto</h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={barData} margin={{ bottom: 20 }}>
                  <XAxis dataKey="name" tick={{ fill:'#64748b', fontSize:10 }} angle={-25} textAnchor="end"/>
                  <YAxis tick={{ fill:'#64748b', fontSize:11 }} domain={[0,100]}/>
                  <TIP formatter={v => [`${v}%`, 'Progreso']}/>
                  <Bar dataKey="Progreso" fill="#4a7fd4" radius={[4,4,0,0]}/>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="card p-5">
              <h3 className="section-title text-sm mb-4">Estado General de Tareas</h3>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={taskPieData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                    {taskPieData.map((d, i) => <Cell key={i} fill={d.color}/>)}
                  </Pie>
                  <TIP/>
                  <Legend wrapperStyle={{ fontSize:12, color:'#94a3b8' }}/>
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="flex justify-end">
            <button className="btn-ghost text-xs flex items-center gap-2" 
              onClick={() => exportCSV('proyectos.csv', projects, [
                {label:'Nombre', key:'name'}, {label:'Cliente', key:'client'}, {label:'Estado', key:'status'}, {label:'Progreso', key:'progress'}, {label:'Presupuesto', key:'budget'}
              ])}>
              <Download size={14}/> Exportar Proyectos CSV
            </button>
          </div>
        </div>
      )}

      {/* TASKS TAB */}
      {tab === 'tasks' && (
        <div className="space-y-4">
          <div className="flex justify-end mb-2">
            <button className="btn-ghost text-xs flex items-center gap-2" 
              onClick={() => exportCSV('tareas.csv', enrichedTasks, [
                {label:'Tarea', key:'name'}, {label:'Proyecto', key:'project_name'}, {label:'Asignado', key:'assigned_name'}, {label:'Estado', key:'status'}, {label:'Prioridad', key:'priority'}
              ])}>
              <Download size={14}/> Exportar Tareas CSV
            </button>
          </div>
          <div className="table-wrap">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="th">Tarea</th>
                  <th className="th">Proyecto</th>
                  <th className="th">Asignado</th>
                  <th className="th">Semanas</th>
                  <th className="th">Estado</th>
                  <th className="th">Progreso</th>
                  <th className="th">Prioridad</th>
                </tr>
              </thead>
              <tbody>
                {enrichedTasks.map(t => (
                  <tr key={t.id} className="tr-hover">
                    <td className="td font-semibold text-slate-200">{t.name}</td>
                    <td className="td text-slate-400 text-xs">{t.project_name}</td>
                    <td className="td text-slate-400 text-xs">{t.assigned_name}</td>
                    <td className="td text-xs text-slate-500 font-mono">S{t.start_week}–S{t.end_week}</td>
                    <td className="td"><Badge status={t.status}/></td>
                    <td className="td">
                      <Progress value={t.progress || 0} size="sm"/>
                    </td>
                    <td className="td">
                      <span className={`text-xs font-semibold ${t.priority==='High'?'text-red-400':t.priority==='Low'?'text-slate-500':'text-yellow-400'}`}>
                        {t.priority}
                      </span>
                    </td>
                  </tr>
                ))}
                {enrichedTasks.length === 0 && <tr><td colSpan={7} className="td text-center text-slate-500 py-6">Sin tareas</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* EMPLOYEES TAB */}
      {tab === 'employees' && (
        <div className="space-y-4">
          <div className="flex justify-end mb-2">
            <button className="btn-ghost text-xs flex items-center gap-2" 
              onClick={() => exportCSV('empleados.csv', users, [
                {label:'Nombre', key:'name'}, {label:'Email', key:'email'}, {label:'Rol', key:'role'}
              ])}>
              <Download size={14}/> Exportar Empleados CSV
            </button>
          </div>
          <div className="table-wrap">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="th">Nombre</th>
                  <th className="th">Correo Electrónico</th>
                  <th className="th">Rol</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} className="tr-hover">
                    <td className="td font-semibold text-slate-200">{u.name}</td>
                    <td className="td text-slate-400">{u.email}</td>
                    <td className="td">
                      <span className="px-2 py-1 rounded bg-surface-600 text-slate-300 text-xs font-semibold tracking-wider uppercase">
                        {u.role}
                      </span>
                    </td>
                  </tr>
                ))}
                {users.length === 0 && <tr><td colSpan={3} className="td text-center text-slate-500 py-6">Sin empleados</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
}
