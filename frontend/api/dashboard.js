// api/dashboard.js
const { supabase, requireAuth, dispatch } = require('./lib/supabase');

module.exports = async (req, res) => {
  const me = requireAuth(req, res); if (!me) return;

  return dispatch(req, res, {
    GET: async () => {
      const [{data:projects},{data:tasks},{data:users},{data:machinery}] = await Promise.all([
        supabase.from('projects').select('id,name,status,progress,budget'),
        supabase.from('tasks').select('id,name,status,project_id,assigned_to,created_at').order('created_at',{ascending:false}),
        supabase.from('users').select('id,name,role').eq('active',true),
        supabase.from('machinery').select('status'),
      ]);

      const projMap={}, nameMap={};
      (projects||[]).forEach(p=>{projMap[p.id]=p.name;});
      (users||[]).forEach(u=>{nameMap[u.id]=u.name;});

      const recentTasks = (tasks||[]).slice(0,8).map(t=>({
        ...t, project_name:projMap[t.project_id]||'—', assigned_name:nameMap[t.assigned_to]||'—',
      }));

      const tAll = tasks||[];
      const pAll = projects||[];
      const machStats={};
      (machinery||[]).forEach(m=>{machStats[m.status]=(machStats[m.status]||0)+1;});

      const tasksByProject = Object.values(
        tAll.reduce((acc,t)=>{
          const k=t.project_id;
          if(!acc[k]) acc[k]={project_name:projMap[k]||'—',total:0,completed:0};
          acc[k].total++;
          if(t.status==='Completed') acc[k].completed++;
          return acc;
        },{})
      ).sort((a,b)=>b.total-a.total).slice(0,8);

      return res.json({
        projects:{
          total:pAll.length,
          active:pAll.filter(p=>p.status==='Active').length,
          completed:pAll.filter(p=>p.status==='Completed').length,
          delayed:pAll.filter(p=>p.status==='Delayed').length,
          planning:pAll.filter(p=>p.status==='Planning').length,
          totalBudget:pAll.reduce((s,p)=>s+(p.budget||0),0),
        },
        tasks:{
          total:tAll.length,
          pending:tAll.filter(t=>t.status==='Pending').length,
          started:tAll.filter(t=>t.status==='Started').length,
          inProgress:tAll.filter(t=>t.status==='In Progress').length,
          completed:tAll.filter(t=>t.status==='Completed').length,
        },
        people:{total:(users||[]).length},
        machinery:machStats,
        projectProgress:pAll.map(p=>({id:p.id,name:p.name,progress:p.progress,status:p.status})),
        tasksByProject,
        recentTasks,
      });
    },
  });
};
