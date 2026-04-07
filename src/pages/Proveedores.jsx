import React, { useState } from 'react';
import ModalNuevoProveedor from '../components/ModalNuevoProveedor'; // ⚠️ Ajusta la ruta según donde guardaste el archivo anterior

export default function Proveedores() {
  // Estado para controlar si la ventana (modal) está visible o no
  const [mostrarModal, setMostrarModal] = useState(false);

  return (
    <div style={styles.container}>
      {/* Encabezado de la página */}
      <div style={styles.header}>
        <div>
          <h2 style={{ margin: 0, color: '#ffffff' }}>Directorio de Proveedores</h2>
          <p style={{ margin: '5px 0 0 0', color: '#a0aec0', fontSize: '14px' }}>
            Gestiona los contactos, ferreterías y subcontratistas de tus obras.
          </p>
        </div>
        
        {/* Este es el botón que "enciende" el modal */}
        <button 
          onClick={() => setMostrarModal(true)} 
          style={styles.btnNuevo}
        >
          + Agregar Proveedor
        </button>
      </div>

      {/* Espacio para la futura tabla de datos */}
      <div style={styles.tablaContainer}>
        <p style={{ color: '#a0aec0', textAlign: 'center', padding: '40px' }}>
          La lista de proveedores aparecerá aquí. Haz clic en "+ Agregar Proveedor" para ingresar el primero.
        </p>
      </div>

      {/* Aquí insertamos el Modal. Solo se renderiza si mostrarModal es true */}
      {mostrarModal && (
        <ModalNuevoProveedor 
          cerrarModal={() => setMostrarModal(false)} 
          // recargarProveedores={cargarListaProveedores} <-- Lo usaremos cuando hagamos la tabla
        />
      )}
    </div>
  );
}

// Estilos basados en la paleta de colores oscura de tu imagen
const styles = {
  container: { padding: '30px', fontFamily: 'system-ui, sans-serif' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' },
  btnNuevo: { padding: '10px 20px', backgroundColor: '#3182ce', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px', transition: 'background 0.3s' },
  tablaContainer: { backgroundColor: '#1a1f2b', borderRadius: '10px', minHeight: '300px', border: '1px solid #2d3748', display: 'flex', justifyContent: 'center', alignItems: 'center' }
};
