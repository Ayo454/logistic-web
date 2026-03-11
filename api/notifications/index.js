import { supabase, addCorsHeaders } from '../lib/shared.js';

export default async (req, res) => {
  addCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method === 'GET') {
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
  } else if (req.method === 'POST') {
    if (!supabase) {
      return res.status(500).json({ ok: false, message: 'Supabase not configured' });
    }

    try {
      const { title, body, type, user_email, link_url } = req.body || {};

      if (!title || !body) {
        return res.status(400).json({ ok: false, message: 'title and body are required' });
      }

      if (!user_email) {
        return res.status(400).json({ ok: false, message: 'user_email is required' });
      }

      const notificationData = {
        title,
        body,
        type: type || 'info',
        status: 'unread',
        user_email,
        link_url: link_url || null,
        created_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from('logistics_notifications')
        .insert([notificationData])
        .select();

      if (error) {
        console.error('Error creating notification', error);
        return res.status(500).json({ ok: false, message: 'Failed to create notification' });
      }

      return res.json({ ok: true, notification: data[0] });
    } catch (err) {
      console.error('Server error in notifications POST:', err);
      return res.status(500).json({ ok: false, message: 'Server error' });
    }
  }

  return res.status(405).json({ ok: false, message: 'Method not allowed' });
};
