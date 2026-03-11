# SMS Verification & Messaging Guide

This guide explains how to use the Twilio SMS verification and messaging functions in your SwiftLogix project.

## Overview

You now have **3 reusable SMS functions**:
1. `sendSmsVerification()` - Send verification codes via SMS
2. `verifySmsCode()` - Verify codes submitted by users
3. `sendSmsMessage()` - Send custom SMS messages

## Setup Requirements

Make sure your `.env` file contains:

```env
TWILIO_ACCOUNT_SID=AC0c05b12dc8685bcee6c7d663c147935b
TWILIO_AUTH_TOKEN=your_actual_auth_token_here
TWILIO_VERIFY_SERVICE_SID=VAb476a4dcf41a488059932ba405dcef0f
TWILIO_PHONE_NUMBER=+1234567890
```

## Usage Methods

### Method 1: Direct Function Calls (Backend/Node.js)

Import and use the functions directly in your Node.js code:

```javascript
import { sendSmsVerification, verifySmsCode, sendSmsMessage } from './sms-utils.js';

// Send verification code
const result = await sendSmsVerification('+2348051877195', 'sms');
if (result.success) {
  console.log('Code sent! SID:', result.data.sid);
} else {
  console.log('Error:', result.error);
}
```

### Method 2: API Endpoints (Frontend/Client Code)

Use the Express endpoints from your frontend:

#### Send Verification Code

```bash
curl -X POST http://localhost:3000/api/sms/send-verification \
  -H "Content-Type: application/json" \
  -d '{
    "phoneNumber": "+2348051877195",
    "channel": "sms"
  }'
```

**Response (Success):**
```json
{
  "ok": true,
  "message": "Verification code sent successfully",
  "data": {
    "sid": "VE...",
    "status": "pending",
    "phoneNumber": "+2348051877195",
    "channel": "sms"
  }
}
```

#### Verify Code

```bash
curl -X POST http://localhost:3000/api/sms/verify-code \
  -H "Content-Type: application/json" \
  -d '{
    "phoneNumber": "+2348051877195",
    "code": "123456"
  }'
```

**Response (Success):**
```json
{
  "ok": true,
  "message": "Verification successful",
  "data": {
    "status": "approved",
    "phoneNumber": "+2348051877195",
    "message": "Code verified successfully"
  }
}
```

#### Send Custom Message

```bash
curl -X POST http://localhost:3000/api/sms/send-message \
  -H "Content-Type: application/json" \
  -d '{
    "phoneNumber": "+2348051877195",
    "message": "Your SwiftLogix order is on the way!"
  }'
```

## JavaScript Examples

### Sending Verification Code from Frontend

```javascript
async function sendCode(phoneNumber) {
  const response = await fetch('/api/sms/send-verification', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      phoneNumber: phoneNumber,
      channel: 'sms'
    })
  });
  
  const data = await response.json();
  if (data.ok) {
    console.log('✓ Code sent to', phoneNumber);
  } else {
    console.log('✗ Error:', data.message);
  }
}
```

### Verifying Code from Frontend

```javascript
async function verifyCode(phoneNumber, code) {
  const response = await fetch('/api/sms/verify-code', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      phoneNumber: phoneNumber,
      code: code
    })
  });
  
  const data = await response.json();
  if (data.ok) {
    console.log('✓ Phone verified!');
    return true;
  } else {
    console.log('✗ Invalid code');
    return false;
  }
}
```

### Complete Authentication Flow

```javascript
async function authenticate(phoneNumber, verificationCode) {
  // Step 1: Send code if not provided
  if (!verificationCode) {
    await sendCode(phoneNumber);
    // Wait for user to enter code
    return;
  }
  
  // Step 2: Verify the code
  const isValid = await verifyCode(phoneNumber, verificationCode);
  if (isValid) {
    // User is authenticated
    console.log('User authenticated successfully');
  }
}
```

## Phone Number Format

The functions automatically handle phone number formatting:

- **With country code:** `+2348051877195` → Used as-is
- **Without country code:** `08051877195` → Converted to `+2348051877195` (Nigerian)
- **Leading zero:** `08051877195` → Zero stripped before adding country code

## Error Handling

All functions return a consistent response object:

```javascript
{
  success: boolean,      // True if operation succeeded
  data: object,          // Response data (if successful)
  error: string          // Error message (if failed)
}
```

Example:
```javascript
const result = await sendSmsVerification('+2348051877195', 'sms');

if (result.success) {
  // Handle success
  console.log('SID:', result.data.sid);
} else {
  // Handle error
  console.log('Error:', result.error);
}
```

## Files Created

1. **`sms-utils.js`** - Core SMS utility functions
2. **`SMS_EXAMPLES.js`** - Detailed usage examples
3. **`SMS_USAGE.md`** - This documentation

## Testing

Use the included `sms-test.html` page to test SMS functionality:

1. Start the server: `npm start`
2. Open: `http://localhost:3000/sms-test.html`
3. Enter a phone number and test the endpoints

## Troubleshooting

### "SMS service not configured"
- Check `.env` file has `TWILIO_ACCOUNT_SID` and `TWILIO_AUTH_TOKEN`
- Restart the server after editing `.env`

### "Invalid phone number"
- Ensure phone is in valid format (with or without country code)
- Nigeria numbers should start with 0 or +234

### "Verification not found"
- Check that `TWILIO_VERIFY_SERVICE_SID` matches your Twilio Verify Service
- Codes expire after 10 minutes

### "Failed to send SMS"
- Verify `TWILIO_PHONE_NUMBER` is set in `.env`
- Check Twilio account has SMS credits

## Best Practices

1. **Rate limiting:** Add rate limiting to prevent abuse
2. **Retry logic:** Implement exponential backoff for failed requests
3. **Logging:** Monitor SMS delivery for debugging
4. **Security:** Never log sensitive data like verification codes
5. **User experience:** Show clear messages to users during verification

## Related Files

- `server.js` - Express endpoints
- `sms-utils.js` - Core functions
- `SMS_EXAMPLES.js` - Full examples
- `sms-test.html` - Test page
- `.env` - Configuration

## Support

For more info, visit:
- [Twilio Verify API Docs](https://www.twilio.com/docs/verify/api)
- [Twilio SMS API Docs](https://www.twilio.com/docs/sms/api)
