// api/materials.js
const { supabase, requireAuth, dispatch, pathParts, queryParams } = require('./lib/supabase');

module.exports = async (req, res) => {
  const me    = requireAuth(req, res); if (!me) return;
  const parts = pathParts(req, 'materials');
  const id    = parts[0]||null;
  const sub   = parts[1]||null;
  const body  = req.body||{};

  return dispatch(req, res, {
    GET: async () => {
      const p = queryParams(req);
      let q = supabase.from('materials').select('*,projects(name)').order('name');
      if (p.project_id) q=q.eq('project_id',p.project_id);
      const {data} = await q;
      return res.json((data||[]).map(m=>({...m,project_name:m.projects?.name})));
    },
    POST: async () => {
      const {name,unit,quantity,used_quantity,cost_per_unit,project_id,supplier,notes}=body;
      if (!name?.trim()) return res.status(400).json({error:'Nombre requerido.'});
      const {data,error} = await supabase.from('materials')
        .insert({name:name.trim(),unit:unit||'units',quantity:parseFloat(quantity)||0,
                 used_quantity:parseFloat(used_quantity)||0,cost_per_unit:parseFloat(cost_per_unit)||0,
                 project_id:project_id||null,supplier,notes})
        .select('id').single();
      if (error) return res.status(400).json({error:error.message});
      return res.status(201).json({id:data.id});
    },
    PUT: async () => {
      if (!id) return res.status(400).json({error:'ID requerido.'});
      const {name,unit,quantity,used_quantity,cost_per_unit,project_id,supplier,notes}=body;
      await supabase.from('materials').update({
        name,unit,quantity:parseFloat(quantity)||0,used_quantity:parseFloat(used_quantity)||0,
        cost_per_unit:parseFloat(cost_per_unit)||0,project_id:project_id||null,supplier,notes,
      }).eq('id',id);
      return res.json({success:true});
    },
    PATCH: async () => {
      if (!id) return res.status(400).json({error:'ID requerido.'});
      const {used_quantity}=body;
      await supabase.from('materials').update({used_quantity:parseFloat(used_quantity)||0}).eq('id',id);
      return res.json({success:true});
    },
    DELETE: async () => {
      if (!id) return res.status(400).json({error:'ID requerido.'});
      await supabase.from('materials').delete().eq('id',id);
      return res.json({success:true});
    },
  });
};
