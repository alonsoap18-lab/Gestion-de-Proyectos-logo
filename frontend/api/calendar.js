// api/calendar.js
const { supabase, requireAuth, dispatch, pathParts, queryParams } = require('./lib/supabase');

module.exports = async (req, res) => {
  const me    = requireAuth(req, res); if (!me) return;
  const parts = pathParts(req, 'calendar');
  const id    = parts[0]||null;
  const body  = req.body||{};

  return dispatch(req, res, {
    GET: async () => {
      const p = queryParams(req);
      let q = supabase.from('calendar_events').select('*,projects(name),users(name)').order('start_date');
      if (p.project_id) q=q.eq('project_id',p.project_id);
      if (p.user_id)    q=q.eq('user_id',p.user_id);
      if (p.type)       q=q.eq('type',p.type);
      if (p.from)       q=q.gte('start_date',p.from);
      if (p.to)         q=q.lte('start_date',p.to);
      const {data} = await q;
      return res.json((data||[]).map(e=>({...e,project_name:e.projects?.name,user_name:e.users?.name})));
    },
    POST: async () => {
      const {title,description,start_date,end_date,type,project_id,user_id,color}=body;
      if (!title?.trim()||!start_date) return res.status(400).json({error:'Título y fecha requeridos.'});
      const {data,error} = await supabase.from('calendar_events')
        .insert({title:title.trim(),description,start_date,end_date:end_date||null,
                 type:type||'Task',project_id:project_id||null,user_id:user_id||null,color:color||'#f97316'})
        .select('id').single();
      if (error) return res.status(400).json({error:error.message});
      return res.status(201).json({id:data.id});
    },
    PUT: async () => {
      if (!id) return res.status(400).json({error:'ID requerido.'});
      const {title,description,start_date,end_date,type,project_id,user_id,color}=body;
      await supabase.from('calendar_events').update({
        title,description,start_date,end_date:end_date||null,
        type,project_id:project_id||null,user_id:user_id||null,color,
      }).eq('id',id);
      return res.json({success:true});
    },
    DELETE: async () => {
      if (!id) return res.status(400).json({error:'ID requerido.'});
      await supabase.from('calendar_events').delete().eq('id',id);
      return res.json({success:true});
    },
  });
};
