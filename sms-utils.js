// SMS Utility Functions for Twilio Verify API
import twilio from 'twilio';
import dotenv from 'dotenv';

dotenv.config();

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_VERIFY_SERVICE_SID = process.env.TWILIO_VERIFY_SERVICE_SID;

// Initialize Twilio client
const twilioClient = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

/**
 * Send SMS verification code to a phone number
 * @param {string} phoneNumber - Phone number in E.164 format (e.g., +2348051877195)
 * @param {string} channel - Channel type: 'sms' or 'call' (default: 'sms')
 * @returns {Object} - { success: boolean, data: Object, error: string }
 */
export async function sendSmsVerification(phoneNumber, channel = 'sms') {
  try {
    // Validate phone number
    if (!phoneNumber) {
      throw new Error('Phone number is required');
    }

    // Format phone number if needed
    let formattedNumber = phoneNumber;
    if (!formattedNumber.startsWith('+')) {
      // Assume Nigerian number if no country code
      formattedNumber = `+234${formattedNumber.replace(/^0/, '')}`;
    }

    // Validate configuration
    if (!TWILIO_VERIFY_SERVICE_SID) {
      throw new Error('TWILIO_VERIFY_SERVICE_SID not configured in .env');
    }

    // Send verification code via Twilio Verify API
    const verification = await twilioClient.verify.v2
      .services(TWILIO_VERIFY_SERVICE_SID)
      .verifications.create({
        to: formattedNumber,
        channel: channel
      });

    console.log(`✓ SMS verification sent to ${formattedNumber}`, verification.sid);
    
    return {
      success: true,
      data: {
        sid: verification.sid,
        status: verification.status,
        phoneNumber: formattedNumber,
        channel: channel
      },
      error: null
    };
  } catch (error) {
    console.error('✗ Error sending SMS verification:', error.message);
    return {
      success: false,
      data: null,
      error: error.message
    };
  }
}

/**
 * Verify SMS code sent to user
 * @param {string} phoneNumber - Phone number in E.164 format
 * @param {string} code - Verification code entered by user
 * @returns {Object} - { success: boolean, data: Object, error: string }
 */
export async function verifySmsCode(phoneNumber, code) {
  try {
    // Validate inputs
    if (!phoneNumber || !code) {
      throw new Error('Phone number and verification code are required');
    }

    // Format phone number if needed
    let formattedNumber = phoneNumber;
    if (!formattedNumber.startsWith('+')) {
      formattedNumber = `+234${formattedNumber.replace(/^0/, '')}`;
    }

    // Validate configuration
    if (!TWILIO_VERIFY_SERVICE_SID) {
      throw new Error('TWILIO_VERIFY_SERVICE_SID not configured in .env');
    }

    // Verify the code via Twilio Verify API
    const verificationCheck = await twilioClient.verify.v2
      .services(TWILIO_VERIFY_SERVICE_SID)
      .verificationChecks.create({
        to: formattedNumber,
        code: code
      });

    if (verificationCheck.status === 'approved') {
      console.log(`✓ SMS code verified for ${formattedNumber}`);
      return {
        success: true,
        data: {
          status: 'approved',
          phoneNumber: formattedNumber,
          message: 'Code verified successfully'
        },
        error: null
      };
    } else {
      throw new Error(`Verification failed. Status: ${verificationCheck.status}`);
    }
  } catch (error) {
    console.error('✗ Error verifying SMS code:', error.message);
    return {
      success: false,
      data: null,
      error: error.message
    };
  }
}

/**
 * Send generic SMS message (requires Twilio Messaging Service)
 * @param {string} phoneNumber - Recipient phone number
 * @param {string} message - Message text to send
 * @returns {Object} - { success: boolean, data: Object, error: string }
 */
export async function sendSmsMessage(phoneNumber, message) {
  try {
    if (!phoneNumber || !message) {
      throw new Error('Phone number and message are required');
    }

    // Format phone number if needed
    let formattedNumber = phoneNumber;
    if (!formattedNumber.startsWith('+')) {
      formattedNumber = `+234${formattedNumber.replace(/^0/, '')}`;
    }

    const sms = await twilioClient.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: formattedNumber
    });

    console.log(`✓ SMS sent to ${formattedNumber}`, sms.sid);
    
    return {
      success: true,
      data: {
        sid: sms.sid,
        status: sms.status,
        phoneNumber: formattedNumber
      },
      error: null
    };
  } catch (error) {
    console.error('✗ Error sending SMS message:', error.message);
    return {
      success: false,
      data: null,
      error: error.message
    };
  }
}

export default {
  sendSmsVerification,
  verifySmsCode,
  sendSmsMessage
};
