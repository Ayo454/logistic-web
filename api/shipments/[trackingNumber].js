import { supabase, addCorsHeaders } from '../../lib/shared.js';

export default async (req, res) => {
  addCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!supabase) {
    return res.status(500).json({ error: 'Supabase not configured' });
  }

  const { trackingNumber } = req.query;

  try {
    const { data, error } = await supabase
      .from('logistics_shipments')
      .select('*')
      .eq('tracking_number', trackingNumber)
      .single();

    if (error) {
      console.error('Supabase fetch error:', error.message);
      return res.status(404).json({ error: 'Shipment not found' });
    }

    return res.json({ shipment: data });
  } catch (err) {
    console.error('Server error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
};
