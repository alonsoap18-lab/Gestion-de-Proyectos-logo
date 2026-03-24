// src/pages/Tasks.jsx
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase'; // ⚠️ REVISA QUE ESTA RUTA APUNTE A TU supabase.js
import { Modal, Confirm, Badge, Progress, Spinner, Empty, Field } from '../components/ui';
import { Plus, Pencil, Trash2, CheckSquare, Filter } from 'lucide-react';

const BLANK = { name:'', project_id:'', assigned_to:'', start_week:1, end_week:2, status:'Pending', progress:0, priority:'Medium', description:'' };

export default function Tasks() {
  const qc = useQueryClient();
  const [modal,   setModal]   = useState(false);
  const [form,    setForm]    = useState(BLANK);
  const [delTgt,  setDelTgt]  = useState(null);
  const [fpj,     setFpj]     = useState('');
  const [fst,     setFst]     = useState('');
  const [fpr,     setFpr]     = useState('');

  // 1. LEER TAREAS (Y cruzar datos con Proyectos y Usuarios)
  const { data: tasks = [], isLoading } = useQuery({ 
    queryKey: ['tasks'],    
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select(`
          *,
          projects ( name ),
          users ( name )
        `)
        .order('start_week', { ascending: true });
      
      if (error) throw error;
      
      // Mapeamos los datos para que el diseño de las tablas funcione igual
      return data.map(t => ({
        ...t,
        project_name: t.projects?.name || 'Sin proyecto',
        assigned_name: t.users?.name || ''
      }));
    } 
  });

  // 2. LEER PROYECTOS (Para llenar la lista desplegable)
  const { data: projects = [] } = useQuery({ 
    queryKey: ['projects'], 
    queryFn: async () => {
      const { data, error } = await supabase.from('projects').select('id, name').order('name');
      if (error) throw error;
      return data;
    } 
  });

  // 3. LEER USUARIOS (Para asignar tareas)
  const { data: users = [] } = useQuery({ 
    queryKey: ['users'],    
    queryFn: async () => {
      const { data, error } = await supabase.from('users').select('id, name').order('name');
      if (error) throw error;
      return data;
    } 
  });

  // 4. GUARDAR / ACTUALIZAR TAREA
  const save = useMutation({
    mutationFn: async (d) => {
      const payload = { ...d };
      
      // Limpieza crítica: Supabase no acepta textos vacíos en columnas tipo UUID
      if (!payload.assigned_to) payload.assigned_to = null;
      if (!payload.project_id) throw new Error("Debes seleccionar un proyecto");

      // Borramos los datos "cruzados" antes de guardar, ya que la base de datos solo acepta las columnas reales
      delete payload.projects;
      delete payload.users;
      delete payload.project_name;
      delete payload.assigned_name;

      if (payload.id) {
        const { data, error } = await supabase.from('tasks').update(payload).eq('id', payload.id).select();
        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase.from('tasks').insert([payload]).select();
        if (error) throw error;
        return data;
      }
    },
    onSuccess:  () => { qc.invalidateQueries({queryKey: ['tasks']}); qc.invalidateQueries({queryKey: ['projects']}); setModal(false); },
    onError: (e) => alert(e.message || 'Error al guardar la tarea')
  });

  // 5. ELIMINAR TAREA
  const del = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('tasks').delete().eq('id', id);
      if (error) throw error;
      return true;
    },
    onSuccess:  () => { qc.invalidateQueries({queryKey: ['tasks']}); qc.invalidateQueries({queryKey: ['projects']}); setDelTgt(null); },
    onError: (e) => alert(e.message || 'Error al eliminar la tarea')
  });

  const filtered = tasks.filter(t => {
    if (fpj && t.project_id !== fpj)   return false;
    if (fst && t.status    !== fst)    return false;
    if (fpr && t.priority  !== fpr)    return false;
    return true;
  });

  // Group by project
  const grouped = filtered.reduce((acc, t) => {
    const key = t.project_name || 'Sin proyecto';
    (acc[key] = acc[key]
