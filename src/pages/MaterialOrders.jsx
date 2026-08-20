// src/pages/MaterialOrders.jsx
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { Modal, Confirm, Spinner, Field } from '../components/ui';
import { Plus, Trash2, Search, ShoppingCart, Calendar, MapPin, Download, CheckSquare, ArrowRight, ArrowLeft, PackageCheck, Archive, Receipt } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { format } from 'date-fns';
import * as XLSX from 'xlsx';

const UNITS = ['Unidades (ud)', 'Sacos', 'Varillas', 'Quintales (qq)', 'Metros Cúbicos (m³)', 'Viajes', 'Tramos / Tubos', 'Rollos', 'Láminas', 'Reglas', 'Metros Cuadrados (m²)', 'Cajas', 'Galones (gal)', 'Cubetas', 'Cuartos (1/4 gal)', 'Cientos', 'Metros lineales (m)', 'Kilogramos (kg)', 'Litros'];
const ALL_STATUSES = ['Pendiente', 'Aprobado', 'Enviado a Proveedor', 'Facturado Proveedor', 'Enviado', 'Recibido Sitio', 'Cancelado'];
const ACTIVE_STATUSES = ['Pendiente', 'Aprobado', 'Enviado a Proveedor', 'Facturado Proveedor', 'Enviado'];
const HISTORY_STATUSES = ['Recibido Sitio', 'Cancelado'];
const CATEGORIES = ['Obra Gris', 'Acabados', 'Eléctrico', 'Tubería y PVC', 'Maderas y Cubiertas', 'Pinturas', 'Tornillería y Varios', 'Importado', 'Agregado de Pedido'];

const BLANK_ORDER = { project_id: '', expected_date: '', status: 'Pendiente', notes: '', items: [] };

export default function MaterialOrders() {
  const qc = useQueryClient();
  const { user } = useAuth();
  
  const [modal, setModal] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [form, setForm] = useState(BLANK_ORDER);
  const [delTgt, setDelTgt] = useState(null);
  
  // Modal de Recepción (Campo)
  const [receiveTgt, setReceiveTgt] = useState(null);
  
  // Modal de Facturación (Oficina)
  const [billingModal, setBillingModal] = useState(false);
  const [billingOrder, setBillingOrder] = useState(null);
  const [billingItems, setBillingItems] = useState([]);

  // Filtros y Pestañas
  const [activeTab, setActiveTab] = useState('Activos');
  const [filterProject, setFilterProject] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [catalogSearch, setCatalogSearch] = useState('');
  const [catalogCategoryFilter, setCatalogCategoryFilter] = useState('Todos');

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

  // 2. GUARDAR PEDIDO NUEVO/EDITADO
  const save = useMutation({
    mutationFn: async (d) => {
      let orderId = d.id;
      const processedItems = await Promise.all(d.items.map(async (item) => {
        if (!item.catalog_id && item.manual_name?.trim()) {
          const { data: newCat, error: catErr } = await supabase.from('materials_catalog')
            .insert([{ name: item.manual_name, category: 'Agregado de Pedido' }]).select().single();
          if (!catErr && newCat) return { ...item, catalog_id: newCat.id, manual_name: null }; 
        }
        return item;
      }));

      const header = { project_id: d.project_id, expected_date: d.expected_date || null, status: d.status, notes: d.notes, requested_by: d.id ? d.requested_by : user.id };
      
      if (orderId) {
        await supabase.from('purchase_orders').update(header).eq('id', orderId);
        await supabase.from('purchase_order_items').delete().eq('order_id', orderId);
      } else {
        const { data: newOrder, error } = await supabase.from('purchase_orders').insert([header]).select().single();
        if (error) throw error; orderId = newOrder.id;
      }

      if (processedItems.length > 0) {
        const lines = processedItems.map(i => ({ order_id: orderId, catalog_id: i.catalog_id || null, manual_name: i.manual_name || null, quantity: i.quantity, unit: i.unit }));
        const { error: errLines } = await supabase.from('purchase_order_items').insert(lines);
        if (errLines) throw errLines;
      }
    },
    onSuccess: () => { qc.invalidateQueries(['purchase_orders']); qc.invalidateQueries(['materials_catalog']); setModal(false); setWizardStep(1); }
  });

  // 3. FACTURACIÓN Y DIVISIÓN AUTOMÁTICA (OFICINA)
  const processBilling = useMutation({
    mutationFn: async () => {
      // a. Actualizar precios unitarios
      await Promise.all(billingItems.map(item => 
        supabase.from('purchase_order_items').update({ unit_price: item.unit_price }).eq('id', item.id)
      ));

      // b. Separar los no enviados (Backorder)
      const unfulfilledIds = billingItems.filter(i => !i.fulfilled).map(i => i.id);
      
      if (unfulfilledIds.length > 0) {
        // Crear pedido hijo (consecutivo automático)
        const { data: newOrder, error: errNew } = await supabase.from('purchase_orders').insert({
          project_id: billingOrder.project_id,
          requested_by: user.id,
          status: 'Pendiente',
          notes: `Backorder autogenerado por faltantes del pedido original: ${billingOrder.order_number}`
        }).select().single();
        if (errNew) throw errNew;

        // Mover líneas al nuevo pedido
        await supabase.from('purchase_order_items').update({ order_id: newOrder.id }).in('id', unfulfilledIds);
      }

      // c. Actualizar pedido original a Enviado (listo para campo)
      await supabase.from('purchase_orders').update({ status: 'Enviado' }).eq('id', billingOrder.id);
    },
    onSuccess: () => { qc.invalidateQueries(['purchase_orders']); setBillingModal(false); }
  });

  // 4. RECIBIR EN SITIO Y PASAR A INVENTARIO (CAMPO)
  const receiveOrder = useMutation({
    mutationFn: async (order) => {
      await supabase.from('purchase_orders').update({ status: 'Recibido Sitio' }).eq('id', order.id);
      
      const inventoryItems = order.purchase_order_items.map(item => ({
        project_id: order.project_id,
        name: item.materials_catalog?.name || item.manual_name,
        quantity: item.quantity,
        unit: item.unit,
        cost_per_unit: item.unit_price || 0, // ¡Ahora toma el precio facturado!
        entry_date: new Date().toISOString().split('T')[0] // Fecha de ingreso físico
      }));

      if (inventoryItems.length > 0) {
        const { error } = await supabase.from('materials').insert(inventoryItems);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries(['purchase_orders']); qc.invalidateQueries(['materials']); setReceiveTgt(null); }
  });

  const del = useMutation({ mutationFn: async (id) => { await supabase.from('purchase_orders').delete().eq('id', id); }, onSuccess: () => { qc.invalidateQueries(['purchase_orders']); setDelTgt(null); } });

  // Cálculos de Facturación
  const subtotal = billingItems.filter(i => i.fulfilled).reduce((acc, curr) => acc + (curr.quantity * curr.unit_price), 0);
  const taxes = subtotal * 0.13;
  const total = subtotal + taxes;

  const handleTabChange = (tab) => { setActiveTab(tab); setFilterStatus(''); };

  const filteredOrders = orders.filter(o => {
    if (activeTab === 'Activos' && HISTORY_STATUSES.includes(o.status)) return false;
    if (activeTab === 'Historial' && ACTIVE_STATUSES.includes(o.status)) return false;
    if (filterProject && o.project_id !== filterProject) return false;
    if (filterStatus && o.status !== filterStatus) return false;
    return true;
  });

  // Funciones de Carrito General
  const toggleCatalogItem = (catItem) => {
    const exists = form.items.find(i => i.catalog_id === catItem.id);
    if (exists) setForm({ ...form, items: form.items.filter(i => i.catalog_id !== catItem.id) });
    else setForm({ ...form, items: [...form.items, { catalog_id: catItem.id, manual_name: catItem.name, quantity: 1, unit: 'Unidades (ud)' }] });
  };
  const updateLine = (idx, field, val) => { const newI = [...form.items]; newI[idx][field] = val; setForm({...form, items: newI}); };
  const removeLine = (idx) => { const newI = [...form.items]; newI.splice(idx, 1); setForm({...form, items: newI}); };

  const renderStepper = (currentStatus) => {
    if (currentStatus === 'Cancelado') return <div className="mt-4 p-2 bg-red-500/10 text-red-500 text-center font-bold text-xs uppercase tracking-wider rounded-lg border border-red-500/20">Pedido Cancelado</div>;
    const STEPS = ['Pendiente', 'Aprobado', 'Enviado a Proveedor', 'Facturado Proveedor', 'Enviado', 'Recibido Sitio'];
    const currentIndex = STEPS.indexOf(currentStatus);
    return (
      <div className="flex items-center w-full mt-4 bg-surface-900/50 p-3 rounded-lg border border-surface-600/50">
        {STEPS.map((status, index) => {
          const isCompleted = index <= currentIndex;
          const isCurrent = index === currentIndex;
          let colorClass = "bg-slate-600";
          if (isCompleted) {
            if (index === 0) colorClass = "bg-yellow-500"; if (index === 1) colorClass = "bg-blue-500"; if (index === 2) colorClass = "bg-purple-500";
            if (index === 3) colorClass = "bg-indigo-500"; if (index === 4) colorClass = "bg-orange-500"; if (index === 5) colorClass = "bg-green-500";
          }
          const shortName = status.replace(' a Proveedor', '').replace(' Proveedor', '');
          return (
            <div key={status} className="flex-1 flex flex-col items-center relative group">
              {index !== 0 && <div className={`absolute top-2.5 left-[-50%] w-full h-[2px] ${isCompleted ? colorClass : 'bg-surface-600'} transition-colors duration-300 z-0`}></div>}
              <div className={`relative z-10 w-5 h-5 rounded-full border-2 ${isCompleted ? 'border-transparent ' + colorClass : 'border-surface-500 bg-surface-800'} ${isCurrent ? 'ring-2 ring-offset-2 ring-offset-surface-800 ring-brand-500' : ''} flex items-center justify-center`}>
                {isCompleted && <div className="w-2 h-2 bg-white rounded-full"></div>}
              </div>
              <span className={`text-[9px] mt-1.5 font-semibold uppercase tracking-wider text-center ${isCurrent ? 'text-white' : isCompleted ? 'text-slate-300' : 'text-slate-500'}`}>{shortName}</span>
            </div>
          );
        })}
      </div>
    );
  };

  if (l1) return <Spinner />;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Pedidos y Logística</h1>
          <p className="text-slate-400 text-sm mt-0.5">Gestión de compras, trazabilidad y pase a inventario</p>
        </div>
        <button className="btn-primary" onClick={() => { setForm(BLANK_ORDER); setWizardStep(1); setModal(true); }}>
          <Plus size={15}/> Nuevo Pedido
        </button>
      </div>

      <div className="flex gap-1 bg-surface-800 border border-surface-600 rounded-xl p-1 w-fit mb-5">
        {['Activos', 'Historial'].map(t => (
          <button key={t} onClick={() => handleTabChange(t)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === t ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/20' : 'text-slate-400 hover:text-white hover:bg-surface-700'}`}>
            {t === 'Activos' ? <ShoppingCart size={16}/> : <Archive size={16}/>} {t}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-3 mb-6 bg-surface-800 p-3 rounded-xl border border-surface-600">
        <select className="input max-w-[250px]" value={filterProject} onChange={e => setFilterProject(e.target.value)}>
          <option value="">🏢 Todos los proyectos</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select className="input max-w-[250px]" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">📋 Todos los estados</option>
          {(activeTab === 'Activos' ? ACTIVE_STATUSES : HISTORY_STATUSES).map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {filteredOrders.map(o => (
          <div key={o.id} className={`card p-5 border transition-all relative overflow-hidden ${o.status === 'Cancelado' ? 'border-red-500/30 opacity-70' : 'border-surface-600 hover:border-surface-500 hover:shadow-xl'}`}>
            
            {o.status === 'Recibido Sitio' && (
              <div className="absolute top-0 right-0 w-16 h-16 bg-green-500/10 flex items-center justify-center rounded-bl-3xl">
                <PackageCheck size={24} className="text-green-500"/>
              </div>
            )}

            <div className="flex justify-between items-start mb-2">
              <div>
                <div className={`font-mono font-bold text-xl ${o.status === 'Cancelado' ? 'text-red-400' : 'text-brand-400'}`}>{o.order_number}</div>
                <h3 className="font-bold text-white text-base mt-0.5">{o.projects?.name}</h3>
                <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-400">
                  <span className="flex items-center gap-1"><Calendar size={12}/> {o.expected_date ? format(new Date(o.expected_date), 'dd/MM/yyyy') : 'Sin fecha'}</span>
                  <span className="flex items-center gap-1"><MapPin size={12}/> {o.projects?.location || 'Sitio'}</span>
                </div>
              </div>
              
              <div className="flex gap-1 bg-surface-800 p-1 rounded-lg border border-surface-600 relative z-10">
                {/* BOTÓN OFICINA: FACTURAR */}
                {activeTab === 'Activos' && o.status !== 'Enviado' && (
                  <button className="btn-icon text-blue-400 hover:bg-blue-500/20" title="Ingresar Factura y Precios (Oficina)" onClick={() => {
                    setBillingOrder(o);
                    setBillingItems(o.purchase_order_items.map(i => ({ id: i.id, name: i.materials_catalog?.name || i.manual_name, quantity: i.quantity, unit: i.unit, unit_price: i.unit_price || 0, fulfilled: true })));
                    setBillingModal(true);
                  }}><Receipt size={16}/></button>
                )}
                {/* BOTÓN CAMPO: RECIBIR EN SITIO */}
                {activeTab === 'Activos' && (
                  <button className="btn-icon text-green-400 hover:bg-green-500/20" title="Recibir en Sitio (Campo)" onClick={() => setReceiveTgt(o)}>
                    <PackageCheck size={16}/>
                  </button>
                )}
                <button className="btn-icon text-brand-400 hover:bg-brand-500/20" title="Editar" onClick={() => { 
                  const lines = o.purchase_order_items.map(i => ({ catalog_id: i.catalog_id, manual_name: i.materials_catalog?.name || i.manual_name, quantity: i.quantity, unit: i.unit }));
                  setForm({...o, items: lines}); setWizardStep(1); setModal(true); 
                }}><CheckSquare size={16}/></button>
                <button className="btn-icon text-slate-500 hover:text-red-400 hover:bg-red-500/20" title="Eliminar" onClick={() => setDelTgt(o)}><Trash2 size={16}/></button>
              </div>
            </div>

            {renderStepper(o.status)}

            <div className="mt-4 bg-surface-900 rounded-lg p-3 border border-surface-700">
              <div className="text-xs uppercase font-bold text-slate-500 mb-2 border-b border-surface-700 pb-2">Resumen de Materiales ({o.purchase_order_items?.length || 0})</div>
              <ul className="space-y-1.5 max-h-24 overflow-y-auto pr-2 custom-scrollbar">
                {(o.purchase_order_items || []).map((item) => (
                  <li key={item.id} className="flex justify-between text-sm">
                    <span className="text-slate-300 font-medium truncate pr-2">• {item.materials_catalog?.name || item.manual_name}</span>
                    <span className="text-brand-400 font-mono text-xs flex-shrink-0 bg-brand-500/10 px-2 py-0.5 rounded">{item.quantity} {item.unit}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))}
        {filteredOrders.length === 0 && <div className="col-span-full py-12 text-center text-slate-500 bg-surface-800 rounded-xl border border-surface-600 border-dashed">No hay pedidos en esta sección.</div>}
      </div>

      {/* ---------------- MODALES ---------------- */}

      {/* 1. MODAL: FACTURACIÓN Y PRECIOS (OFICINA) */}
      <Modal open={billingModal} onClose={() => setBillingModal(false)} title={`Facturación de ${billingOrder?.order_number}`} size="xl">
        <div className="text-sm text-slate-400 mb-4 bg-surface-800 p-3 rounded-lg border border-surface-600">
          Revisa la factura del proveedor. <b>Desmarca (quita el check)</b> a los artículos que no llegaron para enviarlos automáticamente a un pedido pendiente.
        </div>
        <div className="space-y-2 max-h-80 overflow-y-auto pr-2 custom-scrollbar">
          {billingItems.map((item, index) => (
            <div key={item.id} className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${item.fulfilled ? 'bg-surface-800 border-surface-600' : 'bg-surface-900 border-dashed border-slate-600 opacity-60'}`}>
              <input type="checkbox" className="w-5 h-5 accent-brand-500 rounded border-surface-600 cursor-pointer" checked={item.fulfilled}
                onChange={(e) => { const newArr = [...billingItems]; newArr[index].fulfilled = e.target.checked; setBillingItems(newArr); }} />
              <div className="flex-1">
                <div className={`font-semibold text-sm ${item.fulfilled ? 'text-slate-200' : 'text-slate-500 line-through'}`}>{item.name}</div>
                <div className="text-xs text-slate-500">{item.quantity} {item.unit}</div>
              </div>
              <div className="w-32">
                <label className="text-[10px] text-slate-500 font-bold uppercase block mb-1">Precio Unitario ₡</label>
                <input type="number" min="0" step="0.01" className="input text-right font-mono" disabled={!item.fulfilled} value={item.unit_price}
                  onChange={(e) => { const newArr = [...billingItems]; newArr[index].unit_price = Number(e.target.value); setBillingItems(newArr); }} />
              </div>
            </div>
          ))}
        </div>
        <div className="mt-5 p-4 bg-surface-900 rounded-xl border border-surface-600 flex flex-col items-end gap-1 font-mono text-sm">
          <div className="flex justify-between w-64 text-slate-400"><span>Subtotal:</span> <span>₡{subtotal.toLocaleString('es-CR', {minimumFractionDigits: 2})}</span></div>
          <div className="flex justify-between w-64 text-slate-400"><span>IVA (13%):</span> <span>₡{taxes.toLocaleString('es-CR', {minimumFractionDigits: 2})}</span></div>
          <div className="flex justify-between w-64 text-lg font-bold text-brand-400 border-t border-surface-600 pt-1 mt-1"><span>Total:</span> <span>₡{total.toLocaleString('es-CR', {minimumFractionDigits: 2})}</span></div>
        </div>
        <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-surface-600">
          <button className="btn-ghost" onClick={() => setBillingModal(false)}>Cancelar</button>
          <button className="btn-primary px-6" onClick={() => processBilling.mutate()} disabled={processBilling.isPending}>
            {processBilling.isPending ? 'Procesando...' : 'Guardar y Enviar a Campo'}
          </button>
        </div>
      </Modal>

      {/* 2. MODAL PERSONALIZADO: RECIBIR EN CAMPO (Seguro, sin palabra Eliminar) */}
      <Modal open={!!receiveTgt} onClose={() => setReceiveTgt(null)} title="Recepción en Sitio" size="md">
        <div className="py-2">
          <div className="flex items-center gap-4 mb-5">
            <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
              <PackageCheck size={24} className="text-green-500" />
            </div>
            <p className="text-slate-300 text-sm">
              ¿Confirmas que el material del pedido <strong className="text-white">{receiveTgt?.order_number}</strong> está físicamente en la obra?
            </p>
          </div>
          <div className="bg-surface-800 p-3 rounded-lg border border-surface-600 text-xs text-slate-400 mb-6">
            Al confirmar, el sistema registrará automáticamente la <b>fecha de hoy</b> y los <b>costos facturados</b> en el inventario general del proyecto. El pedido pasará al Historial.
          </div>
          <div className="flex justify-end gap-3">
            <button className="btn-ghost" onClick={() => setReceiveTgt(null)}>Cancelar</button>
            <button className="btn-primary bg-green-600 hover:bg-green-500 border-none shadow-lg shadow-green-900/50" 
              onClick={() => receiveOrder.mutate(receiveTgt)} disabled={receiveOrder.isPending}>
              {receiveOrder.isPending ? 'Cargando...' : 'Sí, Cargar a Inventario'}
            </button>
          </div>
        </div>
      </Modal>

      {/* 3. MODAL WIZARD (CREAR/EDITAR) */}
      <Modal open={modal} onClose={() => setModal(false)} title={form.id ? `Editando ${form.order_number}` : 'Nuevo Pedido'} size="2xl">
        <div className="flex gap-2 mb-6 border-b border-surface-600 pb-3">
          <div className={`flex-1 text-center text-sm font-bold pb-2 border-b-2 transition-all ${wizardStep === 1 ? 'border-brand-500 text-brand-400' : 'border-transparent text-slate-500'}`}>1. Datos Generales</div>
          <div className={`flex-1 text-center text-sm font-bold pb-2 border-b-2 transition-all ${wizardStep === 2 ? 'border-brand-500 text-brand-400' : 'border-transparent text-slate-500'}`}>2. Carrito de Materiales</div>
        </div>
        {wizardStep === 1 && (
          <div className="space-y-5 animate-in fade-in slide-in-from-left-4">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Proyecto" required>
                <select className="input text-base py-2" value={form.project_id} onChange={e => setForm({...form, project_id: e.target.value})} required>
                  <option value="">— Seleccionar Proyecto —</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </Field>
              <Field label="Estado del Pedido">
                <select className="input font-semibold" value={form.status} onChange={e => setForm({...form, status: e.target.value})}>
                  {ALL_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
              <Field label="Fecha Requerida en Sitio">
                <input type="date" className="input" value={form.expected_date} onChange={e => setForm({...form, expected_date: e.target.value})}/>
              </Field>
              <Field label="Notas / Proveedor">
                <input className="input" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} placeholder="Instrucciones de entrega..."/>
              </Field>
            </div>
            <div className="flex justify-end pt-4 border-t border-surface-600">
              <button type="button" className="btn-primary px-6" onClick={() => setWizardStep(2)} disabled={!form.project_id}> Siguiente Paso <ArrowRight size={16} className="ml-1"/> </button>
            </div>
          </div>
        )}
        {wizardStep === 2 && (
          <div className="flex flex-col md:flex-row gap-5 h-[500px] animate-in fade-in slide-in-from-right-4">
            <div className="w-full md:w-1/2 flex flex-col bg-surface-800 rounded-xl border border-surface-600 overflow-hidden">
              <div className="p-3 bg-surface-900 border-b border-surface-600 space-y-2">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">Catálogo Maestro</div>
                <div className="flex flex-col gap-2">
                  <select className="input bg-surface-800 text-sm border-surface-600 py-1.5" value={catalogCategoryFilter} onChange={e => setCatalogCategoryFilter(e.target.value)}>
                    <option value="Todos">Todas las categorías</option>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <div className="flex items-center gap-2 bg-surface-800 p-2 rounded-lg border border-surface-600 focus-within:border-brand-500">
                    <Search size={16} className="text-slate-400"/>
                    <input className="bg-transparent border-none outline-none text-sm text-white flex-1" placeholder="Buscar material..." value={catalogSearch} onChange={e => setCatalogSearch(e.target.value)} />
                  </div>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                {catalog.filter(c => {
                    const matchSearch = c.name.toLowerCase().includes(catalogSearch.toLowerCase());
                    const matchCat = catalogCategoryFilter === 'Todos' || c.category === catalogCategoryFilter;
                    return matchSearch && matchCat;
                  }).slice(0,50).map(c => {
                  const isSelected = form.items.some(x => x.catalog_id === c.id);
                  return (
                    <div key={c.id} onClick={() => toggleCatalogItem(c)} className={`flex justify-between items-center p-2.5 rounded-lg cursor-pointer transition-all border ${isSelected ? 'bg-brand-500/20 border-brand-500/50' : 'bg-surface-900 border-surface-700 hover:border-surface-500'}`}>
                      <div className="flex-1 min-w-0 pr-2">
                        <div className="font-semibold text-slate-200 text-xs truncate">{c.name}</div>
                        <div className="text-[9px] text-slate-500 uppercase">{c.category}</div>
                      </div>
                      <div className={`w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 ${isSelected ? 'bg-brand-500 border-brand-500' : 'border-surface-500 bg-surface-800'}`}>
                        {isSelected && <div className="w-2 h-2 bg-white rounded-full"></div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="w-full md:w-1/2 flex flex-col">
              <div className="flex items-center justify-between mb-3">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">Carrito ({form.items.length})</div>
                <button type="button" onClick={addManualLine} className="text-[10px] text-brand-400 font-bold bg-brand-500/10 px-2 py-1 rounded hover:bg-brand-500/20 uppercase tracking-wider flex items-center gap-1">
                  <Plus size={12}/> Línea Manual
                </button>
              </div>
              <div className="flex-1 overflow-y-auto pr-2 space-y-2 custom-scrollbar">
                {form.items.map((item, idx) => (
                  <div key={idx} className={`bg-surface-800 p-2.5 rounded-xl border ${!item.catalog_id ? 'border-dashed border-brand-500/50 bg-brand-500/5' : 'border-surface-600'}`}>
                    <div className="flex justify-between gap-2 mb-2">
                      <input className="input text-sm bg-surface-900 flex-1" placeholder="Nombre del material..." value={item.manual_name || ''} disabled={!!item.catalog_id} onChange={e => updateLine(idx, 'manual_name', e.target.value)} required />
                      <button type="button" onClick={() => removeLine(idx)} className="btn-icon text-slate-500 hover:text-red-400 bg-surface-900 p-2 rounded"><Trash2 size={14}/></button>
                    </div>
                    <div className="flex gap-2">
                      <input type="number" min="0.01" step="0.01" className="input w-24 text-center text-sm font-mono bg-surface-900" value={item.quantity} onChange={e => updateLine(idx, 'quantity', e.target.value)} required />
                      <select className="input flex-1 text-sm bg-surface-900" value={item.unit} onChange={e => updateLine(idx, 'unit', e.target.value)}>
                        {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                      </select>
                    </div>
                  </div>
                ))}
                {form.items.length === 0 && (
                  <div className="h-full flex flex-col items-center justify-center text-slate-500 p-6 text-center border-2 border-dashed border-surface-600 rounded-xl">
                    <ShoppingCart size={32} className="mb-2 opacity-30"/> <p className="text-sm">Selecciona materiales del catálogo o agrega una línea manual.</p>
                  </div>
                )}
              </div>
              <div className="flex justify-between items-center pt-4 border-t border-surface-600 mt-4">
                <button type="button" className="btn-ghost flex items-center gap-1" onClick={() => setWizardStep(1)}><ArrowLeft size={16}/> Volver</button>
                <button type="button" className="btn-primary px-6" onClick={() => save.mutate(form)} disabled={form.items.length === 0 || save.isPending}>
                  {save.isPending ? 'Guardando...' : 'Confirmar Pedido'}
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* MODAL ELIMINAR NORMAL */}
      <Confirm open={!!delTgt} onClose={() => setDelTgt(null)} onConfirm={() => del.mutate(delTgt.id)} title="Eliminar Pedido" message="¿Eliminar este pedido y todas sus líneas de la base de datos?"/>
    </div>
  );
}
