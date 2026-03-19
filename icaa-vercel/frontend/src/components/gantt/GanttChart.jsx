// src/components/gantt/GanttChart.jsx
import { useRef, useState, useCallback } from 'react';
import { addWeeks, format } from 'date-fns';
import { Pencil, Trash2 } from 'lucide-react';
import { Badge } from '../ui';

const CELL_W = 54;   // px per week column
const ROW_H  = 46;   // px per task row

const STATUS_BAR = {
  'Pending':     'bg-slate-500',
  'Started':     'bg-blue-500',
  'In Progress': 'bg-brand-500',
  'Completed':   'bg-green-500',
};

function weekLabel(projectStart, weekNum) {
  if (!projectStart) return `S${weekNum}`;
  const d = addWeeks(new Date(projectStart), weekNum - 1);
  return format(d, 'dd/MM');
}

export default function GanttChart({ project, tasks = [], onEditTask, onDeleteTask, onMoveTask }) {
  const totalWeeks  = project?.duration_weeks || 12;
  const weeks       = Array.from({ length: totalWeeks }, (_, i) => i + 1);
  const containerRef = useRef(null);

  /* ── Drag state ─────────────────────────────────────── */
  const dragRef = useRef(null);
  const [ghost, setGhost] = useState(null); // { id, start_week, end_week }

  const handleBarMouseDown = useCallback((e, task, type) => {
    e.preventDefault();
    e.stopPropagation();
    const startX     = e.clientX;
    const origStart  = task.start_week;
    const origEnd    = task.end_week;
    const origDur    = origEnd - origStart;

    function onMove(me) {
      const delta = Math.round((me.clientX - startX) / CELL_W);
      if (type === 'move') {
        const newStart = Math.max(1, Math.min(origStart + delta, totalWeeks - origDur));
        const newEnd   = newStart + origDur;
        setGhost({ id: task.id, start_week: newStart, end_week: newEnd });
        dragRef.current = { id: task.id, start_week: newStart, end_week: newEnd };
      } else {
        // resize right edge
        const newEnd = Math.max(origStart + 1, Math.min(origEnd + delta, totalWeeks));
        setGhost({ id: task.id, start_week: origStart, end_week: newEnd });
        dragRef.current = { id: task.id, start_week: origStart, end_week: newEnd };
      }
    }

    function onUp() {
      if (dragRef.current) {
        onMoveTask?.(dragRef.current.id, dragRef.current.start_week, dragRef.current.end_week);
        dragRef.current = null;
      }
      setGhost(null);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup',   onUp);
    }

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup',   onUp);
  }, [totalWeeks, onMoveTask]);

  /* ── Render ─────────────────────────────────────────── */
  const getDisplay = (task) =>
    ghost?.id === task.id ? { ...task, ...ghost } : task;

  return (
    <div className="overflow-x-auto rounded-xl border border-surface-600 bg-surface-800">
      <div style={{ minWidth: 260 + totalWeeks * CELL_W }}>

        {/* ── Header ──────────────────────────────────── */}
        <div className="flex bg-surface-700 border-b border-surface-600 sticky top-0 z-10">
          {/* Task label col */}
          <div className="w-64 flex-shrink-0 px-4 py-2.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider border-r border-surface-600">
            Tarea
          </div>
          {weeks.map(w => (
            <div key={w}
              style={{ width: CELL_W, flexShrink: 0 }}
              className="border-r border-surface-600/50 last:border-r-0 text-center py-1.5">
              <div className="text-[10px] font-bold text-slate-400 leading-none">S{w}</div>
              <div className="text-[9px] text-slate-600 mt-0.5">
                {weekLabel(project?.start_date, w)}
              </div>
            </div>
          ))}
        </div>

        {/* ── Rows ────────────────────────────────────── */}
        <div ref={containerRef}>
          {tasks.map((task, idx) => {
            const d   = getDisplay(task);
            const col = STATUS_BAR[task.status] || 'bg-slate-600';
            const barLeft  = (d.start_week - 1) * CELL_W + 2;
            const barWidth = Math.max(CELL_W - 4, (d.end_week - d.start_week + 1) * CELL_W - 4);

            return (
              <div key={task.id}
                className="flex group border-b border-surface-600/40 last:border-0 hover:bg-surface-700/30"
                style={{ height: ROW_H }}>

                {/* Label */}
                <div className="w-64 flex-shrink-0 px-3 flex items-center gap-2 border-r border-surface-600">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${col}`}/>
                  <span className="text-sm text-slate-200 truncate flex-1">{task.name}</span>
                  <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => onEditTask?.(task)}   className="btn-icon p-1"><Pencil size={11}/></button>
                    <button onClick={() => onDeleteTask?.(task)} className="btn-icon p-1 hover:text-red-400"><Trash2 size={11}/></button>
                  </div>
                </div>

                {/* Gantt area */}
                <div className="flex-1 relative">
                  {/* Grid lines */}
                  {weeks.map(w => (
                    <div key={w}
                      style={{ position:'absolute', left:(w-1)*CELL_W, top:0, width:CELL_W, height:'100%' }}
                      className="border-r border-surface-600/20"/>
                  ))}

                  {/* Bar */}
                  <div
                    style={{ position:'absolute', left: barLeft, top: 7, width: barWidth, height: ROW_H - 14 }}
                    className={`${col} rounded-md cursor-grab active:cursor-grabbing select-none
                                flex items-center px-2 overflow-hidden shadow-lg opacity-90 hover:opacity-100`}
                    onMouseDown={e => handleBarMouseDown(e, task, 'move')}
                  >
                    {/* Progress fill */}
                    <div
                      className="absolute inset-0 rounded-md bg-black/25"
                      style={{ left: `${task.progress}%` }}
                    />
                    <span className="text-white text-[10px] font-bold relative z-10 truncate">
                      {task.name.length > 14 ? `${task.progress}%` : `${task.name} · ${task.progress}%`}
                    </span>

                    {/* Resize handle */}
                    <div
                      style={{ position:'absolute', right:0, top:0, width:8, height:'100%', cursor:'ew-resize' }}
                      className="bg-black/30 rounded-r-md hover:bg-black/50"
                      onMouseDown={e => handleBarMouseDown(e, task, 'resize')}
                    />
                  </div>
                </div>
              </div>
            );
          })}

          {tasks.length === 0 && (
            <div className="flex items-center justify-center h-28 text-slate-500 text-sm">
              Sin tareas — crea la primera para visualizar el Gantt
            </div>
          )}
        </div>

        {/* ── Legend ──────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-4 px-4 py-2.5 border-t border-surface-600 bg-surface-700/50">
          {Object.entries(STATUS_BAR).map(([s, c]) => (
            <div key={s} className="flex items-center gap-1.5 text-[11px] text-slate-400">
              <div className={`w-3 h-3 rounded-sm ${c}`}/>
              {s}
            </div>
          ))}
          <span className="text-[11px] text-slate-600 ml-auto">
            Arrastra barra para mover · Borde derecho para redimensionar
          </span>
        </div>
      </div>
    </div>
  );
}
