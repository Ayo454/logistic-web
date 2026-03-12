import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';
import twilio from 'twilio';

dotenv.config();

// Supabase
export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY
);

// Email provider
let emailProvider = null;

if (process.env.RESEND_API_KEY) {
  try {
    const { Resend } = await import('resend');
    emailProvider = new Resend(process.env.RESEND_API_KEY);
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
  } catch (err) {
    console.error('Failed to initialize Gmail SMTP:', err.message);
  }
}

export { emailProvider };

// Twilio
export const twilioClient = process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
  ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
  : null;

// Send email via provider
export async function sendEmailViaProvider(from, to, subject, html) {
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

// CORS headers
export function addCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

// Helper for user registration check
export async function isUserRegistered(email) {
  if (!supabase) return false;
  try {
    const { data, error } = await supabase
      .from('logistics_users')
      .select('email')
      .eq('email', email)
      .eq('event_type', 'register')
      .limit(1);
    return data && data.length > 0;
  } catch (err) {
    console.error('Error checking user registration:', err);
    return false;
  }
}
