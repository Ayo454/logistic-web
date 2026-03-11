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
    const { data: shipment } = await supabase
      .from('logistics_shipments')
      .select('id')
      .eq('tracking_number', trackingNumber)
      .single();

    if (!shipment) {
      return res.status(404).json({ error: 'Shipment not found' });
    }

    const { data: history, error: histErr } = await supabase
      .from('logistics_shipment_history')
      .select('*')
      .eq('shipment_id', shipment.id)
      .order('changed_at', { ascending: true });

    if (histErr) {
      throw histErr;
    }

    return res.json({ history });
  } catch (err) {
    console.error('Error fetching shipment history:', err);
    return res.status(500).json({ error: 'Server error' });
  }
};
