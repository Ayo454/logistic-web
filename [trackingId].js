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
    return res.status(500).json({ ok: false, message: 'Supabase not configured' });
  }

  const trackingId = String(req.query.trackingId || '').trim();
  if (!trackingId) {
    return res.status(400).json({ ok: false, message: 'Tracking ID is required' });
  }

  try {
    const { data: byTracking, error: trackingErr } = await supabase
      .from('logistics_orders')
      .select('id,tracking_id,service,service_label,route,speed_label,price,status,created_at,image_url,contact_phone,receiver_phone,receiver_email,receiver_code,user_email,email')
      .eq('tracking_id', trackingId)
      .order('created_at', { ascending: false })
      .limit(1);

    if (trackingErr) {
      console.error('Error fetching tracking order', trackingErr);
      return res.status(500).json({ ok: false, message: 'Fetch failed' });
    }

    let order = Array.isArray(byTracking) && byTracking.length ? byTracking[0] : null;

    if (!order && /^[0-9]+$/.test(trackingId)) {
      const { data: byId, error: idErr } = await supabase
        .from('logistics_orders')
        .select('id,tracking_id,service,service_label,route,speed_label,price,status,created_at,image_url,contact_phone,user_email,email')
        .eq('id', Number(trackingId))
        .limit(1);

      if (idErr) {
        console.error('Error fetching order by id', idErr);
        return res.status(500).json({ ok: false, message: 'Fetch failed' });
      }
      order = Array.isArray(byId) && byId.length ? byId[0] : null;
    }

    if (!order) {
      return res.status(404).json({ ok: false, message: 'Tracking ID not found' });
    }

    return res.json({ ok: true, order });
  } catch (err) {
    console.error('Unexpected error in track', err);
    return res.status(500).json({ ok: false, message: 'Server error' });
  }
};
