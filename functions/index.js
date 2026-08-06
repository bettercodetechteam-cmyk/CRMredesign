const functions = require('firebase-functions');
const admin = require('firebase-admin');
const cors = require('cors')({ origin: true });
const nodemailer = require('nodemailer');

// Initialize Firebase Admin
admin.initializeApp();

const db = admin.firestore();

// Email configuration
const transporter = nodemailer.createTransporter({
  service: 'gmail',
  auth: {
    user: functions.config().email?.user || 'your-email@gmail.com',
    pass: functions.config().email?.password || 'your-app-password'
  }
});

// SMS Service Providers
class SMSService {
  constructor() {
    this.twilio = null;
    this.awsSNS = null;
    
    // Initialize Twilio if credentials are available
    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
      this.twilio = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    }
    
    // Initialize AWS SNS if credentials are available
    if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
      const AWS = require('aws-sdk');
      this.awsSNS = new AWS.SNS({
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        region: process.env.AWS_REGION || 'us-east-1'
      });
    }
  }

  // Send SMS via Twilio
  async sendViaTwilio(phoneNumber, message) {
    if (!this.twilio) {
      throw new Error('Twilio not configured');
    }

    const twilioMessage = await this.twilio.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: phoneNumber
    });

    return {
      success: true,
      provider: 'twilio',
      messageId: twilioMessage.sid,
      status: twilioMessage.status
    };
  }

  // Send SMS via AWS SNS
  async sendViaAWSSNS(phoneNumber, message) {
    if (!this.awsSNS) {
      throw new Error('AWS SNS not configured');
    }

    const params = {
      Message: message,
      PhoneNumber: phoneNumber
    };

    const result = await this.awsSNS.publish(params).promise();
    
    return {
      success: true,
      provider: 'aws_sns',
      messageId: result.MessageId
    };
  }

  // Send SMS via MSG91 (Indian SMS service) - FREE VERSION
  async sendViaMSG91(phoneNumber, message, studentName) {
    if (!process.env.MSG91_API_KEY) {
      throw new Error('MSG91 not configured');
    }

    const axios = require('axios');
    
    // Remove +91 prefix for MSG91
    const mobileNumber = phoneNumber.replace('+91', '');
    
    // Use the free API endpoint
    const url = 'https://api.msg91.com/api/v5/flow/';
    
    const payload = {
      flow_id: process.env.MSG91_FLOW_ID || 'your_flow_id',
      sender: process.env.MSG91_SENDER_ID || 'ZICAZM',
      mobiles: mobileNumber,
      VAR1: studentName || 'Student',
      VAR2: message.substring(0, 160) // Limit to 160 characters for free tier
    };

    try {
      const response = await axios.post(url, payload, {
        headers: {
          'Content-Type': 'application/json',
          'Authkey': process.env.MSG91_API_KEY
        },
        timeout: 10000 // 10 second timeout
      });

      console.log('MSG91 Response:', response.data);

      if (response.data.type === 'success') {
        return {
          success: true,
          provider: 'msg91_free',
          messageId: response.data.request_id || `msg91_${Date.now()}`,
          cost: 'FREE'
        };
      } else {
        throw new Error(`MSG91 error: ${response.data.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('MSG91 API Error:', error.response?.data || error.message);
      
      // Handle specific MSG91 errors
      if (error.response?.data?.message) {
        throw new Error(`MSG91: ${error.response.data.message}`);
      }
      
      throw new Error(`MSG91 API failed: ${error.message}`);
    }
  }

  // Send SMS via Firebase Phone Auth (for testing)
  async sendViaFirebasePhoneAuth(phoneNumber, message) {
    // This is a fallback method that logs the SMS for testing
    console.log(`ðŸ“± FIREBASE SMS LOG: ${phoneNumber}`);
    console.log(`Message: ${message}`);
    console.log(`Timestamp: ${new Date().toISOString()}`);
    
    // For testing purposes, always return success
    return {
      success: true,
      provider: 'firebase_test',
      messageId: `test_${Date.now()}`
    };
  }

  // Send WhatsApp via Bettercode (Primary method for fee reminders)
  async sendViaBettercodeWhatsApp(phoneNumber, message, studentName) {
    if (!process.env.BETTERCODE_API_KEY) {
      throw new Error('Bettercode not configured');
    }

    const axios = require('axios');
    
    // Format phone number for WhatsApp (remove +91 if present)
    const formattedPhone = phoneNumber.replace('+91', '');
    
    // Bettercode WhatsApp API endpoint
    const url = 'https://api.bettercode.com/v1/whatsapp/send';
    
    const payload = {
      phone: formattedPhone,
      message: message,
      template_name: 'fee_reminder', // Optional: use template if available
      variables: {
        student_name: studentName || 'Student',
        institute_name: 'ZICA ZIMA'
      }
    };

    try {
      const response = await axios.post(url, payload, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.BETTERCODE_API_KEY}`,
          'X-API-Key': process.env.BETTERCODE_API_KEY
        },
        timeout: 15000 // 15 second timeout
      });

      console.log('Bettercode WhatsApp Response:', response.data);

      if (response.data.success || response.data.status === 'success') {
        return {
          success: true,
          provider: 'bettercode_whatsapp',
          messageId: response.data.message_id || `whatsapp_${Date.now()}`,
          cost: 'FREE',
          channel: 'whatsapp'
        };
      } else {
        throw new Error(`Bettercode WhatsApp error: ${response.data.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Bettercode WhatsApp API Error:', error.response?.data || error.message);
      
      // Handle specific Bettercode errors
      if (error.response?.data?.message) {
        throw new Error(`Bettercode WhatsApp: ${error.response.data.message}`);
      }
      
      throw new Error(`Bettercode WhatsApp API failed: ${error.message}`);
    }
  }

  // Send SMS via Bettercode (Fallback method)
  async sendViaBettercodeSMS(phoneNumber, message, studentName) {
    if (!process.env.BETTERCODE_API_KEY) {
      throw new Error('Bettercode not configured');
    }

    const axios = require('axios');
    
    // Format phone number for SMS
    const formattedPhone = phoneNumber.replace('+91', '');
    
    // Bettercode SMS API endpoint
    const url = 'https://api.bettercode.com/v1/sms/send';
    
    const payload = {
      phone: formattedPhone,
      message: message,
      sender_id: process.env.BETTERCODE_SENDER_ID || 'ZICAZM'
    };

    try {
      const response = await axios.post(url, payload, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.BETTERCODE_API_KEY}`,
          'X-API-Key': process.env.BETTERCODE_API_KEY
        },
        timeout: 10000
      });

      console.log('Bettercode SMS Response:', response.data);

      if (response.data.success || response.data.status === 'success') {
        return {
          success: true,
          provider: 'bettercode_sms',
          messageId: response.data.message_id || `sms_${Date.now()}`,
          cost: 'LOW',
          channel: 'sms'
        };
      } else {
        throw new Error(`Bettercode SMS error: ${response.data.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Bettercode SMS API Error:', error.response?.data || error.message);
      
      if (error.response?.data?.message) {
        throw new Error(`Bettercode SMS: ${error.response.data.message}`);
      }
      
      throw new Error(`Bettercode SMS API failed: ${error.message}`);
    }
  }

  // Main messaging method with WhatsApp priority
  async sendSMS(phoneNumber, message, studentName = 'Student') {
    const errors = [];
    
    // Try Bettercode WhatsApp first (primary method for fee reminders)
    try {
      return await this.sendViaBettercodeWhatsApp(phoneNumber, message, studentName);
    } catch (error) {
      errors.push(`Bettercode WhatsApp: ${error.message}`);
    }

    // Try Bettercode SMS as fallback
    try {
      return await this.sendViaBettercodeSMS(phoneNumber, message, studentName);
    } catch (error) {
      errors.push(`Bettercode SMS: ${error.message}`);
    }

    // Try Twilio as backup
    try {
      return await this.sendViaTwilio(phoneNumber, message);
    } catch (error) {
      errors.push(`Twilio: ${error.message}`);
    }

    // Try AWS SNS as backup
    try {
      return await this.sendViaAWSSNS(phoneNumber, message);
    } catch (error) {
      errors.push(`AWS SNS: ${error.message}`);
    }

    // Try MSG91 as backup
    try {
      return await this.sendViaMSG91(phoneNumber, message, studentName);
    } catch (error) {
      errors.push(`MSG91: ${error.message}`);
    }

    // Fallback to Firebase test mode
    try {
      return await this.sendViaFirebasePhoneAuth(phoneNumber, message);
    } catch (error) {
      errors.push(`Firebase Test: ${error.message}`);
    }

    // If all methods fail
    throw new Error(`All messaging providers failed: ${errors.join('; ')}`);
  }
}

// Initialize SMS service
const smsService = new SMSService();

// Cloud Function: Send SMS
exports.sendSMS = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    try {
      // Validate request method
      if (req.method !== 'POST') {
        return res.status(405).json({
          success: false,
          message: 'Method not allowed. Use POST.'
        });
      }

      const { phoneNumber, message, studentName } = req.body;

      // Validate required fields
      if (!phoneNumber || !message) {
        return res.status(400).json({
          success: false,
          message: 'Phone number and message are required'
        });
      }

      // Ensure inputs from req.body are strings before calling string methods
      // (prevents crashes if a non-string type is sent by a client)
      const phoneNumberStr = String(phoneNumber);
      const messageStr = String(message);
      const studentNameStr = studentName ? String(studentName) : 'Unknown';

      // Validate phone number format
      const phoneRegex = /^(\+91|91)?[6-9]\d{9}$/;
      if (!phoneRegex.test(phoneNumberStr.replace(/\s+/g, ''))) {
        return res.status(400).json({
          success: false,
          message: 'Invalid phone number format. Please use a valid Indian mobile number.'
        });
      }

      // Format phone number
      let formattedPhone = phoneNumberStr.replace(/[^\d+]/g, '');
      if (formattedPhone.startsWith('91') && formattedPhone.length === 12) {
        formattedPhone = '+' + formattedPhone;
      }
      if (formattedPhone.length === 10 && !formattedPhone.startsWith('+')) {
        formattedPhone = '+91' + formattedPhone;
      }

      // Store SMS record in Firestore
      const smsRecord = {
        phoneNumber: formattedPhone,
        message: messageStr,
        studentName: studentNameStr,
        status: 'pending',
        sentAt: admin.firestore.FieldValue.serverTimestamp(),
        attempts: 0,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      };

      const smsRef = await db.collection('smsMessages').add(smsRecord);

      // Send SMS
      const result = await smsService.sendSMS(formattedPhone, messageStr, studentNameStr);

      // Update SMS record with result
      await smsRef.update({
        status: result.success ? 'sent' : 'failed',
        sentAt: admin.firestore.FieldValue.serverTimestamp(),
        attempts: 1,
        provider: result.provider,
        messageId: result.messageId,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // Create notification
      await db.collection('notifications').add({
        userId: 'system',
        type: 'sms_notification',
        title: result.success ? 'SMS Sent Successfully' : 'SMS Failed',
        message: result.success 
          ? `SMS sent to ${studentNameStr} (${formattedPhone}) via ${result.provider}`
          : `Failed to send SMS to ${studentNameStr} (${formattedPhone})`,
        phoneNumber: formattedPhone,
        studentName: studentNameStr,
        status: result.success ? 'sent' : 'failed',
        provider: result.provider,
        sentAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // Return success response
      res.json({
        success: result.success,
        message: result.success ? 'SMS sent successfully' : 'SMS failed',
        provider: result.provider,
        messageId: result.messageId,
        smsId: smsRef.id
      });

    } catch (error) {
      console.error('SMS Function Error:', error);
      
      res.status(500).json({
        success: false,
        message: 'Failed to send SMS',
        error: error.message
      });
    }
  });
});

// Cloud Function: Get SMS Status
exports.getSMSStatus = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    try {
      const { smsId } = req.query;

      if (!smsId) {
        return res.status(400).json({
          success: false,
          message: 'SMS ID is required'
        });
      }

      const smsDoc = await db.collection('smsMessages').doc(smsId).get();

      if (!smsDoc.exists) {
        return res.status(404).json({
          success: false,
          message: 'SMS record not found'
        });
      }

      const smsData = smsDoc.data();

      res.json({
        success: true,
        sms: {
          id: smsDoc.id,
          ...smsData,
          sentAt: smsData.sentAt?.toDate(),
          createdAt: smsData.createdAt?.toDate(),
          updatedAt: smsData.updatedAt?.toDate()
        }
      });

    } catch (error) {
      console.error('Get SMS Status Error:', error);
      
      res.status(500).json({
        success: false,
        message: 'Failed to get SMS status',
        error: error.message
      });
    }
  });
});

// Cloud Function: Get SMS Statistics
exports.getSMSStats = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    try {
      const { period = '7d' } = req.query;

      const now = new Date();
      let startDate = new Date();

      switch (period) {
        case '1d':
          startDate.setDate(now.getDate() - 1);
          break;
        case '7d':
          startDate.setDate(now.getDate() - 7);
          break;
        case '30d':
          startDate.setDate(now.getDate() - 30);
          break;
        case '90d':
          startDate.setDate(now.getDate() - 90);
          break;
        default:
          startDate.setDate(now.getDate() - 7);
      }

      const snapshot = await db.collection('smsMessages')
        .where('createdAt', '>=', startDate)
        .get();

      const stats = {
        total: snapshot.size,
        sent: 0,
        failed: 0,
        pending: 0,
      };

      snapshot.docs.forEach((docSnap) => {
        const status = docSnap.data().status;
        if (status === 'sent') stats.sent += 1;
        else if (status === 'failed') stats.failed += 1;
        else stats.pending += 1;
      });

      res.json({
        success: true,
        period,
        stats,
      });
    } catch (error) {
      console.error('Get SMS Stats Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get SMS statistics',
        error: error.message,
      });
    }
  });
});

// Cloud Function: Retry SMS
exports.retrySMS = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    try {
      const { smsId } = req.body;

      if (!smsId) {
        return res.status(400).json({
          success: false,
          message: 'SMS ID is required',
        });
      }

      const smsDoc = await db.collection('smsMessages').doc(smsId).get();

      if (!smsDoc.exists) {
        return res.status(404).json({
          success: false,
          message: 'SMS record not found',
        });
      }

      const smsData = smsDoc.data();

      const result = await smsService.sendSMS(
        smsData.phoneNumber,
        smsData.message,
        smsData.studentName
      );

      await smsDoc.ref.update({
        status: result.success ? 'sent' : 'failed',
        sentAt: admin.firestore.FieldValue.serverTimestamp(),
        attempts: (smsData.attempts || 0) + 1,
        provider: result.provider,
        messageId: result.messageId,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      res.json({
        success: result.success,
        message: result.success ? 'SMS retry successful' : 'SMS retry failed',
        provider: result.provider,
        messageId: result.messageId,
      });
    } catch (error) {
      console.error('Retry SMS Error:', error);

      res.status(500).json({
        success: false,
        message: 'Failed to retry SMS',
        error: error.message,
      });
    }
  });
});


// Cloud Function: Check Reminder Notifications
exports.checkReminderNotifications = functions.pubsub.schedule('every 5 minutes').onRun(async (context) => {
  try {
    const now = new Date();
    const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);
    
    // Get all pending reminders that are due within the next 5 minutes
    const remindersSnapshot = await db.collection('reminders')
      .where('status', '==', 'pending')
      .where('reminderDate', '<=', fiveMinutesFromNow)
      .get();

    const notifications = [];

    for (const doc of remindersSnapshot.docs) {
      const reminder = doc.data();
      const reminderDateTime = new Date(reminder.reminderDate.toDate());
      const timeDiff = reminderDateTime.getTime() - now.getTime();
      const minutesDiff = Math.floor(timeDiff / (1000 * 60));

      // Only process reminders that are due within 15 minutes or overdue
      if (minutesDiff <= 15 && minutesDiff >= -60) {
        // Create notification record
        const notificationData = {
          reminderId: doc.id,
          leadId: reminder.leadId,
          leadName: reminder.leadName,
          leadPhone: reminder.leadPhone,
          title: reminder.title,
          description: reminder.description,
          reminderDate: reminder.reminderDate,
          reminderTime: reminder.reminderTime,
          priority: reminder.priority,
          type: reminder.type,
          assignedTo: reminder.assignedTo,
          centreId: reminder.centreId,
          status: 'pending',
          isUrgent: minutesDiff <= 30 || minutesDiff < 0,
          isOverdue: minutesDiff < 0,
          minutesUntilDue: minutesDiff,
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        };

        // Check if notification already exists for this reminder
        const existingNotification = await db.collection('reminderNotifications')
          .where('reminderId', '==', doc.id)
          .where('status', '==', 'pending')
          .limit(1)
          .get();

        if (existingNotification.empty) {
          await db.collection('reminderNotifications').add(notificationData);
          notifications.push(notificationData);
        }
      }
    }

    console.log(`Processed ${notifications.length} reminder notifications`);
    return { success: true, notificationsProcessed: notifications.length };

  } catch (error) {
    console.error('Check Reminder Notifications Error:', error);
    return { success: false, error: error.message };
  }
});

// Cloud Function: Send Reminder SMS
exports.sendReminderSMS = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    try {
      const { reminderId, phoneNumber, message } = req.body;

      if (!reminderId || !phoneNumber || !message) {
        return res.status(400).json({
          success: false,
          message: 'Reminder ID, phone number, and message are required'
        });
      }

      // Send SMS
      const result = await smsService.sendSMS(phoneNumber, message);

      // Update reminder notification status
      await db.collection('reminderNotifications')
        .where('reminderId', '==', reminderId)
        .limit(1)
        .get()
        .then(snapshot => {
          if (!snapshot.empty) {
            return snapshot.docs[0].ref.update({
              smsSent: true,
              smsSentAt: admin.firestore.FieldValue.serverTimestamp(),
              smsProvider: result.provider,
              smsMessageId: result.messageId
            });
          }
        });

      res.json({
        success: result.success,
        message: result.success ? 'Reminder SMS sent successfully' : 'Reminder SMS failed',
        provider: result.provider,
        messageId: result.messageId
      });

    } catch (error) {
      console.error('Send Reminder SMS Error:', error);
      
      res.status(500).json({
        success: false,
        message: 'Failed to send reminder SMS',
        error: error.message
      });
    }
  });
});

// Cloud Function: Get Reminder Notifications
exports.getReminderNotifications = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    try {
      const { centreId, status = 'pending', limit = 50 } = req.query;

      let query = db.collection('reminderNotifications');

      if (centreId) {
        query = query.where('centreId', '==', centreId);
      }
      if (status) {
        query = query.where('status', '==', status);
      }

      query = query.orderBy('createdAt', 'desc').limit(parseInt(limit));

      const notificationsSnapshot = await query.get();
      const notifications = notificationsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
        reminderDate: doc.data().reminderDate?.toDate(),
        smsSentAt: doc.data().smsSentAt?.toDate()
      }));

      res.json({
        success: true,
        notifications,
        count: notifications.length
      });

    } catch (error) {
      console.error('Get Reminder Notifications Error:', error);
      
      res.status(500).json({
        success: false,
        message: 'Failed to get reminder notifications',
        error: error.message
      });
    }
  });
});

// Cloud Function: Mark Reminder as Completed
exports.markReminderCompleted = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    try {
      const { reminderId, notificationId } = req.body;

      if (!reminderId) {
        return res.status(400).json({
          success: false,
          message: 'Reminder ID is required'
        });
      }

      // Update reminder status
      await db.collection('reminders').doc(reminderId).update({
        status: 'completed',
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // Update notification status if notificationId is provided
      if (notificationId) {
        await db.collection('reminderNotifications').doc(notificationId).update({
          status: 'completed',
          completedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }

      res.json({
        success: true,
        message: 'Reminder marked as completed'
      });

    } catch (error) {
      console.error('Mark Reminder Completed Error:', error);
      
      res.status(500).json({
        success: false,
        message: 'Failed to mark reminder as completed',
        error: error.message
      });
    }
  });
});

// HTTP endpoint for sending emails directly
exports.sendEmail = functions.https.onRequest(async (req, res) => {
  // Enable CORS
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST');
  res.set('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  try {
    const { to, subject, html, text } = req.body;

    if (!to || !subject || !html) {
      res.status(400).json({ error: 'Missing required fields: to, subject, html' });
      return;
    }

    // Send email
    const mailOptions = {
      from: functions.config().email?.user || 'your-email@gmail.com',
      to: to,
      subject: subject,
      html: html,
      text: text || ''
    };

    await transporter.sendMail(mailOptions);
    
    console.log(`Email sent successfully to ${to}`);
    res.status(200).json({ success: true, message: 'Email sent successfully' });
  } catch (error) {
    console.error('Error sending email:', error);
    res.status(500).json({ error: error.message });
  }
});

// Firestore trigger for email queue (fallback method)
exports.processEmailQueue = functions.firestore
  .document('emailQueue/{emailId}')
  .onCreate(async (snap, context) => {
    const emailData = snap.data();
    
    try {
      // Send email
      const mailOptions = {
        from: functions.config().email?.user || 'your-email@gmail.com',
        to: emailData.to,
        subject: emailData.subject,
        html: emailData.html,
        text: emailData.text
      };

      await transporter.sendMail(mailOptions);
      
      // Update status to sent
      await snap.ref.update({
        status: 'sent',
        sentAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      console.log(`Email sent successfully to ${emailData.to}`);
      return { success: true };
    } catch (error) {
      console.error('Error sending email:', error);
      
      // Update status to failed
      await snap.ref.update({
        status: 'failed',
        error: error.message,
        failedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      return { success: false, error: error.message };
    }
  });

// Clean up old email queue entries (older than 24 hours)
exports.cleanupEmailQueue = functions.pubsub
  .schedule('every 24 hours')
  .onRun(async (context) => {
    const cutoff = new Date();
    cutoff.setHours(cutoff.getHours() - 24);
    
    const snapshot = await admin.firestore()
      .collection('emailQueue')
      .where('createdAt', '<', cutoff)
      .get();
    
    const batch = admin.firestore().batch();
    snapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    await batch.commit();
    console.log(`Cleaned up ${snapshot.docs.length} old email queue entries`);
  });

// Clean up expired OTPs (older than 10 minutes)
exports.cleanupExpiredOTPs = functions.pubsub
  .schedule('every 10 minutes')
  .onRun(async (context) => {
    const cutoff = new Date();
    cutoff.setMinutes(cutoff.getMinutes() - 10);
    
    const snapshot = await admin.firestore()
      .collection('passwordResetOTPs')
      .where('expiresAt', '<', cutoff)
      .get();
    
    const batch = admin.firestore().batch();
    snapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    await batch.commit();
    console.log(`Cleaned up ${snapshot.docs.length} expired OTPs`);
  });

Object.assign(exports, require('./iam'));

