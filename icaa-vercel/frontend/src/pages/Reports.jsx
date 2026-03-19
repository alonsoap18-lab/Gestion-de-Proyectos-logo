// src/pages/Reports.jsx
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import api from '../lib/api';
import { Spinner, Progress, Badge } from '../components/ui';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend,
  LineChart, Line
} from 'recharts';
import { Download, BarChart3, CheckSquare, Users, FileSpreadsheet, Printer } from 'lucide-react';

const TIP = (p) => (
  <Tooltip {...p} contentStyle={{ background:'#1c2333', border:'1px solid #2d3a4f', borderRadius:8, color:'#e2e8f0', fontSize:12 }}/>
);

const TABS = [
  { id:'projects',  label:'Proyectos',  icon: BarChart3  },
  { id:'tasks',     label:'Tareas',     icon: CheckSquare },
  { id:'employees', label:'Empleados',  icon: Users       },
];

function exportCSV(filename, rows, cols) {
  const header = cols.map(c => `"${c.label}"`).join(',');
  const body   = rows.map(r => cols.map(c => `"${r[c.key]??''}"`).join(',')).join('\n');
  const blob   = new Blob([header + '\n' + body], { type: 'text/csv;charset=utf-8;' });
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: filename });
  a.click();
}

export default function Reports() {
  const [tab, setTab] = useState('projects');

  const { data: projects  = [], isLoading: lp } = useQuery({ queryKey:['projects'], queryFn: () => api.get('/projects').then(r => r.data) });
  const { data: tasks     = [], isLoading: lt } = useQuery({ queryKey:['tasks'],    queryFn: () => api.get('/tasks').then(r => r.data) });
  const { data: users     = [], isLoading: lu } = useQuery({ queryKey:['users'],    queryFn: () => api.get('/users').then(r => r.data) });
  const { data: machinery = [] }                = useQuery({ queryKey:['machinery'],queryFn: () => api.get('/machinery').then(r => r.data) });
  const { data: materials = [] }                = useQuery({ queryKey:['materials'],queryFn: () => api.get('/materials').then(r => r.data) });

  if (lp || lt || lu) return <Spinner/>;

  /* ── Chart data ─────────────────────────────────────── */
  const projBarData = projects.map(p => ({
    name:     p.name.length > 16 ? p.name.slice(0,16)+'…' : p.name,
    Progreso: p.progress || 0,
    Budget:   Math.round((p.budget || 0) / 1000),
  }));

  const taskPieData = [
    { name:'Pendientes',  value: tasks.filter(t => t.status==='Pending').length,     color:'#64748b' },
    { name:'Iniciadas',   value: tasks.filter(t => t.status==='Started').length,     color:'#3b82f6' },
    { name:'En Progreso', value: tasks.filter(t => t.status==='In Progress').length, color:'#f97316' },
    { name:'Completadas', value: tasks.filter(t => t.status==='Completed').length,   color:'#22c55e' },
  ].filter(d => d.value > 0);

  const empBarData = users.map(u => {
    const ut  = tasks.filter(t => t.assigned_to === u.id);
    const done = ut.filter(t => t.status === 'Completed').length;
    return { name: u.name.split(' ')[0], Asignadas: ut.length, Completadas: done };
  }).filter(d => d.Asignadas > 0).sort((a,b) => b.Asignadas - a.Asignadas);

  /* Totals */
  const totalBudget  = projects.reduce((s,p) => s + (p.budget||0), 0);
  const totalMatCost = materials.reduce((s,m) => s + (m.quantity * m.cost_per_unit), 0);
  const taskDoneRate = tasks.length ? Math.round((tasks.filter(t=>t.status==='Completed').length / tasks.length)*100) : 0;
  const avgProgress  = projects.length ? Math.round(projects.reduce((s,p) => s+(p.progress||0),0)/projects.length) : 0;

  /* Exports */
  const exportProjects  = () => exportCSV('proyectos_icaa.csv', projects, [
    {key:'name',label:'Proyecto'},{key:'client',label:'Cliente'},{key:'location',label:'Ubicación'},
    {key:'start_date',label:'Inicio'},{key:'duration_weeks',label:'Semanas'},
    {key:'status',label:'Estado'},{key:'progress',label:'Progreso %'},{key:'budget',label:'Presupuesto'},
  ]);
  const exportTasks     = () => exportCSV('tareas_icaa.csv', tasks, [
    {key:'name',label:'Tarea'},{key:'project_name',label:'Proyecto'},{key:'assigned_name',label:'Asignado'},
    {key:'start_week',label:'Sem.Inicio'},{key:'end_week',label:'Sem.Fin'},
    {key:'status',label:'Estado'},{key:'progress',label:'Progreso %'},{key:'priority',label:'Prioridad'},
  ]);
  const exportEmployees = () => exportCSV('empleados_icaa.csv', users, [
    {key:'name',label:'Nombre'},{key:'email',label:'Correo'},{key:'role',label:'Rol'},
    {key:'position',label:'Cargo'},{key:'specialty',label:'Especialidad'},{key:'phone',label:'Teléfono'},
  ]);
  const exportMaterials = () => exportCSV('materiales_icaa.csv', materials, [
    {key:'name',label:'Material'},{key:'project_name',label:'Proyecto'},{key:'quantity',label:'Cantidad'},
    {key:'unit',label:'Unidad'},{key:'used_quantity',label:'Usado'},{key:'cost_per_unit',label:'Costo/U'},
    {key:'supplier',label:'Proveedor'},
  ]);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Reportes</h1>
          <p className="text-slate-400 text-sm mt-0.5">Análisis y exportación de datos</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button className="btn-ghost text-xs" onClick={exportProjects}><FileSpreadsheet size={13}/>Proyectos CSV</button>
          <button className="btn-ghost text-xs" onClick={exportTasks}><FileSpreadsheet size={13}/>Tareas CSV</button>
          <button className="btn-ghost text-xs" onClick={exportEmployees}><FileSpreadsheet size={13}/>Empleados CSV</button>
          <button className="btn-ghost text-xs" onClick={exportMaterials}><FileSpreadsheet size={13}/>Materiales CSV</button>
          <button className="btn-ghost text-xs" onClick={() => window.print()}><Printer size={13}/>Imprimir</button>
        </div>
      </div>

      {/* Summary KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          ['Presupuesto Total', `$${(totalBudget/1000).toFixed(0)}K`, 'text-green-400'],
          ['Avance Promedio',   `${avgProgress}%`,                    'text-brand-400'],
          ['Eficiencia Tareas', `${taskDoneRate}%`,                   'text-blue-400'],
          ['Costo Materiales',  `$${(totalMatCost/1000).toFixed(0)}K','text-yellow-400'],
        ].map(([l, v, c]) => (
          <div key={l} className="card p-4 text-center">
            <div className={`text-3xl font-display font-black ${c}`}>{v}</div>
            <div className="text-[10px] text-slate-500 uppercase tracking-wider mt-0.5">{l}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-surface-800 border border-surface-600 rounded-xl p-1 w-fit mb-6">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all
              ${tab===id ? 'bg-brand-500 text-white' : 'text-slate-400 hover:text-white'}`}>
            <Icon size={14}/> {label}
          </button>
        ))}
      </div>

      {/* ── PROJECTS TAB ──────────────────────────────── */}
      {tab === 'projects' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
            {/* Bar chart */}
            <div className="card p-5 lg:col-span-3">
              <h3 className="section-title text-sm mb-4">Progreso por Proyecto</h3>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={projBarData} margin={{ bottom:50, left:-20, right:10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#232d3f"/>
                  <XAxis dataKey="name" tick={{ fill:'#64748b', fontSize:10 }} angle={-35} textAnchor="end" interval={0}/>
                  <YAxis tick={{ fill:'#64748b', fontSize:11 }} domain={[0,100]}/>
                  <TIP formatter={v => [`${v}%`, 'Progreso']}/>
                  <Bar dataKey="Progreso" fill="#f97316" radius={[4,4,0,0]}/>
                </BarChart>
              </ResponsiveContainer>
            </div>
            {/* Status pie */}
            <div className="card p-5 lg:col-span-2">
              <h3 className="section-title text-sm mb-4">Estado de Proyectos</h3>
              {(() => {
                const statuses = ['Planning','Active','Delayed','Completed'];
                const colors   = { Planning:'#3b82f6', Active:'#22c55e', Delayed:'#ef4444', Completed:'#64748b' };
                const pd = statuses.map(s => ({ name:s, value: projects.filter(p=>p.status===s).length, color:colors[s] })).filter(d=>d.value>0);
                return (
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={pd} cx="50%" cy="45%" innerRadius={50} outerRadius={75} paddingAngle={3} dataKey="value">
                        {pd.map((d,i) => <Cell key={i} fill={d.color}/>)}
                      </Pie>
                      <TIP/>
                      <Legend wrapperStyle={{ fontSize:11, color:'#94a3b8' }}/>
                    </PieChart>
                  </ResponsiveContainer>
                );
              })()}
            </div>
          </div>

          {/* Projects detail table */}
          <div className="table-wrap">
            <div className="flex items-center px-5 py-3 bg-surface-700 border-b border-surface-600">
              <h3 className="section-title text-sm">Detalle de Proyectos</h3>
              <span className="ml-auto text-xs text-slate-500">{projects.length} proyecto(s)</span>
            </div>
            <table className="w-full">
              <thead>
                <tr>
                  <th className="th">Proyecto</th>
                  <th className="th">Cliente</th>
                  <th className="th">Inicio</th>
                  <th className="th text-center">Semanas</th>
                  <th className="th text-right">Presupuesto</th>
                  <th className="th text-center">Estado</th>
                  <th className="th text-center w-28">Progreso</th>
                </tr>
              </thead>
              <tbody>
                {projects.map(p => (
                  <tr key={p.id} className="tr-hover">
                    <td className="td font-semibold text-slate-200">{p.name}</td>
                    <td className="td text-slate-400">{p.client || '—'}</td>
                    <td className="td text-slate-400 text-xs">{p.start_date ? format(new Date(p.start_date),'dd/MM/yyyy') : '—'}</td>
                    <td className="td text-center font-mono text-slate-400">{p.duration_weeks}</td>
                    <td className="td text-right font-mono text-slate-300">${Number(p.budget||0).toLocaleString()}</td>
                    <td className="td text-center"><Badge status={p.status}/></td>
                    <td className="td">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-surface-600 rounded-full h-1.5 overflow-hidden">
                          <div className={`h-full rounded-full ${p.progress>=80?'bg-green-500':p.progress>=40?'bg-brand-500':'bg-blue-500'}`}
                            style={{ width:`${p.progress}%` }}/>
                        </div>
                        <span className="text-xs font-mono text-slate-400 w-8 text-right">{p.progress}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TASKS TAB ─────────────────────────────────── */}
      {tab === 'tasks' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="card p-5">
              <h3 className="section-title text-sm mb-4">Distribución por Estado</h3>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={taskPieData} cx="50%" cy="50%" innerRadius={58} outerRadius={88} paddingAngle={3} dataKey="value">
                    {taskPieData.map((d,i) => <Cell key={i} fill={d.color}/>)}
                  </Pie>
                  <TIP/>
                  <Legend wrapperStyle={{ fontSize:11, color:'#94a3b8', paddingTop:8 }}/>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="card p-5">
              <h3 className="section-title text-sm mb-4">Estadísticas</h3>
              <div className="space-y-2">
                {[
                  ['Total de tareas',      tasks.length,                                        'text-white'],
                  ['Completadas',          tasks.filter(t=>t.status==='Completed').length,       'text-green-400'],
                  ['En progreso',          tasks.filter(t=>t.status==='In Progress').length,     'text-brand-400'],
                  ['Pendientes',           tasks.filter(t=>t.status==='Pending').length,         'text-slate-400'],
                  ['Alta prioridad',       tasks.filter(t=>t.priority==='High').length,          'text-red-400'],
                  ['Sin asignar',          tasks.filter(t=>!t.assigned_to).length,               'text-yellow-400'],
                  ['Tasa de completitud',  `${taskDoneRate}%`,                                   'text-blue-400'],
                ].map(([l, v, c]) => (
                  <div key={l} className="flex items-center justify-between p-3 bg-surface-700 rounded-lg border border-surface-600">
                    <span className="text-slate-400 text-sm">{l}</span>
                    <span className={`font-display font-black text-lg ${c}`}>{v}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="table-wrap">
            <div className="flex items-center px-5 py-3 bg-surface-700 border-b border-surface-600">
              <h3 className="section-title text-sm">Detalle de Tareas</h3>
              <span className="ml-auto text-xs text-slate-500">{tasks.length} tarea(s)</span>
            </div>
            <table className="w-full">
              <thead>
                <tr>
                  <th className="th">Tarea</th>
                  <th className="th">Proyecto</th>
                  <th className="th">Asignado</th>
                  <th className="th text-center">Semanas</th>
                  <th className="th text-center">Estado</th>
                  <th className="th text-center">Progreso</th>
                  <th className="th text-center">Prioridad</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map(t => (
                  <tr key={t.id} className="tr-hover">
                    <td className="td font-medium text-slate-200">{t.name}</td>
                    <td className="td text-slate-400 text-xs">{t.project_name || '—'}</td>
                    <td className="td text-slate-400 text-xs">{t.assigned_name || '—'}</td>
                    <td className="td text-center font-mono text-xs text-slate-500">S{t.start_week}–S{t.end_week}</td>
                    <td className="td text-center"><Badge status={t.status}/></td>
                    <td className="td text-center font-mono font-bold text-sm
                      ${t.progress>=80?'text-green-400':t.progress>=40?'text-brand-400':'text-slate-400'}">{t.progress}%</td>
                    <td className="td text-center">
                      <span className={`text-xs font-semibold ${t.priority==='High'?'text-red-400':t.priority==='Low'?'text-slate-500':'text-yellow-400'}`}>
                        {t.priority}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── EMPLOYEES TAB ─────────────────────────────── */}
      {tab === 'employees' && (
        <div className="space-y-5">
          <div className="card p-5">
            <h3 className="section-title text-sm mb-4">Tareas Asignadas vs Completadas por Empleado</h3>
            {empBarData.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={empBarData} margin={{ left:-20, right:10, bottom:5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#232d3f"/>
                  <XAxis dataKey="name" tick={{ fill:'#64748b', fontSize:12 }}/>
                  <YAxis tick={{ fill:'#64748b', fontSize:11 }}/>
                  <TIP/>
                  <Bar dataKey="Asignadas"   fill="#f97316" radius={[4,4,0,0]}/>
                  <Bar dataKey="Completadas" fill="#22c55e" radius={[4,4,0,0]}/>
                  <Legend wrapperStyle={{ fontSize:11, color:'#94a3b8' }}/>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-40 text-slate-500 text-sm">Sin datos de asignaciones</div>
            )}
          </div>

          <div className="table-wrap">
            <div className="flex items-center px-5 py-3 bg-surface-700 border-b border-surface-600">
              <h3 className="section-title text-sm">Desempeño por Empleado</h3>
            </div>
            <table className="w-full">
              <thead>
                <tr>
                  <th className="th">Empleado</th>
                  <th className="th">Rol</th>
                  <th className="th">Especialidad</th>
                  <th className="th text-center">Total Tareas</th>
                  <th className="th text-center">Completadas</th>
                  <th className="th text-center">En Progreso</th>
                  <th className="th text-center">Efectividad</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => {
                  const ut    = tasks.filter(t => t.assigned_to === u.id);
                  const done  = ut.filter(t => t.status==='Completed').length;
                  const prog  = ut.filter(t => t.status==='In Progress').length;
                  const pct   = ut.length ? Math.round((done/ut.length)*100) : 0;
                  return (
                    <tr key={u.id} className="tr-hover">
                      <td className="td">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-brand-500/20 text-brand-400 font-bold text-xs flex items-center justify-center">
                            {u.name.charAt(0)}
                          </div>
                          <span className="font-medium text-slate-200">{u.name}</span>
                        </div>
                      </td>
                      <td className="td text-slate-400">{u.role}</td>
                      <td className="td text-slate-400 text-xs">{u.specialty || '—'}</td>
                      <td className="td text-center font-mono text-slate-300">{ut.length}</td>
                      <td className="td text-center font-mono text-green-400">{done}</td>
                      <td className="td text-center font-mono text-brand-400">{prog}</td>
                      <td className="td text-center">
                        <span className={`font-display font-black text-base ${pct>=80?'text-green-400':pct>=50?'text-brand-400':'text-slate-500'}`}>
                          {pct}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
