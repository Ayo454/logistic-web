# Email & SMS Notification Flow

## 📊 Complete Notification Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                     SWIFTLOGIX NOTIFICATION SYSTEM                  │
│                    (Email + SMS on Render)                          │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 1️⃣ USER REGISTRATION & WELCOME

```
User Registration
        ↓
POST /api/auth-event
        ↓
    Supabase Insert
        ↓
    ┌─────────────────────┐
    │  Send Welcome Email │
    │  Non-blocking async │
    └─────────────────────┘
        ↓
   Gmail/SMTP → User Email
   "Your account has been created"

NOTE: SMS not sent on registration (user phone not yet verified)
```

---

## 2️⃣ ORDER PLACEMENT WITH CONFIRMATION

```
User Places Order
        ↓
POST /api/order
        ↓
   ┌──────────────────┐
   │  Check User      │──→ Must be registered
   │  Registered      │
   └──────────────────┘
        ↓
   ┌──────────────────────────┐
   │  Save Order to Supabase  │
   │  Generate Tracking ID    │
   └──────────────────────────┘
        ↓
        │
        ├──→ ┌─────────────────────────┐
        │    │ Send Order Email        │
        │    │ To: User Email          │
        │    │ Content: Order Details  │
        │    └─────────────────────────┘
        │            ↓
        │    Gmail/SMTP/Resend
        │
        ├──→ ┌──────────────────────────┐
        │    │ Send Receiver Code Email │ (if receiver email provided)
        │    │ To: Receiver Email       │
        │    │ Content: Verification   │
        │    └──────────────────────────┘
        │         ↓
        │    Gmail/SMTP/Resend
        │
        └──→ ┌──────────────────────────┐ ✨ NEW
             │ Send Order SMS           │
             │ To: User Phone Number    │
             │ Content: Tracking ID     │
             └──────────────────────────┘
                      ↓
                   Twilio SMS
                   Message: "Hi, your [service] order received.
                             Tracking: [ID]. Follow at tracking page."

Response to User: 
✅ Order created with tracking ID
✅ Check email and SMS for confirmation
```

---

## 3️⃣ ORDER STATUS UPDATE

```
Admin Updates Order Status
        ↓
POST /api/order-status
        ↓
Supabase: Update status
        ↓
        │
        ├──→ ┌───────────────────────────┐
        │    │ Send Status Update Email  │
        │    │ To: User Email            │
        │    │ Status: [New Status]      │
        │    └───────────────────────────┘
        │            ↓
        │    Gmail/SMTP/Resend
        │
        └──→ ┌───────────────────────────┐ ✨ NEW
             │ Send Status Update SMS    │
             │ To: User Phone            │
             │ Content: New Status       │
             └───────────────────────────┘
                      ↓
                   Twilio SMS
                   Message: "Your [tracking#] is now: [status]"

Example Statuses:
• Pending → "Your order is being reviewed"
• Confirmed → "Your order has been confirmed"
• In Transit → "Your package is on its way"
• Delivered → "Your package has been delivered!"
```

---

## 4️⃣ SHIPMENT STATUS UPDATE

```
Admin Updates Shipment Status
        ↓
PUT /api/shipments/:trackingNumber/status
        ↓
Supabase: Update status
        ↓
        │
        ├──→ [If Status = 'delivered']
        │    ├──→ ┌──────────────────────────┐
        │    │    │ Send Delivery Email      │
        │    │    │ To: User Email           │
        │    │    └──────────────────────────┘
        │    │             ↓
        │    │        Gmail/SMTP/Resend
        │    │
        │    └──→ ┌──────────────────────────┐ ✨ NEW
        │         │ Send Delivery SMS        │
        │         │ To: Sender Phone         │
        │         └──────────────────────────┘
        │                  ↓
        │             Twilio SMS
        │             Message: "Package delivered!
        │                       Tracking: [ID]"
        │
        └──→ [Other Statuses]
             No additional notifications
             (Email/SMS handled by /api/order-status)
```

---

## 5️⃣ SMS VERIFICATION (2FA) - EXISTING

```
User Requests Phone Verification
        ↓
POST /api/sms/send-verification
        ↓
Twilio: Send OTP Code via SMS
        ↓
User receives 6-digit code on phone
        ↓
User enters code
        ↓
POST /api/sms/verify-code
        ↓
Twilio: Verify code
        ↓
✅ Phone number verified (or ❌ Invalid code)
```

---

## 📱 SMS MESSAGE FORMATS

### Order Confirmation SMS
```
Hi, your [Express/Standard] order has been received. 
Tracking ID: [SLX-XXXX-XXXX]. 
Follow delivery at our tracking page. 
-SwiftLogix
```

### Status Update SMS
```
Your SwiftLogix order ([TRACKING_ID]) status is now: [Confirmed/In Transit/Delivered].
Tracking ID: [TRACKING_ID]. 
-SwiftLogix
```

### Delivery SMS
```
Your package has been delivered! 
Tracking: [TRACKING_ID]. 
Thank you for choosing SwiftLogix! 
-SwiftLogix
```

---

## 📧 EMAIL FORMATS

### Welcome Email
- **To**: User email
- **Subject**: Welcome to SwiftLogix
- **Content**: Account created, ready to place orders

### Order Confirmation Email
- **To**: User email
- **Subject**: We received your order
- **Content**: Route, delivery speed, estimated price, tracking ID

### Receiver Code Email
- **To**: Receiver email (if provided)
- **Subject**: SwiftLogix delivery code
- **Content**: 6-digit code for rider verification

### Status Update Email
- **To**: User email
- **Subject**: Your order status updated
- **Content**: New status, route, tracking details

### Delivery Notification Email
- **To**: User email
- **Subject**: Your Package Has Been Delivered
- **Content**: Delivery confirmation, tracking info

---

## 🔧 Configuration Matrix

| Provider | Use Case | Configuration |
|----------|----------|----------------|
| Gmail | Production Email | EMAIL_USER + EMAIL_PASS |
| Custom SMTP | Enterprise Email | SMTP_HOST + SMTP_USER + SMTP_PASS |
| Resend | Alternative Email | RESEND_API_KEY |
| Twilio | SMS + 2FA | TWILIO_ACCOUNT_SID/TOKEN/SID/PHONE |

**Priority**: Resend > Custom SMTP > Gmail

---

## 🚀 Non-Blocking Behavior

All notifications are sent **asynchronously**:

```javascript
// Emails and SMS don't block API response
sendEmailAsync(sendOrderEmail, order);  // Sent in background
sendEmailAsync(sendOrderSms, order);    // Sent in background
return res.json({ ok: true });          // Response sent immediately
```

**Benefits**:
- ✅ Fast API response (not waiting for email/SMS)
- ✅ User gets immediate feedback
- ✅ Even if email fails, order still processed
- ✅ Better user experience

---

## 🔍 Monitoring & Logs

Watch server logs for:

```
=== STARTUP ===
✓ Supabase client initialised
✓ Resend client initialised (or SMTP mailer)
✓ Twilio client initialized

=== DURING OPERATION ===
✅ Order email sent via [SMTP/Resend]: [message ID]
✅ Order SMS sent to +234XXXXXXXXXX: [SID]
✅ Status update SMS sent to +234XXXXXXXXXX: [SID]
✅ Delivery notification sent via [SMTP/Resend]: [message ID]
✅ Delivery SMS sent to +234XXXXXXXXXX: [SID]

❌ EMAIL CLIENT NOT CONFIGURED (if email fails)
❌ Error sending SMS (if Twilio fails)
```

---

## ✅ Deployment Checklist

Before deploying to Render:

- [ ] All environment variables configured in Render dashboard
- [ ] TWILIO_AUTH_TOKEN is real (not placeholder)
- [ ] TWILIO_PHONE_NUMBER is valid Twilio number
- [ ] Gmail app password generated (not regular password)
- [ ] Supabase credentials verified
- [ ] Test email sending locally
- [ ] Test SMS sending locally
- [ ] Deploy to Render
- [ ] Monitor logs for startup messages
- [ ] Test in production (register → check email/SMS)

---

## 🎯 Success Indicators

When everything works:

✅ **Email Flow**:
- User receives welcome email on registration
- User receives order confirmation email
- User receives status update emails
- User receives delivery email

✅ **SMS Flow**:
- User receives order SMS (text message)
- User receives status update SMS
- User receives delivery SMS
- 2FA SMS verification works

✅ **Logs Show**:
- `✓ SMTP mailer initialised` or `✓ Resend client initialised`
- `✓ Twilio client initialized`
- `✅ Order email sent...`
- `✅ Order SMS sent to...`

---

## 🆘 Quick Troubleshooting

| Issue | Check |
|-------|-------|
| No emails | EMAIL_USER/PASS or RESEND_KEY in Render? |
| No SMS | TWILIO vars set? Auth token real? Has credits? |
| Slow response | Normal (async processing in background) |
| User complains about email | Check spam folder, email provider limits |
| User complains about SMS | Check phone format, Twilio country support |

---

**Last Updated**: March 2026  
**Version**: 2.0 (with SMS notifications)  
**Status**: ✅ Production Ready
