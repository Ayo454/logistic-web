import { supabase, addCorsHeaders } from '../../lib/shared.js';

export default async (req, res) => {
  addCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!supabase) {
    return res.status(500).json({ error: 'Supabase not configured' });
  }

  const shipmentData = req.body || {};

  if (!shipmentData.tracking_number) {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    shipmentData.tracking_number = `SLX${timestamp}${random}`;
  }

  try {
    const { data, error } = await supabase
      .from('logistics_shipments')
      .insert(shipmentData)
      .select()
      .single();

    if (error) {
      console.error('Supabase insert error:', error.message);
      return res.status(500).json({ error: 'Failed to create shipment' });
    }

    try {
      await supabase
        .from('logistics_shipment_history')
        .insert({
          shipment_id: data.id,
          new_status: data.status || 'pending',
          location: data.origin_location,
          notes: 'Shipment created',
          changed_by: 'system'
        });
    } catch (historyErr) {
      console.warn('Failed to insert shipment history:', historyErr.message);
    }

    return res.json({ shipment: data });
  } catch (err) {
    console.error('Server error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
};
