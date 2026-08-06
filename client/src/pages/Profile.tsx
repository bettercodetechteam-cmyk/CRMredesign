import { useState, useEffect, useRef } from 'react';
import { useAuth, useRole } from '../hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Separator } from '../components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '../components/ui/form';
import { Switch } from '../components/ui/switch';
import { useToast } from '../hooks/use-toast';
import { 
  User, 
  Mail, 
  Building, 
  Calendar, 
  Shield, 
  Edit, 
  Camera, 
  Lock, 
  Bell, 
  Globe, 
  Smartphone,
  MapPin,
  Briefcase,
  Award,
  Activity,
  Settings,
  Key,
  Eye,
  EyeOff,
  Save,
  X,
  CheckCircle,
  AlertCircle,
  Clock,
  LogOut,
  Upload
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { InlineLoading } from '../components/ui/loading';

// Form validation schemas
const profileSchema = z.object({
  firstName: z.string().min(2, 'First name must be at least 2 characters'),
  lastName: z.string().min(2, 'Last name must be at least 2 characters'),
  phone: z.string().optional(),
  address: z.string().optional(),
  bio: z.string().max(500, 'Bio must be less than 500 characters').optional(),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string().min(1, 'Please confirm your password'),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

export default function Profile() {
  const { userProfile, updateProfile, signOut } = useAuth();
  const { role } = useRole();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [isEnabling2FA, setIsEnabling2FA] = useState(false);
  const [privacySettings, setPrivacySettings] = useState({
    profileVisibility: 'public',
    dataSharing: false,
  });
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const [notifications, setNotifications] = useState({
    email: userProfile?.notificationPreferences?.email ?? true,
    push: userProfile?.notificationPreferences?.push ?? false,
    sms: userProfile?.notificationPreferences?.sms ?? true,
    marketing: userProfile?.notificationPreferences?.marketing ?? false,
  });

  // Update notifications when userProfile changes
  useEffect(() => {
    if (userProfile?.notificationPreferences) {
      setNotifications({
        email: userProfile.notificationPreferences.email ?? true,
        push: userProfile.notificationPreferences.push ?? false,
        sms: userProfile.notificationPreferences.sms ?? true,
        marketing: userProfile.notificationPreferences.marketing ?? false,
      });
    }
  }, [userProfile?.notificationPreferences]);

  // File input ref for profile image
  const fileInputRef = useRef<HTMLInputElement>(null);

  const profileForm = useForm({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstName: userProfile?.firstName || '',
      lastName: userProfile?.lastName || '',
      phone: userProfile?.phone || '',
      address: userProfile?.address || '',
      bio: userProfile?.bio || '',
    },
  });

  const passwordForm = useForm({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  });

  const getRoleDisplayName = (role: string) => {
    const roleMap: { [key: string]: string } = {
      'director': 'Director',
      'centre_head': 'Centre Head',
      'faculty': 'Faculty',
      'admin': 'Administrator',
      'marketing': 'Sales and Marketing',
      'accounting': 'Accounting',
      'academic_head': 'Academic Head',
      'student': 'Student',
    };
    return roleMap[role] || role;
  };

  const getRoleColor = (role: string) => {
    const colorMap: { [key: string]: string } = {
      'director': 'bg-purple-100 text-purple-800 border-purple-200',
      'centre_head': 'bg-blue-100 text-blue-800 border-blue-200',
      'faculty': 'bg-green-100 text-green-800 border-green-200',
      'admin': 'bg-orange-100 text-orange-800 border-orange-200',
      'marketing': 'bg-pink-100 text-pink-800 border-pink-200',
      'accounting': 'bg-amber-100 text-amber-800 border-amber-200',
      'academic_head': 'bg-indigo-100 text-indigo-800 border-indigo-200',
      'student': 'bg-gray-100 text-gray-800 border-gray-200',
    };
    return colorMap[role] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  const getRoleDescription = (role: string) => {
    const descriptions: { [key: string]: string } = {
      'director': 'Full system access and management capabilities',
      'centre_head': 'Centre management and oversight responsibilities',
      'faculty': 'Teaching and student management access',
      'admin': 'Administrative tasks and support functions',
      'marketing': 'Sales and marketing responsibilities',
      'accounting': 'Finance and accounts access',
      'academic_head': 'Academic leadership and oversight',
      'student': 'Student access and course materials',
    };
    return descriptions[role] || 'Standard user access';
  };

  const handleProfileUpdate = async (data: any) => {
    setIsLoading(true);
    try {
      if (!userProfile?.uid) {
        throw new Error('User not authenticated');
      }

      // Update profile in Firestore
      const userRef = doc(db, 'users', userProfile.uid);
      const updateData = {
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone || '',
        address: data.address || '',
        bio: data.bio || '',
        updatedAt: new Date(),
      };

      await updateDoc(userRef, updateData);

      // Update local profile state
      if (updateProfile) {
        await updateProfile({
          ...userProfile,
          ...updateData,
        });
      }
      
      toast({
        title: "Profile Updated",
        description: "Your profile has been successfully updated.",
      });
      
      setIsEditing(false);
    } catch (error: any) {
      console.error('Profile update error:', error);
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update profile. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordChange = async (data: any) => {
    setIsLoading(true);
    try {
      if (!auth) {
        throw new Error('Firebase Auth is not initialized. Please check environment variables.');
      }
      
      const user = auth.currentUser;
      if (!user || !user.email) {
        throw new Error('User not authenticated');
      }

      // Re-authenticate user before password change
      const credential = EmailAuthProvider.credential(user.email, data.currentPassword);
      await reauthenticateWithCredential(user, credential);

      // Update password
      await updatePassword(user, data.newPassword);
      
      toast({
        title: "Password Changed",
        description: "Your password has been successfully updated.",
      });
      
      setShowPasswordDialog(false);
      passwordForm.reset();
    } catch (error: any) {
      console.error('Password change error:', error);
      let errorMessage = "Failed to change password. Please try again.";
      
      if (error.code === 'auth/wrong-password') {
        errorMessage = "Current password is incorrect.";
      } else if (error.code === 'auth/weak-password') {
        errorMessage = "New password is too weak. Please choose a stronger password.";
      } else if (error.code === 'auth/requires-recent-login') {
        errorMessage = "Please log in again to change your password.";
      }
      
      toast({
        title: "Password Change Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleNotificationToggle = async (key: string) => {
    const newNotifications = {
      ...notifications,
      [key]: !notifications[key as keyof typeof notifications]
    };
    
    setNotifications(newNotifications);
    
    try {
      if (!userProfile?.uid) {
        throw new Error('User not authenticated');
      }

      // Update notification preferences in Firestore
      const userRef = doc(db, 'users', userProfile.uid);
      await updateDoc(userRef, {
        notificationPreferences: newNotifications,
        updatedAt: new Date(),
      });

      // Update local profile state
      if (updateProfile) {
        await updateProfile({
          ...userProfile,
          notificationPreferences: newNotifications,
        });
      }

      toast({
        title: "Preferences Updated",
        description: "Your notification preferences have been saved.",
      });
    } catch (error: any) {
      console.error('Notification update error:', error);
      // Revert the change if save failed
      setNotifications(notifications);
      toast({
        title: "Update Failed",
        description: "Failed to save notification preferences. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleProfileImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid File",
        description: "Please select an image file.",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File Too Large",
        description: "Please select an image smaller than 5MB.",
        variant: "destructive",
      });
      return;
    }

    setIsUploadingImage(true);
    try {
      // For now, we'll simulate the upload
      // In a real implementation, you would upload to Firebase Storage or ImageKit
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Simulate successful upload
      const imageUrl = URL.createObjectURL(file);
      
      // Update profile with new image URL
      if (userProfile?.uid && updateProfile) {
        const userRef = doc(db, 'users', userProfile.uid);
        await updateDoc(userRef, {
          profileImageUrl: imageUrl,
          updatedAt: new Date(),
        });

        await updateProfile({
          ...userProfile,
          profileImageUrl: imageUrl,
        });
      }

      toast({
        title: "Profile Image Updated",
        description: "Your profile image has been successfully updated.",
      });
    } catch (error: any) {
      console.error('Image upload error:', error);
      toast({
        title: "Upload Failed",
        description: "Failed to upload profile image. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploadingImage(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleImageClick = () => {
    fileInputRef.current?.click();
  };

  const handle2FAToggle = async () => {
    setIsEnabling2FA(true);
    try {
      // Simulate 2FA setup process
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      setTwoFactorEnabled(!twoFactorEnabled);
      
      toast({
        title: twoFactorEnabled ? "2FA Disabled" : "2FA Enabled",
        description: twoFactorEnabled 
          ? "Two-factor authentication has been disabled."
          : "Two-factor authentication has been enabled. Please complete the setup process.",
      });
    } catch (error: any) {
      console.error('2FA toggle error:', error);
      toast({
        title: "2FA Update Failed",
        description: "Failed to update 2FA settings. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsEnabling2FA(false);
    }
  };

  const handlePrivacySettingChange = async (setting: string, value: any) => {
    const newSettings = {
      ...privacySettings,
      [setting]: value,
    };
    
    setPrivacySettings(newSettings);
    
    try {
      if (!userProfile?.uid) {
        throw new Error('User not authenticated');
      }

      // Update privacy settings in Firestore
      const userRef = doc(db, 'users', userProfile.uid);
      await updateDoc(userRef, {
        privacySettings: newSettings,
        updatedAt: new Date(),
      });

      // Update local profile state
      if (updateProfile) {
        await updateProfile({
          ...userProfile,
          privacySettings: newSettings,
        });
      }

      toast({
        title: "Privacy Settings Updated",
        description: "Your privacy settings have been saved.",
      });
    } catch (error: any) {
      console.error('Privacy settings update error:', error);
      // Revert the change if save failed
      setPrivacySettings(privacySettings);
      toast({
        title: "Update Failed",
        description: "Failed to save privacy settings. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleLogout = async () => {
    try {
      await signOut();
      // No need for toast since we're redirecting immediately
    } catch (error: any) {
      console.error('Logout error:', error);
      // Even if there's an error, the signOut function will handle the redirect
    }
  };

  if (!userProfile) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <User className="w-8 h-8 text-gray-400" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Profile Not Found</h2>
          <p className="text-gray-600">Unable to load user profile.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Profile Settings</h1>
          <p className="text-gray-600 mt-1">Manage your account settings and preferences</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={showLogoutDialog} onOpenChange={setShowLogoutDialog}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <LogOut className="w-4 h-4 mr-2" />
                Sign Out
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Confirm Logout</DialogTitle>
                <DialogDescription>
                  Are you sure you want to log out? You will need to sign in again to access your account.
                </DialogDescription>
              </DialogHeader>
              <div className="flex justify-end space-x-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setShowLogoutDialog(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleLogout}
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Logout
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 gap-1 p-1 bg-gray-100 rounded-lg">
          <TabsTrigger value="overview" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm font-medium px-3 py-2.5 rounded-md transition-all duration-300 data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-md data-[state=active]:font-semibold hover:bg-gray-50 hover:shadow-sm">
            <User className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">Overview</span>
            <span className="sm:hidden">Overview</span>
          </TabsTrigger>
          <TabsTrigger value="personal" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm font-medium px-3 py-2.5 rounded-md transition-all duration-300 data-[state=active]:bg-white data-[state=active]:text-green-600 data-[state=active]:shadow-md data-[state=active]:font-semibold hover:bg-gray-50 hover:shadow-sm">
            <Edit className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">Personal</span>
            <span className="sm:hidden">Personal</span>
          </TabsTrigger>
          <TabsTrigger value="security" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm font-medium px-3 py-2.5 rounded-md transition-all duration-300 data-[state=active]:bg-white data-[state=active]:text-orange-600 data-[state=active]:shadow-md data-[state=active]:font-semibold hover:bg-gray-50 hover:shadow-sm">
            <Shield className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">Security</span>
            <span className="sm:hidden">Security</span>
          </TabsTrigger>
          <TabsTrigger value="preferences" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm font-medium px-3 py-2.5 rounded-md transition-all duration-300 data-[state=active]:bg-white data-[state=active]:text-purple-600 data-[state=active]:shadow-md data-[state=active]:font-semibold hover:bg-gray-50 hover:shadow-sm">
            <Settings className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">Preferences</span>
            <span className="sm:hidden">Preferences</span>
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Profile Card */}
            <Card className="lg:col-span-1">
              <CardHeader className="text-center pb-4">
                <div className="relative inline-block">
                  <Avatar className="h-32 w-32 mx-auto mb-4 ring-4 ring-white shadow-lg">
                    <AvatarImage src={userProfile.profileImageUrl || undefined} alt="Profile" />
                    <AvatarFallback className="text-3xl bg-gradient-to-br from-blue-500 to-purple-600 text-white">
                      {userProfile.firstName?.[0]}{userProfile.lastName?.[0]}
                    </AvatarFallback>
                  </Avatar>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="absolute bottom-6 right-0 rounded-full w-8 h-8 p-0"
                    onClick={handleImageClick}
                    disabled={isUploadingImage}
                    title="Change Profile Picture"
                  >
                    {isUploadingImage ? (
                      <InlineLoading size="sm" color="primary" />
                    ) : (
                      <Camera className="w-4 h-4" />
                    )}
                  </Button>
                  {/* Hidden file input */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleProfileImageUpload}
                    className="hidden"
                  />
                </div>
                <CardTitle className="text-2xl font-bold">
                  {userProfile.firstName} {userProfile.lastName}
                </CardTitle>
                <CardDescription className="text-base">{userProfile.email}</CardDescription>
                <Badge className={`mt-3 px-3 py-1 text-sm font-medium ${getRoleColor(role || '')}`}>
                  {role ? getRoleDisplayName(role) : 'User'}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                    <Mail className="h-4 w-4 text-gray-500" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">Email</p>
                      <p className="text-sm text-gray-600">{userProfile.email}</p>
                    </div>
                  </div>
                  {userProfile.phone && (
                    <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                      <Smartphone className="h-4 w-4 text-gray-500" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">Phone</p>
                        <p className="text-sm text-gray-600">{userProfile.phone}</p>
                      </div>
                    </div>
                  )}
                  {userProfile.centreId && (
                    <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                      <Building className="h-4 w-4 text-gray-500" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">Centre</p>
                        <p className="text-sm text-gray-600">{userProfile.centreId}</p>
                      </div>
                    </div>
                  )}
                  {userProfile.createdAt && (
                    <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                      <Calendar className="h-4 w-4 text-gray-500" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">Member Since</p>
                        <p className="text-sm text-gray-600">
                          {(() => {
                            const d = new Date(userProfile.createdAt);
                            const day = d.getDate().toString().padStart(2, '0');
                            const month = (d.getMonth() + 1).toString().padStart(2, '0');
                            const year = d.getFullYear();
                            return `${day}/${month}/${year}`;
                          })()}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Role & Permissions */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Role & Permissions
                </CardTitle>
                <CardDescription>
                  Your current role and associated permissions
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                        <Award className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">
                          {role ? getRoleDisplayName(role) : 'User'}
                        </p>
                        <p className="text-sm text-gray-600">
                          {role ? getRoleDescription(role) : 'Standard user access'}
                        </p>
                      </div>
                    </div>
                    <Badge className={`px-3 py-1 ${getRoleColor(role || '')}`}>
                      Active
                    </Badge>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 border rounded-lg">
                      <div className="flex items-center space-x-2 mb-2">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        <span className="font-medium text-sm">Permissions</span>
                      </div>
                      <ul className="text-sm text-gray-600 space-y-1">
                        <li>• View dashboard</li>
                        <li>• Access reports</li>
                        <li>• Manage profile</li>
                        {role === 'director' && <li>• Full system access</li>}
                        {role === 'centre_head' && <li>• Centre management</li>}
                        {role === 'faculty' && <li>• Student management</li>}
                      </ul>
                    </div>

                    <div className="p-4 border rounded-lg">
                      <div className="flex items-center space-x-2 mb-2">
                        <Activity className="w-4 h-4 text-blue-500" />
                        <span className="font-medium text-sm">Recent Activity</span>
                      </div>
                      <div className="text-sm text-gray-600 space-y-2">
                        <div className="flex items-center space-x-2">
                          <Clock className="w-3 h-3" />
                          <span>Last login: 2 hours ago</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Globe className="w-3 h-3" />
                          <span>IP: 192.168.1.100</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Personal Information Tab */}
        <TabsContent value="personal" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5" />
                    Personal Information
                  </CardTitle>
                  <CardDescription>
                    Update your personal information and contact details
                  </CardDescription>
                </div>
                <Button
                  variant={isEditing ? "outline" : "default"}
                  onClick={() => setIsEditing(!isEditing)}
                  disabled={isLoading}
                >
                  {isEditing ? (
                    <>
                      <X className="w-4 h-4 mr-2" />
                      Cancel
                    </>
                  ) : (
                    <>
                      <Edit className="w-4 h-4 mr-2" />
                      Edit Profile
                    </>
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Form {...profileForm}>
                <form onSubmit={profileForm.handleSubmit(handleProfileUpdate)} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={profileForm.control}
                      name="firstName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>First Name</FormLabel>
                          <FormControl>
                            <Input {...field} disabled={!isEditing} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={profileForm.control}
                      name="lastName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Last Name</FormLabel>
                          <FormControl>
                            <Input {...field} disabled={!isEditing} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={profileForm.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone Number</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="+91 98765 43210" disabled={!isEditing} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={profileForm.control}
                    name="address"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Address</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Enter your address" disabled={!isEditing} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={profileForm.control}
                    name="bio"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Bio</FormLabel>
                        <FormControl>
                          <textarea
                            {...field}
                            className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            placeholder="Tell us about yourself..."
                            disabled={!isEditing}
                          />
                        </FormControl>
                        <FormDescription>
                          Brief description about yourself (max 500 characters)
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {isEditing && (
                    <div className="flex justify-end space-x-2 pt-4 border-t">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setIsEditing(false)}
                        disabled={isLoading}
                      >
                        Cancel
                      </Button>
                      <Button type="submit" disabled={isLoading}>
                        {isLoading ? (
                          <>
                            <InlineLoading size="sm" color="primary" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <Save className="w-4 h-4 mr-2" />
                            Save Changes
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Password Change */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lock className="h-5 w-5" />
                  Change Password
                </CardTitle>
                <CardDescription>
                  Update your password to keep your account secure
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-gray-600">
                  Ensure your password is strong and unique. We recommend using a combination of letters, numbers, and special characters.
                </p>
                <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
                  <DialogTrigger asChild>
                    <Button>
                      <Key className="w-4 h-4 mr-2" />
                      Change Password
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                      <DialogTitle>Change Password</DialogTitle>
                      <DialogDescription>
                        Enter your current password and choose a new one.
                      </DialogDescription>
                    </DialogHeader>
                    <Form {...passwordForm}>
                      <form onSubmit={passwordForm.handleSubmit(handlePasswordChange)} className="space-y-4">
                        <FormField
                          control={passwordForm.control}
                          name="currentPassword"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Current Password</FormLabel>
                              <FormControl>
                                <div className="relative">
                                  <Input
                                    {...field}
                                    type={showPassword ? "text" : "password"}
                                    placeholder="Enter current password"
                                  />
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                                    onClick={() => setShowPassword(!showPassword)}
                                  >
                                    {showPassword ? (
                                      <EyeOff className="h-4 w-4" />
                                    ) : (
                                      <Eye className="h-4 w-4" />
                                    )}
                                  </Button>
                                </div>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={passwordForm.control}
                          name="newPassword"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>New Password</FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  type="password"
                                  placeholder="Enter new password"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={passwordForm.control}
                          name="confirmPassword"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Confirm New Password</FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  type="password"
                                  placeholder="Confirm new password"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <div className="flex justify-end space-x-2 pt-4">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setShowPasswordDialog(false)}
                            disabled={isLoading}
                          >
                            Cancel
                          </Button>
                          <Button type="submit" disabled={isLoading}>
                            {isLoading ? (
                              <>
                                <InlineLoading size="sm" color="primary" />
                                Updating...
                              </>
                            ) : (
                              "Update Password"
                            )}
                          </Button>
                        </div>
                      </form>
                    </Form>
                  </DialogContent>
                </Dialog>
              </CardContent>
            </Card>

            {/* Two-Factor Authentication */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Two-Factor Authentication
                </CardTitle>
                <CardDescription>
                  Add an extra layer of security to your account
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                      <AlertCircle className="w-5 h-5 text-orange-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">2FA Status</p>
                      <p className="text-sm text-gray-600">
                        {twoFactorEnabled ? 'Enabled' : 'Not enabled'}
                      </p>
                    </div>
                  </div>
                  <Button 
                    variant="outline" 
                    onClick={handle2FAToggle}
                    disabled={isEnabling2FA}
                  >
                    {isEnabling2FA ? (
                      <>
                        <InlineLoading size="sm" color="primary" />
                        {twoFactorEnabled ? 'Disabling...' : 'Enabling...'}
                      </>
                    ) : (
                      twoFactorEnabled ? 'Disable 2FA' : 'Enable 2FA'
                    )}
                  </Button>
                </div>
                <p className="text-sm text-gray-600">
                  Two-factor authentication adds an extra layer of security by requiring a second form of verification in addition to your password.
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Login History */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Recent Login Activity
              </CardTitle>
              <CardDescription>
                Monitor your account access and security
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[
                  { time: '2 hours ago', location: 'Mumbai, India', device: 'Chrome on Windows', ip: '192.168.1.100', status: 'success' },
                  { time: '1 day ago', location: 'Mumbai, India', device: 'Mobile Safari', ip: '192.168.1.101', status: 'success' },
                  { time: '3 days ago', location: 'Delhi, India', device: 'Firefox on Mac', ip: '203.45.67.89', status: 'success' },
                ].map((login, index) => (
                  <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className={`w-2 h-2 rounded-full ${login.status === 'success' ? 'bg-green-500' : 'bg-red-500'}`} />
                      <div>
                        <p className="text-sm font-medium text-gray-900">{login.location}</p>
                        <p className="text-xs text-gray-600">{login.device} • {login.ip}</p>
                      </div>
                    </div>
                    <span className="text-xs text-gray-500">{login.time}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Preferences Tab */}
        <TabsContent value="preferences" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Notification Preferences
              </CardTitle>
              <CardDescription>
                Choose how you want to receive notifications
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                {Object.entries(notifications).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900 capitalize">
                        {key === 'email' && 'Email Notifications'}
                        {key === 'push' && 'Push Notifications'}
                        {key === 'sms' && 'SMS Notifications'}
                        {key === 'marketing' && 'Marketing Communications'}
                      </p>
                      <p className="text-sm text-gray-600">
                        {key === 'email' && 'Receive notifications via email'}
                        {key === 'push' && 'Get instant notifications on your device'}
                        {key === 'sms' && 'Receive important updates via SMS'}
                        {key === 'marketing' && 'Receive promotional and marketing content'}
                      </p>
                    </div>
                    <Switch
                      checked={value}
                      onCheckedChange={() => handleNotificationToggle(key)}
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                Privacy Settings
              </CardTitle>
              <CardDescription>
                Control your privacy and data sharing preferences
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">Profile Visibility</p>
                  <p className="text-sm text-gray-600">Control who can see your profile information</p>
                </div>
                <Select 
                  value={privacySettings.profileVisibility} 
                  onValueChange={(value) => handlePrivacySettingChange('profileVisibility', value)}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public">Public</SelectItem>
                    <SelectItem value="private">Private</SelectItem>
                    <SelectItem value="contacts">Contacts Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">Data Sharing</p>
                  <p className="text-sm text-gray-600">Manage how your data is shared with third parties</p>
                </div>
                <Switch
                  checked={privacySettings.dataSharing}
                  onCheckedChange={(checked) => handlePrivacySettingChange('dataSharing', checked)}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
} 