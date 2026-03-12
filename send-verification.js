import { addCorsHeaders } from '../../lib/shared.js';
import { sendSmsVerification } from '../../logistics/sms-utils.js';

export default async (req, res) => {
  addCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, message: 'Method not allowed' });
  }

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
};
