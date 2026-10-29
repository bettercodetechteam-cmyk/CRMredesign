import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Eye, EyeOff, Mail, Lock, AlertCircle, CheckCircle, ArrowLeft, User } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { createUserWithEmailAndPassword, fetchSignInMethodsForEmail, signOut } from 'firebase/auth';
import { doc, setDoc, serverTimestamp, collection, query, where, getDocs, getDoc, updateDoc } from 'firebase/firestore';
import { auth, db, takeLoginWindowCredentials } from '@/lib/firebase';
import { emailService } from '@/lib/emailService';

import bettercodeLogo from "@/assets/abettercode logo updated.png";
import zicaZimaLogo from "@/assets/Zica Zima.jpg";
import NotificationPopup from '../components/NotificationPopup';
import { NoiseBackground } from "@/components/ui/noise-background";
import { useNavigate } from 'react-router-dom';
import { homePathForRole } from '@shared/permissions';


type LoginMode = 'login' | 'forgot-password' | 'reset-password' | 'create-account';





export default function Login() {
  const [mode, setMode] = useState<LoginMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');

  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [emailConfigStatus] = useState(() => emailService.getEmailConfigStatus());
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSigningIn, setIsSigningIn] = useState(false);
  // Notification state
  const [notification, setNotification] = useState<{
    type: 'success' | 'error' | 'info' | 'warning';
    title: string;
    message: string;
    isVisible: boolean;
  }>({
    type: 'info',
    title: '',
    message: '',
    isVisible: false
  });

  const navigate = useNavigate();
  const { signIn, resetPassword, signUp, login } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    const credentials = takeLoginWindowCredentials();
    if (!credentials) return;
    setEmail(credentials.email);
    setPassword(credentials.password);
  }, []);


  // Notification helper functions
  const showNotification = (type: 'success' | 'error' | 'info' | 'warning', title: string, message: string) => {
    setNotification({
      type,
      title,
      message,
      isVisible: true
    });
  };

  const hideNotification = () => {
    setNotification(prev => ({ ...prev, isVisible: false }));
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSigningIn(true);

    try {
      const role = await signIn(email, password);
      navigate(homePathForRole(role));
    } catch (error: any) {
      console.error("Login failed:", error);
      showNotification('error', 'Login Failed', error.message || "Invalid email or password");
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.includes("@")) {
      showNotification("error", "Email required", "Password reset is sent to an email. Sign in with the mobile number and the password shown when the login was linked.");
      return;
    }

    try {
      // Check if user exists in Firestore
      const q = query(collection(db, 'users'), where('email', '==', email));
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        showNotification('error', 'Account Not Found', 'No account found with this email address');
        return;
      }

      // Generate OTP
      const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
      
      // Store OTP in Firestore with expiration (10 minutes)
      const otpRef = doc(db, 'passwordResetOTPs', email);
      await setDoc(otpRef, {
        otp: otpCode,
        email: email,
        createdAt: serverTimestamp(),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
        used: false
      });

      // For testing purposes, log the OTP to console
      console.log(`🔐 OTP for ${email}: ${otpCode}`);
      
      // Test EmailJS configuration first
      emailService.testEmailJSConfig();
      
      // Test EmailJS template with different variable combinations
      await emailService.testEmailJSTemplate(email);
      
      // Try to send OTP via email service
      const emailSent = await emailService.sendOTPEmail(email, otpCode);
      
      if (emailSent) {
        setResetEmail(email);
        setOtpSent(true);
        showNotification('success', 'OTP Sent Successfully!', `OTP has been sent to ${email}. Please check your inbox and spam folder.`);
        setMode('reset-password');
      } else {
        // Fallback: Show OTP in UI for testing
        setResetEmail(email);
        setOtpSent(true);
        showNotification('warning', 'Email Service Not Configured', `Your OTP is: ${otpCode} (This is for testing purposes)`);
        setMode('reset-password');
      }
    } catch (error: any) {
      console.error("Password reset failed:", error);
      showNotification('error', 'Password Reset Failed', error.message || "Failed to send password reset email");
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!otp || otp.length !== 6) {
      showNotification('error', 'Invalid OTP', 'Please enter a valid 6-digit OTP');
      return;
    }

    if (password !== confirmPassword) {
      showNotification('error', 'Password Mismatch', 'Passwords do not match');
      return;
    }

    if (password.length < 6) {
      showNotification('error', 'Password Too Short', 'Password must be at least 6 characters long');
      return;
    }

    try {
      // Verify OTP
      const otpRef = doc(db, 'passwordResetOTPs', resetEmail);
      const otpDoc = await getDoc(otpRef);
      
      if (!otpDoc.exists()) {
        showNotification('error', 'Invalid OTP', 'Invalid or expired OTP');
        return;
      }

      const otpData = otpDoc.data();
      const now = new Date();
      const expiresAt = otpData.expiresAt.toDate();

      if (now > expiresAt) {
        showNotification('error', 'OTP Expired', 'OTP has expired. Please request a new one.');
        return;
      }

      if (otpData.used) {
        showNotification('error', 'OTP Already Used', 'OTP has already been used');
        return;
      }

      if (otpData.otp !== otp) {
        showNotification('error', 'Invalid OTP', 'Invalid OTP code');
        return;
      }

      // Get user from Firestore
      const userQuery = query(collection(db, 'users'), where('email', '==', resetEmail));
      const userSnapshot = await getDocs(userQuery);
      
      if (userSnapshot.empty) {
        showNotification('error', 'User Not Found', 'User not found');
        return;
      }

      const userDoc = userSnapshot.docs[0];
      const userData = userDoc.data();

      // Update user's password in Firestore (for custom auth system)
      await updateDoc(userDoc.ref, {
        password: password, // Note: In production, this should be hashed
        updatedAt: serverTimestamp()
      });

      // Mark OTP as used
      await updateDoc(otpRef, {
        used: true,
        usedAt: serverTimestamp()
      });

      showNotification('success', 'Password Reset Successful!', 'Your password has been updated successfully. You can now login with your new password.');
      
      // Reset form and go back to login
      setTimeout(() => {
        setMode('login');
        setEmail('');
        setOtp('');
        setPassword('');
        setConfirmPassword('');
        setOtpSent(false);
        setResetEmail('');
      }, 3000);
    } catch (error: any) {
      console.error("Password reset failed:", error);
      showNotification('error', 'Password Reset Failed', error.message || "Failed to reset password");
    }
  };



  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateCreateAccountForm()) {
      return;
    }

    try {
      // A signed-out visitor cannot list users. Auth reports a duplicate email.
      try {
        const methods = await fetchSignInMethodsForEmail(auth, email);
        if (methods.length > 0) {
          showNotification('error', 'Account Already Exists', 'An account with this email already exists');
          return;
        }
      } catch (authError) {
        // If the email doesn't exist in Auth, continue
        console.log('Email not found in Auth, proceeding with signup');
      }

      // Create user in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );
      const uid = userCredential.user.uid;

      // Create user profile in Firestore
      const userData = {
        email: email,
        role: 'pending',
        firstName: firstName,
        lastName: lastName,
        approved: false,
        permissionsGranted: [],
        permissionsRevoked: [],
      };

      await setDoc(doc(db, 'users', uid), {
        ...userData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // Create approval notification for directors/centre heads
      await emailService.sendWelcomeEmail(email, firstName);

      await signOut(auth);

      showNotification('success', 'Account Created Successfully!', 'Your account is ready. Sign in with the email and password you just created.');

      // Reset form
      setEmail('');
      setPassword('');
      setConfirmPassword('');
      setFirstName('');
      setLastName('');

      // Go back to login mode
      setTimeout(() => {
        setMode('login');
      }, 2000);

    } catch (error: any) {
      console.error("Account creation failed:", error);
      showNotification('error', 'Account Creation Failed', error.message || "Failed to create account. Please try again.");
    }
  };

  const validateCreateAccountForm = () => {
    if (!email || !password || !confirmPassword || !firstName || !lastName) {
      showNotification('error', 'All Fields Required', 'All fields are required to create an account.');
      return false;
    }

    if (password !== confirmPassword) {
      showNotification('error', 'Password Mismatch', 'Passwords do not match.');
      return false;
    }

    if (password.length < 6) {
      showNotification('error', 'Password Too Short', 'Password must be at least 6 characters long.');
      return false;
    }

    if (!email.includes('@')) {
      showNotification('error', 'Invalid Email', 'Please enter a valid email address.');
      return false;
    }

    return true;
  };




  const renderLoginForm = () => (
    <form onSubmit={handleLogin} className="space-y-1 sm:space-y-2">
      <div className="space-y-1">
        <Label htmlFor="email" className="text-sm font-semibold text-white">
          Email or mobile number
        </Label>
        <div className="relative group">
          <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500 group-focus-within:text-blue-600 transition-all duration-300" />
          <Input
            id="email"
            type="text"
            inputMode="text"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email or 10-digit mobile number"
            className="pl-10 h-10 sm:h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500/20 rounded-lg text-sm transition-all duration-300 shadow-sm hover:shadow-md group-focus-within:shadow-lg group-focus-within:border-blue-500 bg-white text-gray-900 placeholder-gray-500"
            required
            autoComplete="username"
          />
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="password" className="text-sm font-semibold text-white">
          Password
        </Label>
        <div className="relative group">
          <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500 group-focus-within:text-blue-600 transition-all duration-300" />
          <Input
            id="password"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
            className="pl-10 pr-10 h-10 sm:h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500/20 rounded-lg text-sm transition-all duration-300 shadow-sm hover:shadow-md group-focus-within:shadow-lg group-focus-within:border-blue-500 bg-white text-gray-900 placeholder-gray-500"
            required
            autoComplete="current-password"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 transition-all duration-300 p-1 rounded hover:bg-gray-100 hover:scale-110 touch-target"
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between pt-1">
        <div />
        <button
          type="button"
          onClick={() => setMode('forgot-password')}
          className="text-xs sm:text-sm text-blue-300 hover:text-white font-medium transition-all duration-300 hover:underline hover:scale-105 transform touch-target"
        >
          Forgot password?
        </button>
      </div>

      <Button
        type="submit"
        disabled={isSigningIn}
        className="w-full h-10 sm:h-11 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold rounded-lg text-sm transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-75 disabled:cursor-not-allowed touch-target"
      >
        {isSigningIn ? (
          <div className="flex items-center justify-center space-x-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Sign in...</span>
          </div>
        ) : (
          "Sign In"
        )}
      </Button>












    </form>
  );

  const renderForgotPasswordForm = () => (
    <form onSubmit={handleForgotPassword} className="space-y-3">
      {/* Email Configuration Status */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
        <div className="flex items-center space-x-2">
          <div className={`w-2 h-2 rounded-full ${emailConfigStatus.configured ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
          <span className="text-xs text-blue-800 font-medium">
            {emailConfigStatus.configured ? 'Email service ready' : 'Email service not configured'}
          </span>
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="forgot-email" className="text-sm font-semibold text-white">
          Email Address
        </Label>
        <div className="relative group">
          <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500 group-focus-within:text-blue-600 transition-colors" />
          <Input
            id="forgot-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email address"
            className="pl-10 h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500/20 rounded-lg text-sm transition-all duration-300 shadow-sm hover:shadow-md group-focus-within:shadow-lg bg-white text-gray-900 placeholder-gray-500"
            required
          />
        </div>
      </div>

      <div className="flex items-center justify-between pt-1">
        <button
          type="button"
          onClick={() => setMode('login')}
          className="flex items-center text-sm text-blue-300 hover:text-white font-medium transition-colors hover:scale-105 transform"
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          Back to login
        </button>
      </div>

      <Button
        type="submit"
        className="w-full h-11 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold rounded-lg text-sm transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98]"
      >
        Send OTP
      </Button>
    </form>
  );

  const renderResetPasswordForm = () => (
    <form onSubmit={handleResetPassword} className="space-y-3">
      <div className="space-y-1">
        <Label htmlFor="otp" className="text-sm font-semibold text-white">
          OTP Code
        </Label>
        <div className="relative group">
          <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500 group-focus-within:text-blue-600 transition-colors" />
          <Input
            id="otp"
            type="text"
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            placeholder="Enter 6-digit OTP"
            maxLength={6}
            className="pl-10 h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500/20 rounded-lg text-sm transition-all duration-300 shadow-sm hover:shadow-md group-focus-within:shadow-lg bg-white text-gray-900 placeholder-gray-500"
            required
          />
        </div>
        <p className="text-xs text-blue-200 mt-1">
          💡 For testing: Copy the OTP from the success message above
        </p>
      </div>

      <div className="space-y-1">
        <Label htmlFor="new-password" className="text-sm font-semibold text-white">
          New Password
        </Label>
        <div className="relative group">
          <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500 group-focus-within:text-blue-600 transition-colors" />
          <Input
            id="new-password"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter new password"
            className="pl-10 pr-10 h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500/20 rounded-lg text-sm transition-all duration-300 shadow-sm hover:shadow-md group-focus-within:shadow-lg bg-white text-gray-900 placeholder-gray-500"
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 transition-colors"
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="confirm-new-password" className="text-sm font-semibold text-white">
          Confirm New Password
        </Label>
        <div className="relative group">
          <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500 group-focus-within:text-blue-600 transition-colors" />
          <Input
            id="confirm-new-password"
            type={showPassword ? "text" : "password"}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm new password"
            className="pl-10 h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500/20 rounded-lg text-sm transition-all duration-300 shadow-sm hover:shadow-md group-focus-within:shadow-lg bg-white text-gray-900 placeholder-gray-500"
            required
          />
        </div>
      </div>

      <div className="flex items-center justify-between pt-1">
        <button
          type="button"
          onClick={() => setMode('forgot-password')}
          className="flex items-center text-sm text-blue-300 hover:text-white font-medium transition-colors hover:scale-105 transform"
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          Back to forgot password
        </button>
        <button
          type="button"
          onClick={async () => {
            if (!resetEmail) return;
            
            try {
              // Generate new OTP
              const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
              
              // Store new OTP in Firestore
              const otpRef = doc(db, 'passwordResetOTPs', resetEmail);
              await setDoc(otpRef, {
                otp: otpCode,
                email: resetEmail,
                createdAt: serverTimestamp(),
                expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
                used: false
              });

              // Try to send new OTP via email service
              const emailSent = await emailService.sendOTPEmail(resetEmail, otpCode);
              
              if (emailSent) {
                setOtp('');
                showNotification('success', 'New OTP Sent!', 'New OTP has been sent to your email. Please check your inbox and spam folder.');
              } else {
                // Fallback: Show OTP in UI for testing
                setOtp('');
                showNotification('warning', 'New OTP Generated', `New OTP generated! Your new OTP is: ${otpCode} (Email service not configured - this is for testing)`);
              }
            } catch (error: any) {
              console.error("Resend OTP failed:", error);
              showNotification('error', 'Resend Failed', error.message || "Failed to resend OTP.");
            }
          }}
          className="text-sm text-blue-300 hover:text-white font-medium transition-colors hover:scale-105 transform"
        >
          Resend OTP
        </button>
      </div>

      <Button
        type="submit"
        className="w-full h-11 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-semibold rounded-lg text-sm transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98]"
      >
        Reset Password
      </Button>
    </form>
  );

  const renderCreateAccountForm = () => (
    <form onSubmit={handleCreateAccount} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="firstName" className="text-sm font-semibold text-white">
            First Name
          </Label>
          <div className="relative group">
            <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500 group-focus-within:text-blue-600 transition-all duration-300" />
            <Input
              id="firstName"
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="First Name"
              className="pl-10 h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500/20 rounded-lg text-sm transition-all duration-300 shadow-sm hover:shadow-md group-focus-within:shadow-lg group-focus-within:border-blue-500 bg-white text-gray-900 placeholder-gray-500"
              required
            />
          </div>
        </div>

        <div className="space-y-1">
          <Label htmlFor="lastName" className="text-sm font-semibold text-white">
            Last Name
          </Label>
          <div className="relative group">
            <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500 group-focus-within:text-blue-600 transition-all duration-300" />
            <Input
              id="lastName"
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Last Name"
              className="pl-10 h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500/20 rounded-lg text-sm transition-all duration-300 shadow-sm hover:shadow-md group-focus-within:shadow-lg group-focus-within:border-blue-500 bg-white text-gray-900 placeholder-gray-500"
              required
            />
          </div>
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="create-email" className="text-sm font-semibold text-white">
          Email Address
        </Label>
        <div className="relative group">
          <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500 group-focus-within:text-blue-600 transition-all duration-300" />
          <Input
            id="create-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email address"
            className="pl-10 h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500/20 rounded-lg text-sm transition-all duration-300 shadow-sm hover:shadow-md group-focus-within:shadow-lg group-focus-within:border-blue-500 bg-white text-gray-900 placeholder-gray-500"
            required
          />
        </div>
      </div>

      <p className="text-xs text-blue-100">
        Your director will assign your role after reviewing your sign-up request.
      </p>

      <div className="space-y-1">
        <Label htmlFor="create-password" className="text-sm font-semibold text-white">
          Password
        </Label>
        <div className="relative group">
          <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500 group-focus-within:text-blue-600 transition-all duration-300" />
          <Input
            id="create-password"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Create a password"
            className="pl-10 pr-10 h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500/20 rounded-lg text-sm transition-all duration-300 shadow-sm hover:shadow-md group-focus-within:shadow-lg group-focus-within:border-blue-500 bg-white text-gray-900 placeholder-gray-500"
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 transition-all duration-300 p-1 rounded hover:bg-gray-100 hover:scale-110"
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="confirm-password" className="text-sm font-semibold text-white">
          Confirm Password
        </Label>
        <div className="relative group">
          <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500 group-focus-within:text-blue-600 transition-all duration-300" />
          <Input
            id="confirm-password"
            type={showPassword ? "text" : "password"}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm your password"
            className="pl-10 h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500/20 rounded-lg text-sm transition-all duration-300 shadow-sm hover:shadow-md group-focus-within:shadow-lg group-focus-within:border-blue-500 bg-white text-gray-900 placeholder-gray-500"
            required
          />
        </div>
      </div>

      <div className="flex items-center justify-between pt-1">
        <button
          type="button"
          onClick={() => setMode('login')}
          className="flex items-center text-sm text-blue-300 hover:text-white font-medium transition-colors hover:scale-105 transform"
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          Back to login
        </button>
      </div>

      <Button
        type="submit"
        className="w-full h-11 bg-gradient-to-r from-green-600 to-emerald-700 hover:from-green-700 hover:to-emerald-700 text-white font-semibold rounded-lg text-sm transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98]"
      >
        Create Account
      </Button>


    </form>
  );

  const getTitle = () => {
    switch (mode) {
      case 'forgot-password':
        return 'Forgot Password';
      case 'reset-password':
        return 'Reset Password';
      case 'create-account':
        return 'Create Account';
      default:
        return 'Welcome Back';
    }
  };

  const getDescription = () => {
    switch (mode) {
      case 'forgot-password':
        return 'Enter your email to receive an OTP';
      case 'reset-password':
        return 'Enter OTP and set your new password';
      case 'create-account':
        return 'Create a new account (requires approval)';
      default:
        return 'Sign in to access your dashboard';
    }
  };

  const renderForm = () => {
    switch (mode) {
      case 'forgot-password':
        return renderForgotPasswordForm();
      case 'reset-password':
        return renderResetPasswordForm();
      case 'create-account':
        return renderCreateAccountForm();
      default:
        return renderLoginForm();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4 xs:p-5 sm:p-6 overflow-hidden relative">
      {/* Notification Popup */}
      <NotificationPopup
        type={notification.type}
        title={notification.title}
        message={notification.message}
        isVisible={notification.isVisible}
        onClose={hideNotification}
        autoClose={true}
        autoCloseDelay={5000}
      />

      {/* Bettercode sign-in - top right, black theme */}
      <div className="fixed top-4 right-4 z-20 sm:top-5 sm:right-5">
        <NoiseBackground
          containerClassName="w-fit rounded-full"
          className="bg-neutral-900"
          gradientColors={[
            "rgb(255, 100, 150)",
            "rgb(100, 150, 255)",
            "rgb(255, 200, 100)",
          ]}
        >
          <button
            type="button"
            onClick={() => navigate('/bettercode')}
            className="rounded-full bg-transparent px-4 py-2 sm:px-5 sm:py-2.5 text-sm font-semibold text-white hover:bg-neutral-800 transition-all duration-100 active:scale-[0.98]"
          >
            Sign in with Bettercode →
          </button>
        </NoiseBackground>
      </div>

      {/* Centered Login Container */}
      <div className="w-full max-w-xs xs:max-w-sm sm:max-w-md space-y-3 xs:space-y-4 relative z-10">
        {/* Enhanced Logo & Header */}
        <div className="text-center space-y-1 sm:space-y-2">
          {/* Logo */}
          <div className="relative">
            <img
              src={zicaZimaLogo}
              alt="Zica Logo"
              className="w-14 h-14 sm:w-16 sm:h-16 object-contain drop-shadow-lg mx-auto"
            />
          </div>
          
          {/* Enhanced Title Section */}
          <div className="space-y-1">
            <div className="relative">
              {/* Main Title */}
              <h1 className="relative text-xl sm:text-2xl font-black text-white tracking-tight drop-shadow-lg">
                Zica, PCMC
              </h1>
            </div>
            
            {/* Subtitle with Enhanced Styling */}
            <div className="relative">
              <p className="text-blue-100 text-xs sm:text-sm font-semibold tracking-wide drop-shadow-md">
                Animation Institute Management System
              </p>
              {/* Underline Effect */}
              <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-10 sm:w-12 h-0.5 bg-gradient-to-r from-blue-400 to-purple-400 rounded-full"></div>
            </div>
          </div>
        </div>

        {/* Enhanced Login Form Card */}
        <div className="bg-white/20 backdrop-blur-lg rounded-2xl shadow-xl border border-white/30 overflow-hidden transform hover:scale-[1.005] transition-transform duration-300">
          <div className="px-4 sm:px-6 py-4 sm:py-6">
            <div className="text-center mb-4 sm:mb-5">
              <h2 className="text-lg sm:text-xl font-bold text-white mb-1 drop-shadow-md">{getTitle()}</h2>
              <p className="text-blue-100 text-xs sm:text-sm drop-shadow-sm">{getDescription()}</p>
            </div>
            
            {renderForm()}

            {/* Show Create Account link only on login mode */}
            {mode === 'login' && (
              <div className="mt-3 sm:mt-4 text-center">
                <p className="text-xs sm:text-sm text-blue-100 mb-2">Don't have an account?</p>
                <button
                  type="button"
                  onClick={() => setMode('create-account')}
                  className="text-xs sm:text-sm text-green-300 hover:text-green-100 font-medium transition-all duration-300 hover:underline hover:scale-105 transform touch-target"
                >
                  Create New Account
                </button>
                <div className="mt-2">
                  <a
                    href="/test-credentials"
                    className="text-xs sm:text-sm text-blue-100 hover:text-white font-medium underline"
                  >
                    View test logins
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Enhanced Footer */}
        <div className="text-center space-y-0.5 sm:space-y-1">
          {/* Copyright & Powered by */}
          <div className="space-y-0.5">
            <p className="text-xs text-blue-100 font-medium drop-shadow-sm px-2">
              © Zica, PCMC Animation Institute. All rights reserved.
            </p>
            
            <div className="flex flex-col items-center space-y-0.5">
              <span className="text-xs font-bold text-blue-200 tracking-wider uppercase drop-shadow-sm">Powered by</span>
              <div className="bg-black/20 backdrop-blur-sm rounded-lg p-2 shadow-md border border-white/30 transform hover:scale-105 transition-transform duration-300">
                <img
                  src={bettercodeLogo}
                  alt="Bettercode Logo"
                  className="h-4 sm:h-5 w-auto object-contain filter brightness-110"
                />
              </div>
            </div>
          </div>
        </div>
      </div>


    </div>
  );
}