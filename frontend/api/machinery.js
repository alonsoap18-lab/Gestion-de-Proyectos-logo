// api/machinery.js
const { supabase, requireAuth, dispatch, pathParts, queryParams } = require('./lib/supabase');

module.exports = async (req, res) => {
  const me    = requireAuth(req, res); if (!me) return;
  const parts = pathParts(req, 'machinery');
  const id    = parts[0]||null;
  const body  = req.body||{};

  return dispatch(req, res, {
    GET: async () => {
      const p = queryParams(req);
      let q = supabase.from('machinery').select('*,projects(name)').order('name');
      if (p.status)     q=q.eq('status',p.status);
      if (p.project_id) q=q.eq('project_id',p.project_id);
      const {data} = await q;
      return res.json((data||[]).map(m=>({...m,project_name:m.projects?.name})));
    },
    POST: async () => {
      const {name,type,brand,model,serial_number,status,project_id,notes}=body;
      if (!name?.trim()) return res.status(400).json({error:'Nombre requerido.'});
      const {data,error} = await supabase.from('machinery')
        .insert({name:name.trim(),type,brand,model,serial_number,status:status||'Available',project_id:project_id||null,notes})
        .select('id').single();
      if (error) return res.status(400).json({error:error.message});
      return res.status(201).json({id:data.id});
    },
    PUT: async () => {
      if (!id) return res.status(400).json({error:'ID requerido.'});
      const {name,type,brand,model,serial_number,status,project_id,notes}=body;
      await supabase.from('machinery').update({name,type,brand,model,serial_number,status,project_id:project_id||null,notes}).eq('id',id);
      return res.json({success:true});
    },
    DELETE: async () => {
      if (!id) return res.status(400).json({error:'ID requerido.'});
      await supabase.from('machinery').delete().eq('id',id);
      return res.json({success:true});
    },
  });
};
