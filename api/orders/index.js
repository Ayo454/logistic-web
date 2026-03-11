import { supabase, addCorsHeaders } from '../lib/shared.js';

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
    return res.status(500).json({ ok: false, message: 'Supabase not configured' });
  }

  try {
    const { data, error } = await supabase
      .from('logistics_orders')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error('Error fetching orders', error);
      return res.status(500).json({ ok: false, message: 'Fetch failed' });
    }

    return res.json({ ok: true, orders: data || [] });
  } catch (err) {
    console.error('Unexpected error in orders', err);
    return res.status(500).json({ ok: false, message: 'Server error' });
  }
};
