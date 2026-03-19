// api/auth.js  — /api/auth/login  |  /api/auth/me  |  /api/auth/password
const bcrypt = require('bcryptjs');
const { supabase, signToken, requireAuth, dispatch, pathParts } = require('./lib/supabase');

module.exports = async (req, res) => {
  const parts = pathParts(req, 'auth');
  const sub   = parts[0] || '';    // 'login' | 'me' | 'password'
  const body  = req.body || {};

  return dispatch(req, res, {
    POST: async () => {
      // POST /api/auth/login
      if (sub === 'login') {
        const { email, password } = body;
        if (!email || !password) return res.status(400).json({ error: 'Email y contraseña requeridos.' });
        const { data: rows } = await supabase.from('users').select('*')
          .eq('email', email.toLowerCase().trim()).eq('active', true).limit(1);
        const user = rows?.[0];
        if (!user || !bcrypt.compareSync(password, user.password))
          return res.status(401).json({ error: 'Credenciales incorrectas.' });
        const { password: _pw, ...safe } = user;
        return res.json({ token: signToken({ id:user.id, email:user.email, role:user.role, name:user.name }), user: safe });
      }
      // POST /api/auth/password
      if (sub === 'password') {
        const me = requireAuth(req, res); if (!me) return;
        const { current_password, new_password } = body;
        const { data: u } = await supabase.from('users').select('password').eq('id', me.id).single();
        if (!bcrypt.compareSync(current_password, u.password))
          return res.status(400).json({ error: 'Contraseña actual incorrecta.' });
        await supabase.from('users').update({ password: bcrypt.hashSync(new_password, 10) }).eq('id', me.id);
        return res.json({ success: true });
      }
      return res.status(404).json({ error: 'Not found.' });
    },
    GET: async () => {
      // GET /api/auth/me
      const me = requireAuth(req, res); if (!me) return;
      const { data: user } = await supabase.from('users')
        .select('id,name,email,role,position,specialty,phone,created_at').eq('id', me.id).single();
      if (!user) return res.status(404).json({ error: 'Usuario no encontrado.' });
      return res.json(user);
    },
    PUT: async () => {
      // PUT /api/auth/me
      const me = requireAuth(req, res); if (!me) return;
      const { name, phone, specialty, position } = body;
      await supabase.from('users').update({ name, phone, specialty, position }).eq('id', me.id);
      return res.json({ success: true });
    },
  });
};
