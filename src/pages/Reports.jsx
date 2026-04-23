// src/pages/Reports.jsx
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { Spinner, Badge, Progress } from '../components/ui';
import { differenceInCalendarDays, addWeeks, nextFriday, format, isValid, parseISO, startOfWeek, isFriday } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
  LineChart, Line, CartesianGrid 
} from 'recharts';
import { 
  BarChart3, CheckSquare, Users, Download, Filter, 
  FileText, ChevronDown, TrendingUp, AlertTriangle, CheckCircle2, CalendarDays 
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx'; 

const TIP = (p) => (
  <Tooltip {...p} contentStyle={{ background:'#1c2333', border:'1px solid #2d3a4f', borderRadius:8, color:'#e2e8f0', fontSize:12 }}/>
);

const TABS = [
  { id:'projects',  label:'Proyectos',  icon: BarChart3  },
  { id:'curve',     label:'Curva S',    icon: TrendingUp }, 
  { id:'tasks',     label:'Tareas',     icon: CheckSquare },
  { id:'employees', label:'Empleados',  icon: Users      },
];

const TASK_COLORS = { Pending:'#64748b', Started:'#4a7fd4', 'In Progress':'#f97316', Completed:'#22c55e' };

// Función matemática: Calcula el viernes de la semana correspondiente
const getDueDate = (projectStartDate, endWeek) => {
  if (!projectStartDate) return null;
  const startDate = parseISO(projectStartDate);
  if (!isValid(startDate)) return null;

  const targetWeekDate = addWeeks(startDate, Math.max(0, endWeek - 1));
  const weekStart = startOfWeek(targetWeekDate, { weekStartsOn: 1 });
  const fridayDate = isFriday(targetWeekDate) ? targetWeekDate : nextFriday(weekStart);
  
  return format(fridayDate, "E, dd MMM", { locale: es });
};

// ============================================================================
// FUNCIÓN: EXPORTAR A EXCEL (.xlsx)
// ============================================================================
function exportExcel(filename, rows, cols) {
  const excelData = rows.map(r => {
    const rowData = {};
    cols.forEach(c => {
      let val = r[c.key];
      if (c.key === 'progress' || c.key === 'budget') val = Number(val) || 0;
      else if (c.key === 'start_week') val = `S${r.start_week} - S${r.end_week}`;
      rowData[c.label] = val !== undefined && val !== null ? val : '—';
    });
    return rowData;
  });

  const ws = XLSX.utils.json_to_sheet(excelData);
  const wscols = cols.map(c => ({ wch: Math.max(c.label.length + 5, 20) }));
  ws['!cols'] = wscols;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Reporte_ICAA");
  XLSX.writeFile(wb, filename);
}

export default function Reports() {
  const [tab, setTab] = useState('projects');
  
  // Estados para Filtros de Tareas
  const [taskFilterProject, setTaskFilterProject] = useState('');
  const [taskFilterUser, setTaskFilterUser] = useState('');
  const [taskFilterStatus, setTaskFilterStatus] = useState('');
  const [taskFilterWeeks, setTaskFilterWeeks] = useState([]);
  const [isWeekMenuOpen, setIsWeekMenuOpen] = useState(false);
  const [isExportingPDF, setIsExportingPDF] = useState(false);

  // Estado para Filtro de Curva S
  const [curveProjectId, setCurveProjectId] = useState('');

  // 1. LEER DATOS
  const { data: projects  = [], isLoading: lp } = useQuery({ queryKey:['projects'], queryFn: async () => { const { data } = await supabase.from('projects').select('*'); return data || []; } });
  const { data: tasks     = [], isLoading: lt } = useQuery({ queryKey:['tasks'],    queryFn: async () => { const { data } = await supabase.from('tasks').select('*'); return data || []; } });
  const { data: users     = [], isLoading: lu } = useQuery({ queryKey:['users'],    queryFn: async () => { const { data } = await supabase.from('users').select('*'); return data || []; } });
  const { data: materials = [], isLoading: lm } = useQuery({ queryKey:['materials'],queryFn: async () => { const { data } = await supabase.from('materials').select('*'); return data || []; } });

  if (lp || lt || lu || lm) return <Spinner/>;

  // CÁLCULOS KPIs GLOBALES
  const totalBudget  = projects.reduce((s,p) => s + (Number(p.budget)||0), 0);
  const totalMatCost = materials.reduce((s,m) => s + ((Number(m.quantity)||0) * (Number(m.cost_per_unit)||0)), 0);
  const taskDoneRate = tasks.length ? Math.round((tasks.filter(t=>t.status==='Completed').length / tasks.length)*100) : 0;
  const avgProgress  = projects.length ? Math.round(projects.reduce((s,p) => s+(Number(p.progress)||0),0)/projects.length) : 0;

  // GRÁFICAS (Proyectos)
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

  const maxWeek = Math.max(...tasks.map(t => t.end_week || 1), 1);
  const weeksOptions = Array.from({ length: maxWeek }, (_, i) => i + 1);

  // PROCESAMIENTO TAREAS
  const filteredTasks = tasks
    .filter(t => {
      if (taskFilterProject && t.project_id !== taskFilterProject) return false;
      if (taskFilterUser && t.assigned_to !== taskFilterUser) return false;
      if (taskFilterStatus && t.status !== taskFilterStatus) return false;
      if (taskFilterWeeks.length > 0) {
        const matches = taskFilterWeeks.some(w => w >= t.start_week && w <= t.end_week);
        if (!matches) return false;
      }
      return true;
    })
    .map(t => {
      const p = projects.find(proj => proj.id === t.project_id);
      const u = users.find(user => user.id === t.assigned_to);
      const dueDate = getDueDate(p?.start_date, t.end_week);
      
      return { 
        ...t, 
        project_name: p ? p.name : '—', 
        assigned_name: u ? u.name : '—',
        due_date: dueDate || 'S/F',
        clean_description: t.description ? t.description.replace(/\n/g, ' ') : 'Sin descripción'
      };
    })
    .sort((a, b) => (a.start_week !== b.start_week ? a.start_week - b.start_week : a.end_week - b.end_week));

  // ============================================================================
  // MAGIA MATEMÁTICA: CÁLCULO DE LA CURVA S
  // ============================================================================
  const activeCurveProjectId = curveProjectId || (projects.length > 0 ? projects[0].id : '');
  const curveProj = projects.find(p => p.id === activeCurveProjectId);
  const curveTasks = tasks.filter(t => t.project_id === activeCurveProjectId);
  
  let curveData = [];
  let currentProjectWeek = 1;
  let expectedProgress = 0;
  let actualProgress = curveProj?.progress || 0;

  if (curveProj && curveTasks.length > 0) {
    const cMaxWeek = Math.max(...curveTasks.map(t => t.end_week || 1), 1);
    
    // Calcular en qué semana real estamos basados en la fecha de inicio
    const startDate = curveProj.start_date ? new Date(curveProj.start_date) : new Date();
    const daysSinceStart = Math.max(0, differenceInCalendarDays(new Date(), startDate));
    currentProjectWeek = Math.max(1, Math.ceil(daysSinceStart / 7));

    // Generar datos semana a semana
    for (let w = 1; w <= cMaxWeek; w++) {
      let totalPlanned = 0;
      
      // Calcular cuánto % DEBERÍA estar listo en la semana W
      curveTasks.forEach(t => {
        const sw = t.start_week || 1;
        const ew = t.end_week || 2;
        if (w >= ew) totalPlanned += 100; // Tarea debería estar terminada
        else if (w >= sw) totalPlanned += ((w - sw + 1) / (ew - sw + 1)) * 100; // Tarea en proceso
      });
      
      const planificado = Math.round(totalPlanned / curveTasks.length);
      
      // Calcular línea Real (Solo se dibuja hasta la semana actual)
      let real = null;
      if (w <= currentProjectWeek) {
        // Interpolación visual del avance real hasta hoy
        real = Math.round((curveProj.progress || 0) * (w / Math.min(currentProjectWeek, cMaxWeek)));
      }

      curveData.push({ name: `S${w}`, Planificado: planificado, Real: real });
    }

    // Calcular valores para las tarjetas de resumen
    const currentPoint = curveData[Math.min(currentProjectWeek - 1, cMaxWeek - 1)] || curveData[curveData.length - 1];
    expectedProgress = currentPoint ? currentPoint.Planificado : 0;
  }
  
  const deviation = actualProgress - expectedProgress;

  // ============================================================================
  // EXPORTAR A PDF (MANTIENE SEMANAS Y AGREGA VENCIMIENTO)
  // ============================================================================
  const exportTasksToPDF = async () => {
    setIsExportingPDF(true);
    try {
      const doc = new jsPDF('landscape');
      const logoImg = new Image(); logoImg.src = '/icaa-logo.png'; 
      await new Promise((resolve) => { logoImg.onload = resolve; logoImg.onerror = resolve; });
      if (logoImg.width > 0) doc.addImage(logoImg, 'PNG', 14, 10, 25, 25);

      doc.setFontSize(20); doc.setTextColor(45, 79, 160); doc.text("GRUPO ICAA CONSTRUCTORA", logoImg.width > 0 ? 45 : 14, 20);
      doc.setFontSize(12); doc.setTextColor(100, 116, 139); doc.text("Reporte Detallado de Tareas", logoImg.width > 0 ? 45 : 14, 27);
      
      const fechaActual = new Date().toLocaleDateString('es-CR', { year: 'numeric', month: 'long', day: 'numeric' });
      doc.setFontSize(10); doc.text(`Fecha de generación: ${fechaActual}`, logoImg.width > 0 ? 45 : 14, 33);

      let subtituloFiltros = "";
      if (taskFilterProject) subtituloFiltros += `Proyecto: ${projects.find(x => x.id === taskFilterProject)?.name}   `;
      if (taskFilterUser) subtituloFiltros += `Usuario: ${users.find(x => x.id === taskFilterUser)?.name}   `;
      if (taskFilterStatus) subtituloFiltros += `Estado: ${taskFilterStatus}   `;
      if (taskFilterWeeks.length > 0) subtituloFiltros += `Semanas: ${[...taskFilterWeeks].sort((a,b) => a - b).map(w => `S${w}`).join(', ')}`;
      if (subtituloFiltros) { doc.setTextColor(249, 115, 22); doc.text(`Filtros: ${subtituloFiltros}`, 14, 42); }

      // AQUÍ ESTÁN AMBAS COLUMNAS
      const tableHeaders = [["Tarea", "Proyecto", "Asignado a", "Semanas", "Vencimiento", "Estado", "Progreso", "Descripción"]];
      const tableData = filteredTasks.map(t => [ t.name, t.project_name, t.assigned_name, `S${t.start_week} - S${t.end_week}`, t.due_date, t.status, `${t.progress || 0}%`, t.clean_description ]);

      autoTable(doc, {
        head: tableHeaders, body: tableData, startY: subtituloFiltros ? 48 : 42, theme: 'striped',
        headStyles: { fillColor: [45, 79, 160], textColor: [255, 255, 255], fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [245, 247, 250] },
        styles: { fontSize: 9, cellPadding: 4, textColor: [51, 65, 85] },
        columnStyles: { 0: { cellWidth: 35 }, 1: { cellWidth: 35 }, 2: { cellWidth: 30 }, 3: { cellWidth: 20 }, 4: { cellWidth: 22 }, 5: { cellWidth: 20 }, 6: { cellWidth: 16 }, 7: { cellWidth: 'auto' } },
        didDrawPage: function (data) { doc.setFontSize(8); doc.setTextColor(150); doc.text(`Página ${doc.internal.getNumberOfPages()}`, data.settings.margin.left, doc.internal.pageSize.height - 10); }
      });

      let filename = 'Reporte_Tareas_ICAA';
      if (taskFilterProject) filename += `_${projects.find(x => x.id === taskFilterProject)?.name.replace(/\s+/g, '_')}`;
      doc.save(`${filename}.pdf`);
    } catch (error) { alert("Hubo un error al generar el PDF."); console.error(error); } finally { setIsExportingPDF(false); }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Reportes y Estadísticas</h1>
          <p className="text-slate-400 text-sm mt-0.5">Métricas generales del sistema</p>
        </div>
      </div>

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

      <div className="flex gap-2 mb-6 border-b border-surface-600 pb-2">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm transition-all
              ${tab === id ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/20' : 'text-slate-400 hover:bg-surface-700'}`}>
            <Icon size={16}/> {label}
          </button>
        ))}
      </div>

      {/* === PESTAÑA 1: PROYECTOS === */}
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
              onClick={() => exportExcel('Proyectos_ICAA.xlsx', projects, [
                {label:'Nombre', key:'name'}, {label:'Cliente', key:'client'}, {label:'Ubicación', key:'location'},
                {label:'Estado', key:'status'}, {label:'Progreso (%)', key:'progress'}, {label:'Presupuesto ($)', key:'budget'}
              ])}>
              <Download size={14}/> Exportar Proyectos Excel
            </button>
          </div>
        </div>
      )}

      {/* === PESTAÑA 2: CURVA S === */}
      {tab === 'curve' && (
        <div className="space-y-5">
          
          <div className="flex flex-wrap items-center justify-between bg-surface-800 p-3 rounded-xl border border-surface-600">
            <div className="flex items-center gap-3">
              <TrendingUp size={18} className="text-brand-400 ml-1"/>
              <span className="text-sm font-semibold text-slate-200">Seleccionar Proyecto:</span>
              <select className="input max-w-[300px] border-none bg-surface-700 text-sm font-medium" 
                value={activeCurveProjectId} onChange={e => setCurveProjectId(e.target.value)}>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            {curveProj?.start_date && (
              <div className="text-xs text-slate-400 px-3">
                Inicio Oficial: <span className="text-slate-200 font-mono">{new Date(curveProj.start_date).toLocaleDateString()}</span>
              </div>
            )}
          </div>

          {curveTasks.length === 0 ? (
            <div className="card p-10 text-center text-slate-500">
              <TrendingUp size={40} className="mx-auto mb-3 opacity-20"/>
              <p>Este proyecto aún no tiene tareas asignadas para generar la Curva S.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="card p-4 border-l-4 border-l-surface-500">
                  <div className="text-xs text-slate-400 uppercase tracking-wider font-semibold mb-1">Semana Actual</div>
                  <div className="text-2xl font-display font-bold text-white">S{currentProjectWeek}</div>
                </div>
                <div className="card p-4 border-l-4 border-l-slate-400">
                  <div className="text-xs text-slate-400 uppercase tracking-wider font-semibold mb-1">Progreso Esperado</div>
                  <div className="text-2xl font-display font-bold text-slate-300">{expectedProgress}%</div>
                </div>
                <div className="card p-4 border-l-4 border-l-brand-400">
                  <div className="text-xs text-slate-400 uppercase tracking-wider font-semibold mb-1">Progreso Real</div>
                  <div className="text-2xl font-display font-bold text-brand-400">{actualProgress}%</div>
                </div>
                <div className={`card p-4 border-l-4 ${deviation < 0 ? 'border-l-red-500 bg-red-500/5' : 'border-l-green-500 bg-green-500/5'}`}>
                  <div className={`text-xs uppercase tracking-wider font-semibold mb-1 ${deviation < 0 ? 'text-red-400' : 'text-green-400'}`}>
                    Desviación
                  </div>
                  <div className="flex items-center gap-2 text-2xl font-display font-bold text-white">
                    {deviation > 0 ? '+' : ''}{deviation}%
                    {deviation < 0 ? <AlertTriangle size={20} className="text-red-500"/> : <CheckCircle2 size={20} className="text-green-500"/>}
                  </div>
                </div>
              </div>

              <div className="card p-6">
                <h3 className="section-title text-sm mb-6 flex items-center gap-2">
                  Análisis de Curva S (Planificado vs. Real)
                </h3>
                <ResponsiveContainer width="100%" height={350}>
                  <LineChart data={curveData} margin={{ top: 10, right: 20, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                    <XAxis dataKey="name" tick={{ fill:'#94a3b8', fontSize:12 }} dy={10} />
                    <YAxis tick={{ fill:'#94a3b8', fontSize:12 }} domain={[0, 100]} dx={-10} />
                    <Tooltip 
                      contentStyle={{ background:'#1e293b', border:'1px solid #334155', borderRadius:8, color:'#f8fafc' }}
                      formatter={(value, name) => [`${value}%`, name]}
                    />
                    <Legend wrapperStyle={{ paddingTop: '20px' }}/>
                    
                    <Line type="monotone" dataKey="Planificado" stroke="#94a3b8" strokeWidth={3} dot={{ r: 4, fill: '#94a3b8' }} activeDot={{ r: 6 }} />
                    <Line type="monotone" dataKey="Real" stroke={deviation < 0 ? '#ef4444' : '#4a7fd4'} strokeWidth={4} dot={{ r: 5, fill: deviation < 0 ? '#ef4444' : '#4a7fd4' }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </>
          )}
        </div>
      )}

      {/* === PESTAÑA 3: TAREAS === */}
      {tab === 'tasks' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4 bg-surface-800 p-3 rounded-xl border border-surface-600">
            <div className="flex flex-wrap items-center gap-3 flex-1">
              <Filter size={15} className="text-slate-400 ml-1 flex-shrink-0"/>
              
              <select className="input max-w-[200px] border-none bg-surface-700 text-sm" value={taskFilterProject} onChange={e => setTaskFilterProject(e.target.value)}>
                <option value="">🏢 Todos los Proyectos</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>

              <select className="input max-w-[180px] border-none bg-surface-700 text-sm" value={taskFilterUser} onChange={e => setTaskFilterUser(e.target.value)}>
                <option value="">👤 Todos los Usuarios</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>

              <select className="input max-w-[160px] border-none bg-surface-700 text-sm" value={taskFilterStatus} onChange={e => setTaskFilterStatus(e.target.value)}>
                <option value="">📋 Todos los Estados</option>
                <option value="Pending">Pending</option>
                <option value="Started">Started</option>
                <option value="In Progress">In Progress</option>
                <option value="Completed">Completed</option>
              </select>

              <div className="relative">
                <button onClick={() => setIsWeekMenuOpen(!isWeekMenuOpen)} className="input min-w-[140px] border-none bg-surface-700 text-sm flex items-center justify-between gap-2 h-[38px] px-3 hover:bg-surface-600">
                  <span className="truncate text-slate-200">{taskFilterWeeks.length === 0 ? '🗓️ Toda Semana' : `🗓️ Semanas (${taskFilterWeeks.length})`}</span>
                  <ChevronDown size={14} className="text-slate-400 flex-shrink-0"/>
                </button>
                {isWeekMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsWeekMenuOpen(false)}></div>
                    <div className="absolute top-full left-0 mt-2 w-64 bg-surface-800 border border-surface-600 rounded-xl shadow-2xl z-50 p-3">
                      <div className="flex justify-between items-center mb-3">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Múltiple Selección</span>
                        {taskFilterWeeks.length > 0 && <button className="text-xs text-brand-400 hover:text-brand-300" onClick={() => setTaskFilterWeeks([])}>Limpiar</button>}
                      </div>
                      <div className="grid grid-cols-5 gap-1.5 max-h-56 overflow-y-auto pr-1">
                        {weeksOptions.map(w => (
                          <button key={w} type="button" onClick={() => setTaskFilterWeeks(prev => prev.includes(w) ? prev.filter(x => x !== w) : [...prev, w])}
                            className={`py-1.5 rounded-lg text-xs font-mono font-medium transition-all ${taskFilterWeeks.includes(w) ? 'bg-brand-500 text-white shadow-md shadow-brand-500/20' : 'bg-surface-700 text-slate-400 hover:bg-surface-600 hover:text-white'}`}>
                            S{w}
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>

              {(taskFilterProject || taskFilterUser || taskFilterStatus || taskFilterWeeks.length > 0) && (
                <button className="text-xs font-medium text-brand-400 hover:text-brand-300 whitespace-nowrap px-2" 
                  onClick={() => { setTaskFilterProject(''); setTaskFilterUser(''); setTaskFilterStatus(''); setTaskFilterWeeks([]); }}>Limpiar Filtros</button>
              )}
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <button className="btn-ghost text-xs border border-green-600/30 text-green-400 hover:bg-green-500/10" 
                onClick={() => exportExcel('Reporte_Tareas_ICAA.xlsx', filteredTasks, [
                  {label:'Tarea', key:'name'}, {label:'Descripción', key:'clean_description'}, {label:'Proyecto', key:'project_name'}, 
                  {label:'Asignado a', key:'assigned_name'}, {label:'Estado', key:'status'}, {label:'Progreso (%)', key:'progress'}, 
                  {label:'Semanas', key:'start_week'}, {label:'Vencimiento', key:'due_date'}, {label:'Prioridad', key:'priority'} // AMBAS INCLUIDAS
                ])}>
                <Download size={14} className="mr-1"/> Excel (.xlsx)
              </button>

              <button className="btn-ghost text-xs border border-red-600/30 text-red-400 hover:bg-red-500/10" onClick={exportTasksToPDF} disabled={isExportingPDF}>
                {isExportingPDF ? <Spinner size="sm"/> : <FileText size={14} className="mr-1"/>}
                {isExportingPDF ? '...' : 'PDF'}
              </button>
            </div>
          </div>

          <p className="text-xs text-slate-400 px-1">Mostrando {filteredTasks.length} tareas</p>

          <div className="table-wrap overflow-x-auto" id="tasks-report-table">
            <table className="w-full min-w-[900px]">
              <thead>
                <tr>
                  <th className="th w-1/5">Tarea</th>
                  <th className="th w-1/4">Descripción</th>
                  <th className="th">Proyecto</th>
                  <th className="th">Asignado</th>
                  <th className="th text-center">Semanas</th>
                  <th className="th">Vencimiento</th>
                  <th className="th">Estado</th>
                  <th className="th w-28">Progreso</th>
                </tr>
              </thead>
              <tbody>
                {filteredTasks.map(t => (
                  <tr key={t.id} className="tr-hover border-b border-surface-600/30">
                    <td className="td font-semibold text-slate-200">{t.name}</td>
                    <td className="td text-slate-400 text-xs"><div className="line-clamp-2" title={t.description}>{t.description || '—'}</div></td>
                    <td className="td text-slate-400 text-xs">{t.project_name}</td>
                    <td className="td text-slate-400 text-xs">{t.assigned_name}</td>
                    <td className="td font-mono text-center">
                      <span className="bg-surface-600 text-slate-300 px-2 py-0.5 rounded text-xs font-semibold">
                        S{t.start_week} - S{t.end_week}
                      </span>
                    </td>
                    <td className="td text-xs">
                      {t.due_date !== 'S/F' ? (
                        <div className="flex items-center gap-1.5 text-brand-400 font-semibold capitalize">
                          <CalendarDays size={12}/> {t.due_date}
                        </div>
                      ) : (
                        <span className="text-slate-500 italic">S/F</span>
                      )}
                    </td>
                    <td className="td"><Badge status={t.status}/></td>
                    <td className="td"><Progress value={t.progress || 0} size="sm"/></td>
                  </tr>
                ))}
                {filteredTasks.length === 0 && <tr><td colSpan={8} className="td text-center text-slate-500 py-10">No hay tareas que coincidan con los filtros</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* === PESTAÑA 4: EMPLEADOS === */}
      {tab === 'employees' && (
        <div className="space-y-4">
          <div className="flex justify-end mb-2">
            <button className="btn-ghost text-xs flex items-center gap-2" 
              onClick={() => exportExcel('Directorio_Empleados_ICAA.xlsx', users, [
                {label:'Nombre del Empleado', key:'name'}, {label:'Correo Electrónico', key:'email'}, {label:'Rol', key:'role'}
              ])}>
              <Download size={14}/> Exportar Directorio Excel
            </button>
          </div>
          <div className="table-wrap">
            <table className="w-full">
              <thead>
                <tr><th className="th">Nombre</th><th className="th">Correo Electrónico</th><th className="th">Rol</th></tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} className="tr-hover">
                    <td className="td font-semibold text-slate-200">{u.name}</td>
                    <td className="td text-slate-400">{u.email}</td>
                    <td className="td"><span className="px-2 py-1 rounded bg-surface-600 text-slate-300 text-xs font-semibold tracking-wider uppercase">{u.role}</span></td>
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
