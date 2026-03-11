import { supabase, addCorsHeaders, sendEmailViaProvider } from '../../lib/shared.js';
import { sendSmsMessage } from '../../logistics/sms-utils.js';

async function sendDeliveryNotification(shipment) {
  if (!shipment.user_email) return;

  const emailProvider = require('../../lib/shared.js').emailProvider;
  if (!emailProvider) {
    console.error('Email service not configured');
    return;
  }

  try {
    const displayName = shipment.sender_name || 'Customer';
    const textBody = `Hi ${displayName},\n\nYour shipment has been successfully delivered!\n\nTracking Number: ${shipment.tracking_number}\nFrom: ${shipment.origin_location || 'N/A'}\nTo: ${shipment.destination_location || 'N/A'}\nDelivered At: ${new Date().toLocaleString()}\n\nThank you for choosing SwiftLogix!\n\nBest regards,\nSwiftLogix Team`;

    const fromAddress = process.env.EMAIL_FROM || process.env.EMAIL_USER;
    await sendEmailViaProvider(fromAddress, shipment.user_email, 'Your Package Has Been Delivered - SwiftLogix', textBody.replace(/\n/g, '<br/>'));
  } catch (err) {
    console.error('Error sending delivery notification:', err);
  }
}

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

  const { trackingNumber } = req.query;
  const { status } = req.body;

  if (!status) {
    return res.status(400).json({ error: 'Status is required' });
  }

  try {
    const { data: shipment, error: fetchError } = await supabase
      .from('logistics_shipments')
      .select('*')
      .eq('tracking_number', trackingNumber)
      .single();

    if (fetchError) {
      console.error('Supabase fetch error:', fetchError.message);
      return res.status(404).json({ error: 'Shipment not found' });
    }

    const { error: updateError } = await supabase
      .from('logistics_shipments')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('tracking_number', trackingNumber);

    if (updateError) {
      console.error('Supabase update error:', updateError.message);
      return res.status(500).json({ error: 'Could not update shipment' });
    }

    try {
      await supabase.from('logistics_shipment_history').insert({
        shipment_id: shipment.id,
        old_status: shipment.status,
        new_status: status,
        location: shipment.current_location || shipment.destination_location || null,
        notes: req.body.notes || null,
        changed_by: req.body.changed_by || 'admin',
      });
    } catch (histErr) {
      console.warn('Could not insert shipment history entry:', histErr.message);
    }

    if (status === 'delivered' && shipment.user_email) {
      sendDeliveryNotification(shipment);
      if (shipment.sender_phone) {
        const formattedPhone = shipment.sender_phone.startsWith('+') ? shipment.sender_phone : `+234${shipment.sender_phone.replace(/^0/, '')}`;
        const message = `Your package has been delivered! Tracking: ${trackingNumber}. Thank you for choosing SwiftLogix! -SwiftLogix`;
        sendSmsMessage(formattedPhone, message).catch(err => console.error('Failed to send delivery SMS:', err));
      }
    }

    return res.json({ ok: true });
  } catch (err) {
    console.error('Server error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
};
