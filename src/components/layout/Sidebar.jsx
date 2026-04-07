// src/components/layout/Sidebar.jsx
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard, FolderKanban, CheckSquare, Users,
  Calendar, BarChart3, Wrench, Package, UserCog,
  LogOut, ChevronLeft, ChevronRight, Truck
} from 'lucide-react';

const NAV = [
  { to: '/',          icon: LayoutDashboard, label: 'Dashboard'  },
  { to: '/projects',  icon: FolderKanban,    label: 'Proyectos'  },
  { to: '/tasks',     icon: CheckSquare,     label: 'Tareas'     },
  { to: '/employees', icon: Users,           label: 'Empleados'  },
  { to: '/calendar',  icon: Calendar,        label: 'Calendario' },
  { to: '/reports',   icon: BarChart3,       label: 'Reportes'   },
  { to: '/machinery', icon: Wrench,          label: 'Maquinaria' },
  { to: '/materials', icon: Package,         label: 'Materiales' },
  { to: '/proveedores', icon: Truck,         label: 'Proveedores'},
  { to: '/users',     icon: UserCog,         label: 'Usuarios',  adminOnly: true },
];

const ROLE_COLOR = {
  Admin:      'text-[#4a7fd4]',
  Engineer:   'text-blue-400',
  Supervisor: 'text-purple-400',
  Worker:     'text-slate-400',
};

export default function Sidebar({ collapsed, toggle }) {
  const { user, logout } = useAuth();
  const loc = useLocation();

  return (
    <aside
      className={`fixed top-0 left-0 h-screen bg-surface-800 border-r border-surface-600
                  flex flex-col z-40 transition-all duration-200 select-none
                  ${collapsed ? 'w-[60px]' : 'w-[220px]'}`}
    >
      {/* ── Logo ─────────────────────────────────────────── */}
      <div className={`flex items-center border-b border-surface-600 min-h-[68px] overflow-hidden
                       ${collapsed ? 'justify-center px-2 py-3' : 'px-3 py-3 gap-3'}`}>
        {/* White bg pill for logo */}
        <div className={`bg-white rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-200
                         ${collapsed ? 'w-9 h-9 p-1' : 'w-11 h-11 p-1.5'}`}>
          <img src="/icaa-logo.png" alt="ICAA" className="w-full h-full object-contain"/>
        </div>

        {!collapsed && (
          <div className="leading-tight min-w-0">
            <div className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">Grupo</div>
            <div className="font-display text-lg font-black tracking-widest leading-none"
              style={{ color: '#2d4fa0' }}>ICAA</div>
            <div className="text-[9px] text-slate-500 uppercase tracking-[0.2em] font-semibold">Constructora</div>
          </div>
        )}
      </div>

      {/* ── Nav ──────────────────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {NAV.map(({ to, icon: Icon, label, adminOnly }) => {
          if (adminOnly && user?.role !== 'Admin') return null;
          const active = to === '/'
            ? loc.pathname === '/'
            : loc.pathname.startsWith(to);

          return (
            <NavLink key={to} to={to} title={collapsed ? label : undefined}
              className={`flex items-center gap-2.5 px-2.5 py-2.5 rounded-lg text-sm font-medium
                          transition-all duration-100 group
                          ${active
                            ? 'text-white border border-[#2d4fa0]/40'
                            : 'text-slate-400 hover:text-slate-100 hover:bg-surface-600 border border-transparent'
                          }`}
              style={active ? { background: 'linear-gradient(135deg, rgba(45,79,160,0.25) 0%, rgba(45,79,160,0.1) 100%)' } : {}}
            >
              <Icon size={17} className={`flex-shrink-0 transition-colors
                ${active ? 'text-[#4a7fd4]' : 'text-slate-500 group-hover:text-slate-300'}`}/>
              {!collapsed && <span className="truncate">{label}</span>}
              {active && !collapsed && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-[#4a7fd4] flex-shrink-0"/>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* ── Footer ───────────────────────────────────────── */}
      <div className="border-t border-surface-600 p-2 space-y-1">
        {!collapsed && (
          <div className="px-2.5 py-2 rounded-lg bg-surface-700 mb-1 border border-surface-600">
            <div className="text-xs font-semibold text-slate-200 truncate">{user?.name}</div>
            <div className={`text-[10px] font-bold uppercase tracking-wider ${ROLE_COLOR[user?.role] || 'text-slate-400'}`}>
              {user?.role}
            </div>
          </div>
        )}

        <button onClick={logout} title="Cerrar sesión"
          className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm text-slate-400
                     hover:text-red-400 hover:bg-red-500/10 transition-all">
          <LogOut size={15} className="flex-shrink-0"/>
          {!collapsed && 'Cerrar sesión'}
        </button>

        <button onClick={toggle}
          className="w-full flex items-center justify-center py-1.5 rounded-lg text-slate-600
                     hover:text-slate-400 hover:bg-surface-700 transition-all">
          {collapsed ? <ChevronRight size={13}/> : <ChevronLeft size={13}/>}
        </button>
      </div>
    </aside>
  );
}
