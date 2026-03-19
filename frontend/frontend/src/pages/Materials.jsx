// src/pages/Materials.jsx
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import { Modal, Confirm, Spinner, Empty, Field, Progress } from '../components/ui';
import { Plus, Pencil, Trash2, Package, Search, Filter } from 'lucide-react';

const BLANK = { name:'', unit:'unidades', quantity:0, used_quantity:0, cost_per_unit:0, project_id:'', supplier:'', notes:'' };
const COMMON_UNITS = ['m³','kg','m²','ml','unidades','sacos','litros','toneladas','rollos','piezas'];

export default function Materials() {
  const qc = useQueryClient();
  const [modal,  setModal]  = useState(false);
  const [form,   setForm]   = useState(BLANK);
  const [delTgt, setDelTgt] = useState(null);
  const [fProj,  setFProj]  = useState('');
  const [search, setSearch] = useState('');

  const { data: materials = [], isLoading } = useQuery({ queryKey:['materials'], queryFn: () => api.get('/materials').then(r=>r.data) });
  const { data: projects  = [] }            = useQuery({ queryKey:['projects'],  queryFn: () => api.get('/projects').then(r=>r.data) });

  const save = useMutation({
    mutationFn: d => form.id ? api.put(`/materials/${form.id}`, d) : api.post('/materials', d),
    onSuccess:  () => { qc.invalidateQueries(['materials']); setModal(false); },
  });
  const del = useMutation({
    mutationFn: id => api.delete(`/materials/${id}`),
    onSuccess:  () => qc.invalidateQueries(['materials']),
  });

  const shown = materials.filter(m => {
    if (fProj  && m.project_id !== fProj) return false;
    if (search && !m.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const totalCost   = shown.reduce((s,m) => s + (m.quantity * (m.cost_per_unit||0)), 0);
  const usedCost    = shown.reduce((s,m) => s + ((m.used_quantity||0) * (m.cost_per_unit||0)), 0);

  if (isLoading) return <Spinner/>;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Materiales</h1>
          <p className="text-slate-400 text-sm mt-0.5">
            {shown.length} material(es) · Costo total: <span className="text-white font-semibold">${totalCost.toLocaleString()}</span>
            {' '}· Usado: <span className="text-brand-400 font-semibold">${usedCost.toLocaleString()}</span>
          </p>
        </div>
        <button className="btn-primary" onClick={() => { setForm(BLANK); setModal(true); }}>
          <Plus size={15}/> Nuevo Material
        </button>
      </div>

      {/* Summary cards per project */}
      {projects.filter(p => materials.some(m => m.project_id === p.id)).length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 mb-5">
          {projects.filter(p => materials.some(m => m.project_id === p.id)).map(p => {
            const pm   = materials.filter(m => m.project_id === p.id);
            const cost = pm.reduce((s,m) => s + (m.quantity*(m.cost_per_unit||0)),0);
            return (
              <div key={p.id}
                className={`card p-3 cursor-pointer transition-all hover:border-surface-400 ${fProj===p.id?'border-brand-500/50':''}`}
                onClick={() => setFProj(fProj===p.id?'':p.id)}>
                <div className="text-xs text-slate-500 truncate mb-1">{p.name}</div>
                <div className="text-lg font-display font-black text-white">${(cost/1000).toFixed(0)}K</div>
                <div className="text-[10px] text-slate-600">{pm.length} material(es)</div>
              </div>
            );
          })}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4 items-center">
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"/>
          <input className="input pl-8 max-w-[220px]" placeholder="Buscar material…" value={search} onChange={e => setSearch(e.target.value)}/>
        </div>
        <select className="input max-w-[200px]" value={fProj} onChange={e => setFProj(e.target.value)}>
          <option value="">Todos los proyectos</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        {(fProj||search) && (
          <button className="btn-ghost text-xs" onClick={() => { setFProj(''); setSearch(''); }}>Limpiar</button>
        )}
      </div>

      <div className="table-wrap">
        <table className="w-full">
          <thead>
            <tr>
              <th className="th">Material</th>
              <th className="th">Proyecto</th>
              <th className="th text-right">Cantidad</th>
              <th className="th text-right">Usado</th>
              <th className="th text-center w-32">Consumo</th>
              <th className="th text-right">Disponible</th>
              <th className="th text-right">Costo/U</th>
              <th className="th text-right">Total</th>
              <th className="th">Proveedor</th>
              <th className="th w-20"/>
            </tr>
          </thead>
          <tbody>
            {shown.map(m => {
              const available = m.quantity - (m.used_quantity||0);
              const usedPct   = m.quantity > 0 ? Math.round(((m.used_quantity||0)/m.quantity)*100) : 0;
              const total     = m.quantity * (m.cost_per_unit||0);
              return (
                <tr key={m.id} className="tr-hover">
                  <td className="td font-semibold text-slate-200">{m.name}</td>
                  <td className="td text-slate-400 text-xs max-w-[140px] truncate">{m.project_name || '—'}</td>
                  <td className="td text-right font-mono text-slate-300">
                    {m.quantity} <span className="text-slate-600 text-[10px]">{m.unit}</span>
                  </td>
                  <td className="td text-right font-mono text-brand-400">{m.used_quantity||0}</td>
                  <td className="td">
                    <Progress value={usedPct} size="xs" showLabel={false}/>
                    <div className="text-right text-[10px] text-slate-500 mt-0.5">{usedPct}%</div>
                  </td>
                  <td className="td text-right font-mono">
                    <span className={available < 0 ? 'text-red-400' : available === 0 ? 'text-yellow-400' : 'text-green-400'}>
                      {available}
                    </span>
                  </td>
                  <td className="td text-right font-mono text-slate-400">${m.cost_per_unit||0}</td>
                  <td className="td text-right font-mono text-slate-300">${total.toLocaleString()}</td>
                  <td className="td text-slate-400 text-xs">{m.supplier || '—'}</td>
                  <td className="td">
                    <div className="flex gap-1">
                      <button className="btn-icon" onClick={() => { setForm({...m, project_id:m.project_id||''}); setModal(true); }}><Pencil size={12}/></button>
                      <button className="btn-icon hover:text-red-400" onClick={() => setDelTgt(m)}><Trash2 size={12}/></button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {shown.length === 0 && (
              <tr><td colSpan={10} className="td text-center text-slate-500 py-10">Sin materiales</td></tr>
            )}
          </tbody>
          {shown.length > 0 && (
            <tfoot>
              <tr className="bg-surface-700/50">
                <td className="td font-bold text-slate-300" colSpan={7}>Totales</td>
                <td className="td text-right font-mono font-bold text-white">${totalCost.toLocaleString()}</td>
                <td className="td" colSpan={2}/>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title={form.id ? 'Editar Material' : 'Nuevo Material'} size="lg">
        <form onSubmit={e => { e.preventDefault(); save.mutate({ ...form, project_id: form.project_id||null }); }}
          className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <Field label="Nombre del Material" required>
              <input className="input" value={form.name} onChange={e => setForm({...form,name:e.target.value})} required placeholder="Concreto premezclado 210 kg/cm²…"/>
            </Field>
          </div>
          <Field label="Cantidad Total">
            <input type="number" className="input" value={form.quantity} min={0} step="0.01"
              onChange={e => setForm({...form,quantity:parseFloat(e.target.value)||0})}/>
          </Field>
          <Field label="Unidad">
            <select className="input" value={form.unit} onChange={e => setForm({...form,unit:e.target.value})}>
              {COMMON_UNITS.map(u => <option key={u}>{u}</option>)}
            </select>
          </Field>
          <Field label="Cantidad Usada">
            <input type="number" className="input" value={form.used_quantity} min={0} step="0.01"
              onChange={e => setForm({...form,used_quantity:parseFloat(e.target.value)||0})}/>
          </Field>
          <Field label="Costo por Unidad ($)">
            <input type="number" className="input" value={form.cost_per_unit} min={0} step="0.01"
              onChange={e => setForm({...form,cost_per_unit:parseFloat(e.target.value)||0})}/>
          </Field>
          <Field label="Proyecto">
            <select className="input" value={form.project_id||''} onChange={e => setForm({...form,project_id:e.target.value})}>
              <option value="">— Ninguno —</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
          <Field label="Proveedor">
            <input className="input" value={form.supplier||''} onChange={e => setForm({...form,supplier:e.target.value})} placeholder="Nombre del proveedor"/>
          </Field>
          <div className="col-span-2">
            <Field label="Notas">
              <textarea className="input" rows={2} value={form.notes||''} onChange={e => setForm({...form,notes:e.target.value})}/>
            </Field>
          </div>
          {/* Cost preview */}
          {form.quantity > 0 && form.cost_per_unit > 0 && (
            <div className="col-span-2 bg-surface-700 rounded-lg p-3 border border-surface-600 text-sm">
              <span className="text-slate-400">Costo total estimado: </span>
              <span className="font-display font-black text-white text-lg">
                ${(form.quantity * form.cost_per_unit).toLocaleString()}
              </span>
            </div>
          )}
          <div className="col-span-2 flex justify-end gap-2 pt-1">
            <button type="button" className="btn-ghost" onClick={() => setModal(false)}>Cancelar</button>
            <button type="submit" className="btn-primary" disabled={save.isPending}>
              {form.id ? 'Actualizar' : 'Agregar Material'}
            </button>
          </div>
        </form>
      </Modal>

      <Confirm open={!!delTgt} onClose={() => setDelTgt(null)} onConfirm={() => del.mutate(delTgt.id)}
        title="Eliminar Material" message={`¿Eliminar "${delTgt?.name}"?`}/>
    </div>
  );
}
