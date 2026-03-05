# SwiftLogix Logistics Notifications Setup

## Overview

The notification system fetches logistics notifications from Supabase and displays them in the user menu panel. When a user clicks "Notifications" in the menu, a panel slides in showing all unread notifications for that user.

## How It Works

1. **User clicks "Notifications"** in the user menu (the dropdown from the avatar icon)
2. **Script fetches from `/api/notifications`** - Gets all notifications from Supabase
3. **Filters by email** - Only shows notifications for the logged-in user
4. **Displays in a panel** - Shows notification title, body, date, and type badge

## Database Structure

Notifications are stored in Supabase table `logistics_notifications` with these fields:
- `id` - Auto-incrementing ID
- `title` - Notification title
- `body` - Notification message
- `type` - Badge type: 'info', 'success', 'warning', 'error'
- `status` - 'unread' or 'read'
- `user_email` - User's email (used to filter notifications)
- `link_url` - Optional link for "View Details →" button
- `created_at` - Timestamp

## Creating Test Notifications

### Method 1: Using the Test Script (Easiest)

```bash
# Make sure the server is running
npm start

# In another terminal, run:
node test-notification.js
```

This creates 4 sample notifications for testing.

### Method 2: curl Command

```bash
curl -X POST http://localhost:3000/api/notifications \
# note: server expects `message` (or legacy `body`) field for the notification text
  -H "Content-Type: application/json" \
  -d '{
    "title": "Your Order is Here",
    "body": "Your package has arrived at the destination.",
    "type": "success",
    "user_email": "your-email@example.com",
    "link_url": "/logistics/track.html"
  }'
```

### Method 3: JavaScript/Fetch

```javascript
fetch('http://localhost:3000/api/notifications', {
  // payload should include `message` (not `body`)
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    title: 'Shipment Update',
    body: 'Your shipment is in transit.',
    type: 'info',
    user_email: 'user@example.com',
    link_url: '/logistics/track.html'
  })
})
.then(r => r.json())
.then(data => console.log('Created:', data.notification));
```

## Notification Types

The badge displays different colors based on the `type`:
- `info` - Blue badge
- `success` - Green badge
- `warning` - Orange badge  
- `error` - Red badge

## API Endpoints

### GET /api/notifications
Fetches all notifications from Supabase

**Response:**
```json
{
  "notifications": [
    {
      "id": 1,
      "title": "Package Picked Up",
      "body": "Your package has been picked up",
      "type": "success",
      "user_email": "user@example.com",
      "created_at": "2026-03-05T10:30:00Z"
    }
  ]
}
```

### POST /api/notifications
Creates a new notification in Supabase

**Request Body:**
```json
{
  "title": "Required - Notification title",
  "body": "Required - Notification message",
  "type": "Optional - info, success, warning, error (default: info)",
  "user_email": "Required - Target user email",
  "link_url": "Optional - Link for View Details button"
}
```

**Response:**
```json
{
  "ok": true,
  "notification": {
    "id": 1,
    "title": "...",
    "body": "...",
    "type": "success",
    "user_email": "user@example.com",
    "created_at": "2026-03-05T10:30:00Z"
  }
}
```

## Testing the Notifications Panel

1. **Start the server**: `npm start`
2. **Go to logistics page**: http://localhost:3000/logistics/
3. **Login/Register** with your test email
4. **Create notifications** using one of the methods above (use the same email)
5. **Click the avatar icon** dropdown menu
6. **Click "Notifications"** to see the panel
7. **Notifications for your email** will appear in the panel

## Troubleshooting

### Notifications not showing?
- Make sure you're logged in with the correct email
- Verify the `user_email` matches your logged-in email
- Check browser console for errors (F12 → Console)
- Server might not be running - check `npm start`

### "Could not fetch notifications" warning?
- Main server on port 3000 might not be running
- Run `npm start` in the root folder (not in logistics/)

### No notifications in Supabase?
- Make sure you used POST endpoint to create notifications first
- Check Supabase dashboard to verify table exists and has data

## Files Involved

- `logistics/script.js` - `fetchNotificationsForUser()` function
- `server.js` - API endpoints for notifications
- `test-notification.js` - Test script to create sample data
- Supabase table: `logistics_notifications`
