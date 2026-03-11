import { addCorsHeaders } from '../../lib/shared.js';
import { verifySmsCode } from '../../logistics/sms-utils.js';

export default async (req, res) => {
  addCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, message: 'Method not allowed' });
  }

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
};
