import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';

dotenv.config();

// Initialize email provider
let emailProvider = null;

if (process.env.RESEND_API_KEY) {
  try {
    const { Resend } = await import('resend');
    emailProvider = new Resend(process.env.RESEND_API_KEY);
    console.log('✓ Resend initialized');
  } catch (err) {
    console.error('Failed to initialize Resend:', err.message);
  }
} else if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
  try {
    emailProvider = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
    console.log('✓ Gmail SMTP initialized');
  } catch (err) {
    console.error('Failed to initialize Gmail SMTP:', err.message);
  }
}

// Initialize Supabase
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY;
let supabase = null;
if (SUPABASE_URL && SUPABASE_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
}

// Helper: Send emails
async function sendEmailViaProvider(from, to, subject, html) {
  if (!emailProvider) throw new Error('Email provider not configured');
  try {
    if (emailProvider.emails && typeof emailProvider.emails.send === 'function') {
      return await emailProvider.emails.send({ from, to, subject, html });
    } else if (typeof emailProvider.sendMail === 'function') {
      return await emailProvider.sendMail({ from, to, subject, html });
    }
    throw new Error('Unknown email provider');
  } catch (err) {
    console.error('Email send failed:', err.message);
    throw err;
  }
}

// Route handlers
async function handleAuthEvent(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, message: 'Method not allowed' });
  }

  const { type, user } = req.body || {};
  if (!type || !user || !user.email) {
    return res.status(400).json({ ok: false, message: 'Invalid payload' });
  }

  const fullUser = { ...user, createdAt: new Date().toISOString(), type };

  if (supabase) {
    try {
      await supabase.from('logistics_users').insert({
        name: fullUser.name?.trim() || null,
        phone: fullUser.phone?.trim() || null,
        email: fullUser.email,
        event_type: type,
        created_at: fullUser.createdAt,
      });
    } catch (err) {
      console.error('Error inserting into Supabase', err);
    }
  }

  return res.json({ ok: true });
}

async function handleDebugEmail(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, message: 'Method not allowed' });
  }

  if (!emailProvider) {
    return res.status(500).json({ ok: false, message: 'email provider not configured' });
  }

  const to = process.env.EMAIL_USER || '';
  const from = process.env.EMAIL_FROM ? process.env.EMAIL_FROM : process.env.EMAIL_USER || to;

  try {
    const response = await sendEmailViaProvider(from, to, 'SwiftLogix debug message', 'This is a delivery test from your Vercel service.');
    res.json({ ok: true, response });
  } catch (err) {
    console.error('debug-email failed', err);
    res.status(500).json({ ok: false, error: err.message });
  }
}

// Main handler
export default async (req, res) => {
  const { pathname } = new URL(req.url, 'https://example.com');

  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Route to handler
  if (pathname === '/api/auth-event') {
    return handleAuthEvent(req, res);
  } else if (pathname === '/api/debug-email') {
    return handleDebugEmail(req, res);
  }

  res.status(404).json({ ok: false, message: 'Not found' });
};
