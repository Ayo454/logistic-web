// Simple Express server that receives auth events
// and stores them in Supabase + local user.json

import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import nodemailer from 'nodemailer';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// TODO: put these in a .env file in real usage
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://elqpszcusvpsxspiuwoq.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'sb_publishable_7GHH8d6WkKCE20nKpG_x7g__xl7R2I7';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// Gmail transporter – uses app password via env vars
// Set in PowerShell before npm start:
// $env:EMAIL_USER="yourgmail@gmail.com"
// $env:EMAIL_PASS="your_app_password_without_spaces"
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

async function sendWelcomeEmail(to, name) {
  if (!to) return;
  const firstName = (name || '').split(' ')[0] || 'there';
  const mailOptions = {
    from: process.env.EMAIL_FROM || process.env.EMAIL_USER || 'no-reply@swiftlogix.com',
    to,
    subject: 'Welcome to SwiftLogix Logistics',
    text: `Hi ${firstName}, your SwiftLogix account has been created successfully.`,
    html: `
      <div style="background:#050816;padding:32px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#e5e7eb;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="max-width:520px;width:100%;background:#0b1024;border-radius:18px;border:1px solid #1f2937;box-shadow:0 18px 50px rgba(15,23,42,0.7);overflow:hidden;">
          <tr>
            <td style="padding:20px 24px 12px;text-align:center;background:linear-gradient(135deg,#020617,#020617);border-bottom:1px solid rgba(148,163,184,0.18);">
              <div style="display:inline-flex;align-items:center;gap:10px;">
                <div style="width:32px;height:32px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;letter-spacing:.12em;background:linear-gradient(135deg,#0066ff,#ffd700);color:#020617;box-shadow:0 10px 30px rgba(37,99,235,0.7);">
                  SL
                </div>
                <span style="font-size:18px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#e5e7eb;">SwiftLogix</span>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:22px 24px 8px;">
              <p style="margin:0 0 8px;font-size:14px;color:#9ca3af;">Hi ${firstName},</p>
              <p style="margin:0 0 14px;font-size:14px;color:#e5e7eb;font-weight:600;">Your SwiftLogix account has been created successfully.</p>
              <p style="margin:0 0 16px;font-size:13px;line-height:1.6;color:#9ca3af;">
                You can now place <strong style="color:#e5e7eb;">express deliveries</strong>, request
                <strong style="color:#e5e7eb;">freight &amp; line‑haul</strong>, and manage
                <strong style="color:#e5e7eb;">warehousing &amp; fulfillment</strong> orders from your dashboard.
              </p>
              <p style="margin:0 0 4px;font-size:12px;color:#9ca3af;">Thank you for choosing SwiftLogix,</p>
              <p style="margin:0 0 4px;font-size:12px;color:#e5e7eb;font-weight:600;">SwiftLogix Team</p>
            </td>
          </tr>
          <tr>
            <td style="padding:14px 24px 18px;border-top:1px solid rgba(15,23,42,0.9);background:#020617;">
              <p style="margin:0;font-size:11px;color:#6b7280;line-height:1.5;">
                You’re receiving this email because an account was created on SwiftLogix Logistics with this address.
                If this wasn’t you, you can safely ignore this message.
              </p>
            </td>
          </tr>
        </table>
      </div>
    `,
  };
  try {
    await transporter.sendMail(mailOptions);
  } catch (err) {
    console.error('Email send error:', err.message);
  }
}

// Helper to append to local user.json (for your own logs)
function appendToLocalUsers(payload) {
  const filePath = path.join(__dirname, 'user.json');
  let existing = [];
  try {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf-8');
      existing = raw ? JSON.parse(raw) : [];
    }
  } catch {
    existing = [];
  }
  existing.push({ ...payload, savedAt: new Date().toISOString() });
  fs.writeFileSync(filePath, JSON.stringify(existing, null, 2));
}

// Endpoint the frontend will call for register / generic auth events
app.post('/api/auth-event', async (req, res) => {
  const { type, user } = req.body || {};

  if (!user || !user.email) {
    return res.status(400).json({ error: 'Missing user data' });
  }

  try {
    // If it's a registration, prevent duplicate accounts for the same email
    if (type === 'register') {
      if (!user.password) {
        return res.status(400).json({ error: 'Missing password' });
      }

      const { data: existing, error: selectError } = await supabase
        .from('logistics_users')
        .select('id')
        .eq('email', user.email)
        .eq('event_type', 'register')
        .limit(1);

      if (selectError) {
        console.error('Supabase select error:', selectError.message);
      } else if (existing && existing.length > 0) {
        return res.status(409).json({ error: 'Account with this email already exists. Please login instead.' });
      }

      // Hash password for storage (make sure logistics_users has a password_hash column)
      const passwordHash = await bcrypt.hash(user.password, 10);

      const record = {
        event_type: 'register',
        email: user.email,
        name: user.name || null,
        phone: user.phone || null,
        source: 'logistics-frontend',
        password_hash: passwordHash,
      };

      const { error } = await supabase.from('logistics_users').insert(record);
      if (error) {
        console.error('Supabase insert error:', error.message);
        return res.status(500).json({ error: 'Failed to save user.' });
      }

      appendToLocalUsers({ type, user: { email: user.email, name: user.name, phone: user.phone } });
      await sendWelcomeEmail(user.email, user.name);

      return res.json({ ok: true });
    }

    // For other auth events (like "login"), just append to log / Supabase without password
    const record = {
      event_type: type || 'unknown',
      email: user.email,
      name: user.name || null,
      phone: user.phone || null,
      source: 'logistics-frontend',
    };

    const { error } = await supabase.from('logistics_users').insert(record);
    if (error) {
      console.error('Supabase insert error:', error.message);
    }

    appendToLocalUsers({ type, user });
    return res.json({ ok: true });
  } catch (err) {
    console.error('Server error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Login endpoint - verifies email + password against Supabase
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ error: 'Missing email or password' });
  }

  try {
    // Get latest registration record for this email
    const { data, error } = await supabase
      .from('logistics_users')
      .select('id,email,name,phone,password_hash')
      .eq('email', email)
      .eq('event_type', 'register')
      .order('id', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('Supabase login select error:', error.message);
      return res.status(500).json({ error: 'Could not check credentials' });
    }

    if (!data || !data.password_hash) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const match = await bcrypt.compare(password, data.password_hash);
    if (!match) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const safeUser = {
      email: data.email,
      name: data.name,
      phone: data.phone,
    };

    return res.json({ ok: true, user: safeUser });
  } catch (err) {
    console.error('Server login error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Endpoint to fetch all users from Supabase
app.get('/api/users', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('logistics_users')
      .select('id,email,name,phone,event_type,created_at')
      .eq('event_type', 'register')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase fetch error:', error.message);
      return res.status(500).json({ error: 'Could not fetch users' });
    }

    return res.json({ users: data || [] });
  } catch (err) {
    console.error('Server error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Endpoint to fetch all notifications from Supabase
app.get('/api/notifications', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('logistics_notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Supabase fetch error:', error.message);
      return res.status(500).json({ error: 'Could not fetch notifications' });
    }

    return res.json({ notifications: data || [] });
  } catch (err) {
    console.error('Server error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Endpoint to fetch all users from Supabase
app.get('/api/users', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('logistics_users')
      .select('id,email,name,phone,event_type,created_at')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error('Supabase fetch error:', error.message);
      return res.status(500).json({ error: 'Could not fetch users' });
    }

    return res.json({ users: data || [] });
  } catch (err) {
    console.error('Server error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Endpoint to fetch all shipments from Supabase
app.get('/api/shipments', async (req, res) => {
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

// Endpoint to create a new shipment
app.post('/api/shipments', async (req, res) => {
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

    // Add initial status to history
    await supabase
      .from('logistics_shipment_history')
      .insert({
        shipment_id: data.id,
        new_status: data.status || 'pending',
        location: data.origin_location,
        notes: 'Shipment created',
        changed_by: 'system'
      });

    return res.json({ shipment: data });
  } catch (err) {
    console.error('Server error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Endpoint to update shipment status
app.put('/api/shipments/:trackingNumber/status', async (req, res) => {
  const { trackingNumber } = req.params;
  const { status, location, notes, changed_by } = req.body || {};

  if (!status) {
    return res.status(400).json({ error: 'Status is required' });
  }

  try {
    // Get current shipment
    const { data: currentShipment, error: fetchError } = await supabase
      .from('logistics_shipments')
      .select('id, status')
      .eq('tracking_number', trackingNumber)
      .single();

    if (fetchError) {
      console.error('Supabase fetch error:', fetchError.message);
      return res.status(404).json({ error: 'Shipment not found' });
    }

    // Update shipment status
    const { data, error } = await supabase
      .from('logistics_shipments')
      .update({
        status,
        current_location: location || currentShipment.current_location,
        updated_at: new Date().toISOString(),
        actual_delivery: status === 'delivered' ? new Date().toISOString() : null
      })
      .eq('tracking_number', trackingNumber)
      .select()
      .single();

    if (error) {
      console.error('Supabase update error:', error.message);
      return res.status(500).json({ error: 'Failed to update shipment' });
    }

    // Add status change to history
    await supabase
      .from('logistics_shipment_history')
      .insert({
        shipment_id: currentShipment.id,
        old_status: currentShipment.status,
        new_status: status,
        location,
        notes,
        changed_by: changed_by || 'system'
      });

    return res.json({ shipment: data });
  } catch (err) {
    console.error('Server error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Endpoint to create a new notification and send email
app.post('/api/notifications', async (req, res) => {
  // accept both `message` (newer name) and `body` (older test scripts)
  const { title, message: rawMessage, body: rawBody, type, user_email, userEmails, linkUrl } = req.body || {};

  // prefer explicit message, otherwise fall back to body
  const message = rawMessage || rawBody;

  if (!title || !message) {
    return res.status(400).json({ error: 'Missing title or message/body' });
  }

  try {
    // If userEmails is provided, send to specific users; otherwise send to all users
    let targetEmails = [];
    if (userEmails && Array.isArray(userEmails) && userEmails.length > 0) {
      targetEmails = userEmails;
    } else if (user_email) {
      // support legacy single-recipient key
      targetEmails = [user_email];
    } else {
      // Get all registered user emails
      const { data: users, error: usersError } = await supabase
        .from('logistics_users')
        .select('email')
        .eq('event_type', 'register');

      if (usersError) {
        console.error('Error fetching users:', usersError.message);
        return res.status(500).json({ error: 'Could not fetch users for notification' });
      }

      targetEmails = users.map(user => user.email);
    }

    // Create notification record for each user
    const notifications = targetEmails.map(email => ({
      title,
      body: message,
      type: type || 'info',
      status: 'unread',
      user_email: email,
      link_url: linkUrl || null
    }));

    const { error: insertError } = await supabase
      .from('logistics_notifications')
      .insert(notifications);

    if (insertError) {
      console.error('Supabase insert error:', insertError.message);
      return res.status(500).json({ error: 'Failed to save notifications' });
    }

    // Send email to each user
    const emailPromises = targetEmails.map(email => 
      sendNotificationEmail(email, title, message, linkUrl)
    );

    await Promise.all(emailPromises);

    return res.json({ ok: true, sentTo: targetEmails.length });
  } catch (err) {
    console.error('Server error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Function to send notification email
async function sendNotificationEmail(to, title, message, linkUrl) {
  if (!to) return;
  
  const mailOptions = {
    from: process.env.EMAIL_FROM || process.env.EMAIL_USER || 'no-reply@swiftlogix.com',
    to,
    subject: `SwiftLogix: ${title}`,
    text: `${message}${linkUrl ? `\n\nView details: ${linkUrl}` : ''}`,
    html: `
      <div style="background:#050816;padding:32px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#e5e7eb;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="max-width:520px;width:100%;background:#0b1024;border-radius:18px;border:1px solid #1f2937;box-shadow:0 18px 50px rgba(15,23,42,0.7);overflow:hidden;">
          <tr>
            <td style="padding:20px 24px 12px;text-align:center;background:linear-gradient(135deg,#020617,#020617);border-bottom:1px solid rgba(148,163,184,0.18);">
              <div style="display:inline-flex;align-items:center;gap:10px;">
                <div style="width:32px;height:32px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;letter-spacing:.12em;background:linear-gradient(135deg,#0066ff,#ffd700);color:#020617;box-shadow:0 10px 30px rgba(37,99,235,0.7);">
                  SL
                </div>
                <span style="font-size:18px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#e5e7eb;">SwiftLogix</span>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:22px 24px 8px;">
              <p style="margin:0 0 8px;font-size:14px;color:#9ca3af;">Notification</p>
              <p style="margin:0 0 14px;font-size:14px;color:#e5e7eb;font-weight:600;">${title}</p>
              <p style="margin:0 0 16px;font-size:13px;line-height:1.6;color:#9ca3af;">
                ${message.replace(/\n/g, '<br>')}
              </p>
              ${linkUrl ? `<p style="margin:0 0 16px;"><a href="${linkUrl}" style="background:#0066ff;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;display:inline-block;">View Details</a></p>` : ''}
            </td>
          </tr>
          <tr>
            <td style="padding:14px 24px 18px;border-top:1px solid rgba(15,23,42,0.9);background:#020617;">
              <p style="margin:0;font-size:11px;color:#6b7280;line-height:1.5;">
                You’re receiving this email because you have an account with SwiftLogix Logistics.
                If you no longer wish to receive notifications, you can update your preferences in your account settings.
              </p>
            </td>
          </tr>
        </table>
      </div>
    `,
  };
  
  try {
    await transporter.sendMail(mailOptions);
  } catch (err) {
    console.error('Notification email send error:', err.message);
  }
}

app.listen(PORT, () => {
  console.log(`server.js listening on http://localhost:${PORT}`);
});

