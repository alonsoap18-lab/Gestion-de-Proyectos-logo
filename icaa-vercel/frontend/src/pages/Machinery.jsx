// src/pages/Machinery.jsx
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import { Modal, Confirm, Badge, Spinner, Empty, Field, StatCard } from '../components/ui';
import { Plus, Pencil, Trash2, Wrench, Search } from 'lucide-react';

const BLANK = { name:'', type:'', brand:'', model:'', serial_number:'', status:'Available', project_id:'', notes:'' };
const STATUSES = ['Available','In Use','Maintenance'];

export default function Machinery() {
  const qc = useQueryClient();
  const [modal,  setModal]  = useState(false);
  const [form,   setForm]   = useState(BLANK);
  const [delTgt, setDelTgt] = useState(null);
  const [fSt,    setFSt]    = useState('');
  const [search, setSearch] = useState('');

  const { data: machinery = [], isLoading } = useQuery({ queryKey:['machinery'], queryFn: () => api.get('/machinery').then(r=>r.data) });
  const { data: projects  = [] }            = useQuery({ queryKey:['projects'],  queryFn: () => api.get('/projects').then(r=>r.data) });

  const save = useMutation({
    mutationFn: d => form.id ? api.put(`/machinery/${form.id}`, d) : api.post('/machinery', d),
    onSuccess:  () => { qc.invalidateQueries(['machinery']); setModal(false); },
  });
  const del = useMutation({
    mutationFn: id => api.delete(`/machinery/${id}`),
    onSuccess:  () => qc.invalidateQueries(['machinery']),
  });

  const shown = machinery.filter(m => {
    if (fSt && m.status !== fSt) return false;
    if (search && !m.name.toLowerCase().includes(search.toLowerCase()) && !m.type?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const counts = {
    Available:   machinery.filter(m => m.status==='Available').length,
    'In Use':    machinery.filter(m => m.status==='In Use').length,
    Maintenance: machinery.filter(m => m.status==='Maintenance').length,
  };

  if (isLoading) return <Spinner/>;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Maquinaria</h1>
          <p className="text-slate-400 text-sm mt-0.5">{machinery.length} equipo(s) registrado(s)</p>
        </div>
        <button className="btn-primary" onClick={() => { setForm(BLANK); setModal(true); }}>
          <Plus size={15}/> Nuevo Equipo
        </button>
      </div>

      {/* Status cards */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {[
          ['Available',   'Disponibles',  'green'],
          ['In Use',      'En Uso',       'brand'],
          ['Maintenance', 'Mantenimiento','yellow'],
        ].map(([s, l, c]) => (
          <div key={s} className={`card p-4 cursor-pointer transition-all hover:border-surface-400 ${fSt===s?'border-brand-500/50':''}`}
            onClick={() => setFSt(fSt===s?'':s)}>
            <div className={`text-3xl font-display font-black ${c==='green'?'text-green-400':c==='brand'?'text-brand-400':'text-yellow-400'}`}>
              {counts[s]}
            </div>
            <div className="text-[11px] text-slate-500 uppercase tracking-wider">{l}</div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative mb-4 max-w-xs">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"/>
        <input className="input pl-8" placeholder="Buscar equipo…" value={search} onChange={e => setSearch(e.target.value)}/>
      </div>

      <div className="table-wrap">
        <table className="w-full">
          <thead>
            <tr>
              <th className="th">Equipo</th>
              <th className="th">Tipo</th>
              <th className="th">Marca / Modelo</th>
              <th className="th">N° Serie</th>
              <th className="th">Estado</th>
              <th className="th">Proyecto Asignado</th>
              <th className="th">Notas</th>
              <th className="th w-20"/>
            </tr>
          </thead>
          <tbody>
            {shown.map(m => (
              <tr key={m.id} className="tr-hover">
                <td className="td font-semibold text-slate-200">{m.name}</td>
                <td className="td text-slate-400">{m.type || '—'}</td>
                <td className="td text-slate-400 text-xs">{[m.brand, m.model].filter(Boolean).join(' / ') || '—'}</td>
                <td className="td font-mono text-xs text-slate-500">{m.serial_number || '—'}</td>
                <td className="td"><Badge status={m.status}/></td>
                <td className="td text-slate-400 text-xs max-w-[140px] truncate">{m.project_name || '—'}</td>
                <td className="td text-slate-500 text-xs max-w-[150px] truncate">{m.notes || '—'}</td>
                <td className="td">
                  <div className="flex gap-1">
                    <button className="btn-icon" onClick={() => { setForm({...m, project_id: m.project_id||''}); setModal(true); }}><Pencil size={12}/></button>
                    <button className="btn-icon hover:text-red-400" onClick={() => setDelTgt(m)}><Trash2 size={12}/></button>
                  </div>
                </td>
              </tr>
            ))}
            {shown.length === 0 && (
              <tr><td colSpan={8} className="td text-center text-slate-500 py-10">Sin resultados</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title={form.id ? 'Editar Equipo' : 'Nuevo Equipo'} size="lg">
        <form onSubmit={e => { e.preventDefault(); save.mutate({ ...form, project_id: form.project_id||null }); }}
          className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <Field label="Nombre del Equipo" required>
              <input className="input" value={form.name} onChange={e => setForm({...form,name:e.target.value})} required placeholder="Excavadora CAT 320…"/>
            </Field>
          </div>
          <Field label="Tipo">
            <input className="input" value={form.type||''} onChange={e => setForm({...form,type:e.target.value})} placeholder="Excavadora, Grúa, Compactadora…"/>
          </Field>
          <Field label="Marca">
            <input className="input" value={form.brand||''} onChange={e => setForm({...form,brand:e.target.value})} placeholder="CAT, Liebherr, Wacker…"/>
          </Field>
          <Field label="Modelo">
            <input className="input" value={form.model||''} onChange={e => setForm({...form,model:e.target.value})}/>
          </Field>
          <Field label="N° de Serie">
            <input className="input" value={form.serial_number||''} onChange={e => setForm({...form,serial_number:e.target.value})}/>
          </Field>
          <Field label="Estado">
            <select className="input" value={form.status} onChange={e => setForm({...form,status:e.target.value})}>
              {STATUSES.map(s => <option key={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Proyecto Asignado">
            <select className="input" value={form.project_id||''} onChange={e => setForm({...form,project_id:e.target.value})}>
              <option value="">— Ninguno —</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
          <div className="col-span-2">
            <Field label="Notas">
              <textarea className="input" rows={2} value={form.notes||''} onChange={e => setForm({...form,notes:e.target.value})} placeholder="Observaciones, condición actual…"/>
            </Field>
          </div>
          <div className="col-span-2 flex justify-end gap-2 pt-1">
            <button type="button" className="btn-ghost" onClick={() => setModal(false)}>Cancelar</button>
            <button type="submit" className="btn-primary" disabled={save.isPending}>
              {form.id ? 'Actualizar' : 'Agregar Equipo'}
            </button>
          </div>
        </form>
      </Modal>

      <Confirm open={!!delTgt} onClose={() => setDelTgt(null)} onConfirm={() => del.mutate(delTgt.id)}
        title="Eliminar Equipo" message={`¿Eliminar "${delTgt?.name}"?`}/>
    </div>
  );
}
