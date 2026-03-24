// src/pages/Reports.jsx
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { supabase } from '../lib/supabase';
import { Spinner, Badge } from '../components/ui';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, Legend } from 'recharts';
import { BarChart3, CheckSquare, Users, FileSpreadsheet, Printer } from 'lucide-react';

const TIP = (p) => (
  <Tooltip {...p} contentStyle={{ background:'#1c2333', border:'1px solid #2d3a4f', borderRadius:8, color:'#e2e8f0', fontSize:12 }}/>
);

const TABS = [
  { id:'projects',  label:'Proyectos',  icon: BarChart3   },
  { id:'tasks',     label:'Tareas',     icon: CheckSquare },
  { id:'employees', label:'Empleados',  icon: Users       },
];

function exportCSV(filename, rows, cols) {
  const header = cols.map(c => `"${c.label}"`).join(',');
  const body   = rows.map(r => cols.map(c => {
    let val = r[c.key];
    if (val === null || val === undefined) val = '';
    return `"${val}"`;
  }).join(',')).join('\n');
  const blob   = new Blob([header + '\n' + body], { type: 'text/csv;charset=utf-8;' });
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: filename });
  a.click();
}

export default function Reports() {
  const [tab, setTab] = useState('projects'); 

  const { data: projects = [], isLoading: lp } = useQuery({ 
    queryKey: ['projects'], 
    queryFn: async () => {
      const { data, error } = await supabase.from('projects').select('*');
      if (error) throw error; return data;
    } 
  });

  const { data: tasks = [], isLoading: lt } = useQuery({ 
    queryKey: ['tasks'],    
    queryFn: async () => {
      const { data, error } = await supabase.from('tasks').select('*, projects(name), users(name)');
      if (error) throw error; 
      return data.map(t => ({ ...t, project_name: t.projects?.name || '', assigned_name: t.users?.name || '' }));
    } 
  });

  const { data: users = [], isLoading: lu } = useQuery({ 
    queryKey: ['users'],    
    queryFn: async () => {
      const { data, error } = await supabase.from('users').select('*');
      if (error) throw error; return data;
    } 
  });

  const { data: materials = [], isLoading: lm } = useQuery({ 
    queryKey: ['materials'],
    queryFn: async () => {
      const { data, error } = await supabase.from('materials').select('*');
      if (error) throw error; return data;
    } 
  });

  if (lp || lt || lu || lm) return <Spinner/>;

  const totalBudget  = projects.reduce((s,p) => s + (Number(p.budget)||0), 0);
  const totalMatCost = materials.reduce((s,m) => s + (Number(m.quantity) * Number(m.cost_per_unit)), 0);
  const taskDoneRate = tasks.length ? Math.round((tasks.filter(t=>t.status==='Completed').length / tasks.length)*100) : 0;
  const avgProgress  = projects.length ? Math.round(projects.reduce((s,p) => s+(Number(p.progress)||0),0)/projects.length) : 0;

  // Funciones de Exportación
  const handleExportProjects = () => {
    exportCSV('reporte_proyectos.csv', projects, [
      { label: 'Nombre', key: 'name' },
      { label: 'Cliente', key: 'client' },
      { label: 'Ubicación', key: 'location' },
      { label: 'Estado', key: 'status' },
      { label: 'Progreso (%)', key: 'progress' },
      { label: 'Presupuesto', key: 'budget' }
    ]);
  };

  const handleExportTasks = () => {
    exportCSV('reporte_tareas.csv', tasks, [
      { label: 'Tarea', key: 'name' },
      { label: 'Proyecto', key: 'project_name' },
      { label: 'Asignado a', key: 'assigned_name' },
      { label: 'Estado', key: 'status' },
      { label: 'Progreso (%)', key: 'progress' },
      { label: 'Prioridad', key: 'priority' }
    ]);
  };

  const handleExportEmployees = () => {
    exportCSV('reporte_empleados.csv', users, [
      { label: 'Nombre', key: 'name' },
      { label: 'Correo', key: 'email' },
      { label: 'Rol', key: 'role' },
      { label: 'Cargo', key: 'position' },
      { label: 'Especialidad', key: 'specialty' },
      { label: 'Teléfono', key: 'phone' }
    ]);
  };

  return (
    <div>
      <div className="page-header flex justify-between items-center">
        <h1 className="page-title">Reportes</h1>
        <button className="btn-primary flex items-center gap-2" onClick={() => {
          if (tab === 'projects') handleExportProjects();
          if (tab === 'tasks') handleExportTasks();
          if (tab === 'employees') handleExportEmployees();
        }}>
          <FileSpreadsheet size={15}/> Exportar a CSV
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          ['Presupuesto Total', `$${(totalBudget/1000).toFixed(0)}K`, 'text-green-400'],
          ['Avance Promedio', `${avgProgress}%`, 'text-brand-400'],
          ['Eficiencia Tareas', `${taskDoneRate}%`, 'text-blue-400'],
          ['Costo Materiales', `$${(totalMatCost/1000).toFixed(0)}K`, 'text-yellow-400'],
        ].map(([l, v, c]) => (
          <div key={l} className="card p-4 text-center">
            <div className={`text-3xl font-display font-black ${c}`}>{v}</div>
            <div className="text-xs text-slate-500 mt-1">{l}</div>
          </div>
        ))}
      </div>

      {/* TABS */}
      <div className="flex gap-2 mb-6 bg-surface-800 border border-surface-600 rounded-xl p-1 w-fit">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)} 
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === id ? 'bg-brand-500 text-white' : 'text-slate-400 hover:text-white'}`}>
            <Icon size={14}/> {label}
          </button>
        ))}
      </div>

      {/* PROJECTS TAB */}
      {tab === 'projects' && (
        <div className="table-wrap">
          <table className="w-full">
            <thead>
              <tr>
                <th className="th">Proyecto</th>
                <th className="th">Cliente</th>
                <th className="th">Ubicación</th>
                <th className="th text-center">Progreso</th>
                <th className="th">Estado</th>
                <th className="th text-right">Presupuesto</th>
              </tr>
            </thead>
            <tbody>
              {projects.map(p => (
                <tr key={p.id} className="tr-hover">
                  <td className="td font-medium text-slate-200">{p.name}</td>
                  <td className="td text-slate-400 text-xs">{p.client || '—'}</td>
                  <td className="td text-slate-400 text-xs">{p.location || '—'}</td>
                  <td className={`td text-center font-bold font-mono text-xs ${p.progress >= 80 ? 'text-green-400' : p.progress >= 40 ? 'text-brand-400' : 'text-slate-400'}`}>
                    {p.progress || 0}%
                  </td>
                  <td className="td"><Badge status={p.status}/></td>
                  <td className="td text-right font-mono text-slate-300">
                    ${Number(p.budget || 0).toLocaleString()}
                  </td>
                </tr>
              ))}
              {projects.length === 0 && (
                <tr><td colSpan={6} className="td text-center text-slate-500 py-10">Sin proyectos registrados</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* TASKS TAB */}
      {tab === 'tasks' && (
        <div className="table-wrap">
          <table className="w-full">
            <thead>
              <tr>
                <th className="th">Tarea</th>
                <th className="th">Proyecto</th>
                <th className="th">Asignado</th>
                <th className="th">Semanas</th>
                <th className="th">Estado</th>
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
                  <td className="td text-slate-500 font-mono text-xs">S{t.start_week}–S{t.end_week}</td>
                  <td className="td">
                    <Badge status={t.status}/>
                  </td>
                  <td className={`td text-center font-bold font-mono text-xs ${t.progress >= 80 ? 'text-green-400' : t.progress >= 40 ? 'text-brand-400' : 'text-slate-400'}`}>
                    {t.progress}%
                  </td>
                  <td className="td text-center">
                    <span className={`text-xs font-semibold ${t.priority === 'High' ? 'text-red-400' : t.priority === 'Low' ? 'text-slate-500' : 'text-yellow-400'}`}>
                      {t.priority}
                    </span>
                  </td>
                </tr>
              ))}
              {tasks.length === 0 && (
                <tr><td colSpan={7} className="td text-center text-slate-500 py-10">Sin tareas registradas</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* EMPLOYEES TAB */}
      {tab === 'employees' && (
        <div className="table-wrap">
          <table className="w-full">
            <thead>
              <tr>
                <th className="th">Nombre</th>
                <th className="th">Correo</th>
                <th className="th">Rol</th>
                <th className="th">Cargo</th>
                <th className="th">Especialidad</th>
                <th className="th">Teléfono</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} className="tr-hover">
                  <td className="td font-medium text-slate-200">{u.name}</td>
                  <td className="td text-slate-400 text-xs">{u.email}</td>
                  <td className="td text-slate-400 text-xs font-semibold">{u.role}</td>
                  <td className="td text-slate-400 text-xs">{u.position || '—'}</td>
                  <td className="td text-slate-400 text-xs">{u.specialty || '—'}</td>
                  <td className="td text-slate-500 font-mono text-xs">{u.phone || '—'}</td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr><td colSpan={6} className="td text-center text-slate-500 py-10">Sin empleados registrados</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

    </div>
  );
}
