# Render Environment Variables - Copy/Paste Ready

## 📋 Credentials Needed From Each Service

Before copying below, gather:

### From Supabase (https://app.supabase.com)
- [ ] Project URL → SUPABASE_URL
- [ ] Anon Key → SUPABASE_KEY

### From Gmail Account
- [ ] Email address → EMAIL_USER
- [ ] App Password (16-char) → EMAIL_PASS

### From Twilio (https://www.twilio.com/console)
- [ ] Account SID → TWILIO_ACCOUNT_SID  
- [ ] Auth Token → TWILIO_AUTH_TOKEN
- [ ] Twilio Phone Number → TWILIO_PHONE_NUMBER
- [ ] Verify Service SID → TWILIO_VERIFY_SERVICE_SID

---

## 🚀 Copy These to Render Dashboard

### Step 1: In Render Dashboard
1. Go to your `swiftlogix-logistics` service
2. Click **Settings**
3. Scroll to **Environment Variables**
4. Click **Add Environment Variable**

### Step 2: Add Each Variable

Copy and paste each line into Render (replace YOUR_VALUE):

```
NODE_ENV
production

PORT
3000

EMAIL_FROM
SwiftLogix <no-reply@swiftlogix.com>

SUPABASE_URL
YOUR_VALUE

SUPABASE_KEY
YOUR_VALUE

EMAIL_USER
YOUR_VALUE

EMAIL_PASS
YOUR_VALUE

TWILIO_ACCOUNT_SID
YOUR_VALUE

TWILIO_AUTH_TOKEN
YOUR_VALUE

TWILIO_VERIFY_SERVICE_SID
YOUR_VALUE

TWILIO_PHONE_NUMBER
YOUR_VALUE

RESEND_API_KEY
YOUR_VALUE (optional - only if using Resend instead of Gmail)
```

---

## 🔍 Finding Each Credential

### SUPABASE_URL
1. Go to https://app.supabase.com
2. Click your project
3. Settings → API
4. Copy "Project URL"
- **Format**: `https://xxxxx.supabase.co`

### SUPABASE_KEY  
1. Same as above
2. Copy "anon public" key (not service_role!)
- **Format**: `eyJhbGciOiJIUzI1Ni...` (long string)

### EMAIL_USER
- Your Gmail address
- **Format**: `your.email@gmail.com`

### EMAIL_PASS
1. Go to https://myaccount.google.com/security
2. Search "App passwords"
3. Select Mail and Windows Computer
4. Google generates 16-character password
5. **Format**: `abcd efgh ijkl mnop` (4 groups of 4)

### TWILIO_ACCOUNT_SID
1. Go to https://www.twilio.com/console
2. Look at "Account Info" section
3. Copy "Account SID"
4. **Format**: `ACxxxxxxxxxxxxxxxxxxx`

### TWILIO_AUTH_TOKEN
1. Same as account SID location
2. Copy "Auth Token"
3. **Format**: `Long alphanumeric string`
4. ⚠️ Keep this secret!

### TWILIO_PHONE_NUMBER
1. Go to https://www.twilio.com/console/phone-numbers/incoming
2. Click your active phone number
3. Copy the phone number
4. **Format**: `+1234567890` (must start with +)

### TWILIO_VERIFY_SERVICE_SID
1. Go to https://www.twilio.com/console/verify/services
2. Create new service if needed
3. Copy "Service SID"
4. **Format**: `VAxxxxxxxxxxxxxxxxxxx`

### RESEND_API_KEY (Optional)
1. Go to https://resend.com
2. Get your API key
3. **Format**: `re_xxxxxxxxxxxxxxxxxxxxx`
4. Only needed if NOT using Gmail

---

## ✅ Final Checklist

- [ ] All 4 Supabase/Gmail values obtained
- [ ] All 4 Twilio values obtained
- [ ] No values contain YOUR_VALUE placeholder
- [ ] Phone number starts with +
- [ ] All values copied correctly
- [ ] Ready to paste into Render

---

## 🚀 After Pasting in Render

1. Click **"Deploy"** to redeploy with new variables
2. Go to **Logs** tab
3. Watch for:
   ```
   ✓ Supabase client initialised
   ✓ SMTP mailer initialised (Gmail)
   ✓ Twilio client initialized
   ```
4. If you see these, everything is configured!

---

## 🆘 Troubleshooting

### Issue: "Email mailer not configured"
- Check EMAIL_USER and EMAIL_PASS in Render
- Verify it's an app password, not regular password
- Check Gmail account for security alerts

### Issue: "Twilio not configured"
- Check all 4 Twilio variables are set
- Verify Auth Token is correct (not placeholder)
- Check Twilio account has SMS credits

### Issue: "Supabase not configured"
- Check URL and KEY match your project
- Verify you used anon key, not service_role
- Check project isn't deleted/paused

---

## 📝 Quick Copy Template

Use this to organize your credentials:

```
SUPABASE_URL=
SUPABASE_KEY=
EMAIL_USER=
EMAIL_PASS=
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_VERIFY_SERVICE_SID=
TWILIO_PHONE_NUMBER=
```

Print this and fill in as you gather credentials!

---

**Last Updated**: March 2026  
**Ready for**: Render Deployment
