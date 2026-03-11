import { supabase, addCorsHeaders } from './lib/shared.js';

export default async (req, res) => {
  addCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, message: 'Method not allowed' });
  }

  if (!supabase) {
    return res.status(500).json({ ok: false, message: 'Supabase not configured', users: [] });
  }

  try {
    const { data, error } = await supabase
      .from('logistics_users')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching users:', error);
      return res.status(500).json({ ok: false, message: 'Failed to fetch users', users: [] });
    }

    return res.json({ ok: true, users: data || [] });
  } catch (err) {
    console.error('Server error in users GET:', err);
    return res.status(500).json({ ok: false, message: 'Server error', users: [] });
  }
};
