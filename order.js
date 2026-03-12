import { supabase, addCorsHeaders, isUserRegistered, sendEmailViaProvider } from '../lib/shared.js';
import { sendSmsMessage } from '../logistics/sms-utils.js';

async function sendOrderEmail(order, emailProvider) {
  if (!order.email || !emailProvider) return;
  try {
    const fromAddress = 'SwiftLogix <noreply@swiftlogix.com>';
    const htmlBody = `<div style="background:#020617;padding:32px 0;font-family:Arial,sans-serif;"><table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" width="100%" style="max-width:560px;margin:0 auto;background:#0b1020;border-radius:18px;overflow:hidden;border:1px solid #1e293b;"><tr><td style="padding:20px 24px 14px;background:linear-gradient(135deg,#0b1020,#020617);border-bottom:1px solid #1e293b;"><div style="display:flex;align-items:center;"><div style="width:32px;height:32px;border-radius:12px;background:linear-gradient(135deg,#2563eb,#facc15);display:inline-flex;align-items:center;justify-content:center;font-weight:800;font-size:15px;color:#020617;">SL</div><div style="color:#e5e7eb;font-size:15px;font-weight:700;">SwiftLogix</div></div><h1 style="margin:16px 0 0;font-size:20px;color:#e5e7eb;">Your ${order.serviceLabel || 'SwiftLogix'} order has been received</h1></td></tr><tr><td style="padding:18px 24px 8px;color:#e5e7eb;font-size:14px;"><p>Hi${order.name ? ' ' + order.name : ''},</p><p>We've received your logistics request and our team is reviewing it.</p></td></tr><tr><td style="padding:0 24px 18px;color:#9ca3af;font-size:12px;"><p>Tracking ID: ${order.trackingId || 'Will be shared shortly'}</p><p>Thanks,<br/>SwiftLogix Team</p></td></tr></table></div>`;

    await sendEmailViaProvider(fromAddress, order.email, `We received your ${order.serviceLabel || 'SwiftLogix'} order`, htmlBody);
    console.log('✅ Order email sent');
  } catch (err) {
    console.error('Error sending order email', err);
  }
}

async function sendReceiverCodeEmail(order) {
  if (!order.receiverEmail || !order.receiverCode) return;
  try {
    const htmlBody = `<p>You have been listed as the receiver for a SwiftLogix shipment.</p><p>Your verification code is <strong>${order.receiverCode}</strong>.</p><p>Please keep this code safe and provide it to the rider when they arrive.</p>`;
    const fromAddress = process.env.EMAIL_FROM || process.env.EMAIL_USER;
    await sendEmailViaProvider(fromAddress, order.receiverEmail, 'SwiftLogix delivery code', htmlBody);
    console.log('✅ Receiver code email sent');
  } catch (err) {
    console.error('Error sending receiver code email', err);
  }
}

async function sendOrderSms(order) {
  if (!order.phone) return;
  try {
    const formattedPhone = order.phone.startsWith('+') ? order.phone : `+234${order.phone.replace(/^0/, '')}`;
    const message = `Hi, your ${order.serviceLabel || 'SwiftLogix'} order has been received. Tracking ID: ${order.trackingId || order.tracking_id}. -SwiftLogix`;
    const result = await sendSmsMessage(formattedPhone, message);
    if (result.success) {
      console.log('✅ Order SMS sent');
    }
  } catch (err) {
    console.error('Error sending order SMS:', err);
  }
}

async function saveOrderToSupabase(order) {
  if (!supabase) {
    console.warn('Supabase not initialized, cannot save order');
    return;
  }
  try {
    const trackingId = order.trackingId || order.tracking_id;
    if (!trackingId) {
      console.error('No tracking ID provided for order');
      return;
    }

    const orderData = {
      email: order.email || '',
      user_email: order.email || '',
      service: order.service || 'express',
      service_label: order.serviceLabel || 'Express delivery',
      route: order.route || '',
      speed_label: order.speedLabel || '',
      price: parseFloat(order.price) || 0,
      contact_phone: order.phone || '',
      receiver_phone: order.receiverPhone?.trim() || null,
      receiver_email: order.receiverEmail?.trim() || null,
      receiver_code: order.receiverCode?.trim() || null,
      image_url: order.imageUrl?.trim() || null,
      status: order.status || 'Pending',
      tracking_id: trackingId,
      created_at: order.createdAt || new Date().toISOString(),
    };

    const { data, error } = await supabase.from('logistics_orders').insert([orderData]).select();
    if (error) {
      console.error('Error inserting order into Supabase:', error.message);
    } else {
      console.log('✓ Order successfully saved to Supabase');
    }
  } catch (err) {
    console.error('Unexpected error inserting order into Supabase:', err.message);
  }
}

export default async (req, res) => {
  addCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, message: 'Method not allowed' });
  }

  try {
    const raw = req.body?.order;
    if (!raw) {
      return res.status(400).json({ ok: false, message: 'Missing order payload' });
    }

    let order;
    try {
      order = typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch (parseErr) {
      return res.status(400).json({ ok: false, message: 'Invalid JSON in order payload' });
    }

    if (!order?.email || !order?.serviceLabel) {
      return res.status(400).json({ ok: false, message: 'Invalid order data - email and serviceLabel required' });
    }

    if (!(await isUserRegistered(order.email))) {
      return res.status(403).json({ ok: false, message: 'You must register an account before placing an order.' });
    }

    const trackingId = order.trackingId || order.tracking_id || `SLX-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

    if (order.receiverEmail) {
      order.receiverCode = String(Math.floor(100000 + Math.random() * 900000));
    }

    const fullOrder = {
      ...order,
      createdAt: order.createdAt || new Date().toISOString(),
      trackingId,
      tracking_id: trackingId,
    };

    console.log('Processing order:', { email: fullOrder.email, serviceLabel: fullOrder.serviceLabel, trackingId });

    await saveOrderToSupabase(fullOrder);
    sendOrderEmail(fullOrder, require('../lib/shared.js').emailProvider);
    if (fullOrder.receiverEmail && fullOrder.receiverCode) {
      sendReceiverCodeEmail(fullOrder);
    }
    sendOrderSms(fullOrder);

    console.log('✓ Order processing complete');
    return res.json({ ok: true, trackingId });
  } catch (err) {
    console.error('Error handling /api/order', err.message);
    return res.status(500).json({ ok: false, message: 'Server error' });
  }
};
