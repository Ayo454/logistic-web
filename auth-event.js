import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY;

let supabase = null;
if (SUPABASE_URL && SUPABASE_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
}

export default async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

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
      console.log('User sent to Supabase:', fullUser.email, `(${type})`);
    } catch (err) {
      console.error('Error inserting into Supabase', err);
    }
  }

  return res.json({ ok: true });
};
