// api/projects.js
const { supabase, requireAuth, dispatch, pathParts, queryParams } = require('./lib/supabase');

async function recalc(project_id) {
  const { data } = await supabase.from('tasks').select('progress').eq('project_id', project_id);
  if (!data?.length) return 0;
  const avg = Math.round(data.reduce((s,t)=>s+(t.progress||0),0)/data.length);
  await supabase.from('projects').update({ progress: avg }).eq('id', project_id);
  return avg;
}

async function enrich(p) {
  const [{ data: members }, { data: ts }] = await Promise.all([
    supabase.from('project_members').select('project_role,users(id,name,email,role,specialty,phone)').eq('project_id',p.id),
    supabase.from('tasks').select('status').eq('project_id',p.id),
  ]);
  const stats={total:0,completed:0,in_progress:0,pending:0,started:0};
  (ts||[]).forEach(t=>{stats.total++;if(t.status==='Completed')stats.completed++;if(t.status==='In Progress')stats.in_progress++;if(t.status==='Pending')stats.pending++;if(t.status==='Started')stats.started++;});
  return {...p, members:(members||[]).map(m=>({...m.users,project_role:m.project_role})), taskStats:stats};
}

module.exports = async (req, res) => {
  const me    = requireAuth(req, res); if (!me) return;
  const parts = pathParts(req, 'projects');
  const id    = parts[0]||null;
  const sub   = parts[1]||null;
  const uid   = parts[2]||null;
  const body  = req.body||{};

  return dispatch(req, res, {
    GET: async () => {
      if (id && sub==='gantt') {
        const [{data:p},{data:tasks}] = await Promise.all([
          supabase.from('projects').select('id,name,start_date,duration_weeks').eq('id',id).single(),
          supabase.from('tasks').select('id,name,start_week,end_week,status,progress,priority,assigned_to,users(name)').eq('project_id',id).order('start_week'),
        ]);
        return res.json({project:p, tasks:(tasks||[]).map(t=>({...t,assigned_name:t.users?.name}))});
      }
      if (id) {
        const {data:p} = await supabase.from('projects').select('*').eq('id',id).single();
        if (!p) return res.status(404).json({error:'Proyecto no encontrado.'});
        const [enriched, {data:tasks},{data:materials},{data:machinery},{data:photos}] = await Promise.all([
          enrich(p),
          supabase.from('tasks').select('*,users(name)').eq('project_id',id).order('start_week'),
          supabase.from('materials').select('*').eq('project_id',id).order('name'),
          supabase.from('machinery').select('*').eq('project_id',id).order('name'),
          supabase.from('photos').select('*,users(name)').eq('project_id',id).order('created_at',{ascending:false}).limit(20),
        ]);
        return res.json({...enriched,
          tasks:(tasks||[]).map(t=>({...t,assigned_name:t.users?.name})),
          materials:materials||[], machinery:machinery||[],
          photos:(photos||[]).map(ph=>({...ph,uploader_name:ph.users?.name})),
        });
      }
      const {status} = queryParams(req);
      let q = supabase.from('projects').select('*').order('created_at',{ascending:false});
      if (status) q=q.eq('status',status);
      const {data:projects} = await q;
      return res.json(await Promise.all((projects||[]).map(enrich)));
    },
    POST: async () => {
      if (id&&sub==='members') {
        const {user_id,project_role}=body;
        if (!user_id) return res.status(400).json({error:'user_id requerido.'});
        const {error} = await supabase.from('project_members').insert({project_id:id,user_id,project_role:project_role||'Member'});
        if (error?.code==='23505') return res.status(409).json({error:'Usuario ya es miembro.'});
        return res.status(201).json({success:true});
      }
      if (id&&sub==='recalculate') { return res.json({progress: await recalc(id)}); }
      const {name,client,location,start_date,duration_weeks,status,description,budget}=body;
      if (!name?.trim()) return res.status(400).json({error:'Nombre requerido.'});
      const {data,error} = await supabase.from('projects')
        .insert({name:name.trim(),client,location,start_date:start_date||null,
                 duration_weeks:parseInt(duration_weeks)||12,status:status||'Planning',
                 description,budget:parseFloat(budget)||0})
        .select('id').single();
      if (error) return res.status(400).json({error:error.message});
      return res.status(201).json({id:data.id});
    },
    PUT: async () => {
      if (!id) return res.status(400).json({error:'ID requerido.'});
      const {name,client,location,start_date,duration_weeks,status,progress,description,budget,spent}=body;
      const {error} = await supabase.from('projects').update({
        name,client,location,start_date:start_date||null,
        duration_weeks:parseInt(duration_weeks)||12,status,
        progress:parseInt(progress)||0,description,
        budget:parseFloat(budget)||0,spent:parseFloat(spent)||0,
      }).eq('id',id);
      if (error) return res.status(400).json({error:error.message});
      return res.json({success:true});
    },
    DELETE: async () => {
      if (id&&sub==='members'&&uid) {
        await supabase.from('project_members').delete().eq('project_id',id).eq('user_id',uid);
        return res.json({success:true});
      }
      if (!id) return res.status(400).json({error:'ID requerido.'});
      await supabase.from('projects').delete().eq('id',id);
      return res.json({success:true});
    },
  });
};
