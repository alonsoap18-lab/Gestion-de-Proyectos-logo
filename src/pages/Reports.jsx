// src/pages/Reports.jsx
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import api from '../lib/api';
import { Spinner, Badge } from '../components/ui';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { BarChart3, CheckSquare, Users, FileSpreadsheet, Printer } from 'lucide-react';

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
  const { data: materials = [] }                = useQuery({ queryKey:['materials'],queryFn: () => api.get('/materials').then(r => r.data) });

  if (lp || lt || lu) return <Spinner/>;

  const totalBudget  = projects.reduce((s,p) => s + (p.budget||0), 0);
  const totalMatCost = materials.reduce((s,m) => s + (m.quantity * m.cost_per_unit), 0);
  const taskDoneRate = tasks.length ? Math.round((tasks.filter(t=>t.status==='Completed').length / tasks.length)*100) : 0;
  const avgProgress  = projects.length ? Math.round(projects.reduce((s,p) => s+(p.progress||0),0)/projects.length) : 0;

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
      <div className="flex gap-2 mb-6">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)}>
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
                <th>Tarea</th>
                <th>Proyecto</th>
                <th>Asignado</th>
                <th>Semanas</th>
                <th>Estado</th>
                <th>Progreso</th>
                <th>Prioridad</th>
              </tr>
            </thead>

            {/* 🔥 BLOQUE CORREGIDO */}
            <tbody>
              {tasks.map(t => (
                <tr key={t.id}>
                  <td>{t.name}</td>
                  <td>{t.project_name || '—'}</td>
                  <td>{t.assigned_name || '—'}</td>
                  <td>S{t.start_week}–S{t.end_week}</td>

                  <td>
                    <Badge status={t.status}/>
                  </td>

                  <td
                    className={`font-bold ${
                      t.progress >= 80
                        ? 'text-green-400'
                        : t.progress >= 40
                        ? 'text-brand-400'
                        : 'text-slate-400'
                    }`}
                  >
                    {t.progress}%
                  </td>

                  <td>
                    <span
                      className={
                        t.priority === 'High'
                          ? 'text-red-400'
                          : t.priority === 'Low'
                          ? 'text-slate-500'
                          : 'text-yellow-400'
                      }
                    >
                      {t.priority}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>

          </table>
        </div>
      )}

    </div>
  );
}
