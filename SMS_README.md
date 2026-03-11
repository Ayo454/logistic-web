# SwiftLogix SMS Integration

This document explains how to use the SMS verification and messaging functionality in your SwiftLogix logistics platform.

## Setup

### 1. Environment Variables

Add these variables to your `.env` file:

```env
# Twilio SMS settings
TWILIO_ACCOUNT_SID=AC7b2a742a6ea302635b5324f167bb880e
TWILIO_AUTH_TOKEN=your_actual_auth_token_here
TWILIO_VERIFY_SERVICE_SID=VAb5d52ecd2cbc5e5f6ffa8360feb6570f
TWILIO_PHONE_NUMBER=+1234567890  # Your Twilio phone number
```

### 2. Install Dependencies

```bash
npm install
```

## API Endpoints

### Send Verification Code

**POST** `/api/sms/send-verification`

Sends a verification code to a phone number via SMS.

**Request Body:**
```json
{
  "phoneNumber": "+2348051877195",
  "channel": "sms"
}
```

**Response:**
```json
{
  "ok": true,
  "message": "Verification code sent successfully"
}
```

### Verify Code

**POST** `/api/sms/verify-code`

Verifies a code entered by the user.

**Request Body:**
```json
{
  "phoneNumber": "+2348051877195",
  "code": "123456"
}
```

**Response:**
```json
{
  "ok": true,
  "message": "Verification successful"
}
```

### Send Custom Message

**POST** `/api/sms/send-message`

Sends a custom SMS message.

**Request Body:**
```json
{
  "phoneNumber": "+2348051877195",
  "message": "Your order has been shipped!"
}
```

**Response:**
```json
{
  "ok": true,
  "message": "SMS sent successfully",
  "sid": "SMxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
}
```

## Phone Number Formatting

The API automatically formats Nigerian phone numbers:
- `08051877195` → `+2348051877195`
- `+2348051877195` → `+2348051877195` (no change)

## Testing

Use the provided test script:

```bash
# Edit test-sms.js to uncomment the test you want to run
node test-sms.js
```

## Frontend Integration Example

```javascript
// Send verification code
async function sendVerificationCode(phoneNumber) {
  const response = await fetch('/api/sms/send-verification', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phoneNumber })
  });
  return response.json();
}

// Verify code
async function verifyCode(phoneNumber, code) {
  const response = await fetch('/api/sms/verify-code', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phoneNumber, code })
  });
  return response.json();
}

// Send custom message
async function sendSMS(phoneNumber, message) {
  const response = await fetch('/api/sms/send-message', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phoneNumber, message })
  });
  return response.json();
}
```

## Use Cases

1. **User Registration**: Send verification codes during signup
2. **Order Confirmations**: Notify customers when orders are placed
3. **Delivery Updates**: Send tracking updates via SMS
4. **Password Reset**: Send reset codes via SMS
5. **Delivery Verification**: Send codes to receivers for package pickup

## Error Handling

The API returns appropriate HTTP status codes:
- `200`: Success
- `400`: Bad request (missing parameters)
- `500`: Server error (Twilio not configured or API error)

## Security Notes

- Phone numbers are automatically formatted to E.164 format
- Verification codes expire after 10 minutes (Twilio default)
- Rate limiting should be implemented on the frontend to prevent abuse
- Consider implementing cooldown periods between SMS sends