// src/pages/Reports.jsx
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
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
  const body   = rows.map(r => cols.map(c => `"${r[c.key]??''}"`).join(',')).join('\n');
  const blob   = new Blob([header + '\n' + body], { type: 'text/csv;charset=utf-8;' });
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: filename });
  a.click();
}

export default function Reports() {
  const [tab, setTab] = useState('tasks'); // Cambiado a 'tasks' por defecto para que se vea la tabla

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

  return (
    <div>
      {/* HEADER */}
      <div className="page-header">
        <h1 className="page-title">Reportes</h1>
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

      {/* PLACEHOLDERS PARA OTRAS TABS */}
      {tab === 'projects' && (
        <div className="card p-8 text-center text-slate-500">
          Módulo de gráficos de proyectos en construcción.
        </div>
      )}
      
      {tab === 'employees' && (
        <div className="card p-8 text-center text-slate-500">
          Módulo de rendimiento de empleados en construcción.
        </div>
      )}

    </div>
  );
}
