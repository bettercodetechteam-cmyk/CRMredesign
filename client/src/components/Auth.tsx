import React, { useState, useEffect } from 'react';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, fetchSignInMethodsForEmail } from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp, addDoc, collection, query, where, getDocs, deleteDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Alert, AlertDescription } from './ui/alert';
import { Loader2, Eye, EyeOff, User, Lock, Mail, CheckCircle, Shield, Clock, AlertCircle, Sparkles, Chrome } from 'lucide-react';
import { useToast } from '../hooks/use-toast';
import { useLocation } from "wouter";
import { useAuth } from '../hooks/useAuth';
import Logo from "../assets/Zica Zima.jpg";
import { InlineLoading } from './ui/loading';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';

interface UserData {
  email: string;
  role: string;
  firstName: string;
  lastName: string;
  centreId?: string;
  approved: boolean;
}

const roles = [
  { value: 'director', label: 'Director', description: 'Full system access', icon: '👑' },
  { value: 'centre_head', label: 'Centre Head', description: 'Centre management', icon: '🏢' },
  { value: 'faculty', label: 'Faculty', description: 'Teaching staff', icon: '👨‍🏫' },
  { value: 'marketing', label: 'Sales and Marketing', description: 'Sales and marketing', icon: '📢' },
  { value: 'accounting', label: 'Accounting', description: 'Finance and accounts', icon: '📒' },
  { value: 'academic_head', label: 'Academic Head', description: 'Academic leadership', icon: '📚' },
];

export default function Auth() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [userStatus, setUserStatus] = useState<{ exists: boolean; approved: boolean; rejected: boolean } | null>(null);
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { signIn, signUp } = useAuth();

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
    role: '',
  });

  // Check user status when email changes
  useEffect(() => {
    const checkUserStatus = async () => {
      if (formData.email && formData.email.includes('@')) {
        try {
          // Query Firestore for user by email
          const q = query(collection(db, 'users'), where('email', '==', formData.email));
          const querySnapshot = await getDocs(q);
          
          if (!querySnapshot.empty) {
            const userData = querySnapshot.docs[0].data();
            setUserStatus({
              exists: true,
              approved: userData.approved || false,
              rejected: userData.rejected || false,
            });
          } else {
            setUserStatus({ exists: false, approved: false, rejected: false });
          }
        } catch (error) {
          console.error('Error checking user status:', error);
          setUserStatus(null);
        }
      } else {
        setUserStatus(null);
      }
    };

    const timeoutId = setTimeout(checkUserStatus, 500);
    return () => clearTimeout(timeoutId);
  }, [formData.email]);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError(''); // Clear error when user types
  };

  const validateForm = () => {
    if (!formData.email || !formData.password) {
      setError('Email and password are required');
      return false;
    }

    if (isSignUp) {
      if (!formData.firstName || !formData.lastName) {
        setError('First name and last name are required');
        return false;
      }
      if (!formData.role) {
        setError('Please select a role');
        return false;
      }
      if (formData.password !== formData.confirmPassword) {
        setError('Passwords do not match');
        return false;
      }
      if (formData.password.length < 6) {
        setError('Password must be at least 6 characters');
        return false;
      }
    }

    return true;
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // Check for existing user by email in both Auth and Firestore
      const q = query(collection(db, 'users'), where('email', '==', formData.email));
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        setError('An account with this email already exists');
        setIsLoading(false);
        return;
      }

      // Also check if user exists in Firebase Auth
      try {
        const methods = await fetchSignInMethodsForEmail(auth, formData.email);
        if (methods.length > 0) {
          setError('An account with this email already exists');
          setIsLoading(false);
          return;
        }
      } catch (authError) {
        // If the email doesn't exist in Auth, continue
        console.log('Email not found in Auth, proceeding with signup');
      }

      // Create user in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        formData.email,
        formData.password
      );
      const uid = userCredential.user.uid;

      // Create user profile in Firestore
      const userData: UserData = {
        email: formData.email,
        role: formData.role,
        firstName: formData.firstName,
        lastName: formData.lastName,
        approved: false, // User must be approved by admin
      };

      await setDoc(doc(db, 'users', uid), {
        ...userData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // Create approval notification for directors/centre heads
      await addDoc(collection(db, 'notifications'), {
        type: 'approval_request',
        message: `${formData.firstName} ${formData.lastName} (${formData.email}) requested access as ${formData.role}`,
        createdAt: serverTimestamp(),
        forRoles: ['director', 'centre_head'],
        userId: uid,
        seen: false,
      });

      toast({
        title: 'Account created successfully!',
        description: 'Your account is pending approval. You will be notified once approved.',
      });

      // Reset form
      setFormData({
        email: '',
        password: '',
        confirmPassword: '',
        firstName: '',
        lastName: '',
        role: '',
      });

    } catch (error: any) {
      console.error('Sign up error:', error);
      if (error.code === 'auth/email-already-in-use') {
        setError('An account with this email already exists');
      } else if (error.code === 'auth/weak-password') {
        setError('Password is too weak');
      } else {
        setError('Failed to create account. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      // Use Firebase Auth for sign in
      await signIn(formData.email, formData.password);

      // Reset form
      setFormData({
        email: '',
        password: '',
        confirmPassword: '',
        firstName: '',
        lastName: '',
        role: '',
      });

    } catch (error: any) {
      console.error('Sign in error:', error);
      if (error.code === 'auth/user-not-found') {
        setError('User not found. Please sign up first.');
      } else if (error.code === 'auth/wrong-password') {
        setError('Invalid password. Please try again.');
      } else if (error.code === 'auth/user-disabled') {
        setError('Your account has been disabled. Please contact your administrator.');
      } else {
        setError('Failed to sign in. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };



  // Render user status notification
  const renderUserStatus = () => {
    if (!userStatus || !formData.email) return null;

    if (userStatus.exists) {
      if (userStatus.approved) {
        return (
          <Alert className="border-green-200 bg-green-50 mb-4">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-700">
              Account found and approved! You can sign in.
            </AlertDescription>
          </Alert>
        );
      } else if (userStatus.rejected) {
        return (
          <Alert className="border-red-200 bg-red-50 mb-4">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-700">
              Your account request has been rejected. Please contact your administrator.
            </AlertDescription>
          </Alert>
        );
      } else {
        return (
          <Alert className="border-orange-200 bg-orange-50 mb-4">
            <Clock className="h-4 w-4 text-orange-600" />
            <AlertDescription className="text-orange-700">
              Your account is pending approval. You will be notified once approved.
            </AlertDescription>
          </Alert>
        );
      }
    }
    // Do not render anything if user does not exist
    return null;
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-blue-100 via-blue-50 to-white p-4">
      <div className="w-full max-w-md mx-auto">
        <Card className="bg-white border border-blue-100 shadow-xl rounded-2xl">
          <CardHeader className="text-center pb-4 pt-8 px-8">
            <div className="flex justify-center mb-3">
              <img
                src={Logo}
                alt="ZICA Logo"
                className="w-14 h-14 rounded-full object-cover shadow-lg border-2 border-blue-100 bg-white"
                style={{ maxHeight: 56, maxWidth: 56 }}
              />
            </div>
            <CardTitle className="text-2xl font-bold text-blue-800 mb-1">ZICA, PCMC CRM</CardTitle>
            <CardDescription className="text-blue-400 text-base font-medium mb-2">Sign in to your account or create a new one</CardDescription>
          </CardHeader>
          <CardContent className="px-8 pb-10 pt-2">
            <Tabs value={isSignUp ? 'signup' : 'signin'} onValueChange={(value) => setIsSignUp(value === 'signup')} className="w-full">
              <TabsList className="grid w-full grid-cols-2 bg-blue-50 p-1 rounded-full mb-7 border border-blue-100 relative">
                <TabsTrigger 
                  value="signin" 
                  className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-blue-400 data-[state=active]:text-white data-[state=active]:shadow-md rounded-full transition-all duration-200 text-sm font-semibold"
                >
                  Sign In
                </TabsTrigger>
                <TabsTrigger 
                  value="signup" 
                  className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-blue-400 data-[state=active]:text-white data-[state=active]:shadow-md rounded-full transition-all duration-200 text-sm font-semibold"
                >
                  Sign Up
                </TabsTrigger>
              </TabsList>

              <TabsContent value="signin" className="space-y-4 sm:space-y-5">
                {renderUserStatus()}
                <form onSubmit={handleSignIn} className="space-y-4 sm:space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="signin-email" className="text-sm font-semibold text-[#0072BB]">
                      Email Address
                    </Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-[#4FC3F7]" />
                      <Input
                        id="signin-email"
                        type="email"
                        placeholder="Enter your email"
                        value={formData.email}
                        onChange={(e) => handleInputChange('email', e.target.value)}
                        className="pl-10 h-12 border-blue-200 focus:border-blue-700 focus:ring-2 focus:ring-blue-200 focus:bg-blue-50 focus:outline-none rounded-xl transition-all duration-200 placeholder:text-blue-200 shadow-sm"
                        required
                        autoComplete="username"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signin-password" className="text-sm font-semibold text-[#0072BB]">
                      Password
                    </Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-[#4FC3F7]" />
                      <Input
                        id="signin-password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Enter your password"
                        value={formData.password}
                        onChange={(e) => handleInputChange('password', e.target.value)}
                        className="pl-10 pr-10 h-12 border-blue-200 focus:border-blue-700 focus:ring-2 focus:ring-blue-200 focus:bg-blue-50 focus:outline-none rounded-xl transition-all duration-200 placeholder:text-blue-200 shadow-sm"
                        autoComplete="current-password"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-[#4FC3F7] hover:text-[#0072BB] transition-colors"
                      >
                        {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    </div>
                    <p className="text-xs text-[#4FC3F7] font-medium">
                      Must be at least 6 characters long
                    </p>
                  </div>
                  {error && (
                    <Alert variant="destructive" className="border-red-200 bg-red-50">
                      <AlertDescription className="text-red-700 text-sm">{error}</AlertDescription>
                    </Alert>
                  )}
                  <Button 
                    type="submit" 
                    className="w-full h-12 bg-gradient-to-r from-blue-600 to-blue-400 hover:from-blue-700 hover:to-blue-500 text-white font-semibold tracking-wide rounded-full transition-all duration-200 shadow-lg hover:shadow-xl text-base py-2 focus:ring-4 focus:ring-blue-200 focus:outline-none"
                    disabled={isLoading}
                    title="Sign in to your account"
                  >
                    {isLoading ? (
                      <>
                        <InlineLoading size="sm" color="white" />
                        Signing In...
                      </>
                    ) : (
                      <>
                        <Sparkles className="mr-2 h-4 w-4" />
                        <span className="text-sm sm:text-base">Sign In</span>
                      </>
                    )}
                  </Button>


                </form>
              </TabsContent>

              <TabsContent value="signup" className="space-y-4 sm:space-y-5">
                {renderUserStatus()}
                <form onSubmit={handleSignUp} className="space-y-4 sm:space-y-5">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="signup-firstname" className="text-sm font-semibold text-[#0072BB]">
                        First Name
                      </Label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-[#4FC3F7]" />
                        <Input
                          id="signup-firstname"
                          type="text"
                          placeholder="First name"
                          value={formData.firstName}
                          onChange={(e) => handleInputChange('firstName', e.target.value)}
                          className="pl-10 h-12 border-blue-200 focus:border-blue-700 focus:ring-2 focus:ring-blue-200 focus:bg-blue-50 focus:outline-none rounded-xl transition-all duration-200 placeholder:text-blue-200 shadow-sm"
                          required
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-lastname" className="text-sm font-semibold text-[#0072BB]">
                        Last Name
                      </Label>
                      <Input
                        id="signup-lastname"
                        type="text"
                        placeholder="Last name"
                        value={formData.lastName}
                        onChange={(e) => handleInputChange('lastName', e.target.value)}
                        className="h-12 border-blue-200 focus:border-blue-700 focus:ring-2 focus:ring-blue-200 focus:bg-blue-50 focus:outline-none rounded-xl transition-all duration-200 placeholder:text-blue-200 shadow-sm"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-email" className="text-sm font-semibold text-[#0072BB]">
                      Email Address
                    </Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-[#4FC3F7]" />
                      <Input
                        id="signup-email"
                        type="email"
                        placeholder="Enter your email"
                        value={formData.email}
                        onChange={(e) => handleInputChange('email', e.target.value)}
                        className="pl-10 h-12 border-blue-200 focus:border-blue-700 focus:ring-2 focus:ring-blue-200 focus:bg-blue-50 focus:outline-none rounded-xl transition-all duration-200 placeholder:text-blue-200 shadow-sm"
                        required
                        autoComplete="username"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-role" className="text-sm font-semibold text-[#0072BB]">
                      Select Your Role
                    </Label>
                    <Select value={formData.role} onValueChange={(value) => handleInputChange('role', value)}>
                      <SelectTrigger className="h-12 border-blue-200 focus:border-blue-700 focus:ring-2 focus:ring-blue-200 focus:bg-blue-50 focus:outline-none rounded-xl transition-all duration-200 text-blue-700 shadow-sm">
                        <SelectValue placeholder="Choose your role" className="placeholder:text-[#81D4FA]" />
                      </SelectTrigger>
                      <SelectContent className="border-[#B3E0FF] bg-white">
                        <SelectItem value="teacher" className="text-[#0072BB] hover:bg-[#E3F3FF] focus:bg-[#E3F3FF]">Teacher</SelectItem>
                        <SelectItem value="centre_head" className="text-[#0072BB] hover:bg-[#E3F3FF] focus:bg-[#E3F3FF]">Centre Head</SelectItem>
                        <SelectItem value="director" className="text-[#0072BB] hover:bg-[#E3F3FF] focus:bg-[#E3F3FF]">Director</SelectItem>
                        <SelectItem value="accounts" className="text-[#0072BB] hover:bg-[#E3F3FF] focus:bg-[#E3F3FF]">Accounts</SelectItem>
                        <SelectItem value="marketing" className="text-[#0072BB] hover:bg-[#E3F3FF] focus:bg-[#E3F3FF]">Sales and Marketing</SelectItem>
                        <SelectItem value="accounting" className="text-[#0072BB] hover:bg-[#E3F3FF] focus:bg-[#E3F3FF]">Accounting</SelectItem>
                        <SelectItem value="academic_head" className="text-[#0072BB] hover:bg-[#E3F3FF] focus:bg-[#E3F3FF]">Academic Head</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-password" className="text-sm font-semibold text-[#0072BB]">
                      Password
                    </Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-[#4FC3F7]" />
                      <Input
                        id="signup-password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Create a password"
                        value={formData.password}
                        onChange={(e) => handleInputChange('password', e.target.value)}
                        className="pl-10 pr-10 h-12 border-blue-200 focus:border-blue-700 focus:ring-2 focus:ring-blue-200 focus:bg-blue-50 focus:outline-none rounded-xl transition-all duration-200 placeholder:text-blue-200 shadow-sm"
                        autoComplete="new-password"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-[#4FC3F7] hover:text-[#0072BB] transition-colors"
                      >
                        {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    </div>
                    <p className="text-xs text-[#4FC3F7] font-medium">
                      Must be at least 6 characters long
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-confirm-password" className="text-sm font-semibold text-[#0072BB]">
                      Confirm Password
                    </Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-[#4FC3F7]" />
                      <Input
                        id="signup-confirm-password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Confirm your password"
                        value={formData.confirmPassword}
                        onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                        className="pl-10 h-12 border-blue-200 focus:border-blue-700 focus:ring-2 focus:ring-blue-200 focus:bg-blue-50 focus:outline-none rounded-xl transition-all duration-200 placeholder:text-blue-200 shadow-sm"
                        required
                      />
                    </div>
                  </div>

                  {error && (
                    <Alert variant="destructive" className="border-red-200 bg-red-50">
                      <AlertDescription className="text-red-700 text-sm">{error}</AlertDescription>
                    </Alert>
                  )}

                  <Button 
                    type="submit" 
                    className="w-full h-12 bg-gradient-to-r from-blue-600 to-blue-400 hover:from-blue-700 hover:to-blue-500 text-white font-semibold tracking-wide rounded-full transition-all duration-200 shadow-lg hover:shadow-xl text-base py-2 focus:ring-4 focus:ring-blue-200 focus:outline-none"
                    disabled={isLoading}
                    title="Create your account"
                  >
                    {isLoading ? (
                      <>
                        <InlineLoading size="sm" color="white" />
                        Creating Account...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="mr-2 h-4 w-4" />
                        <span className="text-sm sm:text-base">Create Account</span>
                      </>
                    )}
                  </Button>


                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>


    </div>
  );
} 