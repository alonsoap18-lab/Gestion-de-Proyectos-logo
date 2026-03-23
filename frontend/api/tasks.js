// api/tasks.js
const { supabase, requireAuth, dispatch, pathParts, queryParams } = require('./lib/supabase');

async function recalc(project_id) {
  const {data} = await supabase.from('tasks').select('progress').eq('project_id',project_id);
  if (!data?.length) return;
  const avg = Math.round(data.reduce((s,t)=>s+(t.progress||0),0)/data.length);
  await supabase.from('projects').update({progress:avg}).eq('id',project_id);
}

module.exports = async (req, res) => {
  const me    = requireAuth(req, res); if (!me) return;
  const parts = pathParts(req, 'tasks');
  const id    = parts[0]||null;
  const sub   = parts[1]||null;
  const body  = req.body||{};

  return dispatch(req, res, {
    GET: async () => {
      if (id) {
        const {data:task} = await supabase.from('tasks')
          .select('*,users(name),projects(name,start_date)').eq('id',id).single();
        if (!task) return res.status(404).json({error:'Tarea no encontrada.'});
        const {data:photos} = await supabase.from('photos')
          .select('*,users(name)').eq('task_id',id).order('created_at',{ascending:false});
        return res.json({...task,
          assigned_name:task.users?.name, project_name:task.projects?.name,
          project_start_date:task.projects?.start_date,
          photos:(photos||[]).map(p=>({...p,uploader_name:p.users?.name})),
        });
      }
      const p = queryParams(req);
      let q = supabase.from('tasks').select('*,users(name),projects(name,start_date)').order('start_week').order('name');
      if (p.project_id)  q=q.eq('project_id',p.project_id);
      if (p.assigned_to) q=q.eq('assigned_to',p.assigned_to);
      if (p.status)      q=q.eq('status',p.status);
      if (p.priority)    q=q.eq('priority',p.priority);
      const {data} = await q;
      return res.json((data||[]).map(t=>({...t,
        assigned_name:t.users?.name, project_name:t.projects?.name,
        project_start_date:t.projects?.start_date,
      })));
    },
    POST: async () => {
      const {name,project_id,assigned_to,start_week,end_week,status,progress,priority,description}=body;
      if (!name?.trim()) return res.status(400).json({error:'Nombre requerido.'});
      if (!project_id)   return res.status(400).json({error:'Proyecto requerido.'});
      const {data,error} = await supabase.from('tasks')
        .insert({name:name.trim(),project_id,assigned_to:assigned_to||null,
                 start_week:parseInt(start_week)||1, end_week:parseInt(end_week)||2,
                 status:status||'Pending', progress:parseInt(progress)||0,
                 priority:priority||'Medium', description:description||null})
        .select('id').single();
      if (error) return res.status(400).json({error:error.message});
      await recalc(project_id);
      return res.status(201).json({id:data.id});
    },
    PUT: async () => {
      if (!id) return res.status(400).json({error:'ID requerido.'});
      const {data:ex} = await supabase.from('tasks').select('project_id').eq('id',id).single();
      if (!ex) return res.status(404).json({error:'Tarea no encontrada.'});
      const {name,assigned_to,start_week,end_week,status,progress,priority,description}=body;
      await supabase.from('tasks').update({
        name, assigned_to:assigned_to||null,
        start_week:parseInt(start_week)||1, end_week:parseInt(end_week)||2,
        status, progress:parseInt(progress)||0, priority, description,
      }).eq('id',id);
      await recalc(ex.project_id);
      return res.json({success:true});
    },
    PATCH: async () => {
      if (!id||sub!=='position') return res.status(404).json({error:'Not found.'});
      const {start_week,end_week}=body;
      await supabase.from('tasks').update({start_week:parseInt(start_week),end_week:parseInt(end_week)}).eq('id',id);
      return res.json({success:true});
    },
    DELETE: async () => {
      if (!id) return res.status(400).json({error:'ID requerido.'});
      const {data:ex} = await supabase.from('tasks').select('project_id').eq('id',id).single();
      await supabase.from('tasks').delete().eq('id',id);
      if (ex?.project_id) await recalc(ex.project_id);
      return res.json({success:true});
    },
  });
};
