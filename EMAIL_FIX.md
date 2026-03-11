# Fix Email Issues on Render - Quick Guide

Your deployment shows email timeouts because Gmail SMTP doesn't work reliably from Render. Here's the fastest fix:

## 🚀 Use Resend (5 minutes setup)

### Step 1: Install Resend
```powershell
cd logistics
npm install resend
```

### Step 2: Create Resend Account
- Go to https://resend.com
- Sign up (free)
- Get your API key from dashboard

### Step 3: Update .env
```env
RESEND_API_KEY=re_xxxxxxxxxxxxx
```

### Step 4: Replace email code in server.js

Find this section:
```javascript
// --- Mailer setup (configure SMTP in .env) ---
let mailer = null;
```

And replace with:

```javascript
// --- Email setup (using Resend) ---
let emailProvider = null;

if (process.env.RESEND_API_KEY) {
  try {
    const { Resend } = await import('resend');
    emailProvider = new Resend(process.env.RESEND_API_KEY);
    console.log('✓ Resend email provider initialized');
  } catch (err) {
    console.error('Failed to initialize Resend:', err.message);
  }
} else {
  console.warn('⚠️  RESEND_API_KEY not set - emails will NOT be sent');
}
```

### Step 5: Update sendWelcomeEmail function

Replace:
```javascript
async function sendWelcomeEmail(email) {
  if (!mailer || !email) return;
```

With:
```javascript
async function sendWelcomeEmail(email) {
  if (!emailProvider || !email) {
    console.log('Email service not configured - skipping welcome email');
    return;
  }
```

Then find the mailer.sendMail call and replace entire try block with:

```javascript
  try {
    const response = await emailProvider.emails.send({
      from: 'SwiftLogix <onboarding@resend.dev>',  // Use Resend's sender
      to: email,
      subject: 'Welcome to SwiftLogix!',
      html: `
        <h1>Welcome to SwiftLogix</h1>
        <p>Your account has been created successfully.</p>
        <p>Start managing your shipments now!</p>
      `
    });
    // include the destination email in the log since the provider response may not
    // include an `id` property on free/trial plans (it will otherwise show as undefined)
    console.log('✓ Welcome email sent to', email, 'response:', response);
    if (!response || !response.id) {
      console.warn('⚠️  Resend response did not include an id (that is normal on some plans)');
    }
  } catch (err) {
    console.error('Error sending welcome email:', err.message);
  }
```

### Step 6: Update render.yaml

Add to envVars:
```yaml
- key: RESEND_API_KEY
  fromDatabase:
    name: resend_api_key
```

### Step 7: Add to Render Dashboard

In your Render service settings → Environment Variables, add:
```
RESEND_API_KEY=re_xxxxxxxxxxxxx
```

Then redeploy.

---

## Alternative: Use SendGrid

If you prefer SendGrid:

```powershell
npm install @sendgrid/mail
```

```env
SENDGRID_API_KEY=SG.xxxxxxxxxxxxx
SENDGRID_FROM_EMAIL=noreply@swiftlogix.com
```

Code:
```javascript
import sgMail from '@sendgrid/mail';
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Then in sendWelcomeEmail:
await sgMail.send({
  to: email,
  from: process.env.SENDGRID_FROM_EMAIL,
  subject: 'Welcome to SwiftLogix!',
  html: '...'
});
```

---

## Why This Works

✅ No firewall issues - designed for serverless  
✅ Free tier - 100 emails/day free  
✅ Simple API - just 2 lines to send  
✅ Reliable delivery  
✅ Built for Render/Vercel/serverless  

Choose Resend or SendGrid and let me know if you need help implementing!
