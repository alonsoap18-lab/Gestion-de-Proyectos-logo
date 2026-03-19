// api/lib/supabase.js
const { createClient } = require('@supabase/supabase-js');
const jwt = require('jsonwebtoken');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const JWT_SECRET = process.env.JWT_SECRET || 'icaa_jwt_secret_2026_change_in_prod';

function signToken(payload) { return jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' }); }
function verifyToken(token)  { return jwt.verify(token, JWT_SECRET); }

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
}

function requireAuth(req, res) {
  const h = req.headers.authorization || '';
  if (!h.startsWith('Bearer ')) { res.status(401).json({ error: 'Token no proporcionado.' }); return null; }
  try   { return verifyToken(h.split(' ')[1]); }
  catch { res.status(401).json({ error: 'Token inválido o expirado.' }); return null; }
}

function requireRole(user, res, ...roles) {
  if (!roles.includes(user?.role)) { res.status(403).json({ error: 'Permisos insuficientes.' }); return false; }
  return true;
}

async function dispatch(req, res, handlers) {
  setCors(res);
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  const h = handlers[req.method];
  if (!h) { res.status(405).json({ error: 'Método no permitido.' }); return; }
  try { await h(); }
  catch (e) { console.error('[API]', e); res.status(500).json({ error: e.message }); }
}

function pathParts(req, base) {
  const clean = (req.url||'').split('?')[0].replace(new RegExp('^/api/'+base+'/?'),'');
  return clean ? clean.split('/') : [];
}

function queryParams(req) {
  return Object.fromEntries(new URL('http://x'+(req.url||'')).searchParams);
}

module.exports = { supabase, signToken, verifyToken, setCors, requireAuth, requireRole, dispatch, pathParts, queryParams };
