import React, { useState } from 'react';
import { supabase } from '../ruta/a/tu/supabaseClient'; // ⚠️ IMPORTANTE: Ajusta esta ruta a tu archivo real

export default function ModalNuevoProveedor({ cerrarModal, recargarProveedores }) {
  // Estados de los campos
  const [contacto, setContacto] = useState('');
  const [telefonos, setTelefonos] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [direccion, setDireccion] = useState('');
  const [ubicacion, setUbicacion] = useState('');
  const [segmento, setSegmento] = useState('Obra Gris');
  const [paginaWeb, setPaginaWeb] = useState('');
  
  // Estado de carga
  const [loading, setLoading] = useState(false);

  const handleGuardar = async () => {
    // 1. Verificación de conexión a Internet
    if (!navigator.onLine) {
      alert("No hay conexión a internet. Revisa tu red e intenta de nuevo.");
      return; 
    }

    // 2. Validación de campos obligatorios
    if (!contacto) {
      alert("El nombre del contacto o empresa es obligatorio.");
      return;
    }

    setLoading(true);

    // 3. Controlador de tiempo máximo de espera (Timeout de 8s)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    try {
      // 4. Inserción en Supabase
      const { error } = await supabase
        .from('proveedores')
        .insert([{ 
          contacto: contacto,
          telefonos: telefonos,
          whatsapp: whatsapp,
          direccion: direccion,
          ubicacion: ubicacion,
          segmento_mercado: segmento,
          pagina_web: paginaWeb
        }])
        .abortSignal(controller.signal);

      clearTimeout(timeoutId);

      if (error) throw error;

      alert("Proveedor agregado exitosamente");
      cerrarModal();
      
      // 5. Refrescar la lista en la pantalla principal (si la función fue pasada como prop)
      if (recargarProveedores) {
        recargarProveedores(); 
      }

    } catch (error) {
      if (error.name === 'AbortError') {
        alert("La conexión está muy inestable. Se agotó el tiempo de espera.");
      } else {
        console.error("Error al guardar proveedor:", error.message);
        alert("Hubo un error al guardar. Intenta nuevamente.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-fondo" style={styles.fondo}>
      <div className="modal-contenido" style={styles.modal}>
        <div style={styles.header}>
          <h3>NUEVO PROVEEDOR</h3>
          <button 
            onClick={() => { setLoading(false); cerrarModal(); }} 
            style={styles.closeBtn}
            disabled={loading}
          >
            ✕
          </button>
        </div>

        <div style={styles.grid}>
          <div style={styles.inputGroup}>
            <label style={styles.label}>NOMBRE DEL CONTACTO / EMPRESA *</label>
            <input 
              type="text" 
              value={contacto} 
              onChange={(e) => setContacto(e.target.value)} 
              placeholder="Ej. Ferretería El Constructor"
              style={styles.input}
              disabled={loading}
            />
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>TELÉFONOS</label>
            <input 
              type="text" 
              value={telefonos} 
              onChange={(e) => setTelefonos(e.target.value)} 
              placeholder="Ej. 2222-3333"
              style={styles.input}
              disabled={loading}
            />
          </div>
          
          <div style={styles.inputGroup}>
            <label style={styles.label}>WHATSAPP</label>
            <input 
              type="text" 
              value={whatsapp} 
              onChange={(e) => setWhatsapp(e.target.value)} 
              placeholder="Ej. 8888-9999"
              style={styles.input}
              disabled={loading}
            />
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>SEGMENTO DE MERCADO</label>
            <select 
              value={segmento} 
              onChange={(e) => setSegmento(e.target.value)} 
              style={styles.input}
              disabled={loading}
            >
              <option value="Obra Gris">Obra Gris (Cemento, Acero, Blocks)</option>
              <option value="Acabados">Acabados (Pisos, Pintura, Cerámica)</option>
              <option value="Eléctrico">Eléctrico e Iluminación</option>
              <option value="Plomería">Plomería y Tuberías</option>
              <option value="Maquinaria">Alquiler de Maquinaria</option>
              <option value="Servicios Profesionales">Servicios Profesionales</option>
              <option value="Otros">Otros</option>
            </select>
          </div>
          
          <div style={styles.inputGroup}>
            <label style={styles.label}>UBICACIÓN (CIUDAD / CANTÓN)</label>
            <input 
              type="text" 
              value={ubicacion} 
              onChange={(e) => setUbicacion(e.target.value)} 
              placeholder="Ej. San José, Escazú"
              style={styles.input}
              disabled={loading}
            />
          </div>

          <div style={{...styles.inputGroup, gridColumn: 'span 2'}}>
            <label style={styles.label}>DIRECCIÓN EXACTA</label>
            <input 
              type="text" 
              value={direccion} 
              onChange={(e) => setDireccion(e.target.value)} 
              placeholder="Señas exactas del local"
              style={styles.input}
              disabled={loading}
            />
          </div>

          <div style={{...styles.inputGroup, gridColumn: 'span 2'}}>
            <label style={styles.label}>PÁGINA WEB / REDES SOCIALES</label>
            <input 
              type="text" 
              value={paginaWeb} 
              onChange={(e) => setPaginaWeb(e.target.value)} 
              placeholder="Ej. www.ferreteria.com o link de Facebook"
              style={styles.input}
              disabled={loading}
            />
          </div>
        </div>

        <div style={styles.footer}>
          <button 
            onClick={() => { setLoading(false); cerrarModal(); }} 
            style={styles.btnCancelar}
            disabled={loading}
          >
            Cancelar
          </button>
          <button 
            onClick={handleGuardar} 
            disabled={loading} 
            style={styles.btnGuardar}
          >
            {loading ? 'Guardando...' : 'Guardar Proveedor'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Estilos integrados (puedes migrarlos a un archivo .css o usar Tailwind si prefieres)
const styles = {
  fondo: { position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 },
  modal: { backgroundColor: '#1a1f2b', padding: '25px', borderRadius: '12px', width: '650px', maxWidth: '95%', color: '#e2e8f0', fontFamily: 'system-ui, -apple-system, sans-serif', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #2d3748', paddingBottom: '15px', marginBottom: '20px' },
  closeBtn: { background: 'none', border: 'none', color: '#a0aec0', cursor: 'pointer', fontSize: '20px', fontWeight: 'bold' },
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' },
  inputGroup: { display: 'flex', flexDirection: 'column' },
  label: { fontSize: '12px', fontWeight: 'bold', color: '#a0aec0', marginBottom: '5px', letterSpacing: '0.5px' },
  input: { padding: '10px 12px', borderRadius: '6px', border: '1px solid #4a5568', backgroundColor: '#2d3748', color: 'white', fontSize: '14px', outline: 'none' },
  footer: { display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '25px', borderTop: '1px solid #2d3748', paddingTop: '20px' },
  btnCancelar: { padding: '10px 20px', backgroundColor: 'transparent', border: '1px solid #4a5568', color: '#e2e8f0', borderRadius: '6px', cursor: 'pointer', fontWeight: '500' },
  btnGuardar: { padding: '10px 20px', backgroundColor: '#3182ce', border: 'none', color: 'white', borderRadius: '6px', cursor: 'pointer', fontWeight: '500' }
};
