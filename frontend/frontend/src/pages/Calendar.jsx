// src/pages/Calendar.jsx
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  startOfWeek, endOfWeek, isSameMonth, isToday, isSameDay, parseISO, addMonths, subMonths
} from 'date-fns';
import { es } from 'date-fns/locale';
import api from '../lib/api';
import { Modal, Field, Spinner } from '../components/ui';
import { ChevronLeft, ChevronRight, Plus, X, Calendar as CalIcon } from 'lucide-react';

const EVENT_TYPES  = ['Task','Meeting','Inspection','Delivery','Other'];
const TYPE_COLORS  = { Task:'#f97316', Meeting:'#3b82f6', Inspection:'#8b5cf6', Delivery:'#22c55e', Other:'#64748b' };
const TYPE_LABELS  = { Task:'Tarea', Meeting:'Reunión', Inspection:'Inspección', Delivery:'Entrega', Other:'Otro' };
const DAYS_ES      = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];

const BLANK = { title:'', description:'', start_date:'', end_date:'', type:'Task', project_id:'', color:'#f97316' };

export default function CalendarPage() {
  const qc  = useQueryClient();
  const [current,    setCurrent]    = useState(new Date());
  const [modal,      setModal]      = useState(false);
  const [form,       setForm]       = useState(BLANK);
  const [filterProj, setFilterProj] = useState('');
  const [filterType, setFilterType] = useState('');

  const { data: events   = [], isLoading } = useQuery({ queryKey:['calendar'], queryFn: () => api.get('/calendar').then(r => r.data) });
  const { data: projects = [] }            = useQuery({ queryKey:['projects'], queryFn: () => api.get('/projects').then(r => r.data) });

  const save = useMutation({
    mutationFn: d => form.id ? api.put(`/calendar/${form.id}`, d) : api.post('/calendar', d),
    onSuccess:  () => { qc.invalidateQueries(['calendar']); setModal(false); },
  });
  const del = useMutation({
    mutationFn: id => api.delete(`/calendar/${id}`),
    onSuccess:  () => { qc.invalidateQueries(['calendar']); setModal(false); },
  });

  /* Calendar grid */
  const monthStart  = startOfMonth(current);
  const monthEnd    = endOfMonth(current);
  const gridStart   = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd     = endOfWeek(monthEnd,    { weekStartsOn: 1 });
  const days        = eachDayOfInterval({ start: gridStart, end: gridEnd });

  const filtered = events.filter(ev => {
    if (filterProj && ev.project_id !== filterProj) return false;
    if (filterType && ev.type        !== filterType) return false;
    return true;
  });

  const eventsForDay = (day) =>
    filtered.filter(ev => ev.start_date && isSameDay(parseISO(ev.start_date.slice(0,10)), day));

  function openCreate(day) {
    const ds = format(day, 'yyyy-MM-dd');
    setForm({ ...BLANK, start_date: ds, end_date: ds });
    setModal(true);
  }
  function openEdit(ev, e) {
    e?.stopPropagation();
    setForm({ ...ev, start_date: ev.start_date?.slice(0,10)||'', end_date: ev.end_date?.slice(0,10)||'' });
    setModal(true);
  }

  /* Upcoming events (next 30 days) */
  const now    = new Date();
  const soon   = filtered
    .filter(ev => ev.start_date && new Date(ev.start_date) >= now)
    .sort((a,b) => new Date(a.start_date) - new Date(b.start_date))
    .slice(0, 10);

  if (isLoading) return <Spinner/>;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Calendario</h1>
          <p className="text-slate-400 text-sm mt-0.5">Eventos, reuniones e inspecciones</p>
        </div>
        <div className="flex items-center gap-2">
          <select className="input max-w-[180px]" value={filterProj} onChange={e => setFilterProj(e.target.value)}>
            <option value="">Todos los proyectos</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select className="input max-w-[150px]" value={filterType} onChange={e => setFilterType(e.target.value)}>
            <option value="">Todos los tipos</option>
            {EVENT_TYPES.map(t => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
          </select>
          <button className="btn-primary" onClick={() => { setForm(BLANK); setModal(true); }}>
            <Plus size={15}/> Nuevo Evento
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-5">
        {/* Main calendar */}
        <div className="xl:col-span-3 card overflow-hidden">
          {/* Month nav */}
          <div className="flex items-center justify-between px-5 py-4 bg-surface-700 border-b border-surface-600">
            <button onClick={() => setCurrent(subMonths(current, 1))} className="btn-icon p-2">
              <ChevronLeft size={16}/>
            </button>
            <h2 className="font-display text-xl font-bold text-white uppercase tracking-widest">
              {format(current, 'MMMM yyyy', { locale: es })}
            </h2>
            <button onClick={() => setCurrent(addMonths(current, 1))} className="btn-icon p-2">
              <ChevronRight size={16}/>
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 border-b border-surface-600">
            {DAYS_ES.map(d => (
              <div key={d} className="py-2 text-center text-[11px] font-bold text-slate-500 uppercase tracking-wider border-r border-surface-600/50 last:border-r-0">
                {d}
              </div>
            ))}
          </div>

          {/* Day grid */}
          <div className="grid grid-cols-7">
            {days.map((day, i) => {
              const dayEvs   = eventsForDay(day);
              const inMonth  = isSameMonth(day, current);
              const isNow    = isToday(day);
              const lastCol  = (i + 1) % 7 === 0;

              return (
                <div key={i}
                  className={`min-h-[90px] p-1.5 border-r border-b border-surface-600/40 cursor-pointer transition-colors
                    ${lastCol ? 'border-r-0' : ''}
                    ${inMonth ? 'hover:bg-surface-700/50' : 'bg-surface-900/30'}
                    ${isNow   ? 'bg-brand-500/5' : ''}`}
                  onClick={() => openCreate(day)}>
                  {/* Day number */}
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-sm font-semibold mb-1
                    ${isNow    ? 'bg-brand-500 text-white font-black'
                    : inMonth  ? 'text-slate-300'
                    : 'text-slate-600'}`}>
                    {format(day, 'd')}
                  </div>
                  {/* Events */}
                  <div className="space-y-0.5">
                    {dayEvs.slice(0,3).map(ev => (
                      <div key={ev.id}
                        onClick={e => openEdit(ev, e)}
                        className="text-[10px] px-1.5 py-0.5 rounded truncate text-white font-semibold cursor-pointer hover:opacity-80 transition-opacity leading-4"
                        style={{ backgroundColor: ev.color || TYPE_COLORS[ev.type] || '#f97316' }}>
                        {ev.title}
                      </div>
                    ))}
                    {dayEvs.length > 3 && (
                      <div className="text-[10px] text-slate-500 pl-1">+{dayEvs.length - 3} más</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-4 px-5 py-3 border-t border-surface-600 bg-surface-700/50">
            {EVENT_TYPES.map(t => (
              <div key={t} className="flex items-center gap-1.5 text-[11px] text-slate-400">
                <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: TYPE_COLORS[t] }}/>
                {TYPE_LABELS[t]}
              </div>
            ))}
          </div>
        </div>

        {/* Sidebar: upcoming events */}
        <div className="card p-4">
          <h3 className="section-title text-sm mb-4 flex items-center gap-2">
            <CalIcon size={14} className="text-brand-500"/> Próximos Eventos
          </h3>
          {soon.length > 0 ? (
            <div className="space-y-2">
              {soon.map(ev => (
                <div key={ev.id}
                  className="flex items-start gap-2.5 p-2.5 bg-surface-700 rounded-lg hover:bg-surface-600 transition-colors cursor-pointer group border border-surface-600"
                  onClick={e => openEdit(ev, e)}>
                  <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
                    style={{ backgroundColor: ev.color || TYPE_COLORS[ev.type] }}/>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-slate-200 truncate">{ev.title}</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      {ev.start_date?.slice(0,10)} · {TYPE_LABELS[ev.type] || ev.type}
                    </div>
                    {ev.project_name && (
                      <div className="text-[10px] text-slate-600 truncate">{ev.project_name}</div>
                    )}
                  </div>
                  <button onClick={e => { e.stopPropagation(); del.mutate(ev.id); }}
                    className="btn-icon p-1 opacity-0 group-hover:opacity-100 flex-shrink-0 hover:text-red-400">
                    <X size={12}/>
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-slate-500 text-sm text-center py-8">Sin próximos eventos</p>
          )}

          {/* Today button */}
          <button onClick={() => setCurrent(new Date())}
            className="w-full btn-ghost mt-4 justify-center text-xs">
            Ir a hoy
          </button>
        </div>
      </div>

      {/* Event form modal */}
      <Modal open={modal} onClose={() => setModal(false)}
        title={form.id ? 'Editar Evento' : 'Nuevo Evento'}>
        <form onSubmit={e => { e.preventDefault(); save.mutate(form); }} className="space-y-4">
          <Field label="Título" required>
            <input className="input" value={form.title}
              onChange={e => setForm({...form, title: e.target.value})} required placeholder="Nombre del evento…"/>
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Fecha Inicio" required>
              <input type="date" className="input" value={form.start_date}
                onChange={e => setForm({...form, start_date: e.target.value})} required/>
            </Field>
            <Field label="Fecha Fin">
              <input type="date" className="input" value={form.end_date||''}
                onChange={e => setForm({...form, end_date: e.target.value})}/>
            </Field>
            <Field label="Tipo">
              <select className="input" value={form.type}
                onChange={e => setForm({...form, type: e.target.value, color: TYPE_COLORS[e.target.value] || form.color})}>
                {EVENT_TYPES.map(t => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
              </select>
            </Field>
            <Field label="Proyecto">
              <select className="input" value={form.project_id||''}
                onChange={e => setForm({...form, project_id: e.target.value})}>
                <option value="">— Ninguno —</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </Field>
          </div>

          <Field label="Descripción">
            <textarea className="input" rows={2} value={form.description||''}
              onChange={e => setForm({...form, description: e.target.value})} placeholder="Detalles del evento…"/>
          </Field>

          {/* Color picker */}
          <Field label="Color del Evento">
            <div className="flex items-center gap-2">
              {Object.values(TYPE_COLORS).map(c => (
                <button type="button" key={c}
                  onClick={() => setForm({...form, color: c})}
                  className={`w-7 h-7 rounded-lg border-2 transition-all ${form.color === c ? 'border-white scale-110' : 'border-transparent'}`}
                  style={{ backgroundColor: c }}/>
              ))}
              <input type="color" className="w-7 h-7 rounded-lg cursor-pointer bg-transparent border-0" value={form.color}
                onChange={e => setForm({...form, color: e.target.value})}/>
            </div>
          </Field>

          <div className="flex items-center justify-between pt-2">
            {form.id && (
              <button type="button" className="btn-danger"
                onClick={() => del.mutate(form.id)}>
                Eliminar evento
              </button>
            )}
            <div className={`flex gap-2 ${form.id ? '' : 'ml-auto'}`}>
              <button type="button" className="btn-ghost" onClick={() => setModal(false)}>Cancelar</button>
              <button type="submit" className="btn-primary" disabled={save.isPending}>
                {save.isPending ? 'Guardando…' : form.id ? 'Actualizar' : 'Crear Evento'}
              </button>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}
