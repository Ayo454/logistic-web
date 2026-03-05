// Test script to create sample notifications for testing the logistics notification panel

const API_URL = 'http://localhost:3000/api/notifications';

// Sample notifications to create
const sampleNotifications = [
  {
    title: 'Package Picked Up',
    message: 'Your express delivery package has been picked up and is on the way.',
    type: 'success',
    user_email: 'test@example.com',
    link_url: '/logistics/track.html'
  },
  {
    title: 'Delivery Scheduled',
    message: 'Your shipment is scheduled for delivery today between 2-4 PM.',
    type: 'info',
    user_email: 'test@example.com',
    link_url: '/logistics/track.html'
  },
  {
    title: 'Out for Delivery',
    message: 'Your package is out for delivery. Track its current location.',
    type: 'warning',
    user_email: 'test@example.com',
    link_url: '/logistics/track.html'
  },
  {
    title: 'Delivered',
    message: 'Your package has been successfully delivered!',
    type: 'success',
    user_email: 'test@example.com',
    link_url: '/logistics/track.html'
  }
];

async function createNotifications() {
  console.log('Creating sample notifications...\n');

  for (const notif of sampleNotifications) {
    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(notif)
      });

      const data = await response.json();

      if (response.ok) {
        console.log(`✓ Created: ${notif.title}`);
      } else {
        console.error(`✗ Failed to create "${notif.title}":`, data.message);
      }
    } catch (err) {
      console.error(`✗ Error creating "${notif.title}":`, err.message);
    }
  }

  console.log('\n✓ Done! Notifications created.');
  console.log('\nNote: Update the "user_email" field if you want to test with a different email address.');
  console.log('The logged-in user will only see notifications for their email address.');
}

createNotifications();
