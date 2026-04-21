// src/pages/Materials.jsx
import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { Modal, Confirm, Spinner, Empty, Field, Progress } from '../components/ui';
import { Plus, Pencil, Trash2, Search, Upload, DownloadCloud, Download, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx'; // Exportación e Importación nativa a Excel

const BLANK = { 
  name:'', unit:'unidades', quantity:0, used_quantity:0, cost_per_unit:0, 
  project_id:'', supplier:'', notes:'', invoice_number:'', purchase_date:'' 
};
const COMMON_UNITS = ['m³','kg','m²','ml','unidades','sacos','litros','toneladas','rollos','piezas', 'varas'];

// Función para exportar a Excel limpio
function exportExcel(filename, rows, cols) {
  const excelData = rows.map(r => {
    const rowData = {};
    cols.forEach(c => {
      let val = r[c.key];
      if (typeof val === 'number') val = Number(val) || 0;
      rowData[c.label] = val !== undefined && val !== null ? val : '—';
    });
    return rowData;
  });

  const ws = XLSX.utils.json_to_sheet(excelData);
  const wscols = cols.map(c => ({ wch: Math.max(c.label.length + 5, 20) }));
  ws['!cols'] = wscols;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Materiales");
  XLSX.writeFile(wb, filename);
}

export default function Materials() {
  const qc = useQueryClient();
  const fileInputRef = useRef(null);
  
  const [modal,  setModal]  = useState(false);
  const [form,   setForm]   = useState(BLANK);
  const [delTgt, setDelTgt] = useState(null);
  const [fProj,  setFProj]  = useState(''); 
  const [search, setSearch] = useState('');

  // 1. LEER DATOS
  const { data: rawMaterials = [], isLoading: loadingMat } = useQuery({ 
    queryKey:['materials'], 
    queryFn: async () => { 
      const { data, error } = await supabase.from('materials').select('*').order('created_at', { ascending: false }); 
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
        notes: d.notes || null,
        invoice_number: d.invoice_number || null,
        purchase_date: d.purchase_date || null
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

  // 4. IMPORTACIÓN MASIVA DESDE EXCEL
  const uploadBulk = useMutation({
    mutationFn: async (materialsArray) => {
      const { error } = await supabase.from('materials').insert(materialsArray);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries(['materials']);
      alert('¡Facturas y Materiales importados con éxito!');
    },
    onError: (error) => alert(`Error en la importación: ${error.message}`)
  });

  const materials = rawMaterials.map(m => {
    const p = projects.find(proj => proj.id === m.project_id);
    return { ...m, project_name: p ? p.name : null };
  });

  const shown = materials.filter(m => {
    if (fProj  && m.project_id !== fProj) return false;
    if (search && !m.name.toLowerCase().includes(search.toLowerCase()) && !(m.invoice_number||'').toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  // --- FUNCIONES DE EXPORTACIÓN E IMPORTACIÓN (100% EXCEL) ---

  const downloadTemplate = () => {
    const templateData = [
      {
        "Factura": "FAC-1020",
        "Fecha": "2026-04-20",
        "Material": "Cemento Fuerte",
        "Proveedor": "Cemex",
        "Cantidad": 100,
        "Unidad": "sacos",
        "Costo_Unitario": 8.50,
        "Proyecto": "Nueva Sede ICAA", // Debe coincidir con un nombre real de proyecto o dejar vacío
        "Notas": "Para fundicion principal"
      },
      {
        "Factura": "FAC-1021",
        "Fecha": "2026-04-21",
        "Material": "Varilla 3/8",
        "Proveedor": "Ferreteria EPA",
        "Cantidad": 500,
        "Unidad": "piezas",
        "Costo_Unitario": 4.25,
        "Proyecto": "", // Dejar vacío es "Inventario General"
        "Notas": "Grado 60 para inventario general"
      }
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    ws['!cols'] = [{wch:15}, {wch:15}, {wch:25}, {wch:20}, {wch:12}, {wch:12}, {wch:15}, {wch:25}, {wch:40}];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Plantilla");
    XLSX.writeFile(wb, "Plantilla_Carga_Materiales_ICAA.xlsx");
  };

  const exportToExcel = () => {
    if (shown.length === 0) return alert("No hay datos para exportar.");
    
    const formattedData = shown.map(m => ({
      ...m,
      disponible: m.quantity - (m.used_quantity || 0),
      total_cost: m.quantity * (m.cost_per_unit || 0),
      project_label: m.project_name || 'Inventario General'
    }));

    exportExcel(`Materiales_${fProj ? 'Proyecto' : 'General'}.xlsx`, formattedData, [
      {label: 'No. Factura', key: 'invoice_number'},
      {label: 'Fecha Compra', key: 'purchase_date'},
      {label: 'Material', key: 'name'},
      {label: 'Proyecto', key: 'project_label'},
      {label: 'Cantidad Comprada', key: 'quantity'},
      {label: 'Cantidad Usada', key: 'used_quantity'},
      {label: 'Disponible', key: 'disponible'},
      {label: 'Unidad', key: 'unit'},
      {label: 'Costo Unitario ($)', key: 'cost_per_unit'},
      {label: 'Costo Total ($)', key: 'total_cost'},
      {label: 'Proveedor', key: 'supplier'},
      {label: 'Notas', key: 'notes'}
    ]);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      
      // Convertir la hoja de Excel a un arreglo JSON
      const rows = XLSX.utils.sheet_to_json(worksheet);

      if (rows.length === 0) return alert("El archivo Excel está vacío.");

      const dataToInsert = rows.map(row => {
        const projNameInput = row["Proyecto"]?.toString().trim();
        let foundProjectId = null;
        if (projNameInput) {
          const matchedProject = projects.find(p => p.name.toLowerCase() === projNameInput.toLowerCase());
          if (matchedProject) foundProjectId = matchedProject.id;
        }

        // Leer fechas y formatearlas correctamente si Excel las manda como texto raro
        let dateString = row["Fecha"]?.toString().trim() || null;
        
        return {
          invoice_number: row["Factura"]?.toString().trim() || null,
          purchase_date: dateString,
          name: row["Material"]?.toString().trim(),
          supplier: row["Proveedor"]?.toString().trim() || null,
          quantity: parseFloat(row["Cantidad"]) || 0,
          used_quantity: 0, 
          unit: row["Unidad"]?.toString().trim() || 'unidades',
          cost_per_unit: parseFloat(row["Costo_Unitario"]) || 0,
          project_id: foundProjectId,
          notes: row["Notas"]?.toString().trim() || null
        };
      }).filter(m => m.name); // Ignorar lineas vacías

      if(dataToInsert.length > 0) {
        uploadBulk.mutate(dataToInsert);
      } else {
        alert("No se encontraron materiales válidos. Revisa que usaste la plantilla correcta.");
      }
    } catch (err) {
      console.error(err);
      alert("Error leyendo el archivo. Asegúrate de subir un archivo .xlsx de Excel válido.");
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
          <h1 className="page-title">Compras y Materiales</h1>
          <p className="text-slate-400 text-sm mt-0.5">
            {shown.length} registros · Inversión: <span className="text-white font-semibold">${totalCost.toLocaleString()}</span>
            {' '}· Consumido: <span className="text-brand-400 font-semibold">${usedCost.toLocaleString()}</span>
          </p>
        </div>
        
        <div className="flex gap-2 flex-wrap items-center">
          {/* Aceptamos SOLO archivos de excel */}
          <input type="file" accept=".xlsx, .xls" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
          
          <button className="btn-ghost text-xs border border-surface-600" onClick={downloadTemplate} title="Descargar plantilla XLSX">
            <DownloadCloud size={14} className="mr-1"/> Plantilla Excel
          </button>
          
          <button className="btn-ghost text-xs border border-brand-500/30 text-brand-400 hover:bg-brand-500/10" 
            onClick={() => fileInputRef.current?.click()} disabled={uploadBulk.isPending}>
            {uploadBulk.isPending ? <Spinner size="sm"/> : <Upload size={14} className="mr-1"/>} Importar Excel
          </button>

          <button className="btn-ghost text-xs border border-green-600/30 text-green-400 hover:bg-green-500/10" onClick={exportToExcel}>
            <FileSpreadsheet size={14} className="mr-1"/> Exportar Excel
          </button>

          <button className="btn-primary ml-2" onClick={() => { setForm(BLANK); setModal(true); }}>
            <Plus size={15}/> Registrar Compra
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
                <div className="text-[10px] text-slate-600">{pm.length} facturas/items</div>
              </div>
            );
          })}
        </div>
      )}

      {/* FILTROS */}
      <div className="flex flex-wrap gap-2 mb-4 items-center bg-surface-800 p-2 rounded-xl border border-surface-600">
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"/>
          <input className="input pl-8 max-w-[250px]" placeholder="Buscar material o # factura..." value={search} onChange={e => setSearch(e.target.value)}/>
        </div>
        
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-400 uppercase ml-2">Filtrar por Proyecto:</span>
          <select className="input min-w-[200px] border-brand-500/30" value={fProj} onChange={e => setFProj(e.target.value)}>
            <option value="">🏠 Todos los proyectos (Inventario General)</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>

        {(fProj||search) && (
          <button className="btn-ghost text-xs ml-auto text-brand-400" onClick={() => { setFProj(''); setSearch(''); }}>Limpiar Filtros</button>
        )}
      </div>

      {/* TABLA PRINCIPAL */}
      <div className="table-wrap">
        <table className="w-full">
          <thead>
            <tr>
              <th className="th">Material y Compra</th>
              <th className="th">Proyecto</th>
              <th className="th text-right">Cantidad</th>
              <th className="th text-right">Usado</th>
              <th className="th text-center w-28">Consumo</th>
              <th className="th text-right">Disponible</th>
              <th className="th text-right">Costo/U</th>
              <th className="th text-right">Costo Total</th>
              <th className="th">Proveedor</th>
              <th className="th w-16"/>
            </tr>
          </thead>
          <tbody>
            {shown.map(m => {
              const available = m.quantity - (m.used_quantity||0);
              const usedPct   = m.quantity > 0 ? Math.round(((m.used_quantity||0)/m.quantity)*100) : 0;
              const total     = m.quantity * (m.cost_per_unit||0);
              return (
                <tr key={m.id} className="tr-hover">
                  <td className="td">
                    <div className="font-semibold text-slate-200">{m.name}</div>
                    <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                      {m.invoice_number ? `FAC: ${m.invoice_number}` : 'S/N'} • {m.purchase_date || 'Sin fecha'}
                    </div>
                  </td>
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
                  <td className="td text-right font-mono text-slate-300 font-semibold">${total.toLocaleString()}</td>
                  <td className="td text-slate-400 text-xs">{m.supplier || '—'}</td>
                  <td className="td">
                    <div className="flex gap-1 justify-end">
                      <button className="btn-icon" onClick={() => { setForm({...m, project_id:m.project_id||''}); setModal(true); }}><Pencil size={12}/></button>
                      <button className="btn-icon hover:text-red-400" onClick={() => setDelTgt(m)}><Trash2 size={12}/></button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {shown.length === 0 && (
              <tr><td colSpan={10} className="td text-center text-slate-500 py-10">No hay registros de compras</td></tr>
            )}
          </tbody>
          {shown.length > 0 && (
            <tfoot>
              <tr className="bg-surface-700/50">
                <td className="td font-bold text-slate-300" colSpan={7}>Total Inversión Mostrada:</td>
                <td className="td text-right font-mono font-bold text-white">${totalCost.toLocaleString()}</td>
                <td className="td" colSpan={2}/>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* MODAL CREAR / EDITAR */}
      <Modal open={modal} onClose={() => setModal(false)} title={form.id ? 'Editar Registro' : 'Registrar Compra / Material'} size="lg">
        <form onSubmit={e => { e.preventDefault(); save.mutate(form); }} className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <Field label="Descripción del Material" required>
              <input className="input" value={form.name} onChange={e => setForm({...form,name:e.target.value})} required placeholder="Ej: Varilla Corrugada #3"/>
            </Field>
          </div>
          
          <Field label="No. Factura (Opcional)">
            <input className="input" value={form.invoice_number||''} onChange={e => setForm({...form,invoice_number:e.target.value})} placeholder="FAC-XXXX"/>
          </Field>
          <Field label="Fecha de Compra">
            <input type="date" className="input" value={form.purchase_date||''} onChange={e => setForm({...form,purchase_date:e.target.value})}/>
          </Field>

          <Field label="Cantidad Comprada" required>
            <input type="number" className="input" value={form.quantity} min={0} step="0.01" required
              onChange={e => setForm({...form,quantity:parseFloat(e.target.value)||0})}/>
          </Field>
          <Field label="Unidad">
            <select className="input" value={form.unit} onChange={e => setForm({...form,unit:e.target.value})}>
              {COMMON_UNITS.map(u => <option key={u}>{u}</option>)}
            </select>
          </Field>

          <Field label="Cantidad Consumida (Usada)">
            <input type="number" className="input" value={form.used_quantity} min={0} step="0.01"
              onChange={e => setForm({...form,used_quantity:parseFloat(e.target.value)||0})}/>
          </Field>
          <Field label="Costo por Unidad ($)">
            <input type="number" className="input" value={form.cost_per_unit} min={0} step="0.01"
              onChange={e => setForm({...form,cost_per_unit:parseFloat(e.target.value)||0})}/>
          </Field>

          <Field label="Asignar a Proyecto">
            <select className="input" value={form.project_id||''} onChange={e => setForm({...form,project_id:e.target.value})}>
              <option value="">— Inventario General (Sin asignar) —</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
          <Field label="Proveedor">
            <input className="input" value={form.supplier||''} onChange={e => setForm({...form,supplier:e.target.value})} placeholder="Nombre de la ferretería"/>
          </Field>

          <div className="col-span-2">
            <Field label="Notas Adicionales">
              <textarea className="input" rows={2} value={form.notes||''} onChange={e => setForm({...form,notes:e.target.value})}/>
            </Field>
          </div>

          {form.quantity > 0 && form.cost_per_unit > 0 && (
            <div className="col-span-2 bg-surface-700 rounded-lg p-3 border border-surface-600 flex justify-between items-center">
              <span className="text-slate-400 text-sm">Inversión Total de la Línea: </span>
              <span className="font-display font-black text-white text-xl">
                ${(form.quantity * form.cost_per_unit).toLocaleString()}
              </span>
            </div>
          )}

          <div className="col-span-2 flex justify-end gap-2 pt-2 border-t border-surface-600 mt-2">
            <button type="button" className="btn-ghost" onClick={() => setModal(false)}>Cancelar</button>
            <button type="submit" className="btn-primary" disabled={save.isPending}>
              {save.isPending ? 'Guardando...' : (form.id ? 'Actualizar Registro' : 'Guardar Compra')}
            </button>
          </div>
        </form>
      </Modal>

      <Confirm open={!!delTgt} onClose={() => setDelTgt(null)} onConfirm={() => del.mutate(delTgt.id)}
        title="Eliminar Registro" message={`¿Estás seguro de eliminar el registro de "${delTgt?.name}"? Esta acción no afectará el presupuesto del proyecto si ya fue pagado, pero borrará el historial.`}/>
    </div>
  );
}
