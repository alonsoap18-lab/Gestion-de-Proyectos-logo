// api/users.js
const bcrypt = require('bcryptjs');
const { supabase, requireAuth, requireRole, dispatch, pathParts, queryParams } = require('./lib/supabase');
const SAFE = 'id,name,email,role,position,specialty,phone,active,created_at';

module.exports = async (req, res) => {
  const me   = requireAuth(req, res); if (!me) return;
  const parts = pathParts(req, 'users');
  const id    = parts[0] || null;
  const body  = req.body || {};

  return dispatch(req, res, {
    GET: async () => {
      if (id) {
        const { data: user } = await supabase.from('users').select(SAFE).eq('id', id).single();
        if (!user) return res.status(404).json({ error: 'Usuario no encontrado.' });
        const { data: projects } = await supabase.from('project_members')
          .select('project_role, projects(id,name,status,progress)').eq('user_id', id);
        return res.json({ ...user, projects: (projects||[]).map(p=>({...p.projects, project_role:p.project_role})) });
      }
      const { role, search } = queryParams(req);
      let q = supabase.from('users').select(SAFE).order('name');
      if (role)   q = q.eq('role', role);
      if (search) q = q.or(`name.ilike.%${search}%,email.ilike.%${search}%`);
      const { data } = await q;
      return res.json(data || []);
    },
    POST: async () => {
      if (!requireRole(me, res, 'Admin')) return;
      const { name, email, password, role, phone, specialty, position } = body;
      if (!name||!email||!password) return res.status(400).json({ error: 'Nombre, email y contraseña requeridos.' });
      const { data, error } = await supabase.from('users')
        .insert({ name:name.trim(), email:email.toLowerCase().trim(),
                  password:bcrypt.hashSync(password,10), role:role||'Worker', phone, specialty, position })
        .select('id,name,email,role').single();
      if (error?.code==='23505') return res.status(409).json({ error: 'El correo ya está registrado.' });
      if (error) return res.status(400).json({ error: error.message });
      return res.status(201).json(data);
    },
    PUT: async () => {
      if (!requireRole(me, res, 'Admin')) return;
      if (!id) return res.status(400).json({ error: 'ID requerido.' });
      const { name, email, role, phone, specialty, position, active, password } = body;
      const upd = { name, email:email?.toLowerCase().trim(), role, phone, specialty, position,
                    active: active !== undefined ? active : true };
      if (password && password.length >= 6) upd.password = bcrypt.hashSync(password, 10);
      const { error } = await supabase.from('users').update(upd).eq('id', id);
      if (error?.code==='23505') return res.status(409).json({ error: 'El correo ya está en uso.' });
      if (error) return res.status(400).json({ error: error.message });
      return res.json({ success: true });
    },
    DELETE: async () => {
      if (!requireRole(me, res, 'Admin')) return;
      if (!id) return res.status(400).json({ error: 'ID requerido.' });
      if (id === me.id) return res.status(400).json({ error: 'No puedes eliminarte a ti mismo.' });
      await supabase.from('users').delete().eq('id', id);
      return res.json({ success: true });
    },
  });
};
