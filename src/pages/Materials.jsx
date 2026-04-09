// src/pages/Materials.jsx
import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { Modal, Confirm, Spinner, Empty, Field, Progress } from '../components/ui';
import { Plus, Pencil, Trash2, Search, Upload, DownloadCloud, Download } from 'lucide-react';

const BLANK = { name:'', unit:'unidades', quantity:0, used_quantity:0, cost_per_unit:0, project_id:'', supplier:'', notes:'' };
const COMMON_UNITS = ['m³','kg','m²','ml','unidades','sacos','litros','toneladas','rollos','piezas'];

export default function Materials() {
  const qc = useQueryClient();
  const fileInputRef = useRef(null);
  
  const [modal,  setModal]  = useState(false);
  const [form,   setForm]   = useState(BLANK);
  const [delTgt, setDelTgt] = useState(null);
  const [fProj,  setFProj]  = useState(''); // Este es el filtro de proyectos
  const [search, setSearch] = useState('');

  // 1. LEER MATERIALES Y PROYECTOS
  const { data: rawMaterials = [], isLoading: loadingMat } = useQuery({ 
    queryKey:['materials'], 
    queryFn: async () => { 
      const { data, error } = await supabase.from('materials').select('*'); 
      if(error) throw error;
      return data; 
    }
  });
  const { data: projects  = [], isLoading: loadingProj } = useQuery({ 
    queryKey:['projects'],  
    queryFn: async () => { 
      const { data, error } = await supabase.from('projects').select('*'); 
      if(error) throw error;
      return data; 
    }
  });

  // 2. CREAR O ACTUALIZAR
  const save = useMutation({
    mutationFn: async (d) => {
      const dataToSave = {
        name: d.name,
        unit: d.unit,
        quantity: d.quantity || 0,
        used_quantity: d.used_quantity || 0,
        cost_per_unit: d.cost_per_unit || 0,
        project_id: d.project_id || null,
        supplier: d.supplier || null,
        notes: d.notes || null
      };
      
      if (d.id) {
        const { data, error } = await supabase.from('materials').update(dataToSave).eq('id', d.id).select();
        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase.from('materials').insert([dataToSave]).select();
        if (error) throw error;
        return data;
      }
    },
    onSuccess:  () => { qc.invalidateQueries(['materials']); setModal(false); },
    onError: (error) => alert(`Error al guardar: ${error.message}`)
  });

  // 3. ELIMINAR
  const del = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('materials').delete().eq('id', id);
      if (error) throw error;
      return true;
    },
    onSuccess:  () => qc.invalidateQueries(['materials']),
  });

  // 4. IMPORTACIÓN MASIVA
  const uploadBulk = useMutation({
    mutationFn: async (materialsArray) => {
      const { error } = await supabase.from('materials').insert(materialsArray);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries(['materials']);
      alert('¡Materiales importados con éxito!');
    },
    onError: (error) => alert(`Error en la importación: ${error.message}`)
  });

  // Procesamos para cruzar datos (vincular el nombre del proyecto)
  const materials = rawMaterials.map(m => {
    const p = projects.find(proj => proj.id === m.project_id);
    return { ...m, project_name: p ? p.name : null };
  });

  // Aplicamos los filtros
  const shown = materials.filter(m => {
    if (fProj  && m.project_id !== fProj) return false;
    if (search && !m.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  // --- FUNCIONES DE EXPORTACIÓN E IMPORTACIÓN ---

  // Descargar la plantilla vacía
  const downloadTemplate = () => {
    const headers = "nombre,unidad,cantidad,cantidad_usada,costo_unitario,proveedor,notas\n";
    const example1 = "Cemento Fuerte,sacos,100,0,8.50,Cemex,Para fundicion principal\n";
    const example2 = "Varilla 3/8,piezas,500,50,4.25,Aceros Nacionales,Grado 60\n";
    
    const blob = new Blob([headers + example1 + example2], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "plantilla_importacion_materiales.csv";
    link.click();
  };

  // NUEVO: Exportar los datos que estás viendo en pantalla a Excel (CSV)
  const exportDataToCSV = () => {
    if (shown.length === 0) return alert("No hay datos para exportar.");

    const headers = ["Nombre", "Proyecto", "Cantidad", "Usado", "Disponible", "Unidad", "Costo_Unitario", "Costo_Total", "Proveedor", "Notas"];
    
    const rows = shown.map(m => {
      const available = m.quantity - (m.used_quantity || 0);
      const total = m.quantity * (m.cost_per_unit || 0);
      
      // Limpiamos saltos de línea en las notas para no romper el Excel
      const notasLimpias = m.notes ? m.notes.replace(/\n/g, ' ') : '';

      return [
        `"${m.name || ''}"`,
        `"${m.project_name || 'Inventario General'}"`,
        m.quantity || 0,
        m.used_quantity || 0,
        available,
        `"${m.unit || ''}"`,
        m.cost_per_unit || 0,
        total,
        `"${m.supplier || ''}"`,
        `"${notasLimpias}"`
      ].join(',');
    });

    const csvContent = headers.join(',') + '\n' + rows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    // Le pone nombre inteligente dependiendo de si filtras o no
    link.download = fProj ? `materiales_proyecto_filtrado.csv` : `base_datos_materiales.csv`;
    link.click();
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim() !== ''); 
      
      if (lines.length < 2) {
        return alert("El archivo está vacío o no tiene el formato correcto.");
      }

      const dataToInsert = lines.slice(1).map(line => {
        const cols = line.split(','); 
        return {
          name: cols[0]?.trim(),
          unit: cols[1]?.trim() || 'unidades',
          quantity: parseFloat(cols[2]) || 0,
          used_quantity: parseFloat(cols[3]) || 0,
          cost_per_unit: parseFloat(cols[4]) || 0,
          supplier: cols[5]?.trim() || null,
          notes: cols[6]?.trim() || null,
          project_id: null 
        };
      }).filter(m => m.name); 

      if(dataToInsert.length > 0) {
        uploadBulk.mutate(dataToInsert);
      }
    } catch (err) {
      alert("Error leyendo el archivo. Asegúrate de que sea un archivo CSV.");
    } finally {
      e.target.value = ''; 
    }
  };

  const totalCost   = shown.reduce((s,m) => s + (m.quantity * (m.cost_per_unit||0)), 0);
  const usedCost    = shown.reduce((s,m) => s + ((m.used_quantity||0) * (m.cost_per_unit||0)), 0);

  if (loadingMat || loadingProj) return <Spinner/>;

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
        
        <div className="flex gap-2 flex-wrap items-center">
          <input type="file" accept=".csv" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
          
          <button className="btn-ghost text-xs" onClick={downloadTemplate} title="Descargar plantilla vacía">
            <DownloadCloud size={14} className="mr-1"/> Plantilla
          </button>
          
          <button className="btn-ghost text-xs border border-surface-600" onClick={() => fileInputRef.current?.click()} disabled={uploadBulk.isPending} title="Subir archivo lleno">
            {uploadBulk.isPending ? <Spinner size="sm"/> : <Upload size={14} className="mr-1"/>} Importar
          </button>

          {/* NUEVO: Botón de exportación */}
          <button className="btn-ghost text-xs border border-green-600/30 text-green-400 hover:bg-green-500/10" onClick={exportDataToCSV} title="Descargar lo que ves en pantalla">
            <Download size={14} className="mr-1"/> Exportar Excel
          </button>

          <button className="btn-primary ml-2" onClick={() => { setForm(BLANK); setModal(true); }}>
            <Plus size={15}/> Nuevo
          </button>
        </div>
      </div>

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

      {/* ESTE ES EL FILTRO DE PROYECTOS EN PANTALLA */}
      <div className="flex flex-wrap gap-2 mb-4 items-center bg-surface-800 p-2 rounded-xl border border-surface-600">
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"/>
          <input className="input pl-8 max-w-[220px]" placeholder="Buscar material…" value={search} onChange={e => setSearch(e.target.value)}/>
        </div>
        
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-400 uppercase ml-2">Filtrar por Proyecto:</span>
          <select className="input min-w-[200px] border-brand-500/30" value={fProj} onChange={e => setFProj(e.target.value)}>
            <option value="">🏠 Todos los proyectos (Inventario General)</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>

        {(fProj||search) && (
          <button className="btn-ghost text-xs ml-auto" onClick={() => { setFProj(''); setSearch(''); }}>Limpiar Filtros</button>
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
                <td className="td font-bold text-slate-300" colSpan={7}>Totales de los materiales mostrados:</td>
                <td className="td text-right font-mono font-bold text-white">${totalCost.toLocaleString()}</td>
                <td className="td" colSpan={2}/>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title={form.id ? 'Editar Material' : 'Nuevo Material'} size="lg">
        <form onSubmit={e => { e.preventDefault(); save.mutate(form); }} className="grid grid-cols-2 gap-4">
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
              {save.isPending ? 'Guardando...' : (form.id ? 'Actualizar' : 'Agregar Material')}
            </button>
          </div>
        </form>
      </Modal>

      <Confirm open={!!delTgt} onClose={() => setDelTgt(null)} onConfirm={() => del.mutate(delTgt.id)}
        title="Eliminar Material" message={`¿Eliminar "${delTgt?.name}"?`}/>
    </div>
  );
}
