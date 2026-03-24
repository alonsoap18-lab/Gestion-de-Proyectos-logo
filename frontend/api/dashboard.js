import { supabase } from '../lib/supabase';

queryFn: async () => {
  const { data: projects } = await supabase.from('projects').select('*');
  const { data: tasks } = await supabase.from('tasks').select('*');
  const { data: people } = await supabase.from('employees').select('*');
  const { data: machinery } = await supabase.from('machinery').select('*');

  return {
    projects: {
      total: projects?.length || 0,
      active: projects?.filter(p => p.status === 'Active').length || 0,
      planning: projects?.filter(p => p.status === 'Planning').length || 0,
      delayed: projects?.filter(p => p.status === 'Delayed').length || 0,
      completed: projects?.filter(p => p.status === 'Completed').length || 0,
    },
    tasks: {
      total: tasks?.length || 0,
      pending: tasks?.filter(t => t.status === 'Pending').length || 0,
      inProgress: tasks?.filter(t => t.status === 'In Progress').length || 0,
      completed: tasks?.filter(t => t.status === 'Completed').length || 0,
      started: tasks?.filter(t => t.status === 'Started').length || 0,
    },
    people: { total: people?.length || 0 },
    machinery: { Available: machinery?.filter(m => m.status === 'Available').length || 0 },
    projectProgress: projects?.map(p => ({
      id: p.id,
      name: p.name,
      progress: p.progress || 0,
      status: p.status
    })) || [],
    recentTasks: tasks?.slice(0,5) || []
  };
}
