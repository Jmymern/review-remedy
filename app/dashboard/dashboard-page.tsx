
// dashboard Supabase fetch
const { data } = await supabase
  .from('reports')
  .select('*')
  .eq('user_id', user.id);
