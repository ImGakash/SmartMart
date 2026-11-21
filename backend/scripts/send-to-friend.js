const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { Resend } = require('resend');

// Line 6: CHANGE THIS to your friend's actual email address (e.g., 'yourfriend@gmail.com')
const TO_EMAIL = 'delivered@resend.dev';

const resend = new Resend(process.env.RESEND_API_KEY);
const fromEmail = process.env.NOTIFICATION_FROM_EMAIL || 'onboarding@resend.dev';

const htmlBody = `
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
    <h2 style="color: #2b6cb0;">Thank You for Shopping with SmartMart! 🎉</h2>
    <p>Your order has been confirmed.</p>
    <div style="background-color: #f7fafc; padding: 15px; border-radius: 6px; margin: 20px 0;">
      <p style="margin: 4px 0;"><strong>Order Number:</strong> SM-TEST-001</p>
      <p style="margin: 4px 0;"><strong>Items (2):</strong></p>
      <ul style="margin: 5px 0 10px 20px; padding: 0;">
        <li>boAt Airdopes 141 (Qty: 2) - ₹2,598.00</li>
      </ul>
      <p style="margin: 4px 0; font-size: 16px;"><strong>Total Amount:</strong> ₹2,598.00</p>
    </div>
    <hr style="border: none; border-top: 1px solid #edf2f7; margin: 20px 0;" />
    <p style="color: #718096; font-size: 12px; text-align: center;">
      This email was generated as a verification test for the SmartMart Kafka event pipeline demo.
    </p>
  </div>
`;

async function sendTestEmail() {
  console.log(`Sending test email to: ${TO_EMAIL} from: ${fromEmail}...`);
  try {
    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to: TO_EMAIL,
      subject: 'SmartMart Order Confirmation - Test Email 🎉',
      html: htmlBody
    });

    if (error) {
      console.error('❌ Resend API Error:', error);
      return;
    }

    console.log(`✅ Success! Resend Message ID: ${data.id}`);
    console.log('📌 Delivery status check: https://resend.com/emails');
  } catch (err) {
    console.error('❌ Network / Execution Error:', err.message);
  }
}

sendTestEmail();
