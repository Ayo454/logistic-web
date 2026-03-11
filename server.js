import express from 'express';
import path from 'path';
import fs from 'fs';
import cors from 'cors';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import multer from 'multer';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import twilio from 'twilio';
import nodemailer from 'nodemailer';
import { sendSmsVerification, verifySmsCode, sendSmsMessage } from './sms-utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from .env file
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS for all routes
app.use(cors());
app.use(express.json());

// Serve static files from the current folder
app.use(express.static(__dirname));
// Serve admin panel
app.use('/admin', express.static(path.join(__dirname, 'admin')));
// Serve uploaded files from uploads folder
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Default route -> auth.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'auth.html'));
});

// --- debug utilities ------------------------------------------------------
// quick endpoint to verify mailer configuration and deliverability
app.get('/api/debug-email', async (req, res) => {
  if (!emailProvider) {
    return res.status(500).json({ ok: false, message: 'email provider not configured' });
  }

  const to = process.env.EMAIL_USER || '';
  const from = process.env.EMAIL_FROM
    ? process.env.EMAIL_FROM
    : process.env.EMAIL_USER || to;

  try {
    const response = await emailProvider.emails.send({
      from,
      to,
      subject: 'SwiftLogix debug message',
      html: 'This is a delivery test from your Render service.',
    });
    console.log('🔧 debug-email sent', response.id);
    res.json({ ok: true, response });
  } catch (err) {
    console.error('🔧 debug-email failed', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});


// Avoid favicon 404 noise in the browser console
app.get('/favicon.ico', (req, res) => {
  res.status(204).end();
});

// Public tracking endpoint: lookup order by tracking ID
app.get('/api/track/:trackingId', async (req, res) => {
  if (!supabase) {
    return res.status(500).json({ ok: false, message: 'Supabase not configured' });
  }

  const trackingId = String(req.params.trackingId || '').trim();
  if (!trackingId) {
    return res.status(400).json({ ok: false, message: 'Tracking ID is required' });
  }

  try {
    // First try exact tracking_id match
    const { data: byTracking, error: trackingErr } = await supabase
      .from('logistics_orders')
      .select(
        'id,tracking_id,service,service_label,route,speed_label,price,status,created_at,image_url,contact_phone,receiver_phone,receiver_email,receiver_code,user_email,email'
      )
      .eq('tracking_id', trackingId)
      .order('created_at', { ascending: false })
      .limit(1);

    if (trackingErr) {
      console.error('Error fetching tracking order from Supabase', trackingErr);
      return res.status(500).json({ ok: false, message: 'Fetch failed' });
    }

    let order = Array.isArray(byTracking) && byTracking.length ? byTracking[0] : null;

    // If no match and the user entered a numeric ID, try by primary key id
    if (!order && /^[0-9]+$/.test(trackingId)) {
      const { data: byId, error: idErr } = await supabase
        .from('logistics_orders')
        .select(
          'id,tracking_id,service,service_label,route,speed_label,price,status,created_at,image_url,contact_phone,receiver_phone,user_email,email'
        )
        .eq('id', Number(trackingId))
        .limit(1);

      if (idErr) {
        console.error('Error fetching order by id from Supabase', idErr);
        return res.status(500).json({ ok: false, message: 'Fetch failed' });
      }
      order = Array.isArray(byId) && byId.length ? byId[0] : null;
    }

    if (!order) {
      return res.status(404).json({ ok: false, message: 'Tracking ID not found' });
    }

    return res.json({ ok: true, order });
  } catch (err) {
    console.error('Unexpected error in /api/track', err);
    return res.status(500).json({ ok: false, message: 'Server error' });
  }
});

// --- Supabase setup (configure your keys in .env) ---
const SUPABASE_URL = process.env.SUPABASE_URL;
// user has SUPABASE_KEY in .env, so fall back to that name if ANON key not set
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY;
let supabase = null;
if (SUPABASE_URL && SUPABASE_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  console.log('Supabase client initialised');
} else {
  console.log('Supabase not configured – set SUPABASE_URL and key in .env');
}

// Initialize storage bucket if it doesn't exist
async function initializeStorageBucket() {
  // Using local file storage now - no bucket initialization needed
  const uploadsDir = path.join(__dirname, 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
    console.log('✓ Uploads directory created at:', uploadsDir);
  } else {
    console.log('✓ Uploads directory ready at:', uploadsDir);
  }
}

// Initialize bucket check when server starts
setTimeout(initializeStorageBucket, 500);

// --- Email setup (using Resend or Gmail SMTP) ---
let emailProvider = null;

if (process.env.RESEND_API_KEY) {
  try {
    const { Resend } = await import('resend');
    emailProvider = new Resend(process.env.RESEND_API_KEY);
    console.log('✓ Resend email provider initialized');
  } catch (err) {
    console.error('Failed to initialize Resend:', err.message);
  }
} else if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
  try {
    // Fall back to Gmail SMTP using Nodemailer
    emailProvider = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
    console.log('✓ Gmail SMTP email provider initialized');
    
    // Verify connection
    emailProvider.verify((err, success) => {
      if (err) {
        console.error('❌ Gmail SMTP verification failed:', err.message);
      } else {
        console.log('✓ Gmail SMTP connection verified successfully');
      }
    });
  } catch (err) {
    console.error('Failed to initialize Gmail SMTP:', err.message);
  }
} else {
  console.warn('⚠️  No email provider configured - emails will NOT be sent');
}

// Helper: Send emails via either Resend or Gmail SMTP
async function sendEmailViaProvider(from, to, subject, html) {
  if (!emailProvider) {
    throw new Error('Email provider not configured');
  }

  try {
    // Check if using Resend (has .emails.send method)
    if (emailProvider.emails && typeof emailProvider.emails.send === 'function') {
      console.log('📧 Using Resend provider');
      return await emailProvider.emails.send({ from, to, subject, html });
    }
    // Otherwise using Gmail/Nodemailer (has .sendMail method)
    else if (typeof emailProvider.sendMail === 'function') {
      console.log('📧 Using Gmail SMTP provider');
      const result = await emailProvider.sendMail({ from, to, subject, html });
      console.log('📧 Nodemailer result:', result);
      return result;
    }
    
    throw new Error('Unknown email provider - no send method found');
  } catch (err) {
    console.error('📧 Email send failed in sendEmailViaProvider:', err.message, err.code);
    throw err;
  }
}

// Helper: Send emails in background without blocking the response
function sendEmailAsync(emailFunction, param) {
  // Fire and forget - don't await
  emailFunction(param).catch(err => {
    console.error('📧 Background email failed (non-critical):', err.message);
  });
}

const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');

// Supabase storage bucket name for orders
const ORDERS_BUCKET = 'orders';

// Configure multer to save files to disk in the uploads folder
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Create uploads directory if it doesn't exist
    if (!fs.existsSync(UPLOADS_DIR)) {
      fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    }
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    // Generate unique filename
    const ext = path.extname(file.originalname) || '.jpg';
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
    cb(null, filename);
  }
});

const upload = multer({ storage: storage });

// --- Twilio setup (configure in .env) ---
let twilioClient = null;
console.log('=== TWILIO CONFIGURATION CHECK ===');
console.log('TWILIO_ACCOUNT_SID:', process.env.TWILIO_ACCOUNT_SID ? '✓ SET' : '✗ NOT SET');
console.log('TWILIO_AUTH_TOKEN:', process.env.TWILIO_AUTH_TOKEN ? '✓ SET' : '✗ NOT SET');
console.log('TWILIO_VERIFY_SERVICE_SID:', process.env.TWILIO_VERIFY_SERVICE_SID ? '✓ SET' : '✗ NOT SET');
console.log('=====================================');

if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
  twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  console.log('✓ Twilio client initialized');
} else {
  console.error('⚠️  TWILIO NOT CONFIGURED! SMS verification will NOT work.');
  console.error('To enable SMS, set these in your environment variables:');
  console.error('  TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_VERIFY_SERVICE_SID');
}


async function isUserRegistered(email) {
  if (!supabase) return false;
  try {
    const { data, error } = await supabase
      .from('logistics_users')
      .select('email')
      .eq('email', email)
      .eq('event_type', 'register')
      .limit(1);
    if (error) {
      console.error('Error checking user registration:', error);
      return false;
    }
    return data && data.length > 0;
  } catch (err) {
    console.error('Error checking user registration:', err);
    return false;
  }
}

// Helper to push order into Supabase logistics_orders table
async function saveOrderToSupabase(order) {
  if (!supabase) {
    console.warn('Supabase not initialized, cannot save order');
    return;
  }
  try {
    const trackingId = order.trackingId || order.tracking_id;
    
    if (!trackingId) {
      console.error('No tracking ID provided for order', order);
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
      receiver_phone: order.receiverPhone && order.receiverPhone.trim() ? order.receiverPhone.trim() : null,
      receiver_email: order.receiverEmail && order.receiverEmail.trim() ? order.receiverEmail.trim() : null,
      receiver_code: order.receiverCode && order.receiverCode.trim() ? order.receiverCode.trim() : null,
      image_url: order.imageUrl && order.imageUrl.trim() ? order.imageUrl.trim() : null,
      status: order.status || 'Pending',
      tracking_id: trackingId,
      created_at: order.createdAt || new Date().toISOString(),
    };

    console.log('Saving order to Supabase:', orderData);
    
    const { data, error } = await supabase.from('logistics_orders').insert([orderData]).select();
    
    if (error) {
      console.error('Error inserting order into Supabase:', error.message, error.details);
    } else {
      console.log('✓ Order successfully saved to Supabase for', order.email, 'tracking:', trackingId, 'data:', data);
    }
  } catch (err) {
    console.error('Unexpected error inserting order into Supabase:', err.message, err);
  }
}

async function sendOrderEmail(order) {
  if (!order.email) return;
  if (!emailProvider) {
    console.error('❌ Email service not configured - skipping order email');
    return;
  }
  try {
    const fromAddress = 'SwiftLogix <noreply@swiftlogix.com>';

    const htmlBody = `
      <div style="background:#020617;padding:32px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" width="100%" style="max-width:560px;margin:0 auto;background:#0b1020;border-radius:18px;overflow:hidden;border:1px solid #1e293b;">
          <tr>
            <td style="padding:20px 24px 14px;background:linear-gradient(135deg,#0b1020,#020617);border-bottom:1px solid #1e293b;">
              <div style="display:flex;align-items:center;">
                <div style="width:32px;height:32px;border-radius:12px;background:linear-gradient(135deg,#2563eb,#facc15);display:inline-flex;align-items:center;justify-content:center;font-weight:800;font-size:15px;color:#020617;margin-right:10px;">
                  SL
                </div>
                <div style="color:#e5e7eb;font-size:15px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;">
                  SwiftLogix
                </div>
              </div>
              <h1 style="margin:16px 0 0;font-size:20px;line-height:1.3;color:#e5e7eb;">Your ${order.serviceLabel || 'SwiftLogix'} order has been received</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 24px 4px;color:#e5e7eb;font-size:14px;line-height:1.6;">
              <p style="margin:0 0 10px;">Hi${order.name ? ' ' + order.name : ''},</p>
              <p style="margin:0 0 10px;">We’ve received your logistics request and our team is reviewing it.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 24px 14px;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="border-radius:14px;border:1px solid #1e293b;background:#020617;">
                <tr>
                  <td style="padding:12px 16px 4px;color:#9ca3af;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;">Route</td>
                </tr>
                <tr>
                  <td style="padding:0 16px 10px;color:#e5e7eb;font-size:14px;font-weight:600;">${order.route || 'Custom route'}</td>
                </tr>
                <tr>
                  <td style="padding:8px 16px 4px;color:#9ca3af;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;">Delivery speed</td>
                </tr>
                <tr>
                  <td style="padding:0 16px 10px;color:#e5e7eb;font-size:13px;">${order.speedLabel || ''}</td>
                </tr>
                <tr>
                  <td style="padding:8px 16px 4px;color:#9ca3af;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;">Estimated price</td>
                </tr>
                <tr>
                  <td style="padding:0 16px 10px;color:#e5e7eb;font-size:13px;">₦${Number(order.price || 0).toLocaleString('en-NG')} (final rate on confirmation).</td>
                </tr>
                <tr>
                  <td style="padding:8px 16px 4px;color:#9ca3af;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;">Status</td>
                </tr>
                <tr>
                  <td style="padding:0 16px 10px;color:#e5e7eb;font-size:13px;">${order.status || 'Pending'}</td>
                </tr>
                <tr>
                  <td style="padding:8px 16px 4px;color:#9ca3af;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;">Tracking ID</td>
                </tr>
                <tr>
                  <td style="padding:0 16px 14px;color:#e5e7eb;font-size:13px;">${order.trackingId || order.tracking_id || 'Will be shared shortly'}<br/>
                    You can use this ID on the SwiftLogix tracking page.
                  </td>
                </tr>
                <tr>
                  <td style="padding:8px 16px 4px;color:#9ca3af;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;">Contact</td>
                </tr>
                <tr>
                  <td style="padding:0 16px 16px;color:#e5e7eb;font-size:13px;">
                    ${order.phone || ''}${order.receiverPhone ? ' • Receiver: ' + order.receiverPhone : ''}${order.receiver_email ? ' • Receiver email: ' + order.receiver_email : ''}<br/>
                    ${order.email}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:0 24px 18px;color:#9ca3af;font-size:12px;line-height:1.6;">
              <p style="margin:10px 0 4px;">You’ll receive another email once your order is confirmed and assigned to a rider.</p>
              <p style="margin:0;">Thanks,<br/>SwiftLogix Team</p>
            </td>
          </tr>
        </table>
      </div>
    `;

      const response = await sendEmailViaProvider(
        fromAddress,
        order.email,
        `We received your ${order.serviceLabel || 'SwiftLogix'} order`,
        htmlBody
      );
      console.log('✅ Order email sent', response.id || response.messageId || response);
  } catch (err) {
    console.error('Error sending order email', err);
  }
}

// send the 6‑digit code to the receiver email when one is supplied
async function sendReceiverCodeEmail(order) {
  if (!order.receiverEmail || !order.receiverCode) return;
  if (!emailProvider) {
    console.error('❌ Email service not configured - skipping receiver code email');
    return;
  }
  try {
    const textBody = `You have been listed as the receiver for a SwiftLogix shipment.\n
Your verification code is: ${order.receiverCode}\n
Please keep this code safe and provide it to the rider when they arrive.`;
    const htmlBody = `<p>You have been listed as the receiver for a SwiftLogix shipment.</p><p>Your verification code is <strong>${order.receiverCode}</strong>.</p><p>Please keep this code safe and provide it to the rider when they arrive.</p>`;

    // Determine proper from address (allow custom EMAIL_FROM)
    const fromAddress = process.env.EMAIL_FROM || process.env.EMAIL_USER;
    const response = await sendEmailViaProvider(
      fromAddress,
      order.receiverEmail,
      'SwiftLogix delivery code',
      htmlBody
    );
    console.log('✅ Receiver code email sent', response.id || response.messageId || response);
  } catch (err) {
    console.error('Error sending receiver code email', err);
  }
}

async function sendOrderStatusEmail(order) {
  if (!order || !order.user_email) return;

  if (!emailProvider) {
    console.error('❌ Email service not configured! Order status email not sent.');
    return;
  }
  try {
    const htmlBody = `
      <div style="background:#020617;padding:32px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" width="100%" style="max-width:560px;margin:0 auto;background:#0b1020;border-radius:18px;overflow:hidden;border:1px solid #1e293b;">
          <tr>
            <td style="padding:20px 24px 14px;background:linear-gradient(135deg,#0b1020,#020617);border-bottom:1px solid #1e293b;">
              <div style="display:flex;align-items:center;">
                <div style="width:32px;height:32px;border-radius:12px;background:linear-gradient(135deg,#2563eb,#facc15);display:inline-flex;align-items:center;justify-content:center;font-weight:800;font-size:15px;color:#020617;margin-right:10px;">
                  SL
                </div>
                <div style="color:#e5e7eb;font-size:15px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;">
                  SwiftLogix
                </div>
              </div>
              <h1 style="margin:16px 0 0;font-size:20px;line-height:1.3;color:#e5e7eb;">Your order status has been updated</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 24px 8px;color:#e5e7eb;font-size:14px;line-height:1.6;">
              <p style="margin:0 0 10px;">Hi,</p>
              <p style="margin:0 0 10px;">The status of your ${order.service_label || 'SwiftLogix'} order has changed to <strong>${order.status}</strong>.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 24px 18px;color:#9ca3af;font-size:12px;line-height:1.6;">
              <p style="margin:10px 0 4px;">Route: ${order.route || 'Custom route'}</p>
              <p style="margin:0 0 4px;">Delivery speed: ${order.speed_label || ''}</p>
              <p style="margin:0 0 4px;">Tracking ID: ${order.tracking_id || '—'}</p>
              <p style="margin:0;">Thanks,<br/>SwiftLogix Team</p>
            </td>
          </tr>
        </table>
      </div>
    `;

    const fromAddress = process.env.EMAIL_FROM
      ? process.env.EMAIL_FROM
      : `SwiftLogix <${process.env.EMAIL_USER || 'no-reply@example.com'}>`;
    
    const response = await sendEmailViaProvider(
      fromAddress,
      order.user_email,
      `Your SwiftLogix order is now ${order.status}`,
      htmlBody
    );
    console.log('✅ Order status email sent', response.id || response.messageId || response);
  } catch (err) {
    console.error('Error sending order status email', err);
  }
}

async function sendWelcomeEmail(user) {
  console.log(`📧 sendWelcomeEmail called for: ${user.email}`);
  
  if (!user.email) {
    console.error('❌ No email provided');
    return;
  }
  
  if (!emailProvider) {
    console.error('❌ Email service not configured - skipping welcome email');
    return;
  }
  
  try {
    // Determine from address; preferrably from EMAIL_FROM, otherwise fallback
    const fromAddress =
      process.env.EMAIL_FROM ||
      `"SwiftLogix" <${process.env.EMAIL_USER || 'no-reply@example.com'}>`;

    console.log(`📧 Sending email from: ${fromAddress} to: ${user.email}`);
    const displayName = user.name || 'there';

    const htmlBody = `
      <div style="background:#020617;padding:32px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" width="100%" style="max-width:520px;margin:0 auto;background:#0b1020;border-radius:18px;overflow:hidden;border:1px solid #1e293b;">
          <tr>
            <td style="padding:22px 26px 18px;background:linear-gradient(135deg,#0b1020,#020617);border-bottom:1px solid #1e293b;">
              <div style="display:flex;align-items:center;">
                <div style="width:32px;height:32px;border-radius:12px;background:linear-gradient(135deg,#2563eb,#facc15);display:inline-flex;align-items:center;justify-content:center;font-weight:800;font-size:15px;color:#020617;margin-right:10px;">
                  SL
                </div>
                <div style="color:#e5e7eb;font-size:15px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;">
                  SwiftLogix
                </div>
              </div>
              <h1 style="margin:18px 0 0;font-size:22px;line-height:1.25;color:#e5e7eb;">Welcome to SwiftLogix</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 26px 6px;color:#e5e7eb;font-size:14px;line-height:1.6;">
              <p style="margin:0 0 10px;">Hi ${displayName},</p>
              <p style="margin:0 0 10px;">Your SwiftLogix account has been created successfully.</p>
              <p style="margin:0 0 14px;">You can now log in and manage your express deliveries, freight shipments and warehousing requests from one place.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 26px 18px;">
              <a href="${process.env.PUBLIC_BASE_URL || 'http://localhost:3000/logistics/auth.html'}" 
                 style="display:inline-block;background:linear-gradient(135deg,#2563eb,#1ea1ff);color:#0b1020;font-weight:600;font-size:14px;text-decoration:none;padding:10px 20px;border-radius:999px;box-shadow:0 10px 25px rgba(37,99,235,0.45);">
                Go to my account
              </a>
            </td>
          </tr>
          <tr>
            <td style="padding:0 26px 20px;color:#9ca3af;font-size:12px;line-height:1.6;border-top:1px solid #1e293b;">
              <p style="margin:12px 0 4px;">If you did not create this account, you can ignore this email.</p>
              <p style="margin:0;">Thanks,<br/>SwiftLogix Team</p>
            </td>
          </tr>
        </table>
      </div>
    `;

    const response = await sendEmailViaProvider(
      fromAddress,
      user.email,
      'Welcome to SwiftLogix',
      htmlBody
    );
    
    console.log('✅ Welcome email sent to', user.email, 'response:', response);

  } catch (err) {
    console.error('❌ Error sending welcome email:', {
      message: err.message,
      code: err.code,
      command: err.command,
      response: err.response,
      stack: err.stack
    });
  }
}

async function sendDeliveryNotification(shipment) {
  if (!shipment.user_email) return;
  if (!emailProvider) {
    console.error('❌ Email service not configured - skipping delivery notification');
    return;
  }
  try {
    const displayName = shipment.sender_name || 'Customer';

    // Simple text email
    const textBody = `
Hi ${displayName},

Your shipment has been successfully delivered!

Tracking Number: ${shipment.tracking_number}
From: ${shipment.origin_location || 'N/A'}
To: ${shipment.destination_location || 'N/A'}
Delivered At: ${new Date().toLocaleString()}

Thank you for choosing SwiftLogix!

Best regards,
SwiftLogix Team
    `;

    // Determine from address for delivery notification
    const fromAddress = process.env.EMAIL_FROM || process.env.EMAIL_USER;
    
    const response = await sendEmailViaProvider(
      fromAddress,
      shipment.user_email,
      'Your Package Has Been Delivered - SwiftLogix',
      textBody.replace(/\n/g, '<br/>')
    );
    console.log('✅ Delivery notification sent', response.id || response.messageId || response);
  } catch (err) {
    console.error('Error sending delivery notification:', err);
  }
}

// Send SMS notification when order is placed
async function sendOrderSms(order) {
  if (!twilioClient || !order.phone) {
    if (!twilioClient) {
      console.log('⚠️  Twilio not configured, SMS not sent for order');
    }
    return;
  }
  try {
    const formattedPhone = order.phone.startsWith('+') ? order.phone : `+234${order.phone.replace(/^0/, '')}`;
    const message = `Hi, your ${order.serviceLabel || 'SwiftLogix'} order has been received. Tracking ID: ${order.trackingId || order.tracking_id}. Follow delivery at our tracking page. -SwiftLogix`;
    
    const result = await sendSmsMessage(formattedPhone, message);
    if (result.success) {
      console.log('✅ Order SMS sent to', formattedPhone);
    } else {
      console.error('❌ Failed to send order SMS:', result.error);
    }
  } catch (err) {
    console.error('Error sending order SMS:', err);
  }
}

// Send SMS notification when order status is updated
async function sendStatusUpdateSms(order) {
  if (!twilioClient || !order.contact_phone) {
    if (!twilioClient) {
      console.log('⚠️  Twilio not configured, SMS not sent for status update');
    }
    return;
  }
  try {
    const formattedPhone = order.contact_phone.startsWith('+') ? order.contact_phone : `+234${order.contact_phone.replace(/^0/, '')}`;
    const message = `Your SwiftLogix order (${order.tracking_id}) status is now: ${order.status}. Tracking ID: ${order.tracking_id}. -SwiftLogix`;
    
    const result = await sendSmsMessage(formattedPhone, message);
    if (result.success) {
      console.log('✅ Status update SMS sent to', formattedPhone);
    } else {
      console.error('❌ Failed to send status SMS:', result.error);
    }
  } catch (err) {
    console.error('Error sending status update SMS:', err);
  }
}

// Receive auth events from the frontend (register / login)
app.post('/api/auth-event', async (req, res) => {
  const { type, user } = req.body || {};
  if (!type || !user || !user.email) {
    return res.status(400).json({ ok: false, message: 'Invalid payload' });
  }

  const fullUser = {
    ...user,
    createdAt: new Date().toISOString(),
    type,
  };

  // Send to Supabase if configured
  if (supabase) {
    try {
      const { error } = await supabase.from('logistics_users').insert({
        name: fullUser.name && fullUser.name.trim() ? fullUser.name.trim() : null,
        phone: fullUser.phone && fullUser.phone.trim() ? fullUser.phone.trim() : null,
        email: fullUser.email,
        event_type: type,
        created_at: fullUser.createdAt,
      });
      if (error) {
        console.error('Error inserting into Supabase', error);
      } else {
        console.log('User sent to Supabase:', fullUser.email, `(${type})`);
      }
    } catch (err) {
      console.error('Error inserting into Supabase', err);
    }
  }

  // Send welcome email on register (non-blocking)
  if (type === 'register') {
    console.log(`📨 Attempting to send welcome email to ${fullUser.email}...`);
    sendEmailAsync(sendWelcomeEmail, fullUser);
  }

  return res.json({ ok: true });
});

// Receive logistics order with photo upload
app.post('/api/order', upload.single('photo'), async (req, res) => {
  try {
    const raw = req.body && req.body.order;
    if (!raw) {
      console.error('Missing order payload in /api/order request');
      return res.status(400).json({ ok: false, message: 'Missing order payload' });
    }
    let order;
    try {
      order = JSON.parse(raw);
    } catch (parseErr) {
      console.error('Failed to parse order JSON:', parseErr.message, 'raw:', raw);
      return res.status(400).json({ ok: false, message: 'Invalid JSON in order payload' });
    }

    if (!order || !order.email || !order.serviceLabel) {
      console.error('Invalid order data - missing required fields:', { email: order?.email, serviceLabel: order?.serviceLabel });
      return res.status(400).json({ ok: false, message: 'Invalid order data - email and serviceLabel required' });
    }

    // Check if user is registered
    if (!(await isUserRegistered(order.email))) {
      console.error('Order rejected - user not registered:', order.email);
      return res.status(403).json({ ok: false, message: 'You must register an account before placing an order. Please visit the registration page.' });
    }

    let imageUrl = null;

    // Handle file upload - file is now saved to disk by multer
    if (req.file) {
      // Generate URL path for the uploaded file
      imageUrl = `/uploads/${req.file.filename}`;
      console.log('✓ Image saved locally:', imageUrl);
    }

    const trackingId = order.trackingId || order.tracking_id || `SLX-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

    // generate a six-digit code for receiver if email was provided
    if (order.receiverEmail) {
      order.receiverCode = String(Math.floor(100000 + Math.random() * 900000));
    }

    const fullOrder = {
      ...order,
      imageUrl,
      createdAt: order.createdAt || new Date().toISOString(),
      trackingId,
      tracking_id: trackingId,
    };

    console.log('Processing order:', { email: fullOrder.email, serviceLabel: fullOrder.serviceLabel, trackingId });
    
    await saveOrderToSupabase(fullOrder);
    // Send emails in background (non-blocking)
    sendEmailAsync(sendOrderEmail, fullOrder);
    if (fullOrder.receiverEmail && fullOrder.receiverCode) {
      sendEmailAsync(sendReceiverCodeEmail, fullOrder);
    }
    // Send SMS in background (non-blocking)
    sendEmailAsync(sendOrderSms, fullOrder);

    console.log('✓ Order processing complete for', fullOrder.email);
    return res.json({ ok: true, imageUrl, trackingId });
  } catch (err) {
    console.error('Error handling /api/order', err.message, err);
    return res.status(500).json({ ok: false, message: 'Server error' });
  }
});

// Admin endpoint to update order status and notify user
app.post('/api/order-status', async (req, res) => {
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
      console.error('Error updating order status in Supabase', error);
      return res.status(500).json({ ok: false, message: 'Update failed' });
    }

    // Send status email in background (non-blocking)
    sendEmailAsync(sendOrderStatusEmail, data);
    // Send status SMS in background (non-blocking)
    sendEmailAsync(sendStatusUpdateSms, data);
    return res.json({ ok: true });
  } catch (err) {
    console.error('Unexpected error in /api/order-status', err);
    return res.status(500).json({ ok: false, message: 'Server error' });
  }
});

// Admin endpoint to list recent orders
app.get('/api/orders', async (req, res) => {
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
      console.error('Error fetching orders from Supabase', error);
      return res.status(500).json({ ok: false, message: 'Fetch failed' });
    }
    return res.json({ ok: true, orders: data || [] });
  } catch (err) {
    console.error('Unexpected error in /api/orders', err);
    return res.status(500).json({ ok: false, message: 'Server error' });
  }
});

// Endpoint to fetch all shipments from Supabase
app.get('/api/shipments', async (req, res) => {
  if (!supabase) {
    return res.status(500).json({ error: 'Supabase not configured' });
  }
  try {
    const { data, error } = await supabase
      .from('logistics_shipments')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error('Supabase fetch error:', error.message);
      return res.status(500).json({ error: 'Could not fetch shipments' });
    }

    return res.json({ shipments: data || [] });
  } catch (err) {
    console.error('Server error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Endpoint to fetch shipment by tracking number
app.get('/api/shipments/:trackingNumber', async (req, res) => {
  if (!supabase) {
    return res.status(500).json({ error: 'Supabase not configured' });
  }
  const { trackingNumber } = req.params;

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
});

// Debug route: retrieve history entries for a shipment (for testing)
app.get('/api/shipments/:trackingNumber/history', async (req, res) => {
  if (!supabase) {
    return res.status(500).json({ error: 'Supabase not configured' });
  }
  const { trackingNumber } = req.params;
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
});

// Endpoint to update shipment status
app.put('/api/shipments/:trackingNumber/status', async (req, res) => {
  if (!supabase) {
    return res.status(500).json({ error: 'Supabase not configured' });
  }
  const { trackingNumber } = req.params;
  const { status } = req.body;

  if (!status) {
    return res.status(400).json({ error: 'Status is required' });
  }

  try {
    // First, get the current shipment data
    const { data: shipment, error: fetchError } = await supabase
      .from('logistics_shipments')
      .select('*')
      .eq('tracking_number', trackingNumber)
      .single();

    if (fetchError) {
      console.error('Supabase fetch error:', fetchError.message);
      return res.status(404).json({ error: 'Shipment not found' });
    }

    // Update the status
    const { error: updateError } = await supabase
      .from('logistics_shipments')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('tracking_number', trackingNumber);

    if (updateError) {
      console.error('Supabase update error:', updateError.message);
      return res.status(500).json({ error: 'Could not update shipment' });
    }

    // record a history entry for every status change
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
      console.warn('Could not insert shipment history entry:', histErr.message || histErr);
    }

    // If status is 'delivered', also add/update logistics_orders table
    if (status === 'delivered') {
      // Check if order already exists
      const { data: existingOrder } = await supabase
        .from('logistics_orders')
        .select('id')
        .eq('tracking_id', trackingNumber)
        .single();

      if (!existingOrder) {
        // Create new order entry
        const { error: orderInsertError } = await supabase
          .from('logistics_orders')
          .insert({
            email: shipment.user_email,
            user_email: shipment.user_email,
            service: shipment.service_type || 'express',
            service_label: shipment.service_type || 'Express Delivery',
            route: `${shipment.origin_location || 'Origin'} → ${shipment.destination_location || 'Destination'}`,
            speed_label: 'Delivered',
            price: shipment.shipping_cost || 0,
            contact_phone: shipment.sender_phone,
            receiver_phone: shipment.recipient_phone || null,
            image_url: null,
            status: 'Delivered',
            tracking_id: trackingNumber,
            created_at: new Date().toISOString(),
          });

        if (orderInsertError) {
          console.error('Error inserting into logistics_orders:', orderInsertError.message);
        }
      } else {
        // Update existing order
        const { error: orderUpdateError } = await supabase
          .from('logistics_orders')
          .update({ 
            status: 'Delivered'
          })
          .eq('tracking_id', trackingNumber);

        if (orderUpdateError) {
          console.error('Error updating logistics_orders:', orderUpdateError.message);
        }
      }
    }

    // Send email notification if status is 'delivered'
    if (status === 'delivered' && shipment.user_email) {
      await sendDeliveryNotification(shipment);
      // Also send SMS for delivery
      if (shipment.sender_phone) {
        sendEmailAsync(async () => {
          const formattedPhone = shipment.sender_phone.startsWith('+') ? shipment.sender_phone : `+234${shipment.sender_phone.replace(/^0/, '')}`;
          const message = `Your package has been delivered! Tracking: ${trackingNumber}. Thank you for choosing SwiftLogix! -SwiftLogix`;
          const result = await sendSmsMessage(formattedPhone, message);
          if (result.success) {
            console.log('✅ Delivery SMS sent to', formattedPhone);
          } else {
            console.error('❌ Failed to send delivery SMS:', result.error);
          }
        });
      }
    }

    return res.json({ ok: true });
  } catch (err) {
    console.error('Server error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Endpoint to create a new shipment
app.post('/api/shipments', async (req, res) => {
  if (!supabase) {
    return res.status(500).json({ error: 'Supabase not configured' });
  }
  const shipmentData = req.body || {};

  // Generate tracking number if not provided
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

    // Add initial status to history (optional)
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
});

// Endpoint to update order status in logistics_orders table
app.put('/api/orders/:trackingId/status', async (req, res) => {
  if (!supabase) {
    return res.status(500).json({ error: 'Supabase not configured' });
  }
  const { trackingId } = req.params;
  const { status } = req.body;

  if (!status) {
    return res.status(400).json({ error: 'Status is required' });
  }

  try {
    console.log(`Updating order status for tracking ID: ${trackingId} to ${status}`);
    
    // First, get the order details to check if it exists
    const { data: order, error: fetchError } = await supabase
      .from('logistics_orders')
      .select('*')
      .eq('tracking_id', trackingId)
      .single();

    if (fetchError) {
      console.warn('Order not found in logistics_orders:', trackingId);
      // Order may not exist yet, that's ok
    }

    // Update the order status in logistics_orders table
    const { error: updateError } = await supabase
      .from('logistics_orders')
      .update({ status })
      .eq('tracking_id', trackingId);

    if (updateError) {
      console.error('Supabase update error:', updateError);
      return res.status(500).json({ error: 'Could not update order status', details: updateError.message });
    }

    // also propagate status change to shipments if a matching record exists
    try {
      const { data: linkedShipment, error: linkErr } = await supabase
        .from('logistics_shipments')
        .select('id,status')
        .eq('tracking_number', trackingId)
        .single();

      if (!linkErr && linkedShipment) {
        // update the shipment status too
        await supabase
          .from('logistics_shipments')
          .update({ status, updated_at: new Date().toISOString() })
          .eq('tracking_number', trackingId);

        // add a history entry on the shipment
        try {
          await supabase.from('logistics_shipment_history').insert({
            shipment_id: linkedShipment.id,
            old_status: linkedShipment.status,
            new_status: status,
            changed_by: req.body.changed_by || 'admin',
          });
        } catch (histErr) {
          console.warn('Could not insert shipment history for order sync:', histErr.message || histErr);
        }
      } else if (linkErr) {
        // If shipment doesn't exist yet, create it from order when status changes
        console.log('Creating new shipment from order:', trackingId);
        try {
          await supabase.from('logistics_shipments').insert({
            tracking_number: trackingId,
            service_type: order?.service || 'express',
            origin_location: order?.route?.split(' → ')[0] || 'Origin',
            destination_location: order?.route?.split(' → ')[1] || 'Destination',
            sender_name: 'Sender',
            recipient_name: 'Recipient',
            sender_phone: order?.contact_phone || '',
            recipient_phone: order?.receiver_phone || '',
            shipping_cost: order?.price || 0,
            status: status,
            user_email: order?.user_email || order?.email || '',
          });
        } catch (createErr) {
          console.warn('Could not create shipment from order:', createErr.message || createErr);
        }
      }
    } catch (syncErr) {
      console.warn('Error syncing order status to shipments:', syncErr.message || syncErr);
    }

    console.log('Order status updated successfully');
    return res.json({ ok: true, message: 'Order status updated successfully' });
  } catch (err) {
    console.error('Server error in /api/orders/:trackingId/status:', err);
    return res.status(500).json({ error: 'Server error', details: err.message });
  }
});

// Endpoint to upload image for an order
app.post('/api/orders/:trackingId/image', upload.single('photo'), async (req, res) => {
  if (!supabase) {
    return res.status(500).json({ ok: false, message: 'Supabase not configured' });
  }

  const { trackingId } = req.params;

  if (!req.file) {
    return res.status(400).json({ ok: false, message: 'No file provided' });
  }

  try {
    // Get the order to ensure it exists
    const { data: order, error: fetchError } = await supabase
      .from('logistics_orders')
      .select('id')
      .eq('tracking_id', trackingId)
      .single();

    if (fetchError) {
      console.error('Order not found:', trackingId);
      return res.status(404).json({ ok: false, message: 'Order not found' });
    }

    // Upload image to Supabase storage
    const filePath = `orders/${trackingId}/${Date.now()}-${req.file.originalname}`;
    const { error: uploadError } = await supabase.storage
      .from(ORDERS_BUCKET)
      .upload(filePath, req.file.buffer, {
        contentType: req.file.mimetype || 'image/jpeg',
      });

    if (uploadError) {
      console.error('Error uploading image to Supabase storage', uploadError);
      return res.status(500).json({ ok: false, message: 'Failed to upload image' });
    }

    // Get public URL
    const { data: publicUrlData } = supabase.storage
      .from(ORDERS_BUCKET)
      .getPublicUrl(filePath);

    const imageUrl = publicUrlData && publicUrlData.publicUrl ? publicUrlData.publicUrl : null;

    // Update order with image URL
    const { error: updateError } = await supabase
      .from('logistics_orders')
      .update({ image_url: imageUrl })
      .eq('tracking_id', trackingId);

    if (updateError) {
      console.error('Error updating order with image URL:', updateError);
      return res.status(500).json({ ok: false, message: 'Failed to update order' });
    }

    console.log('Image uploaded successfully for order:', trackingId);
    return res.json({ ok: true, message: 'Image uploaded successfully', image_url: imageUrl });
  } catch (err) {
    console.error('Server error in /api/orders/:trackingId/image:', err);
    return res.status(500).json({ ok: false, message: 'Server error' });
  }
});

// Endpoint to fetch all notifications
app.get('/api/notifications', async (req, res) => {
  if (!supabase) {
    return res.status(500).json({ ok: false, message: 'Supabase not configured' });
  }

  try {
    const { data, error } = await supabase
      .from('logistics_notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Supabase fetch error:', error.message);
      return res.status(500).json({ ok: false, message: 'Could not fetch notifications' });
    }

    return res.json({ notifications: data || [] });
  } catch (err) {
    console.error('Server error:', err);
    return res.status(500).json({ ok: false, message: 'Server error' });
  }
});

// Endpoint to create notifications (for testing/admin)
app.post('/api/notifications', async (req, res) => {
  if (!supabase) {
    return res.status(500).json({ ok: false, message: 'Supabase not configured' });
  }

  try {
    const { title, body, type, user_email, link_url } = req.body || {};

    if (!title || !body) {
      return res.status(400).json({ ok: false, message: 'title and body are required' });
    }

    // Get the target email
    let targetEmail = user_email;
    if (!targetEmail) {
      return res.status(400).json({ ok: false, message: 'user_email is required' });
    }

    // Create notification record
    const notificationData = {
      title,
      body,
      type: type || 'info',
      status: 'unread',
      user_email: targetEmail,
      link_url: link_url || null,
      created_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('logistics_notifications')
      .insert([notificationData])
      .select();

    if (error) {
      console.error('Error creating notification in Supabase:', error);
      return res.status(500).json({ ok: false, message: 'Failed to create notification' });
    }

    return res.json({ ok: true, notification: data[0] });
  } catch (err) {
    console.error('Server error in /api/notifications POST:', err);
    return res.status(500).json({ ok: false, message: 'Server error' });
  }
});

// Get all users from logistics_users table (for admin)
app.get('/api/users', async (req, res) => {
  if (!supabase) {
    return res.status(500).json({ ok: false, message: 'Supabase not configured', users: [] });
  }

  try {
    const { data, error } = await supabase
      .from('logistics_users')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching users from Supabase:', error);
      return res.status(500).json({ ok: false, message: 'Failed to fetch users', users: [] });
    }

    return res.json({ ok: true, users: data || [] });
  } catch (err) {
    console.error('Server error in /api/users GET:', err);
  }
});

// --- SMS Verification Endpoints ---

// Send verification code via SMS
app.post('/api/sms/send-verification', async (req, res) => {
  const { phoneNumber, channel = 'sms' } = req.body;

  if (!phoneNumber) {
    return res.status(400).json({ ok: false, message: 'Phone number is required' });
  }

  const result = await sendSmsVerification(phoneNumber, channel);
  
  if (result.success) {
    return res.json({ ok: true, message: 'Verification code sent successfully', data: result.data });
  } else {
    return res.status(500).json({ ok: false, message: result.error });
  }
});

// Verify SMS code
app.post('/api/sms/verify-code', async (req, res) => {
  const { phoneNumber, code } = req.body;

  if (!phoneNumber || !code) {
    return res.status(400).json({ ok: false, message: 'Phone number and verification code are required' });
  }

  const result = await verifySmsCode(phoneNumber, code);
  
  if (result.success) {
    return res.json({ ok: true, message: result.data.message, data: result.data });
  } else {
    return res.status(400).json({ ok: false, message: result.error });
  }
});

// Send custom SMS message
app.post('/api/sms/send-message', async (req, res) => {
  const { phoneNumber, message } = req.body;

  if (!phoneNumber || !message) {
    return res.status(400).json({ ok: false, message: 'Phone number and message are required' });
  }

  const result = await sendSmsMessage(phoneNumber, message);
  
  if (result.success) {
    return res.json({ ok: true, message: 'SMS sent successfully', data: result.data });
  } else {
    return res.status(500).json({ ok: false, message: result.error });
  }
});

app.listen(PORT, () => {
// --- SMS Verification Endpoints ---

// // Send verification code via SMS
// app.post('/api/sms/send-verification', async (req, res) => {
//   if (!twilioClient) {
//     return res.status(500).json({ ok: false, message: 'SMS service not configured' });
//   }

//   const { phoneNumber, channel = 'sms' } = req.body;

//   if (!phoneNumber) {
//     return res.status(400).json({ ok: false, message: 'Phone number is required' });
//   }

//   try {
//     // Ensure phone number is in E.164 format
//     let formattedNumber = phoneNumber;
//     if (!formattedNumber.startsWith('+')) {
//       // Assume Nigerian number if no country code
//       formattedNumber = `+234${formattedNumber.replace(/^0/, '')}`;
//     }

//     const verification = await twilioClient.verify.v2
//       .services(process.env.TWILIO_VERIFY_SERVICE_SID)
//       .verifications.create({
//         to: formattedNumber,
//         channel: channel
//       });

//     console.log('SMS verification sent:', verification.sid);
//     return res.json({ ok: true, message: 'Verification code sent successfully' });
//   } catch (error) {
//     console.error('Error sending SMS verification:', error);
//     return res.status(500).json({ ok: false, message: 'Failed to send verification code' });
//   }
// });

// // Verify SMS code
// app.post('/api/sms/verify-code', async (req, res) => {
//   if (!twilioClient) {
//     return res.status(500).json({ ok: false, message: 'SMS service not configured' });
//   }

//   const { phoneNumber, code } = req.body;

//   if (!phoneNumber || !code) {
//     return res.status(400).json({ ok: false, message: 'Phone number and verification code are required' });
//   }

//   try {
//     // Ensure phone number is in E.164 format
//     let formattedNumber = phoneNumber;
//     if (!formattedNumber.startsWith('+')) {
//       // Assume Nigerian number if no country code
//       formattedNumber = `+234${formattedNumber.replace(/^0/, '')}`;
//     }

//     const verificationCheck = await twilioClient.verify.v2
//       .services(process.env.TWILIO_VERIFY_SERVICE_SID)
//       .verificationChecks.create({
//         to: formattedNumber,
//         code: code
//       });

//     if (verificationCheck.status === 'approved') {
//       console.log('SMS verification successful for:', formattedNumber);
//       return res.json({ ok: true, message: 'Verification successful' });
//     } else {
//      return res.status(400).json({ ok: false, message: 'Invalid verification code' });
//     }
//   } catch (error) {
//     console.error('Error verifying SMS code:', error);
//     return res.status(500).json({ ok: false, message: 'Failed to verify code' });
//   }
// });

// // Send custom SMS message
// app.post('/api/sms/send-message', async (req, res) => {
//   if (!twilioClient) {
//     return res.status(500).json({ ok: false, message: 'SMS service not configured' });
//   }

//   const { phoneNumber, message } = req.body;

//   if (!phoneNumber || !message) {
//     return res.status(400).json({ ok: false, message: 'Phone number and message are required' });
//   }

//   try {
//     // Ensure phone number is in E.164 format
//     let formattedNumber = phoneNumber;
//     if (!formattedNumber.startsWith('+')) {
//       // Assume phone number is in E.164 format
//       formattedNumber = `+234${formattedNumber.replace(/^0/, '')}`;
//     }

//     const sms = await twilioClient.messages.create({
//       body: message,
//       from: process.env.TWILIO_PHONE_NUMBER, // Your Twilio phone number
//       to: formattedNumber
//     });

//     console.log('SMS sent successfully:', sms.sid);
//     return res.json({ ok: true, message: 'SMS sent successfully', sid: sms.sid });
//   } catch (error) {
//     console.error('Error sending SMS:', error);
//     return res.status(500).json({ ok: false, message: 'Failed to send SMS' });
//   }
// });

  console.log(`SwiftLogix server running at http://localhost:${PORT}`);
});

