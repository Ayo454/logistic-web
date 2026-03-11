// Example Usage: How to use SMS Verification Functions
// This file demonstrates all the ways you can use the Twilio SMS functions

// ============================================
// METHOD 1: Using the utility functions directly (Node.js)
// ============================================
import { sendSmsVerification, verifySmsCode, sendSmsMessage } from './sms-utils.js';

// Example 1: Send SMS verification code
async function example1() {
  console.log('Example 1: Sending SMS verification code...');
  
  const result = await sendSmsVerification('+2348051877195', 'sms');
  
  if (result.success) {
    console.log('✓ Verification code sent!');
    console.log('Verification SID:', result.data.sid);
    console.log('Status:', result.data.status);
  } else {
    console.log('✗ Failed:', result.error);
  }
}

// Example 2: Verify SMS code
async function example2() {
  console.log('Example 2: Verifying SMS code...');
  
  const result = await verifySmsCode('+2348051877195', '123456');
  
  if (result.success) {
    console.log('✓ Code verified successfully!');
  } else {
    console.log('✗ Verification failed:', result.error);
  }
}

// Example 3: Send custom SMS message
async function example3() {
  console.log('Example 3: Sending custom SMS message...');
  
  const result = await sendSmsMessage(
    '+2348051877195',
    'Hello! Your SwiftLogix order is on the way.'
  );
  
  if (result.success) {
    console.log('✓ SMS sent successfully!');
    console.log('Message SID:', result.data.sid);
  } else {
    console.log('✗ Failed to send SMS:', result.error);
  }
}

// ============================================
// METHOD 2: Using the API endpoints from frontend/client code
// ============================================

// Example: Using fetch from JavaScript/HTML
const sendVerificationExample = async (phoneNumber) => {
  try {
    const response = await fetch('/api/sms/send-verification', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        phoneNumber: phoneNumber,
        channel: 'sms'  // or 'call'
      })
    });

    const data = await response.json();
    if (data.ok) {
      console.log('✓ Verification code sent!');
      return data;
    } else {
      console.log('✗ Error:', data.message);
      return null;
    }
  } catch (error) {
    console.error('Request error:', error);
  }
};

// Verify the code submitted by user
const verifyCodeExample = async (phoneNumber, code) => {
  try {
    const response = await fetch('/api/sms/verify-code', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        phoneNumber: phoneNumber,
        code: code
      })
    });

    const data = await response.json();
    if (data.ok) {
      console.log('✓ Code verified!');
      return true;
    } else {
      console.log('✗ Invalid code:', data.message);
      return false;
    }
  } catch (error) {
    console.error('Request error:', error);
  }
};

// Send custom message
const sendMessageExample = async (phoneNumber, message) => {
  try {
    const response = await fetch('/api/sms/send-message', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        phoneNumber: phoneNumber,
        message: message
      })
    });

    const data = await response.json();
    if (data.ok) {
      console.log('✓ SMS sent!');
      return data;
    } else {
      console.log('✗ Error:', data.message);
      return null;
    }
  } catch (error) {
    console.error('Request error:', error);
  }
};

// ============================================
// Real-world usage example in a form
// ============================================

/**
 * Handle user signup/login with SMS verification
 * @param {string} phoneNumber - User phone number
 * @param {string} verificationCode - Code from user input (optional on first step)
 */
export async function handlePhoneVerification(phoneNumber, verificationCode = null) {
  // Step 1: Send verification code if not provided
  if (!verificationCode) {
    const result = await sendVerificationExample(phoneNumber);
    if (result) {
      // UI should prompt user to enter code
      return { step: 'waiting-for-code', message: 'Code sent! Enter it below.' };
    } else {
      return { step: 'error', message: 'Failed to send code' };
    }
  }
  
  // Step 2: Verify the code
  const isValid = await verifyCodeExample(phoneNumber, verificationCode);
  if (isValid) {
    return { step: 'verified', message: 'Phone verified!' };
  } else {
    return { step: 'error', message: 'Invalid code' };
  }
}

// Export examples for testing
export default {
  example1,
  example2,
  example3,
  sendVerificationExample,
  verifyCodeExample,
  sendMessageExample,
  handlePhoneVerification
};
