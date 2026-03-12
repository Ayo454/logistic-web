import { supabase, addCorsHeaders, isUserRegistered } from '../lib/shared.js';

export default async (req, res) => {
  addCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, message: 'Method not allowed' });
  }

  if (!supabase) {
    return res.status(500).json({ ok: false, message: 'Supabase not configured' });
  }

  const { id, status } = req.body || {};
  if (!id || !status) {
    return res.status(400).json({ ok: false, message: 'id and status are required' });
  }

  try {
    const { data, error } = await supabase
      .from('logistics_orders')
      .update({ status })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating order status', error);
      return res.status(500).json({ ok: false, message: 'Update failed' });
    }

    return res.json({ ok: true });
  } catch (err) {
    console.error('Unexpected error in order-status', err);
    return res.status(500).json({ ok: false, message: 'Server error' });
  }
};
