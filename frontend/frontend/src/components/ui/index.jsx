// src/components/ui/index.jsx
import { X, AlertTriangle, Loader2, SearchX } from 'lucide-react';

/* ── Badge ──────────────────────────────────────────────── */
const BADGE_MAP = {
  'Pending':     'badge-pending',  'Pendiente':     'badge-pending',
  'Started':     'badge-started',  'Iniciado':      'badge-started',
  'In Progress': 'badge-progress', 'En Progreso':   'badge-progress',
  'Completed':   'badge-done',     'Completado':    'badge-done',
  'Active':      'badge-active',   'Activo':        'badge-active',
  'Planning':    'badge-planning', 'Planificación': 'badge-planning',
  'Delayed':     'badge-delayed',  'Retrasado':     'badge-delayed',
  'Available':   'badge-avail',    'Disponible':    'badge-avail',
  'In Use':      'badge-inuse',    'En Uso':        'badge-inuse',
  'Maintenance': 'badge-maint',    'Mantenimiento': 'badge-maint',
  'Completed\n': 'badge-done',
};
export function Badge({ status }) {
  return <span className={BADGE_MAP[status] || 'badge-pending'}>{status}</span>;
}

/* ── Progress ───────────────────────────────────────────── */
export function Progress({ value = 0, size = 'sm', showLabel = true }) {
  const h   = size === 'xs' ? 'h-1' : size === 'sm' ? 'h-1.5' : size === 'md' ? 'h-2.5' : 'h-3';
  const col = value >= 80 ? 'bg-green-500' : value >= 40 ? 'bg-brand-500' : 'bg-blue-500';
  return (
    <div className="progress-wrap">
      <div className={`progress-rail ${h} flex-1`}>
        <div className={`progress-fill ${h} ${col}`} style={{ width: `${Math.min(100, value)}%` }} />
      </div>
      {showLabel && <span className="text-xs font-mono text-slate-400 w-8 text-right">{value}%</span>}
    </div>
  );
}

/* ── Modal ──────────────────────────────────────────────── */
const SIZE = { sm:'max-w-md', md:'max-w-2xl', lg:'max-w-3xl', xl:'max-w-5xl', full:'max-w-7xl' };
export function Modal({ open, onClose, title, children, size = 'md' }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
         onMouseDown={onClose}>
      <div className={`bg-surface-800 border border-surface-500 rounded-2xl shadow-2xl w-full ${SIZE[size]} max-h-[90vh] flex flex-col`}
           onMouseDown={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-600 flex-shrink-0">
          <h2 className="section-title text-base">{title}</h2>
          <button onClick={onClose} className="btn-icon"><X size={16}/></button>
        </div>
        <div className="overflow-y-auto flex-1 p-6">{children}</div>
      </div>
    </div>
  );
}

/* ── Confirm ────────────────────────────────────────────── */
export function Confirm({ open, onClose, onConfirm, title, message }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
      <div className="bg-surface-800 border border-surface-500 rounded-2xl p-6 max-w-sm w-full shadow-2xl">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-xl bg-red-500/20 flex items-center justify-center flex-shrink-0">
            <AlertTriangle size={18} className="text-red-400"/>
          </div>
          <h3 className="font-display font-bold text-white text-base uppercase tracking-wide">{title}</h3>
        </div>
        <p className="text-slate-400 text-sm mb-5 leading-relaxed">{message}</p>
        <div className="flex gap-2 justify-end">
          <button onClick={onClose}                              className="btn-ghost">Cancelar</button>
          <button onClick={() => { onConfirm(); onClose(); }}   className="btn bg-red-600 hover:bg-red-700 text-white">Eliminar</button>
        </div>
      </div>
    </div>
  );
}

/* ── Spinner ────────────────────────────────────────────── */
export function Spinner({ size = 'md' }) {
  const s = { sm:'w-4 h-4', md:'w-7 h-7', lg:'w-10 h-10' }[size];
  return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className={`${s} animate-spin text-brand-500`}/>
    </div>
  );
}

/* ── Empty state ────────────────────────────────────────── */
export function Empty({ icon: Icon = SearchX, title, message, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
      <div className="w-14 h-14 rounded-2xl bg-surface-700 flex items-center justify-center border border-surface-500">
        <Icon size={26} className="text-slate-500"/>
      </div>
      <div>
        <p className="font-display font-bold text-slate-400 uppercase tracking-wide">{title}</p>
        {message && <p className="text-slate-500 text-xs mt-1 max-w-xs">{message}</p>}
      </div>
      {action}
    </div>
  );
}

/* ── Stat card ──────────────────────────────────────────── */
const STAT_COL = {
  brand:  'bg-brand-500/15 text-brand-400',
  green:  'bg-green-500/15 text-green-400',
  blue:   'bg-blue-500/15  text-blue-400',
  red:    'bg-red-500/15   text-red-400',
  yellow: 'bg-yellow-500/15 text-yellow-400',
  purple: 'bg-purple-500/15 text-purple-400',
  slate:  'bg-slate-500/15  text-slate-400',
};
export function StatCard({ icon: Icon, label, value, color = 'brand', sub, onClick }) {
  return (
    <div className={`card p-4 flex items-start gap-3 ${onClick ? 'cursor-pointer hover:border-surface-400 transition-colors' : ''}`}
         onClick={onClick}>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${STAT_COL[color]}`}>
        <Icon size={20}/>
      </div>
      <div>
        <div className="text-2xl font-display font-bold text-white leading-none">{value}</div>
        <div className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold mt-0.5">{label}</div>
        {sub && <div className="text-[11px] text-slate-500 mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}

/* ── Field wrapper ──────────────────────────────────────── */
export function Field({ label, required, children }) {
  return (
    <div className="field">
      <label className="label">{label}{required && <span className="text-brand-500 ml-0.5">*</span>}</label>
      {children}
    </div>
  );
}

/* ── Avatar ─────────────────────────────────────────────── */
export function Avatar({ name = '?', size = 'md' }) {
  const s = { xs:'w-6 h-6 text-[10px]', sm:'w-8 h-8 text-xs', md:'w-10 h-10 text-sm', lg:'w-12 h-12 text-base' }[size];
  return (
    <div className={`${s} rounded-xl bg-brand-500/20 text-brand-400 font-display font-bold flex items-center justify-center flex-shrink-0 uppercase`}>
      {name.charAt(0)}
    </div>
  );
}
