// src/pages/Reports.jsx
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { Spinner, Badge, Progress } from '../components/ui';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { BarChart3, CheckSquare, Users, Download, Filter, FileText } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable'; // <-- LA NUEVA MAGIA PARA TABLAS

const TIP = (p) => (
  <Tooltip {...p} contentStyle={{ background:'#1c2333', border:'1px solid #2d3a4f', borderRadius:8, color:'#e2e8f0', fontSize:12 }}/>
);

const TABS = [
  { id:'projects',  label:'Proyectos',  icon: BarChart3  },
  { id:'tasks',     label:'Tareas',     icon: CheckSquare },
  { id:'employees', label:'Empleados',  icon: Users       },
];

const TASK_COLORS = { Pending:'#64748b', Started:'#4a7fd4', 'In Progress':'#f97316', Completed:'#22c55e' };

// Función genérica para exportar a CSV (Excel)
function exportCSV(filename, rows, cols) {
  const header = cols.map(c => `"${c.label}"`).join(',');
  const body   = rows.map(r => cols.map(c => `"${(r[c.key]||'').toString().replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob   = new Blob(['\uFEFF' + header + '\n' + body], { type: 'text/csv;charset=utf-8;' });
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: filename });
  a.click();
}

export default function Reports() {
  const [tab, setTab] = useState('projects');
  
  // Estados para los filtros de tareas
  const [taskFilterProject, setTaskFilterProject] = useState('');
  const [taskFilterUser, setTaskFilterUser] = useState('');
  const [isExportingPDF, setIsExportingPDF] = useState(false);

  // 1. LEER DATOS
  const { data: projects  = [], isLoading: lp } = useQuery({ queryKey:['projects'], queryFn: async () => { const { data } = await supabase.from('projects').select('*'); return data || []; } });
  const { data: tasks     = [], isLoading: lt } = useQuery({ queryKey:['tasks'],    queryFn: async () => { const { data } = await supabase.from('tasks').select('*'); return data || []; } });
  const { data: users     = [], isLoading: lu } = useQuery({ queryKey:['users'],    queryFn: async () => { const { data } = await supabase.from('users').select('*'); return data || []; } });
  const { data: materials = [], isLoading: lm } = useQuery({ queryKey:['materials'],queryFn: async () => { const { data } = await supabase.from('materials').select('*'); return data || []; } });

  if (lp || lt || lu || lm) return <Spinner/>;

  // 2. CÁLCULOS KPIs
  const totalBudget  = projects.reduce((s,p) => s + (Number(p.budget)||0), 0);
  const totalMatCost = materials.reduce((s,m) => s + ((Number(m.quantity)||0) * (Number(m.cost_per_unit)||0)), 0);
  const taskDoneRate = tasks.length ? Math.round((tasks.filter(t=>t.status==='Completed').length / tasks.length)*100) : 0;
  const avgProgress  = projects.length ? Math.round(projects.reduce((s,p) => s+(Number(p.progress)||0),0)/projects.length) : 0;

  // 3. GRÁFICAS (Pestaña Proyectos)
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

  // 4. PROCESAMIENTO TAREAS (Pestaña Tareas)
  const filteredTasks = tasks
    .filter(t => {
      if (taskFilterProject && t.project_id !== taskFilterProject) return false;
      if (taskFilterUser && t.assigned_to !== taskFilterUser) return false;
      return true;
    })
    .map(t => {
      const p = projects.find(proj => proj.id === t.project_id);
      const u = users.find(user => user.id === t.assigned_to);
      return { 
        ...t, 
        project_name: p ? p.name : '—', 
        assigned_name: u ? u.name : '—',
        clean_description: t.description ? t.description.replace(/\n/g, ' ') : 'Sin descripción'
      };
    })
    .sort((a, b) => {
      // 1. Ordenar primero por la semana de inicio (de menor a mayor)
      if (a.start_week !== b.start_week) {
        return a.start_week - b.start_week;
      }
      // 2. Si empiezan en la misma semana, desempatar por la semana de fin
      return a.end_week - b.end_week;
    });

  // ==========================================
  // EXPORTAR A PDF CORPORATIVO (TEXTO Y TABLAS)
  // ==========================================
  const exportTasksToPDF = async () => {
    setIsExportingPDF(true);
    try {
      // Formato apaisado (horizontal) para que quepa bien la descripción
      const doc = new jsPDF('landscape');

      // 1. Intentar cargar el logo de la empresa
      const logoImg = new Image();
      logoImg.src = '/icaa-logo.png'; // Asegúrate de que este sea el nombre exacto de tu logo en la carpeta public

      await new Promise((resolve) => {
        logoImg.onload = resolve;
        logoImg.onerror = resolve; // Continúa aunque el logo falle
      });

      // 2. Dibujar el Encabezado
      if (logoImg.width > 0) {
        doc.addImage(logoImg, 'PNG', 14, 10, 25, 25); // x, y, width, height
      }

      doc.setFontSize(20);
      doc.setTextColor(45, 79, 160); // Azul ICAA (brand-500)
      doc.text("GRUPO ICAA CONSTRUCTORA", logoImg.width > 0 ? 45 : 14, 20);
      
      doc.setFontSize(12);
      doc.setTextColor(100, 116, 139); // Gris (slate-500)
      doc.text("Reporte Detallado de Tareas", logoImg.width > 0 ? 45 : 14, 27);
      
      const fechaActual = new Date().toLocaleDateString('es-CR', { year: 'numeric', month: 'long', day: 'numeric' });
      doc.setFontSize(10);
      doc.text(`Fecha de generación: ${fechaActual}`, logoImg.width > 0 ? 45 : 14, 33);

      // Mostrar filtros activos en el reporte si existen
      let subtituloFiltros = "";
      if (taskFilterProject) {
        const pName = projects.find(x => x.id === taskFilterProject)?.name;
        subtituloFiltros += `Proyecto: ${pName}   `;
      }
      if (taskFilterUser) {
        const uName = users.find(x => x.id === taskFilterUser)?.name;
        subtituloFiltros += `Usuario: ${uName}`;
      }
      if (subtituloFiltros) {
        doc.setTextColor(249, 115, 22); // Naranja sutil para destacar el filtro
        doc.text(`Filtros aplicados -> ${subtituloFiltros}`, 14, 42);
      }

      // 3. Preparar los datos para la tabla
      const tableHeaders = [["Tarea", "Proyecto", "Asignado a", "Estado", "Progreso", "Semanas", "Descripción"]];
      const tableData = filteredTasks.map(t => [
        t.name,
        t.project_name,
        t.assigned_name,
        t.status,
        `${t.progress || 0}%`,
        `S${t.start_week} - S${t.end_week}`, // <-- AQUÍ PONEMOS LAS SEMANAS
        t.clean_description
      ]);

      // 4. Dibujar la tabla auto-ajustable
      autoTable(doc, {
        head: tableHeaders,
        body: tableData,
        startY: subtituloFiltros ? 48 : 42,
        theme: 'striped',
        headStyles: { 
          fillColor: [45, 79, 160], // Azul corporativo
          textColor: [255, 255, 255],
          fontStyle: 'bold'
        },
        alternateRowStyles: {
          fillColor: [245, 247, 250] // Gris muy claro para leer mejor
        },
        styles: { 
          fontSize: 9, 
          cellPadding: 4,
          textColor: [51, 65, 85] // Slate-700
        },
        columnStyles: {
          0: { cellWidth: 40 }, // Tarea
          1: { cellWidth: 35 }, // Proyecto
          2: { cellWidth: 35 }, // Asignado
          3: { cellWidth: 25 }, // Estado
          4: { cellWidth: 20 }, // Progreso
          5: { cellWidth: 20 }, // Prioridad
          6: { cellWidth: 'auto' } // Descripción toma todo el espacio sobrante
        },
        // Pie de página automático en cada hoja
        didDrawPage: function (data) {
          doc.setFontSize(8);
          doc.setTextColor(150);
          doc.text(`Página ${doc.internal.getNumberOfPages()}`, data.settings.margin.left, doc.internal.pageSize.height - 10);
        }
      });

      // 5. Descargar el archivo
      let filename = 'Reporte_Tareas_ICAA';
      if (taskFilterProject) {
        const p = projects.find(x => x.id === taskFilterProject);
        if (p) filename += `_${p.name.replace(/\s+/g, '_')}`;
      }
      doc.save(`${filename}.pdf`);

    } catch (error) {
      alert("Hubo un error al generar el PDF.");
      console.error(error);
    } finally {
      setIsExportingPDF(false);
    }
  };

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

      {/* === PESTAÑA: PROYECTOS === */}
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

      {/* === PESTAÑA: TAREAS === */}
      {tab === 'tasks' && (
        <div className="space-y-4">
          
          {/* Barra de Filtros y Acciones */}
          <div className="flex flex-wrap items-center justify-between gap-4 bg-surface-800 p-3 rounded-xl border border-surface-600">
            <div className="flex items-center gap-3">
              <Filter size={15} className="text-slate-400 ml-1"/>
              
              <select className="input max-w-[220px] border-none bg-surface-700 text-sm" 
                value={taskFilterProject} onChange={e => setTaskFilterProject(e.target.value)}>
                <option value="">🏢 Todos los Proyectos</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>

              <select className="input max-w-[200px] border-none bg-surface-700 text-sm" 
                value={taskFilterUser} onChange={e => setTaskFilterUser(e.target.value)}>
                <option value="">👤 Todos los Usuarios</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>

              {(taskFilterProject || taskFilterUser) && (
                <button className="text-xs font-medium text-brand-400 hover:text-brand-300" 
                  onClick={() => { setTaskFilterProject(''); setTaskFilterUser(''); }}>
                  Limpiar
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button className="btn-ghost text-xs border border-green-600/30 text-green-400 hover:bg-green-500/10" 
                onClick={() => exportCSV('tareas_reporte.csv', filteredTasks, [
                  {label:'Tarea', key:'name'}, 
                  {label:'Descripción', key:'clean_description'}, 
                  {label:'Proyecto', key:'project_name'}, 
                  {label:'Asignado', key:'assigned_name'}, 
                  {label:'Estado', key:'status'}, 
                  {label:'Progreso', key:'progress'}, 
                  {label:'Semanas', key:'start_week'}
                ])}>
                <Download size={14} className="mr-1"/> Exportar Excel
              </button>

              <button className="btn-ghost text-xs border border-red-600/30 text-red-400 hover:bg-red-500/10" 
                onClick={exportTasksToPDF} disabled={isExportingPDF}>
                {isExportingPDF ? <Spinner size="sm"/> : <FileText size={14} className="mr-1"/>}
                {isExportingPDF ? 'Generando...' : 'Exportar a PDF'}
              </button>
            </div>
          </div>

          <p className="text-xs text-slate-400 px-1">Mostrando {filteredTasks.length} tareas</p>

          {/* Tabla de Tareas Visible */}
          <div className="table-wrap overflow-x-auto" id="tasks-report-table">
            <table className="w-full min-w-[900px]">
              <thead>
                <tr>
                  <th className="th w-1/4">Tarea</th>
                  <th className="th w-1/3">Descripción</th>
                  <th className="th">Proyecto</th>
                  <th className="th">Asignado</th>
                  <th className="th">Estado</th>
                  <th className="th w-28">Progreso</th>
                </tr>
              </thead>
              <tbody>
                {filteredTasks.map(t => (
                  <tr key={t.id} className="tr-hover border-b border-surface-600/30">
                    <td className="td font-semibold text-slate-200">
                      <div>{t.name}</div>
                      <div className="text-[10px] text-slate-500 uppercase mt-0.5 font-mono">
                        S{t.start_week} - S{t.end_week}
                      </div>
                    </td>
                    <td className="td text-slate-400 text-xs">
                      <div className="line-clamp-2" title={t.description}>{t.description || '—'}</div>
                    </td>
                    <td className="td text-slate-400 text-xs">{t.project_name}</td>
                    <td className="td text-slate-400 text-xs">{t.assigned_name}</td>
                    <td className="td"><Badge status={t.status}/></td>
                    <td className="td">
                      <Progress value={t.progress || 0} size="sm"/>
                    </td>
                  </tr>
                ))}
                {filteredTasks.length === 0 && <tr><td colSpan={6} className="td text-center text-slate-500 py-10">No hay tareas que coincidan con los filtros</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* === PESTAÑA: EMPLEADOS === */}
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
