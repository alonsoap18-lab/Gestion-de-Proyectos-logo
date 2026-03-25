// src/pages/Dashboard.jsx
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { Spinner } from '../components/ui';
import { BarChart, Bar, XAxis, YAxis, Tooltip as ReTooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { FolderKanban, CheckSquare, Clock, AlertTriangle, TrendingUp } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const TASK_COLORS = { Pending: '#64748b', Started: '#4a7fd4', 'In Progress': '#f97316', Completed: '#22c55e' };

function Tooltip(props) {
  return <ReTooltip {...props} contentStyle={{ background:'#1c2333', border:'1px solid #2d3a4f', borderRadius:8, color:'#e2e8f0', fontSize:12 }}/>;
}

function StatCard({ icon: Icon, label, value, color, sub }) {
  const styles = {
    blue:   { bg:'rgba(45,79,160,0.15)',  text:'#4a7fd4',  border:'rgba(45,79,160,0.3)' },
    green:  { bg:'rgba(34,197,94,0.12)',  text:'#4ade80',  border:'rgba(34,197,94,0.25)' },
    red:    { bg:'rgba(239,68,68,0.12)',  text:'#f87171',  border:'rgba(239,68,68,0.25)' },
    gray:   { bg:'rgba(100,116,139,0.15)',text:'#94a3b8',  border:'rgba(100,116,139,0.25)' }
  };
  const s = styles[color] || styles.blue;
  return (
    <div className="card p-4 flex items-start gap-3">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: s.bg, border: `1px solid ${s.border}` }}>
        <Icon size={19} style={{ color: s.text }}/>
      </div>
      <div>
        <div className="text-2xl font-display font-bold text-white leading-none">{value ?? 0}</div>
        <div className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold mt-0.5">{label}</div>
        {sub && <div className="text-[11px] text-slate-500 mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();

  const { data: stats, isLoading, isError } = useQuery({
    queryKey: ['dashboard'],
    queryFn: async () => {
      const { data: projects } = await supabase.from('projects').select('*');
      const { data: tasks } = await supabase.from('tasks').select('*');
      
      return {
        projects: {
          total: projects?.length || 0,
          active: projects?.filter(p => p.status === 'Active').length || 0,
          planning: projects?.filter(p => p.status === 'Planning').length || 0,
          delayed: projects?.filter(p => p.status === 'Delayed').length || 0,
          completed: projects?.filter(p => p.status === 'Completed').length || 0,
        },
        tasks: {
          total: tasks?.length || 0,
          pending: tasks?.filter(t => t.status === 'Pending').length || 0,
          inProgress: tasks?.filter(t => t.status === 'In Progress').length || 0,
          completed: tasks?.filter(t => t.status === 'Completed').length || 0,
        },
        // 🔥 MAGIA AQUÍ: Calculamos el progreso cruzando las tareas de cada proyecto
        projectProgress: projects?.map(p => {
          const pTasks = tasks?.filter(t => t.project_id === p.id) || [];
          const realProgress = pTasks.length > 0 ? Math.round(pTasks.reduce((s, t) => s + (t.progress || 0), 0) / pTasks.length) : 0;
          return { id: p.id, name: p.name, progress: realProgress };
        }) || []
      };
    },
  });

  if (isLoading) return <Spinner/>;
  if (isError || !stats) return <div className="text-white text-center p-10">Error al cargar datos.</div>;

  const { projects, tasks, projectProgress } = stats;

  const taskPieData = [
    { name:'Pendientes', value: tasks.pending, color: TASK_COLORS.Pending },
    { name:'En Progreso', value: tasks.inProgress, color: TASK_COLORS['In Progress'] },
    { name:'Completadas', value: tasks.completed, color: TASK_COLORS.Completed },
  ].filter(d => d.value > 0);

  const barData = projectProgress.map(p => ({ name: p.name?.slice(0,16), Progreso: p.progress }));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="bg-white rounded-xl p-2 w-12 h-12 flex items-center justify-center shadow-lg"><img src="/icaa-logo.png" alt="ICAA"/></div>
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="text-slate-400 text-sm">Bienvenido, <span className="text-white font-semibold">{user?.name || user?.email}</span></p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatCard icon={FolderKanban} label="Proyectos" value={projects.total}/>
        <StatCard icon={TrendingUp} label="Activos" value={projects.active} color="green"/>
        <StatCard icon={Clock} label="Planificación" value={projects.planning} color="gray"/>
        <StatCard icon={AlertTriangle} label="Retrasados" value={projects.delayed} color="red"/>
        <StatCard icon={CheckSquare} label="Completados" value={projects.completed}/>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="card p-5">
          <h3 className="section-title text-sm mb-4">Progreso por Proyecto</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={barData}>
              <XAxis dataKey="name" tick={{fill: '#94a3b8', fontSize: 12}} />
              <YAxis tick={{fill: '#94a3b8', fontSize: 12}} />
              <Tooltip/>
              <Bar dataKey="Progreso" fill="#f97316" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card p-5">
          <h3 className="section-title text-sm mb-4">Tareas Globales</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={taskPieData} dataKey="value" cx="50%" cy="50%" innerRadius={60} outerRadius={80}>
                {taskPieData.map((d,i) => <Cell key={i} fill={d.color}/>)}
              </Pie>
              <Tooltip/>
              <Legend/>
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
