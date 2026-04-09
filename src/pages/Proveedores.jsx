import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { Spinner } from '../components/ui';
import ModalNuevoProveedor from '../components/ModalNuevoProveedor';

export default function Proveedores() {
  const [mostrarModal, setMostrarModal] = useState(false);

  // 1. LEER PROVEEDORES DESDE SUPABASE
  const { data: proveedores = [], isLoading, refetch } = useQuery({
    queryKey: ['proveedores'],
    queryFn: async () => {
      // Pedimos todos los proveedores, ordenados por los más recientes
      const { data, error } = await supabase
        .from('proveedores')
        .select('*')
        .order('created_at', { ascending: false });
        
      if (error) {
        alert("Error cargando proveedores: " + error.message);
        throw error;
      }
      return data;
    }
  });

  // Mostramos el spinner mientras carga
  if (isLoading) return <Spinner />;

  return (
    <div>
      {/* Encabezado con el diseño unificado de tu app */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Directorio de Proveedores</h1>
          <p className="text-slate-400 text-sm mt-0.5">
            {proveedores.length} proveedor(es) registrado(s). Gestiona contactos, ferreterías y subcontratistas.
          </p>
        </div>
        
        <button onClick={() => setMostrarModal(true)} className="btn-primary">
          + Agregar Proveedor
        </button>
      </div>

      {/* Tabla de datos */}
      <div className="table-wrap">
        <table className="w-full">
          <thead>
            <tr>
              <th className="th">Contacto / Empresa</th>
              <th className="th">Teléfonos</th>
              <th className="th">WhatsApp</th>
              <th className="th">Dirección</th>
            </tr>
          </thead>
          <tbody>
            {proveedores.map(p => (
              <tr key={p.id} className="tr-hover">
                <td className="td font-semibold text-slate-200">{p.contacto || '—'}</td>
                <td className="td text-slate-400">{p.telefonos || '—'}</td>
                <td className="td text-brand-400 font-mono">{p.whatsapp || '—'}</td>
                <td className="td text-slate-400 text-xs">{p.direccion || '—'}</td>
              </tr>
            ))}
            
            {/* Mensaje si la tabla está vacía */}
            {proveedores.length === 0 && (
              <tr>
                <td colSpan={4} className="td text-center text-slate-500 py-10">
                  La lista de proveedores aparecerá aquí. Haz clic en "+ Agregar Proveedor" para ingresar el primero.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {mostrarModal && (
        <ModalNuevoProveedor 
          cerrarModal={() => setMostrarModal(false)} 
          // Pasamos la función 'refetch' para que la tabla se actualice sola al guardar
          recargarProveedores={refetch} 
        />
      )}
    </div>
  );
}
