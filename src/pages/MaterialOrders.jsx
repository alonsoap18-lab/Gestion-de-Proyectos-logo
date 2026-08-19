// src/pages/MaterialOrders.jsx
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { Modal, Confirm, Spinner, Field } from '../components/ui';
import { Plus, Trash2, Search, ShoppingCart, Calendar, MapPin, Download, CheckSquare } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { format } from 'date-fns';
import * as XLSX from 'xlsx';

// Unidades adaptadas a CR
const UNITS = ['Unidades (ud)', 'Sacos', 'Varillas', 'Quintales (qq)', 'Metros Cúbicos (m³)', 'Viajes', 'Tramos / Tubos', 'Rollos', 'Láminas', 'Reglas', 'Metros Cuadrados (m²)', 'Cajas', 'Galones (gal)', 'Cubetas', 'Cuartos (1/4 gal)', 'Cientos', 'Metros lineales (m)', 'Kilogramos (kg)', 'Litros'];

const BLANK_ORDER = { project_id: '', expected_date: '', status: 'Pendiente', notes: '', items: [] };

export default function MaterialOrders() {
  const qc = useQueryClient();
  const { user } = useAuth();
  
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(BLANK_ORDER);
  const [delTgt, setDelTgt] = useState(null);
  
  // Estados para el Modal del Catálogo (El seleccionador tipo carrito)
  const [catalogModal, setCatalogModal] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState('');
  const [selectedCatalogItems, setSelectedCatalogItems] = useState([]);

  // 1. LEER DATOS
  const { data: orders = [], isLoading: l1 } = useQuery({
    queryKey: ['purchase_orders'],
    queryFn: async () => {
      const { data, error } = await supabase.from('purchase_orders')
        .select('*, projects(name, location), users(name), purchase_order_items(*, materials_catalog(name))')
        .order('created_at', { ascending: false });
      if (error) throw error; return data;
    }
  });

  const { data: projects = [] } = useQuery({ queryKey: ['projects'], queryFn: async () => { const { data } = await supabase.from('projects').select('*'); return data || []; } });
  const { data: catalog = [] } = useQuery({ queryKey: ['materials_catalog'], queryFn: async () => { const { data } = await supabase.from('materials_catalog').select('*').order('name'); return data || []; } });

  // 2. GUARDAR PEDIDO (Encabezado y Líneas relacionales)
  const save = useMutation({
    mutationFn: async (d) => {
      let orderId = d.id;

      // 1. Guardar o actualizar Encabezado
      const header = { project_id: d.project_id, expected_date: d.expected_date || null, status: d.status, notes: d.notes, requested_by: d.id ? d.requested_by : user.id };
      
      if (orderId) {
        await supabase.from('purchase_orders').update(header).eq('id', orderId);
        await supabase.from('purchase_order_items').delete().eq('order_id', orderId); // Borramos líneas viejas para poner las nuevas
      } else {
        const { data: newOrder, error } = await supabase.from('purchase_orders').insert([header]).select().single();
        if (error) throw error;
        orderId = newOrder.id;
      }

      // 2. Guardar Líneas
      if (d.items.length > 0) {
        const lines = d.items.map(i => ({
          order_id: orderId,
          catalog_id: i.catalog_id || null,
          manual_name: i.manual_name || null,
          quantity: i.quantity,
          unit: i.unit
        }));
        const { error: errLines } = await supabase.from('purchase_order_items').insert(lines);
        if (errLines) throw errLines;
      }
    },
    onSuccess: () => { qc.invalidateQueries(['purchase_orders']); setModal(false); },
    onError: (e) => alert(`Error al guardar: ${e.message}`)
  });

  const del = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('purchase_orders').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries(['purchase_orders']); setDelTgt(null); }
  });

  // Exportar a Excel
  const exportToExcel = (order) => {
    const data = order.purchase_order_items.map(item => ({
      Consecutivo: order.order_number,
      Proyecto: order.projects?.name,
      Material: item.materials_catalog?.name || item.manual_name,
      Cantidad: Number(item.quantity),
      Unidad: item.unit,
      FechaEsperada: order.expected_date ? format(new Date(order.expected_date), 'dd/MM/yyyy') : '',
      Notas: order.notes || ''
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Pedido");
    XLSX.writeFile(wb, `Pedido_${order.order_number}.xlsx`);
  };

  // Lógica del Formulario
  const removeLine = (idx) => {
    const newI = [...form.items]; newI.splice(idx, 1); setForm({...form, items: newI});
  };
  const updateLine = (idx, field, val) => {
    const newI = [...form.items]; newI[idx][field] = val; setForm({...form, items: newI});
  };

  // Lógica del seleccionador visual del catálogo
  const handleCatalogSelection = () => {
    const newLines = selectedCatalogItems.map(c => ({
      catalog_id: c.id, manual_name: c.name, quantity: 1, unit: 'Unidades (ud)'
    }));
    setForm({...form, items: [...form.items, ...newLines]});
    setCatalogModal(false);
    setSelectedCatalogItems([]);
    setCatalogSearch('');
  };

  if (l1) return <Spinner />;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Pedidos a Bodega / Compras</h1>
          <p className="text-slate-400 text-sm mt-0.5">Control de requisiciones con consecutivos</p>
        </div>
        <button className="btn-primary" onClick={() => { setForm(BLANK_ORDER); setModal(true); }}>
          <Plus size={15}/> Crear Pedido
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {orders.map(o => (
          <div key={o.id} className="card p-5 border-l-4" style={{ borderLeftColor: o.status === 'Entregado' ? '#22c55e' : o.status === 'Pendiente' ? '#eab308' : '#3b82f6' }}>
            <div className="flex justify-between items-start mb-4">
              <div>
                <div className="text-brand-400 font-mono font-bold text-lg">{o.order_number}</div>
                <h3 className="font-bold text-white text-base mt-1">{o.projects?.name}</h3>
              </div>
              <div className="flex gap-1">
                <button className="btn-icon" title="Exportar Excel" onClick={() => exportToExcel(o)}><Download size={15}/></button>
                <button className="btn-icon" onClick={() => { 
                  // Mapeamos para que el form entienda
                  const lines = o.purchase_order_items.map(i => ({ catalog_id: i.catalog_id, manual_name: i.materials_catalog?.name || i.manual_name, quantity: i.quantity, unit: i.unit }));
                  setForm({...o, items: lines}); setModal(true); 
                }}><CheckSquare size={15}/></button>
                <button className="btn-icon hover:text-red-400" onClick={() => setDelTgt(o)}><Trash2 size={15}/></button>
              </div>
            </div>

            <div className="bg-surface-900 rounded-lg p-3">
              <div className="text-xs uppercase font-bold text-slate-500 mb-2 border-b border-surface-600 pb-1">Líneas Solicitadas ({o.purchase_order_items?.length || 0})</div>
              <ul className="space-y-2 max-h-32 overflow-y-auto pr-2 custom-scrollbar">
                {(o.purchase_order_items || []).map((item) => (
                  <li key={item.id} className="flex justify-between text-sm">
                    <span className="text-slate-300">• {item.materials_catalog?.name || item.manual_name}</span>
                    <span className="text-slate-400 font-mono text-xs">{item.quantity} {item.unit}</span>
                  </li>
                ))}
              </ul>
            </div>
            
            <div className="flex items-center gap-3 mt-4 text-xs text-slate-500">
              <span className="flex items-center gap-1"><Calendar size={12}/> Para: {o.expected_date ? format(new Date(o.expected_date), 'dd/MM/yyyy') : 'S/F'}</span>
              <span className="px-2 py-1 rounded bg-surface-700">{o.status}</span>
            </div>
          </div>
        ))}
      </div>

      {/* MODAL PRINCIPAL: CREAR PEDIDO */}
      <Modal open={modal} onClose={() => setModal(false)} title={form.id ? `Editar ${form.order_number}` : 'Nuevo Pedido'} size="xl">
        <form onSubmit={e => { e.preventDefault(); save.mutate(form); }} className="space-y-4">
          <div className="grid grid-cols-3 gap-4 bg-surface-800 p-4 rounded-xl border border-surface-600">
            <Field label="Proyecto" required>
              <select className="input bg-surface-900" value={form.project_id} onChange={e => setForm({...form, project_id: e.target.value})} required>
                <option value="">— Seleccionar —</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </Field>
            <Field label="Fecha Esperada en Obra">
              <input type="date" className="input bg-surface-900" value={form.expected_date} onChange={e => setForm({...form, expected_date: e.target.value})}/>
            </Field>
            <Field label="Estado">
              <select className="input bg-surface-900" value={form.status} onChange={e => setForm({...form, status: e.target.value})}>
                <option>Pendiente</option><option>Aprobado</option><option>Parcial</option><option>Completo</option>
              </select>
            </Field>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3 border-b border-surface-600 pb-2">
              <label className="label mb-0">Detalle del Pedido</label>
              <div className="flex gap-2">
                <button type="button" onClick={() => setForm({...form, items: [...form.items, { catalog_id: null, manual_name: '', quantity: 1, unit: 'Unidades (ud)' }]})} className="text-xs text-slate-300 bg-surface-700 px-3 py-1.5 rounded flex items-center gap-1 hover:bg-surface-600">
                  <Plus size={14}/> Línea Manual
                </button>
                {/* BOTÓN MAGICO PARA ABRIR CATÁLOGO */}
                <button type="button" onClick={() => setCatalogModal(true)} className="text-xs text-brand-400 bg-brand-500/10 px-3 py-1.5 rounded font-bold flex items-center gap-1 hover:bg-brand-500/20">
                  <Search size={14}/> Ver Catálogo Maestro
                </button>
              </div>
            </div>
            
            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
              {form.items.map((item, idx) => (
                <div key={idx} className="flex gap-2 items-start bg-surface-800/50 p-2 rounded-lg border border-surface-700">
                  <div className="flex-1">
                    <input className="input text-sm" placeholder="Nombre del material..." value={item.manual_name} disabled={!!item.catalog_id} onChange={e => updateLine(idx, 'manual_name', e.target.value)} required />
                    {item.catalog_id && <div className="text-[9px] text-green-400 mt-1">✔ Enlazado al Catálogo</div>}
                  </div>
                  <div className="w-24">
                    <input type="number" min="0.01" step="0.01" className="input text-center text-sm font-mono" value={item.quantity} onChange={e => updateLine(idx, 'quantity', e.target.value)} required />
                  </div>
                  <div className="w-40">
                    <select className="input text-sm" value={item.unit} onChange={e => updateLine(idx, 'unit', e.target.value)}>
                      {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </div>
                  <button type="button" onClick={() => removeLine(idx)} className="btn-icon bg-surface-800 text-slate-400 hover:text-red-400 mt-1 p-2 rounded"><Trash2 size={15}/></button>
                </div>
              ))}
              {form.items.length === 0 && <div className="text-center py-6 text-slate-500 text-sm">No has agregado materiales al pedido.</div>}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-surface-600">
            <button type="button" className="btn-ghost" onClick={() => setModal(false)}>Cerrar</button>
            <button type="submit" className="btn-primary" disabled={save.isPending}>{save.isPending ? 'Guardando...' : 'Guardar Pedido'}</button>
          </div>
        </form>
      </Modal>

      {/* SUB-MODAL: CATÁLOGO MAESTRO (PARA MARCAR CASILLAS) */}
      {catalogModal && (
        <div className="fixed inset-0 z-[60] bg-surface-900/95 flex items-center justify-center p-4">
          <div className="bg-surface-800 w-full max-w-2xl rounded-2xl border border-surface-600 flex flex-col max-h-[85vh]">
            <div className="p-4 border-b border-surface-600 flex justify-between items-center">
              <h3 className="font-bold text-lg text-white">Seleccionar del Catálogo</h3>
              <button onClick={() => setCatalogModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>
            
            <div className="p-4 border-b border-surface-600">
              <div className="flex items-center gap-2 bg-surface-900 p-2 rounded-lg border border-surface-600">
                <Search size={16} className="text-slate-400"/>
                <input autoFocus className="bg-transparent border-none outline-none text-sm text-white flex-1" placeholder="Buscar clavo, cemento, pintura..." value={catalogSearch} onChange={e => setCatalogSearch(e.target.value)} />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-1">
              {catalog.filter(c => c.name.toLowerCase().includes(catalogSearch.toLowerCase())).map(c => {
                const isSelected = selectedCatalogItems.some(x => x.id === c.id);
                return (
                  <label key={c.id} className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer border transition-colors ${isSelected ? 'bg-brand-500/10 border-brand-500' : 'bg-surface-900 border-surface-700 hover:border-surface-500'}`}>
                    <input type="checkbox" className="w-5 h-5 accent-brand-500 rounded border-surface-600" checked={isSelected}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedCatalogItems([...selectedCatalogItems, c]);
                        else setSelectedCatalogItems(selectedCatalogItems.filter(x => x.id !== c.id));
                      }}
                    />
                    <div>
                      <div className="font-semibold text-slate-200 text-sm">{c.name}</div>
                      <div className="text-[10px] text-slate-500 uppercase tracking-wider">{c.category}</div>
                    </div>
                  </label>
                );
              })}
            </div>

            <div className="p-4 border-t border-surface-600 flex justify-between items-center bg-surface-800 rounded-b-2xl">
              <span className="text-sm text-slate-400"><strong className="text-brand-400">{selectedCatalogItems.length}</strong> seleccionados</span>
              <div className="flex gap-2">
                <button type="button" className="btn-ghost" onClick={() => setCatalogModal(false)}>Cancelar</button>
                <button type="button" className="btn-primary" disabled={selectedCatalogItems.length === 0} onClick={handleCatalogSelection}>
                  Agregar al Pedido
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <Confirm open={!!delTgt} onClose={() => setDelTgt(null)} onConfirm={() => del.mutate(delTgt.id)} title="Eliminar Pedido" message="¿Eliminar este documento y todas sus líneas?"/>
    </div>
  );
}
