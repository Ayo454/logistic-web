import { addCorsHeaders } from '../../lib/shared.js';
import { sendSmsMessage } from '../../logistics/sms-utils.js';

export default async (req, res) => {
  addCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, message: 'Method not allowed' });
  }

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
};
