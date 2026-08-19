// src/pages/MaterialCatalog.jsx
import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { Spinner, Modal, Field, Confirm } from '../components/ui';
import { Plus, Upload, Trash2, Database, Search } from 'lucide-react';
import * as XLSX from 'xlsx';

export default function MaterialCatalog() {
  const qc = useQueryClient();
  const fileRef = useRef(null);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ name: '', category: 'Obra Gris' });
  const [delTgt, setDelTgt] = useState(null);
  const [search, setSearch] = useState('');

  const { data: catalog = [], isLoading } = useQuery({
    queryKey: ['materials_catalog'],
    queryFn: async () => {
      const { data, error } = await supabase.from('materials_catalog').select('*').order('name');
      if (error) throw error; return data;
    }
  });

  const save = useMutation({
    mutationFn: async (d) => {
      const { error } = await supabase.from('materials_catalog').insert([d]);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries(['materials_catalog']); setModal(false); }
  });

  const del = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('materials_catalog').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries(['materials_catalog']); setDelTgt(null); }
  });

  // SUBIR EXCEL MASIVO
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

        // Busca el nombre en la primera columna o en la que se llame "Material"
        const inserts = data.map(row => {
          const keys = Object.keys(row);
          const matKey = keys.find(k => /material|nombre|descripci[oó]n|articulo|item/i.test(k)) || keys[0];
          return { name: String(row[matKey]).trim(), category: 'Importado' };
        }).filter(i => i.name && i.name !== 'undefined');

        if (inserts.length > 0) {
          const { error } = await supabase.from('materials_catalog').insert(inserts);
          if (error) throw error;
          qc.invalidateQueries(['materials_catalog']);
          alert(`Se cargaron ${inserts.length} materiales al catálogo.`);
        }
      } catch (err) { alert("Error leyendo el archivo."); }
    };
    reader.readAsBinaryString(file);
    e.target.value = null;
  };

  const filtered = catalog.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));

  if (isLoading) return <Spinner/>;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Catálogo Maestro</h1>
          <p className="text-slate-400 text-sm mt-0.5">Base de datos de materiales para la constructora</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-ghost border border-green-500/30 text-green-400 hover:bg-green-500/10" onClick={() => fileRef.current?.click()}>
            <Upload size={15}/> Cargar Excel
          </button>
          <input type="file" accept=".xlsx, .xls, .csv" hidden ref={fileRef} onChange={handleExcel} />
          
          <button className="btn-primary" onClick={() => { setForm({ name: '', category: 'Obra Gris' }); setModal(true); }}>
            <Plus size={15}/> Nuevo Artículo
          </button>
        </div>
      </div>

      <div className="card p-5 mb-5 flex items-center gap-2">
        <Search size={16} className="text-slate-500"/>
        <input className="bg-transparent border-none outline-none text-slate-200 flex-1" placeholder="Buscar material en el catálogo..." value={search} onChange={e => setSearch(e.target.value)}/>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {filtered.map(c => (
          <div key={c.id} className="flex items-center justify-between bg-surface-800 p-3 rounded-xl border border-surface-600">
            <div>
              <div className="text-slate-200 font-semibold text-sm">{c.name}</div>
              <div className="text-xs text-slate-500">{c.category}</div>
            </div>
            <button className="btn-icon hover:text-red-400" onClick={() => setDelTgt(c)}><Trash2 size={14}/></button>
          </div>
        ))}
        {filtered.length === 0 && <div className="col-span-full py-10 text-center text-slate-500"><Database size={30} className="mx-auto mb-2 opacity-50"/>El catálogo está vacío o no hay coincidencias.</div>}
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title="Agregar Artículo al Catálogo">
        <div className="space-y-4">
          <Field label="Nombre del Material"><input className="input" value={form.name} onChange={e => setForm({...form, name: e.target.value})}/></Field>
          <Field label="Categoría">
            <select className="input" value={form.category} onChange={e => setForm({...form, category: e.target.value})}>
              <option>Obra Gris</option><option>Acabados</option><option>Eléctrico</option><option>Tubería y PVC</option><option>Maderas y Cubiertas</option><option>Pinturas</option><option>Tornillería y Varios</option><option>Importado</option>
            </select>
          </Field>
          <div className="flex justify-end gap-2 pt-2"><button className="btn-ghost" onClick={() => setModal(false)}>Cancelar</button><button className="btn-primary" onClick={() => save.mutate(form)}>Guardar</button></div>
        </div>
      </Modal>

      <Confirm open={!!delTgt} onClose={() => setDelTgt(null)} onConfirm={() => del.mutate(delTgt.id)} title="Eliminar" message="¿Eliminar este material del catálogo maestro?"/>
    </div>
  );
}
