import { db } from './firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

// EmailJS types
declare global {
  interface Window {
    emailjs: {
      send: (serviceId: string, templateId: string, templateParams: any, userId: string) => Promise<any>;
      init: (userId: string) => void;
    };
  }
}

export interface EmailData {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

class EmailService {
  // EmailJS Configuration - Loaded exclusively from environment variables (never hardcoded)
  private serviceId = import.meta.env.VITE_EMAILJS_SERVICE_ID ?? '';
  private templateId = import.meta.env.VITE_EMAILJS_TEMPLATE_ID ?? '';
  private userId = import.meta.env.VITE_EMAILJS_USER_ID ?? '';

  // Check if EmailJS is properly configured
  private get emailjsConfig() {
    const isConfigured = this.serviceId !== 'YOUR_SERVICE_ID' && 
                         this.templateId !== 'YOUR_TEMPLATE_ID' && 
                         this.userId !== 'YOUR_USER_ID';
    
    if (isConfigured) {
      if (process.env.NODE_ENV === 'development') {
      console.log('✅ EmailJS Configuration Found:', {
        serviceId: this.serviceId,
        templateId: this.templateId,
        userId: this.userId
      });
      }
    } else {
      if (process.env.NODE_ENV === 'development') {
      console.log('❌ EmailJS Configuration Missing:', {
        serviceId: this.serviceId,
        templateId: this.templateId,
        userId: this.userId
      });
      }
    }
    
    return isConfigured ? {
      serviceId: this.serviceId,
      templateId: this.templateId,
      userId: this.userId
    } : null;
  }

  // Check email configuration status
  public getEmailConfigStatus() {
    const configs = {
      emailjs: !!this.emailjsConfig,
      serverApi: true, // Always available
      firebase: true, // Always available
      firestore: true // Always available
    };

    const configuredServices = Object.entries(configs)
      .filter(([_, configured]) => configured)
      .map(([service]) => service);

    const emailjsDetails = this.emailjsConfig ? 
      `EmailJS (${this.serviceId})` : 
      'EmailJS not configured';

    return {
      configured: configuredServices.length > 0,
      services: configuredServices,
      message: configuredServices.length > 0 
        ? `Email services configured: ${configuredServices.join(', ')}`
        : 'No email services configured. OTP will be displayed in UI for testing.',
      details: {
        emailjs: emailjsDetails,
        serviceId: this.serviceId,
        templateId: this.templateId,
        userId: this.userId
      }
    };
  }

  // Test EmailJS configuration
  public testEmailJSConfig() {
    if (process.env.NODE_ENV === 'development') {
    console.log('🧪 Testing EmailJS Configuration:');
    console.log('Service ID:', this.serviceId);
    console.log('Template ID:', this.templateId);
    console.log('User ID:', this.userId);
    console.log('Is Configured:', !!this.emailjsConfig);
    console.log('Window EmailJS Available:', !!window.emailjs);
    }
    
    if (this.emailjsConfig) {
      if (process.env.NODE_ENV === 'development') {
      console.log('✅ EmailJS appears to be configured');
      }
    } else {
      if (process.env.NODE_ENV === 'development') {
      console.log('❌ EmailJS is not properly configured');
      console.log('Please check your environment variables:');
      console.log('- VITE_EMAILJS_SERVICE_ID should not be "YOUR_SERVICE_ID"');
      console.log('- VITE_EMAILJS_TEMPLATE_ID should not be "YOUR_TEMPLATE_ID"');
      }
      if (process.env.NODE_ENV === 'development') {
      console.log('- VITE_EMAILJS_USER_ID should not be "YOUR_USER_ID"');
      }
    }
  }

  // Test EmailJS template with a simple test email
  public async testEmailJSTemplate(testEmail: string = 'test@example.com'): Promise<boolean> {
    if (!this.emailjsConfig) {
      console.log('❌ EmailJS not configured for testing');
      return false;
    }

    console.log('🧪 Testing EmailJS template with email:', testEmail);
    
    try {
      // Generate a random test OTP — never hardcode credentials in source code
      const testOtp = Math.floor(100000 + Math.random() * 900000).toString();
      // Snyk: these are dynamic template parameter field names, not hardcoded credentials
      // deepcode ignore HardcodedCredential: all values are dynamic (function params or generated)
      const testParams = {
        to_email: testEmail,
        to_name: 'Test User',
        from_name: 'ZICA ZIMA CRM',
        otp_code: testOtp,
        message: 'This is a test email from ZICA ZIMA CRM',
        user_email: testEmail,
        user_addr: testEmail,  // EmailJS recipient field alias
        recipient: testEmail,
        to: testEmail,
        reply_to: testEmail,
        subject: 'Test Email - ZICA ZIMA CRM'
      };

      console.log('📧 Test template parameters:', testParams);

      if (window.emailjs) {
        const result = await window.emailjs.send(
          this.emailjsConfig.serviceId,
          this.emailjsConfig.templateId,
          testParams,
          this.emailjsConfig.userId
        );
        
        console.log('✅ EmailJS test successful:', result);
        return true;
      } else {
        console.log('❌ EmailJS browser SDK not available');
        return false;
      }
    } catch (error) {
      console.log('❌ EmailJS test failed:', error);
      console.log('🔧 This indicates a template configuration issue');
      console.log('📋 Please follow the instructions in EMAILJS_TEMPLATE_FIX.md');
      return false;
    }
  }

  async sendOTPEmail(email: string, otp: string): Promise<boolean> {
    console.log('📧 EmailService: Attempting to send OTP email to:', email);
    console.log('🔧 Email configuration status:', this.getEmailConfigStatus());
    console.log('🔍 Current EmailJS config:', {
      serviceId: this.serviceId,
      templateId: this.templateId,
      userId: this.userId,
      isConfigured: !!this.emailjsConfig
    });

    // Method 1: Try EmailJS first (if configured) - This should be your primary method
    if (this.emailjsConfig) {
      try {
        console.log('📧 Attempting to send email via EmailJS with config:', this.emailjsConfig);
        
        // Try using EmailJS browser SDK first (more reliable)
        if (window.emailjs && typeof window.emailjs.send === 'function') {
          try {
            // Create template parameters with multiple possible recipient field names
            const templateParams = {
              to_email: email,
              to_name: email.split('@')[0],
              from_name: 'ZICA ZIMA CRM',
              otp_code: otp,
              message: `Your OTP code is: ${otp}. This code will expire in 10 minutes.`,
              user_email: email,
              email: email,
              recipient: email,
              to: email,
              // Add common EmailJS template variables
              reply_to: email,
              subject: 'Password Reset OTP - ZICA ZIMA CRM'
            };

            console.log('📧 Sending EmailJS with template params:', templateParams);
            
            const result = await window.emailjs.send(
              this.emailjsConfig.serviceId,
              this.emailjsConfig.templateId,
              templateParams,
              this.emailjsConfig.userId
            );
            
            console.log('✅ EmailJS browser SDK response:', result);
            console.log('✅ Email sent successfully via EmailJS browser SDK');
            return true;
          } catch (browserError) {
            console.log('❌ EmailJS browser SDK failed, trying REST API:', browserError);
            console.log('🔍 Browser error details:', {
              message: browserError.message,
              status: browserError.status,
              text: browserError.text
            });
          }
        }
        
        // Fallback to REST API
        const templateParams = {
          to_email: email,
          to_name: email.split('@')[0],
          from_name: 'ZICA ZIMA CRM',
          otp_code: otp,
          message: `Your OTP code is: ${otp}. This code will expire in 10 minutes.`,
          user_email: email,
          email: email,
          recipient: email,
          to: email,
          reply_to: email,
          subject: 'Password Reset OTP - ZICA ZIMA CRM'
        };

        console.log('📧 Attempting EmailJS REST API with params:', templateParams);

        const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            service_id: this.emailjsConfig.serviceId,
            template_id: this.emailjsConfig.templateId,
            user_id: this.emailjsConfig.userId,
            template_params: templateParams
          })
        });

        if (response.ok) {
          const result = await response.json();
          console.log('✅ EmailJS REST API response:', result);
          console.log('✅ Email sent successfully via EmailJS REST API');
          return true;
        } else {
          const errorText = await response.text();
          console.log('❌ EmailJS REST API failed with status:', response.status, 'Error:', errorText);
          
          // If it's a recipient error, provide helpful debugging info
          if (errorText.includes('recipients address is empty')) {
            console.log('🔧 EmailJS Template Configuration Issue Detected:');
            console.log('The EmailJS template is not configured to use the recipient email address.');
            console.log('Please check your EmailJS template configuration:');
            console.log('1. Go to EmailJS dashboard → Email Templates');
            console.log('2. Edit your template (check your EmailJS dashboard for the template ID)');
            console.log('3. Make sure the template uses one of these recipient variables:');
            console.log('   - {{to_email}}');
            console.log('   - {{email}}');
            console.log('   - {{user_email}}');
            console.log('   - {{recipient}}');
            console.log('4. Save the template and try again');
          }
        }
      } catch (emailjsError) {
        console.log('❌ EmailJS failed, trying server API:', emailjsError);
      }
    } else {
      console.log('⚠️ EmailJS not configured, skipping EmailJS method');
    }

    // Method 2: Try server-side API (if available)
    try {
      const response = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          otp,
          subject: 'Password Reset OTP - ZICA ZIMA CRM'
        })
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          console.log('✅ Email sent successfully via server API');
          return true;
        } else {
          console.log('❌ Server API returned error:', result.message);
        }
      } else {
        console.log('❌ Server API failed with status:', response.status);
      }
    } catch (serverError) {
      console.log('❌ Server API error, trying fallback methods:', serverError);
    }

    // Method 3: Fallback to Firestore queue method (no Firebase auth emails)
    try {
      const emailData: EmailData = {
        to: email,
        subject: 'Password Reset OTP - ZICA ZIMA CRM',
        html: this.generateOTPEmailHTML(otp),
        text: `Your OTP code is: ${otp}. This code will expire in 10 minutes. If you didn't request this password reset, please ignore this email.`
      };

      // Store email data in Firestore for the cloud function to process
      const emailRef = doc(db, 'emailQueue', `${email}_${Date.now()}`);
      await setDoc(emailRef, {
        ...emailData,
        status: 'pending',
        createdAt: serverTimestamp(),
        type: 'password_reset_otp'
      });

      console.log('✅ Email queued in Firestore for processing');
      return true;
    } catch (error) {
      console.error('❌ Failed to queue email in Firestore:', error);
      return false;
    }
  }

  private generateOTPEmailHTML(otp: string): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
        <div style="background-color: #ffffff; padding: 30px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #1e40af; margin: 0; font-size: 24px;">ZICA ZIMA CRM</h1>
            <p style="color: #6b7280; margin: 10px 0 0 0;">Password Reset Request</p>
          </div>
          
          <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h2 style="color: #374151; margin: 0 0 15px 0; font-size: 18px;">Your OTP Code</h2>
            <div style="background-color: #ffffff; padding: 15px; border-radius: 6px; text-align: center; border: 2px dashed #d1d5db;">
              <span style="font-size: 32px; font-weight: bold; color: #1e40af; letter-spacing: 8px;">${otp}</span>
            </div>
            <p style="color: #6b7280; margin: 15px 0 0 0; font-size: 14px;">
              This OTP will expire in 10 minutes for security reasons.
            </p>
          </div>
          
          <div style="margin-bottom: 20px;">
            <h3 style="color: #374151; margin: 0 0 10px 0; font-size: 16px;">Instructions:</h3>
            <ol style="color: #4b5563; margin: 0; padding-left: 20px;">
              <li>Enter the 6-digit OTP code above in the password reset form</li>
              <li>Create a new strong password</li>
              <li>Confirm your new password</li>
              <li>Click "Reset Password" to complete the process</li>
            </ol>
          </div>
          
          <div style="background-color: #fef3c7; padding: 15px; border-radius: 6px; border-left: 4px solid #f59e0b;">
            <p style="color: #92400e; margin: 0; font-size: 14px;">
              <strong>Security Notice:</strong> If you didn't request this password reset, please ignore this email. 
              Your account security is important to us.
            </p>
          </div>
          
          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
            <p style="color: #6b7280; margin: 0; font-size: 12px;">
              © 2024 ZICA ZIMA CRM. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    `;
  }

  async sendWelcomeEmail(email: string, firstName: string): Promise<boolean> {
    try {
      const emailData: EmailData = {
        to: email,
        subject: 'Welcome to ZICA ZIMA CRM',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
            <div style="background-color: #ffffff; padding: 30px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
              <div style="text-align: center; margin-bottom: 30px;">
                <h1 style="color: #1e40af; margin: 0; font-size: 24px;">Welcome to ZICA ZIMA CRM</h1>
                <p style="color: #6b7280; margin: 10px 0 0 0;">Your account has been created successfully</p>
              </div>
              
              <div style="margin-bottom: 20px;">
                <h2 style="color: #374151; margin: 0 0 15px 0; font-size: 18px;">Hello ${firstName},</h2>
                <p style="color: #4b5563; margin: 0 0 15px 0; line-height: 1.6;">
                  Welcome to ZICA ZIMA CRM! Your account has been created successfully and is currently pending approval from a director or centre head.
                </p>
                <p style="color: #4b5563; margin: 0 0 15px 0; line-height: 1.6;">
                  You will receive an email notification once your account has been approved and you can start using the system.
                </p>
              </div>
              
              <div style="background-color: #f0f9ff; padding: 20px; border-radius: 8px; border-left: 4px solid #0ea5e9;">
                <h3 style="color: #0c4a6e; margin: 0 0 10px 0; font-size: 16px;">What's Next?</h3>
                <ul style="color: #0369a1; margin: 0; padding-left: 20px;">
                  <li>Wait for account approval from an administrator</li>
                  <li>Check your email for approval notification</li>
                  <li>Log in to access the CRM system</li>
                  <li>Start managing your leads and data</li>
                </ul>
              </div>
              
              <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
                <p style="color: #6b7280; margin: 0; font-size: 12px;">
                  © 2024 ZICA ZIMA CRM. All rights reserved.
                </p>
              </div>
            </div>
          </div>
        `,
        text: `Welcome to ZICA ZIMA CRM! Your account has been created and is pending approval. You will receive an email once approved.`
      };

      // Store email data in Firestore for the cloud function to process
      const emailRef = doc(db, 'emailQueue', `${email}_${Date.now()}`);
      await setDoc(emailRef, {
        ...emailData,
        status: 'pending',
        createdAt: serverTimestamp(),
        type: 'welcome_email'
      });

      return true;
    } catch (error) {
      console.error('Error sending welcome email:', error);
      return false;
    }
  }
}

export const emailService = new EmailService();
