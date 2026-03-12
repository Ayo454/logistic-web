# Render Deployment Guide - Email & SMS

This guide explains how to deploy your SwiftLogix application to Render with full email and SMS notifications.

---

## 📋 Pre-Deployment Checklist

### Step 1: Get Your Credentials

#### ✅ Supabase
- Go to [Supabase Dashboard](https://app.supabase.com)
- Open your project → Settings → API
- Copy: **Project URL** and **Public/Anon Key**
- Save as: `SUPABASE_URL` and `SUPABASE_KEY`

#### ✅ Gmail Setup
- Go to your Gmail account: [myaccount.google.com/security](https://myaccount.google.com/security)
- Search for "App passwords"
- Create app password for Mail app
- Copy the 16-character password
- Save as: `EMAIL_PASS`
- Save email as: `EMAIL_USER=your_email@gmail.com`

#### ✅ Twilio SMS Setup
1. Go to [Twilio Console](https://www.twilio.com/console)
2. Get your:
   - **Account SID** (under "Account Info")
   - **Auth Token** (under "Account Info")
   - **Phone Number** (click "Phone Numbers" → Active Numbers)

3. Create a **Verify Service**:
   - Go to "Programmable SMS" → "Verify"
   - Click "Create Verify Service"
   - Give it a name (e.g., "SwiftLogix")
   - Copy the **Service SID**

4. Save these as:
   ```
   TWILIO_ACCOUNT_SID=your_sid
   TWILIO_AUTH_TOKEN=your_token
   TWILIO_VERIFY_SERVICE_SID=your_service_id
   TWILIO_PHONE_NUMBER=+1234567890  (your actual Twilio number)
   ```

---

## 🚀 Deploying to Render

### Step 2: Connect Your Repository

1. Push your code to GitHub (if not already done)
2. Go to [Render.com](https://render.com)
3. Sign in with GitHub
4. Click **"New +"** → **"Web Service"**
5. Select your repository
6. Configure:
   - **Name**: `swiftlogix-logistics`
   - **Environment**: `Node`
   - **Build Command**: `cd logistics && npm install`
   - **Start Command**: `cd logistics && npm start`
   - **Instance Type**: Free or Paid

### Step 3: Add Environment Variables

In Render dashboard, under "Environment":

```
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_key

EMAIL_USER=your_gmail@gmail.com
EMAIL_PASS=your_16_char_app_password
EMAIL_FROM=SwiftLogix <no-reply@swiftlogix.com>

TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_VERIFY_SERVICE_SID=your_verify_service_id
TWILIO_PHONE_NUMBER=+1234567890

PORT=3000
NODE_ENV=production
```

### Step 4: Deploy

- Click **"Deploy"** button
- Wait for build to complete
- Check logs for any errors

---

## 🧪 Testing Your Deployment

### Test Email Sending
1. Register a new account on your Render app
2. Check email inbox for welcome email
3. Should contain: "Your SwiftLogix account has been created"

### Test Order Confirmation Email
1. Log in and place a test order
2. Check email for order confirmation
3. Should contain: tracking ID and order details

### Test SMS Sending
1. Place an order with a phone number
2. Check phone for SMS message
3. Should contain: "Your order has been received. Tracking ID: ..."

### Test Status Update
1. Go to admin panel
2. Update an order status
3. Check both email and SMS received

---

## 📊 What Gets Sent Automatically

### 📧 Emails (When deployed):
- ✅ Welcome email on registration
- ✅ Order confirmation when order is placed
- ✅ Receiver code email (if receiver email provided)
- ✅ Status update when order status changes
- ✅ Delivery notification when marked delivered

### 📱 SMS Messages (When deployed):
- ✅ Order confirmation SMS to user phone
- ✅ Status update SMS to user phone
- ✅ Delivery confirmation SMS to user phone
- ✅ SMS verification for 2FA (via `/api/sms/verify-code`)

---

## 🔧 Troubleshooting

### ❌ Emails Not Sending
**Check**:
1. Gmail app password is correct (16 characters, not regular password)
2. Less secure app access enabled (if using regular Gmail)
3. RESEND_API_KEY set if using Resend service
4. Email logs in Render: check "Live Logs"

**Logs to check**:
- Look for: `✓ SMTP mailer initialised (Gmail)` or `✓ Resend client initialised`

### ❌ SMS Not Sending
**Check**:
1. TWILIO_AUTH_TOKEN is correct (real token, not placeholder)
2. TWILIO_VERIFY_SERVICE_SID is set (for verification codes)
3. TWILIO_PHONE_NUMBER is your actual Twilio number
4. SMS logs in Render: check "Live Logs"

**Logs to check**:
- Look for: `✓ Twilio client initialized`
- When SMS attempts: `✓ SMS sent to +234...`

### ❌ Order SMS Not Sending
**Possible Issues**:
1. Phone number format - must be international format (+234...)
2. Twilio doesn't support that country
3. Insufficient Twilio credit (check account balance)

---

## 📝 Environment Variable Reference

| Variable | Source | Required | Example |
|----------|--------|----------|---------|
| `SUPABASE_URL` | Supabase Dashboard | ✅ | `https://xxx.supabase.co` |
| `SUPABASE_KEY` | Supabase Dashboard | ✅ | `sb_xxx` |
| `EMAIL_USER` | Gmail Account | ✅ | `email@gmail.com` |
| `EMAIL_PASS` | Gmail App Password | ✅ | `16-char password` |
| `TWILIO_ACCOUNT_SID` | Twilio Console | ✅ | `ACxxx` |
| `TWILIO_AUTH_TOKEN` | Twilio Console | ✅ | `auth token` |
| `TWILIO_VERIFY_SERVICE_SID` | Twilio Verify | ✅ | `VAxxx` |
| `TWILIO_PHONE_NUMBER` | Twilio Console | ✅ | `+1xxx` |
| `RESEND_API_KEY` | Resend.com | ❌ | `re_xxx` |
| `PORT` | Default | ❌ | `3000` |
| `NODE_ENV` | For Render | ❌ | `production` |

---

## 🎯 API Endpoints Available

### Order Endpoints
- `POST /api/order` - Create order with email & SMS notification
- `POST /api/order-status` - Update order status (sends email & SMS)
- `GET /api/orders` - List all orders

### SMS Endpoints
- `POST /api/sms/send-verification` - Send 2FA code
- `POST /api/sms/verify-code` - Verify 2FA code
- `POST /api/sms/send-message` - Send custom SMS message

### Shipment Endpoints
- `POST /api/shipments` - Create shipment
- `PUT /api/shipments/:trackingNumber/status` - Update shipment status (sends notifications)
- `GET /api/shipments` - List shipments

---

## ✨ Key Features Added

✅ **Automatic Email Sending**:
- Integrated Resend, Gmail SMTP, or custom SMTP
- Beautiful HTML emails with order details
- Background processing (non-blocking)

✅ **Automatic SMS Sending**:
- SMS sent when order is placed
- SMS sent when order status updates
- SMS sent when delivery confirmed
- Built on Twilio API

✅ **SMS Verification**:
- 2FA code sending via SMS
- Code verification endpoint
- Nigeria-friendly number formatting

✅ **Production Ready**:
- Error handling and logging
- Configuration checks on startup
- Environment variable validation
- Non-blocking background tasks

---

## 📞 Support

If emails/SMS not working:
1. Check Render logs: Dashboard → Service → Logs
2. Verify all credentials in Environment tab
3. Test endpoints using the provided test files
4. Check provider dashboards (Gmail, Twilio, Supabase)

---

**Last Updated**: March 2026
**Status**: Ready for Production Deployment
