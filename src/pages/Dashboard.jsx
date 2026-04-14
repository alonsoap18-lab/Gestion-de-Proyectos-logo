// src/pages/Dashboard.jsx
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Progress, Badge, Spinner } from '../components/ui';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import {
  FolderKanban, CheckSquare, Clock, AlertTriangle,
  TrendingUp, Users, Wrench, ChevronRight
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const TIP = (p) => (
  <Tooltip {...p} contentStyle={{ background:'#1c2333', border:'1px solid #2d3a4f', borderRadius:8, color:'#e2e8f0', fontSize:12 }}/>
);

const TASK_COLORS  = {
  Pending:       '#64748b',
  Started:       '#4a7fd4',
  'In Progress': '#f97316',
  Completed:     '#22c55e',
};

function StatCard({ icon: Icon, label, value, color, sub }) {
  const styles = {
    blue:   { bg:'rgba(45,79,160,0.15)',  text:'#4a7fd4',  border:'rgba(45,79,160,0.3)' },
    green:  { bg:'rgba(34,197,94,0.12)',  text:'#4ade80',  border:'rgba(34,197,94,0.25)' },
    red:    { bg:'rgba(239,68,68,0.12)',  text:'#f87171',  border:'rgba(239,68,68,0.25)' },
    yellow: { bg:'rgba(234,179,8,0.12)',  text:'#facc15',  border:'rgba(234,179,8,0.25)' },
    gray:   { bg:'rgba(100,116,139,0.15)',text:'#94a3b8',  border:'rgba(100,116,139,0.25)' },
    orange: { bg:'rgba(249,115,22,0.12)', text:'#fb923c',  border:'rgba(249,115,22,0.25)' },
  };
  const s = styles[color] || styles.blue;
  return (
    <div className="card p-4 flex items-start gap-3">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: s.bg, border: `1px solid ${s.border}` }}>
        <Icon size={19} style={{ color: s.text }}/>
      </div>
      <div>
        <div className="text-2xl font-display font-bold text-white leading-none">{value}</div>
        <div className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold mt-0.5">{label}</div>
        {sub && <div className="text-[11px] text-slate-500 mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  
  // Usamos useQuery individualmente para cada tabla para que el Tiempo Real las actualice por separado
  const { data: projectsData = [], isLoading: loadP } = useQuery({ queryKey: ['projects'],  queryFn: async () => { const { data } = await supabase.from('projects').select('*'); return data || []; }});
  const { data: tasksData = [],    isLoading: loadT } = useQuery({ queryKey: ['tasks'],     queryFn: async () => { const { data } = await supabase.from('tasks').select('*'); return data || []; }});
  const { data: usersData = [],    isLoading: loadU } = useQuery({ queryKey: ['users'],     queryFn: async () => { const { data } = await supabase.from('users').select('*'); return data || []; }});
  const { data: machineryData = [],isLoading: loadM } = useQuery({ queryKey: ['machinery'], queryFn: async () => { const { data } = await supabase.from('machinery').select('*'); return data || []; }});

  if (loadP || loadT || loadU || loadM) return <Spinner/>;

  // Cálculos reactivos basados en la información en vivo
  const projects = {
    total: projectsData.length,
    active: projectsData.filter(p => p.status === 'Active').length,
    planning: projectsData.filter(p => p.status === 'Planning').length,
    delayed: projectsData.filter(p => p.status === 'Delayed').length,
    completed: projectsData.filter(p => p.status === 'Completed').length,
  };

  const tasks = {
    total: tasksData.length,
    pending: tasksData.filter(t => t.status === 'Pending').length,
    started: tasksData.filter(t => t.status === 'Started').length,
    inProgress: tasksData.filter(t => t.status === 'In Progress').length,
    completed: tasksData.filter(t => t.status === 'Completed').length,
  };

  const projectProgress = projectsData.map(p => ({
    id: p.id,
    name: p.name,
    progress: p.progress || 0,
    status: p.status
  }));

  const recentTasks = tasksData.slice(-5).reverse().map(t => {
    const p = projectsData.find(proj => proj.id === t.project_id);
    const u = usersData.find(user => user.id === t.assigned_to);
    return {
      ...t,
      project_name: p ? p.name : 'Sin proyecto',
      assigned_name: u ? u.name : 'Sin asignar'
    };
  });

  const people = { total: usersData.length };
  const machinery = { Available: machineryData.filter(m => m.status === 'Available' || m.status === 'Disponible').length };

  const taskPieData = [
    { name:'Pendientes',  value: tasks.pending,    color: TASK_COLORS.Pending     },
    { name:'Iniciadas',   value: tasks.started,    color: TASK_COLORS.Started     },
    { name:'En Progreso', value: tasks.inProgress, color: TASK_COLORS['In Progress']},
    { name:'Completadas', value: tasks.completed,  color: TASK_COLORS.Completed   },
  ].filter(d => d.value > 0);

  const barData = projectProgress.map(p => ({
    name:     p.name.length > 16 ? p.name.slice(0,16)+'…' : p.name,
    Progreso: p.progress || 0,
  }));

  const avgProgress = projects.total > 0
    ? Math.round(projectProgress.reduce((s,p) => s+(p.progress||0), 0) / projects.total)
    : 0;

  return (
    <div className="space-y-6">
      {/* Header with logo */}
      <div className="flex items-center gap-4">
        <div className="bg-white rounded-xl p-2 w-12 h-12 flex items-center justify-center flex-shrink-0 shadow-lg">
          <img src="/icaa-logo.png" alt="ICAA" className="w-full h-full object-contain"/>
        </div>
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="text-slate-400 text-sm mt-0.5">
            Bienvenido, <span className="text-white font-semibold">{user?.name || 'Administrador ICAA'}</span> — Grupo ICAA Constructora
          </p>
        </div>
      </div>

      {/* Project KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatCard icon={FolderKanban} label="Total Proyectos"     value={projects.total}     color="blue"/>
        <StatCard icon={TrendingUp}   label="Activos"             value={projects.active}    color="green"/>
        <StatCard icon={Clock}        label="Planificación"       value={projects.planning}  color="gray"/>
        <StatCard icon={AlertTriangle}label="Retrasados"          value={projects.delayed}   color="red"/>
        <StatCard icon={CheckSquare}  label="Completados"         value={projects.completed} color="gray"/>
      </div>

      {/* Task KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard icon={CheckSquare} label="Total Tareas"  value={tasks.total}      color="blue"/>
        <StatCard icon={Clock}       label="Pendientes"    value={tasks.pending}    color="yellow"/>
        <StatCard icon={TrendingUp}  label="En Progreso"   value={tasks.inProgress} color="orange"/>
        <StatCard icon={CheckSquare} label="Completadas"   value={tasks.completed}  color="green"/>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="card p-5 lg:col-span-2">
          <h3 className="section-title text-sm mb-4">Progreso por Proyecto</h3>
          {barData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={barData} margin={{ bottom:50, left:-20, right:10 }}>
                <XAxis dataKey="name" tick={{ fill:'#64748b', fontSize:10 }} angle={-35} textAnchor="end" interval={0}/>
                <YAxis tick={{ fill:'#64748b', fontSize:11 }} domain={[0,100]}/>
                <TIP formatter={v => [`${v}%`, 'Progreso']}/>
                <Bar dataKey="Progreso" radius={[4,4,0,0]} fill="url(#blueGrad)"/>
                <defs>
                  <linearGradient id="blueGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#4a7fd4"/>
                    <stop offset="100%" stopColor="#2d4fa0"/>
                  </linearGradient>
                </defs>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-48 text-slate-500 text-sm">Sin datos de proyectos</div>
          )}
        </div>

        <div className="card p-5">
          <h3 className="section-title text-sm mb-4">Tareas por Estado</h3>
          {taskPieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={taskPieData} cx="50%" cy="45%" innerRadius={52} outerRadius={80} paddingAngle={3} dataKey="value">
                  {taskPieData.map((d, i) => <Cell key={i} fill={d.color}/>)}
                </Pie>
                <TIP/>
                <Legend wrapperStyle={{ fontSize:11, color:'#94a3b8', paddingTop:8 }}/>
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-48 text-slate-500 text-sm">Sin tareas</div>
          )}
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="section-title text-sm">Estado de Proyectos</h3>
            <Link to="/projects" className="text-xs flex items-center gap-1 hover:opacity-80 transition-opacity" style={{ color: '#4a7fd4' }}>
              Ver todos <ChevronRight size={12}/>
            </Link>
          </div>
          <div className="space-y-3">
            {projectProgress.slice(0,6).map(p => (
              <Link key={p.id} to={`/projects/${p.id}`} className="block group">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-slate-200 truncate group-hover:text-[#4a7fd4] transition-colors">{p.name}</span>
                  <Badge status={p.status}/>
                </div>
                <Progress value={p.progress} size="xs" showLabel={false}/>
              </Link>
            ))}
            {projectProgress.length === 0 && <p className="text-slate-500 text-sm text-center py-4">Sin proyectos</p>}
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="section-title text-sm">Actividad Reciente</h3>
            <Link to="/tasks" className="text-xs flex items-center gap-1 hover:opacity-80 transition-opacity" style={{ color: '#4a7fd4' }}>
              Ver todas <ChevronRight size={12}/>
            </Link>
          </div>
          <div className="space-y-2">
            {recentTasks.map(t => (
              <div key={t.id} className="flex items-center gap-3 py-2 border-t border-surface-600/50 first:border-0">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-slate-200 truncate">{t.name}</div>
                  <div className="text-xs text-slate-500 truncate">{t.project_name} · {t.assigned_name}</div>
                </div>
                <Badge status={t.status}/>
              </div>
            ))}
            {recentTasks.length === 0 && <p className="text-slate-500 text-sm text-center py-4">Sin actividad</p>}
          </div>
        </div>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card p-4 text-center border-surface-600" style={{ background: 'linear-gradient(135deg, rgba(45,79,160,0.12) 0%, rgba(45,79,160,0.04) 100%)' }}>
          <div className="text-3xl font-display font-black text-white">{people.total}</div>
          <div className="text-[11px] text-slate-400 uppercase tracking-wider mt-0.5 flex items-center justify-center gap-1">
            <Users size={11}/> Empleados Activos
          </div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-3xl font-display font-black text-green-400">{machinery.Available || 0}</div>
          <div className="text-[11px] text-slate-400 uppercase tracking-wider mt-0.5 flex items-center justify-center gap-1">
            <Wrench size={11}/> Maquinaria Disponible
          </div>
        </div>
        <div className="card p-4 text-center" style={{ background: 'linear-gradient(135deg, rgba(45,79,160,0.12) 0%, rgba(45,79,160,0.04) 100%)' }}>
          <div className="text-3xl font-display font-black" style={{ color: '#4a7fd4' }}>{avgProgress}%</div>
          <div className="text-[11px] text-slate-400 uppercase tracking-wider mt-0.5 flex items-center justify-center gap-1">
            <TrendingUp size={11}/> Avance General
          </div>
        </div>
      </div>
    </div>
  );
}
