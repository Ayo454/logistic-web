import { supabase, addCorsHeaders } from '../../lib/shared.js';

export default async (req, res) => {
  addCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'PUT') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!supabase) {
    return res.status(500).json({ error: 'Supabase not configured' });
  }

  const { trackingId } = req.query;
  const { status } = req.body;

  if (!status) {
    return res.status(400).json({ error: 'Status is required' });
  }

  try {
    console.log(`Updating order status for tracking ID: ${trackingId} to ${status}`);

    const { data: order, error: fetchError } = await supabase
      .from('logistics_orders')
      .select('*')
      .eq('tracking_id', trackingId)
      .single();

    if (fetchError) {
      console.warn('Order not found in logistics_orders:', trackingId);
    }

    const { error: updateError } = await supabase
      .from('logistics_orders')
      .update({ status })
      .eq('tracking_id', trackingId);

    if (updateError) {
      console.error('Supabase update error:', updateError);
      return res.status(500).json({ error: 'Could not update order status', details: updateError.message });
    }

    try {
      const { data: linkedShipment, error: linkErr } = await supabase
        .from('logistics_shipments')
        .select('id,status')
        .eq('tracking_number', trackingId)
        .single();

      if (!linkErr && linkedShipment) {
        await supabase
          .from('logistics_shipments')
          .update({ status, updated_at: new Date().toISOString() })
          .eq('tracking_number', trackingId);

        try {
          await supabase.from('logistics_shipment_history').insert({
            shipment_id: linkedShipment.id,
            old_status: linkedShipment.status,
            new_status: status,
            changed_by: req.body.changed_by || 'admin',
          });
        } catch (histErr) {
          console.warn('Could not insert shipment history:', histErr.message);
        }
      }
    } catch (syncErr) {
      console.warn('Error syncing order status to shipments:', syncErr.message);
    }

    console.log('Order status updated successfully');
    return res.json({ ok: true, message: 'Order status updated successfully' });
  } catch (err) {
    console.error('Server error:', err);
    return res.status(500).json({ error: 'Server error', details: err.message });
  }
};
