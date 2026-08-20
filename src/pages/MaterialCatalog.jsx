// src/pages/MaterialCatalog.jsx
import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { Spinner, Modal, Field, Confirm } from '../components/ui';
import { Plus, Upload, Trash2, Database, Search } from 'lucide-react';
import * as XLSX from 'xlsx';

// NUEVA LISTA CONDENSADA DE 10 CATEGORÍAS + 2 AUTOMÁTICAS
const CATEGORIES = [
  'Obra Gris y Estructuras', 
  'Paredes y Repellos', 
  'Techos y Cielos', 
  'Pisos, Loza y Acabados', 
  'Puertas y Ventanas', 
  'Maderas y Metales', 
  'Pinturas y Químicos', 
  'Inst. Eléctrica', 
  'Inst. Mecánica', 
  'Consumibles y Tornillería', 
  'Importado', 
  'Agregado de Pedido'
];

export default function MaterialCatalog() {
  const qc = useQueryClient();
  const fileRef = useRef(null);
  
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ name: '', category: 'Obra Gris y Estructuras' });
  const [delTgt, setDelTgt] = useState(null);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('Todos');

  // 1. LEER DATOS
  const { data: catalog = [], isLoading } = useQuery({
    queryKey: ['materials_catalog'],
    queryFn: async () => {
      const { data, error } = await supabase.from('materials_catalog').select('*').order('name');
      if (error) throw error; return data;
    }
  });

  // 2. CREAR NUEVO
  const save = useMutation({
    mutationFn: async (d) => {
      const { error } = await supabase.from('materials_catalog').insert([d]);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries(['materials_catalog']); setModal(false); }
  });

  // 3. ACTUALIZAR CATEGORÍA RÁPIDO (INLINE EDITING)
  const updateCategory = useMutation({
    mutationFn: async ({ id, category }) => {
      const { error } = await supabase.from('materials_catalog').update({ category }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries(['materials_catalog'])
  });

  // 4. ELIMINAR
  const del = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('materials_catalog').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries(['materials_catalog']); setDelTgt(null); }
  });

  // 5. SUBIR EXCEL MASIVO
  const handleExcel = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws);

        const inserts = data.map(row => {
          const keys = Object.keys(row);
          const matKey = keys.find(k => /material|nombre|descripci[oó]n|articulo|item/i.test(k)) || keys[0];
          return { name: String(row[matKey]).trim(), category: 'Importado' };
        }).filter(i => i.name && i.name !== 'undefined');

        if (inserts.length > 0) {
          const { error } = await supabase.from('materials_catalog').insert(inserts);
          if (error) throw error;
          qc.invalidateQueries(['materials_catalog']);
          setActiveTab('Importado');
          alert(`Se cargaron ${inserts.length} materiales al catálogo.`);
        }
      } catch (err) { alert("Error leyendo el archivo."); }
    };
    reader.readAsBinaryString(file);
    e.target.value = null;
  };

  const filtered = catalog.filter(c => {
    const matchTab = activeTab === 'Todos' || c.category === activeTab;
    const matchSearch = (c.name || '').toLowerCase().includes((search || '').toLowerCase());
    return matchTab && matchSearch;
  });

  if (isLoading) return <Spinner/>;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Catálogo Maestro</h1>
          <p className="text-slate-400 text-sm mt-0.5">Base de datos centralizada de materiales</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-ghost border border-green-500/30 text-green-400 hover:bg-green-500/10" onClick={() => fileRef.current?.click()}>
            <Upload size={15}/> Cargar Excel
          </button>
          <input type="file" accept=".xlsx, .xls, .csv" hidden ref={fileRef} onChange={handleExcel} />
          
          <button className="btn-primary" onClick={() => { setForm({ name: '', category: 'Obra Gris y Estructuras' }); setModal(true); }}>
            <Plus size={15}/> Nuevo Artículo
          </button>
        </div>
      </div>

      <div className="flex overflow-x-auto gap-2 mb-4 pb-2 custom-scrollbar">
        <button 
          onClick={() => setActiveTab('Todos')}
          className={`whitespace-nowrap px-4 py-2 rounded-lg text-sm font-semibold transition-all
            ${activeTab === 'Todos' ? 'bg-brand-500 text-white' : 'bg-surface-800 text-slate-400 hover:text-slate-200'}`}
        >
          Todos ({catalog.length})
        </button>
        {CATEGORIES.map(cat => {
          const count = catalog.filter(c => c.category === cat).length;
          return (
            <button key={cat} onClick={() => setActiveTab(cat)}
              className={`whitespace-nowrap px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2
                ${activeTab === cat ? 'bg-brand-500 text-white' : 'bg-surface-800 text-slate-400 hover:text-slate-200'}
                ${['Importado', 'Agregado de Pedido'].includes(cat) && count > 0 && activeTab !== cat ? 'border border-yellow-500/50 text-yellow-500' : ''}`}
            >
              {cat}
              {count > 0 && (
                <span className={`px-1.5 py-0.5 rounded-md text-[10px] ${activeTab === cat ? 'bg-white/20' : 'bg-surface-600'}`}>
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      <div className="bg-surface-800 p-3 rounded-xl border border-surface-600 flex items-center gap-2 mb-4">
        <Search size={16} className="text-slate-400"/>
        <input 
          className="bg-transparent border-none outline-none text-slate-200 flex-1 text-sm" 
          placeholder={`Buscar en ${activeTab}...`} 
          value={search} 
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div className="table-wrap">
        <table className="w-full">
          <thead>
            <tr>
              <th className="th w-1/2">Nombre del Material</th>
              <th className="th w-1/3">Categoría</th>
              <th className="th w-20 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(c => (
              <tr key={c.id} className="tr-hover group">
                <td className="td font-medium text-slate-200">{c.name}</td>
                <td className="td">
                  <select 
                    className={`bg-surface-700 text-xs font-semibold py-1.5 px-2 rounded border border-surface-600 outline-none cursor-pointer hover:border-brand-500 transition-colors max-w-[200px] truncate
                      ${['Importado', 'Agregado de Pedido'].includes(c.category) ? 'text-yellow-500 border-yellow-500/30' : 'text-slate-300'}`}
                    value={c.category || ''}
                    onChange={(e) => updateCategory.mutate({ id: c.id, category: e.target.value })}
                  >
                    {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                  </select>
                </td>
                <td className="td text-right">
                  <button className="btn-icon text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => setDelTgt(c)}>
                    <Trash2 size={15}/>
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={3} className="td text-center py-12 text-slate-500">
                  <Database size={32} className="mx-auto mb-3 opacity-20"/>
                  <p>No se encontraron materiales.</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title="Agregar Artículo al Catálogo">
        <div className="space-y-4">
          <Field label="Nombre del Material">
            <input className="input" placeholder="Ej. Cemento UGC 50kg" value={form.name} onChange={e => setForm({...form, name: e.target.value})}/>
          </Field>
          <Field label="Categoría">
            <select className="input" value={form.category} onChange={e => setForm({...form, category: e.target.value})}>
              {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
            </select>
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <button className="btn-ghost" onClick={() => setModal(false)}>Cancelar</button>
            <button className="btn-primary" onClick={() => save.mutate(form)} disabled={!form.name.trim() || save.isPending}>
              {save.isPending ? 'Guardando...' : 'Guardar Material'}
            </button>
          </div>
        </div>
      </Modal>

      <Confirm open={!!delTgt} onClose={() => setDelTgt(null)} onConfirm={() => del.mutate(delTgt.id)} 
        title="Eliminar del Catálogo" message={`¿Estás seguro de eliminar "${delTgt?.name}"? Esto no afectará los pedidos que ya lo incluyan.`}/>
    </div>
  );
}
