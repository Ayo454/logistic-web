import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';

dotenv.config();

// Initialize email provider (Resend or Gmail SMTP)
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
    emailProvider = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
    console.log('✓ Gmail SMTP email provider initialized');
  } catch (err) {
    console.error('Failed to initialize Gmail SMTP:', err.message);
  }
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
      return result;
    }
    
    throw new Error('Unknown email provider - no send method found');
  } catch (err) {
    console.error('📧 Email send failed:', err.message, err.code);
    throw err;
  }
}

export default async function handler(req, res) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, message: 'Method not allowed' });
  }

  if (!emailProvider) {
    return res.status(500).json({ ok: false, message: 'Email provider not configured' });
  }

  const to = process.env.EMAIL_USER || '';
  const from = process.env.EMAIL_FROM
    ? process.env.EMAIL_FROM
    : process.env.EMAIL_USER || to;

  try {
    const response = await sendEmailViaProvider(
      from,
      to,
      'SwiftLogix debug message',
      'This is a delivery test from your Vercel service.'
    );
    
    console.log('🔧 debug-email sent', response.id || response.messageId || 'success');
    res.json({ ok: true, response });
  } catch (err) {
    console.error('🔧 debug-email failed', err);
    res.status(500).json({ ok: false, error: err.message });
  }
}
