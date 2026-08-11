import { auth } from '../firebaseConfig';
import { getFirebaseAdmin } from '../firebaseConfig';
import {
  getMigrationRoleForEmail,
  isDirectorEmail,
  normalizeEmail,
} from '@shared/permissions';
import { 
  sendPasswordResetEmail, 
  confirmPasswordReset, 
  verifyPasswordResetCode 
} from 'firebase/auth';
import { doc, getDoc, updateDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';

export interface OTPVerificationResult {
  success: boolean;
  message: string;
  email?: string;
}

export interface PasswordResetResult {
  success: boolean;
  message: string;
}

export class AuthService {
  /**
   * Send password reset email
   */
  static async sendPasswordResetEmail(email: string): Promise<PasswordResetResult> {
    try {
      await sendPasswordResetEmail(auth, email);
      return {
        success: true,
        message: 'Password reset email sent successfully'
      };
    } catch (error: any) {
      console.error('Error sending password reset email:', error);
      return {
        success: false,
        message: error.message || 'Failed to send password reset email'
      };
    }
  }

  /**
   * Send OTP email using custom email service
   */
  static async sendOTPEmail(email: string, otp: string, subject: string = 'Password Reset OTP - ZICA ZIMA CRM'): Promise<PasswordResetResult> {
    try {
      if (process.env.NODE_ENV !== 'production') {
        console.log(`📧 Sending OTP email to ${email}`);
      }
      
      // Method 1: Try SendGrid if configured
      if (process.env.SENDGRID_API_KEY) {
        try {
          const sgMail = require('@sendgrid/mail');
          sgMail.setApiKey(process.env.SENDGRID_API_KEY);
          
          const msg = {
            to: email,
            from: process.env.SENDGRID_FROM_EMAIL || 'noreply@zicazima.com',
            subject: subject,
            html: this.generateOTPEmailHTML(otp),
            text: `Your OTP code is: ${otp}. This code will expire in 10 minutes. If you didn't request this password reset, please ignore this email.`
          };
          
          await sgMail.send(msg);
          console.log('✅ Email sent successfully via SendGrid');
          return {
            success: true,
            message: 'OTP email sent successfully via SendGrid'
          };
        } catch (sendgridError) {
          console.error('SendGrid failed:', sendgridError);
        }
      }

      // Method 2: Try Nodemailer with Gmail
      if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
        try {
          const nodemailer = require('nodemailer');
          
          const transporter = nodemailer.createTransporter({
            service: 'gmail',
            auth: {
              user: process.env.GMAIL_USER,
              pass: process.env.GMAIL_APP_PASSWORD
            }
          });

          const mailOptions = {
            from: process.env.GMAIL_USER,
            to: email,
            subject: subject,
            html: this.generateOTPEmailHTML(otp),
            text: `Your OTP code is: ${otp}. This code will expire in 10 minutes. If you didn't request this password reset, please ignore this email.`
          };

          await transporter.sendMail(mailOptions);
          console.log('✅ Email sent successfully via Gmail');
          return {
            success: true,
            message: 'OTP email sent successfully via Gmail'
          };
        } catch (gmailError) {
          console.error('Gmail failed:', gmailError);
        }
      }

      // Method 3: Try EmailJS if configured
      if (process.env.EMAILJS_SERVICE_ID && process.env.EMAILJS_TEMPLATE_ID && process.env.EMAILJS_USER_ID) {
        try {
          const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              service_id: process.env.EMAILJS_SERVICE_ID,
              template_id: process.env.EMAILJS_TEMPLATE_ID,
              user_id: process.env.EMAILJS_USER_ID,
              template_params: {
                to_email: email,
                otp_code: otp,
                subject: subject
              }
            })
          });

          if (response.ok) {
            console.log('✅ Email sent successfully via EmailJS');
            return {
              success: true,
              message: 'OTP email sent successfully via EmailJS'
            };
          }
        } catch (emailjsError) {
          console.error('EmailJS failed:', emailjsError);
        }
      }

      // Method 4: Fallback - Store in Firestore for cloud function processing
      try {
        const emailRef = doc(db, 'emailQueue', `${email}_${Date.now()}`);
        await setDoc(emailRef, {
          to: email,
          subject: subject,
          html: this.generateOTPEmailHTML(otp),
          text: `Your OTP code is: ${otp}. This code will expire in 10 minutes. If you didn't request this password reset, please ignore this email.`,
          status: 'pending',
          createdAt: new Date(),
          type: 'password_reset_otp'
        });

        console.log('✅ Email queued in Firestore for processing');
        return {
          success: true,
          message: 'OTP email queued for processing'
        };
      } catch (firestoreError) {
        console.error('Firestore queue failed:', firestoreError);
      }

      // If all methods fail, return failure — never expose OTP in logs or responses
      return {
        success: false,
        message: 'Unable to send OTP email. Email service is not configured.'
      };
    } catch (error: any) {
      console.error('Error sending OTP email:', error);
      return {
        success: false,
        message: error.message || 'Failed to send OTP email'
      };
    }
  }

  private static generateOTPEmailHTML(otp: string): string {
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

  /**
   * Verify OTP code from password reset email
   */
  static async verifyOTP(otpCode: string): Promise<OTPVerificationResult> {
    try {
      const email = await verifyPasswordResetCode(auth, otpCode);
      return {
        success: true,
        message: 'OTP verified successfully',
        email
      };
    } catch (error: any) {
      console.error('Error verifying OTP:', error);
      return {
        success: false,
        message: error.message || 'Invalid or expired OTP code'
      };
    }
  }

  /**
   * Reset password with OTP code
   */
  static async resetPassword(otpCode: string, newPassword: string): Promise<PasswordResetResult> {
    try {
      await confirmPasswordReset(auth, otpCode, newPassword);
      return {
        success: true,
        message: 'Password reset successfully'
      };
    } catch (error: any) {
      console.error('Error resetting password:', error);
      return {
        success: false,
        message: error.message || 'Failed to reset password'
      };
    }
  }

  /**
   * Reset password using a custom OTP stored in Firestore (server-side verification).
   */
  static async resetPasswordWithCustomOTP(
    email: string,
    otp: string,
    newPassword: string
  ): Promise<PasswordResetResult> {
    try {
      const admin = await getFirebaseAdmin();
      if (!admin?.adminDb) {
        return {
          success: false,
          message: 'Password reset service is temporarily unavailable'
        };
      }

      const normalizedEmail = email.trim().toLowerCase();
      const otpRef = admin.adminDb.collection('passwordResetOTPs').doc(normalizedEmail);
      const otpDoc = await otpRef.get();

      if (!otpDoc.exists) {
        return { success: false, message: 'Invalid or expired OTP' };
      }

      const otpData = otpDoc.data()!;
      const expiresAt = otpData.expiresAt?.toDate?.() ?? new Date(otpData.expiresAt);

      if (!expiresAt || new Date() > expiresAt) {
        return { success: false, message: 'OTP has expired. Please request a new one.' };
      }

      if (otpData.used) {
        return { success: false, message: 'OTP has already been used' };
      }

      if (otpData.otp !== otp) {
        return { success: false, message: 'Invalid OTP code' };
      }

      const usersSnapshot = await admin.adminDb
        .collection('users')
        .where('email', '==', normalizedEmail)
        .limit(1)
        .get();

      let uid: string | undefined;

      if (!usersSnapshot.empty) {
        const userDoc = usersSnapshot.docs[0];
        uid = userDoc.data().uid || userDoc.id;
      } else {
        const firebaseAdmin = await import('firebase-admin');
        try {
          const authUser = await firebaseAdmin.auth().getUserByEmail(normalizedEmail);
          uid = authUser.uid;
        } catch {
          return { success: false, message: 'User not found' };
        }
      }

      const firebaseAdmin = await import('firebase-admin');
      await firebaseAdmin.auth().updateUser(uid!, { password: newPassword });

      await otpRef.update({
        used: true,
        usedAt: new Date()
      });

      return {
        success: true,
        message: 'Password reset successfully'
      };
    } catch (error: any) {
      console.error('Error resetting password with custom OTP:', error);
      return {
        success: false,
        message: error.message || 'Failed to reset password'
      };
    }
  }

  /**
   * Get user profile by UID
   */
  static async getUserProfile(uid: string) {
    try {
      const userDoc = await getDoc(doc(db, 'users', uid));
      if (userDoc.exists()) {
        return {
          success: true,
          data: userDoc.data()
        };
      } else {
        return {
          success: false,
          message: 'User not found'
        };
      }
    } catch (error: any) {
      console.error('Error getting user profile:', error);
      return {
        success: false,
        message: error.message || 'Failed to get user profile'
      };
    }
  }

  /**
   * Update user profile
   */
  static async updateUserProfile(uid: string, updates: any) {
    try {
      const userRef = doc(db, 'users', uid);
      await updateDoc(userRef, {
        ...updates,
        updatedAt: new Date()
      });
      return {
        success: true,
        message: 'Profile updated successfully'
      };
    } catch (error: any) {
      console.error('Error updating user profile:', error);
      return {
        success: false,
        message: error.message || 'Failed to update profile'
      };
    }
  }

  /**
   * Approve user account
   */
  static async approveUser(uid: string, approvedBy: string) {
    try {
      const userRef = doc(db, 'users', uid);
      await updateDoc(userRef, {
        approved: true,
        approvedBy,
        approvedAt: new Date(),
        updatedAt: new Date()
      });
      return {
        success: true,
        message: 'User approved successfully'
      };
    } catch (error: any) {
      console.error('Error approving user:', error);
      return {
        success: false,
        message: error.message || 'Failed to approve user'
      };
    }
  }

  /**
   * Create or repair a Firestore user profile using Admin SDK (bypasses security rules).
   */
  static async bootstrapUserProfile(
    uid: string,
    email: string,
    options?: { firstName?: string; lastName?: string }
  ) {
    try {
      const adminBundle = await getFirebaseAdmin();
      if (!adminBundle?.adminDb) {
        return {
          success: false,
          message: 'Firebase Admin is not configured on the server',
        };
      }

      const admin = await import('firebase-admin');
      const userRef = adminBundle.adminDb.collection('users').doc(uid);
      const existing = await userRef.get();
      const normalizedEmail = normalizeEmail(email);
      const migratedRole = getMigrationRoleForEmail(normalizedEmail);
      const isDirector = isDirectorEmail(normalizedEmail);
      const now = admin.firestore.FieldValue.serverTimestamp();

      if (existing.exists) {
        const data = existing.data() as Record<string, unknown>;
        const patch: Record<string, unknown> = { updatedAt: now };
        const shouldAutoApprove = isDirector || Boolean(migratedRole);

        if (shouldAutoApprove && data.approved !== true) {
          patch.approved = true;
        }
        if (migratedRole && data.role !== migratedRole) {
          patch.role = migratedRole;
        }
        if (!data.centreId) {
          patch.centreId = 'default-centre';
        }

        if (Object.keys(patch).length > 1) {
          await userRef.update(patch);
        }

        const refreshed = await userRef.get();
        return {
          success: true,
          created: false,
          data: refreshed.data(),
        };
      }

      const role = migratedRole ?? 'pending';
      const approved = isDirector || Boolean(migratedRole);
      const profile = {
        uid,
        email: normalizedEmail || email,
        firstName: options?.firstName || 'User',
        lastName: options?.lastName || '',
        role,
        centreId: 'default-centre',
        approved,
        permissionsGranted: [],
        permissionsRevoked: [],
        createdAt: now,
        updatedAt: now,
      };

      await userRef.set(profile);
      const created = await userRef.get();

      return {
        success: true,
        created: true,
        data: created.data(),
      };
    } catch (error: unknown) {
      console.error('Error bootstrapping user profile:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to bootstrap user profile',
      };
    }
  }

  /**
   * Reject user account
   */
  static async rejectUser(uid: string, rejectedBy: string, reason?: string) {
    try {
      const userRef = doc(db, 'users', uid);
      await updateDoc(userRef, {
        approved: false,
        rejected: true,
        rejectedBy,
        rejectedAt: new Date(),
        rejectionReason: reason,
        updatedAt: new Date()
      });
      return {
        success: true,
        message: 'User rejected successfully'
      };
    } catch (error: any) {
      console.error('Error rejecting user:', error);
      return {
        success: false,
        message: error.message || 'Failed to reject user'
      };
    }
  }
}

export default AuthService;
