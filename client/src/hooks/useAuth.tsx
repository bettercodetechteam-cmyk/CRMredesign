import { useState, useEffect, createContext, useContext, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User as FirebaseUser,
  onAuthStateChanged,
  signOut as firebaseSignOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs, addDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';

import type { ModulePermission } from '@shared/permissions';

interface UserProfile {
  id: string; // Document ID (Firebase UID)
  uid: string; // Keep for backward compatibility
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  centreId?: string;
  createdAt?: Date;
  updatedAt?: Date;
  approved?: boolean;
  permissionsGranted?: ModulePermission[];
  permissionsRevoked?: ModulePermission[];
}

interface AuthContextType {
  user: FirebaseUser | null;
  userProfile: UserProfile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, userData: Partial<UserProfile>) => Promise<void>;

  resetPassword: (email: string) => Promise<void>;
  refreshUserProfile: () => Promise<void>;
  updateProfile?: (userData: Partial<UserProfile>) => Promise<void>;
  login?: (userData: any, role?: string) => void; // Keep for Director demo only
  reloadFromStorage?: () => void;
}

// Create context with a default value
const AuthContext = createContext<AuthContextType>({
  user: null,
  userProfile: null,
  loading: false,
  signOut: async () => {},
  signIn: async () => {},
  signUp: async () => {},

  resetPassword: async () => {},
  refreshUserProfile: async () => {},
  updateProfile: async () => {},
  login: () => {},
  reloadFromStorage: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchUserProfile = async (uid: string): Promise<UserProfile | null> => {
    if (!db) {
      console.warn('⚠️ Firebase Firestore is not initialized. Cannot fetch user profile.');
      return null;
    }
    
    try {
      const userDoc = await getDoc(doc(db, 'users', uid));

      if (userDoc.exists()) {
        const data = userDoc.data();
        const approvedStatus = data.approved === true;

        const profile = {
          id: uid,
          uid,
          email: data.email,
          firstName: data.firstName,
          lastName: data.lastName,
          role: data.role,
          centreId: data.centreId || 'default-centre',
          createdAt: data.createdAt?.toDate?.() ?? data.createdAt,
          updatedAt: data.updatedAt?.toDate?.() ?? data.updatedAt,
          approved: approvedStatus,
          permissionsGranted: data.permissionsGranted ?? [],
          permissionsRevoked: data.permissionsRevoked ?? [],
        };

        return profile;
      }

      return null;
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('❌ Error fetching user profile:', error);
      }
      return null;
    }
  };

  const bootstrapUserProfile = async (firebaseUser: FirebaseUser): Promise<void> => {
    const token = await firebaseUser.getIdToken();
    const displayParts = firebaseUser.displayName?.split(' ') ?? [];
    const response = await fetch('/api/auth/bootstrap-profile', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        firstName: displayParts[0] || 'User',
        lastName: displayParts.slice(1).join(' ') || '',
      }),
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.success) {
      throw new Error(result.message || 'Failed to set up user profile');
    }
  };

  const ensureUserProfile = async (firebaseUser: FirebaseUser): Promise<UserProfile | null> => {
    let profile = await fetchUserProfile(firebaseUser.uid);
    if (profile) {
      return profile;
    }

    await bootstrapUserProfile(firebaseUser);
    profile = await fetchUserProfile(firebaseUser.uid);
    return profile;
  };

  const refreshUserProfile = useCallback(async () => {
    if (user) {
      const profile = await fetchUserProfile(user.uid);
      setUserProfile(profile);
    }
  }, [user]);

  const signOut = useCallback(async () => {
    try {
      if (auth && auth.currentUser) {
        await firebaseSignOut(auth);
      }
      
      clearAllSessionData();
      setUser(null);
      setUserProfile(null);
      navigate('/');
      
    } catch (error) {
      console.error('Error during sign out:', error);
      clearAllSessionData();
      setUser(null);
      setUserProfile(null);
      navigate('/');
    }
  }, [navigate]);

  const clearAllSessionData = useCallback(() => {
    localStorage.removeItem('demoUser');
    localStorage.removeItem('demoUserProfile');
    localStorage.removeItem('authToken');
    localStorage.removeItem('userSession');
    localStorage.removeItem('userProfile');
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!auth) {
      const errorMsg = import.meta.env.PROD 
        ? 'Firebase is not configured. Please contact your administrator. The application needs to be rebuilt with Firebase environment variables.'
        : 'Firebase Auth is not initialized. Please check your .env file and restart the dev server.';
      throw new Error(errorMsg);
    }
    
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const firebaseUser = userCredential.user;
      
      const userProfile = await ensureUserProfile(firebaseUser);
      
      if (!userProfile) {
        throw new Error('Failed to load user profile. Please try again.');
      }

      if (userProfile.approved === false) {
        await firebaseSignOut(auth);
        throw new Error('Your account is pending approval. Please contact your administrator.');
      }
      
    } catch (error: any) {
      console.error('Sign in failed:', error);
      
      // Handle specific Firebase Auth errors
      if (error.code === 'auth/user-not-found') {
        throw new Error('No account found with this email address');
      } else if (error.code === 'auth/wrong-password') {
        throw new Error('Invalid email or password');
      } else if (error.code === 'auth/too-many-requests') {
        throw new Error('Too many failed attempts. Please try again later.');
      } else if (error.code === 'auth/user-disabled') {
        throw new Error('This account has been disabled. Please contact support.');
      } else if (error.code === 'permission-denied') {
        throw new Error('Account setup failed due to permissions. Please contact your administrator.');
      } else {
        throw new Error(error.message || 'Sign in failed. Please try again.');
      }
    }
  }, []);

  const signUp = useCallback(async (email: string, password: string, userData: Partial<UserProfile>) => {
    if (!auth) {
      const errorMsg = import.meta.env.PROD 
        ? 'Firebase is not configured. Please contact your administrator. The application needs to be rebuilt with Firebase environment variables.'
        : 'Firebase Auth is not initialized. Please check your .env file and restart the dev server.';
      throw new Error(errorMsg);
    }
    
    if (!db) {
      const errorMsg = import.meta.env.PROD 
        ? 'Firebase is not configured. Please contact your administrator. The application needs to be rebuilt with Firebase environment variables.'
        : 'Firebase Firestore is not initialized. Please check your .env file and restart the dev server.';
      throw new Error(errorMsg);
    }
    
    try {
      
      // Create user in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const firebaseUser = userCredential.user;
      
      // Create user profile in Firestore
      const profileData = {
        uid: firebaseUser.uid,
        email,
        firstName: userData.firstName || '',
        lastName: userData.lastName || '',
        role: 'pending',
        centreId: userData.centreId || 'demo-centre-001',
        createdAt: new Date(),
        updatedAt: new Date(),
        approved: false,
        permissionsGranted: [],
        permissionsRevoked: [],
      };

      await setDoc(doc(db, 'users', firebaseUser.uid), profileData);
    } catch (error: any) {
      console.error('Error signing up:', error);
      
      // Handle specific Firebase Auth errors
      if (error.code === 'auth/email-already-in-use') {
        throw new Error('An account with this email already exists');
      } else if (error.code === 'auth/weak-password') {
        throw new Error('Password should be at least 6 characters long');
      } else if (error.code === 'auth/invalid-email') {
        throw new Error('Please enter a valid email address');
      } else {
        throw new Error(error.message || 'Failed to create account. Please try again.');
      }
    }
  }, []);




  const resetPassword = useCallback(async (email: string) => {
    if (!auth) {
      const errorMsg = import.meta.env.PROD 
        ? 'Firebase is not configured. Please contact your administrator.'
        : 'Firebase Auth is not initialized. Please check your .env file and restart the dev server.';
      throw new Error(errorMsg);
    }
    
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (error) {
      console.error('Error sending password reset email:', error);
      throw error;
    }
  }, []);

  const updateProfile = useCallback(async (userData: Partial<UserProfile>) => {
    if (!db) {
      throw new Error('Firebase Firestore is not initialized. Please check environment variables.');
    }
    
    try {
      if (!userProfile?.uid) {
        throw new Error('No user profile found');
      }

      const userRef = doc(db, 'users', userProfile.uid);
      const updateData = {
        ...userData,
        updatedAt: new Date(),
      };

      await updateDoc(userRef, updateData);

      const updatedProfile = {
        ...userProfile,
        ...userData,
        updatedAt: new Date(),
      };
      setUserProfile(updatedProfile);

      if (localStorage.getItem('demoUserProfile')) {
        localStorage.setItem('demoUserProfile', JSON.stringify(updatedProfile));
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      throw error;
    }
  }, [userProfile]);

  const reloadFromStorage = useCallback(() => {}, []);

  const login = useCallback(() => {}, []);

  // Listen to Firebase authentication state changes
  useEffect(() => {
    // Check if auth is initialized before using it
    if (!auth) {
      console.warn('⚠️ Firebase Auth is not initialized. Authentication features will not work.');
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      
      if (firebaseUser) {
        setUser(firebaseUser);
        try {
          const profile = await ensureUserProfile(firebaseUser);
          setUserProfile(profile);
        } catch (bootstrapError) {
          console.error('Failed to load user profile:', bootstrapError);
          setUserProfile(null);
        }
        setLoading(false);
      } else {
        clearAllSessionData();
        setUser(null);
        setUserProfile(null);
      }
      
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (user && !userProfile && !loading) {
      refreshUserProfile();
    }
  }, [user, userProfile, loading, refreshUserProfile]);

  useEffect(() => {
    if (user && !loading) {
      sessionStorage.setItem('sessionActive', 'true');
      sessionStorage.setItem('sessionStartTime', Date.now().toString());
    }
  }, [user, loading]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && user) {
        refreshUserProfile();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user, refreshUserProfile]);

  const value = useMemo(() => ({
    user,
    userProfile,
    loading,
    signOut,
    signIn,
    signUp,
    resetPassword,
    refreshUserProfile,
    updateProfile,
    login,
    reloadFromStorage,
  }), [user, userProfile, loading, signOut, signIn, signUp, resetPassword, refreshUserProfile, updateProfile, login, reloadFromStorage]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

import { normalizeRole as normalizeRoleShared, isDirectorRole } from '@shared/permissions';

export function useRole() {
  const { userProfile } = useAuth();
  
  const hasRole = (roles: string | string[]) => {
    if (!userProfile) return false;
    const roleArray = Array.isArray(roles) ? roles : [roles];
    const userRole = normalizeRoleShared(userProfile.role);
    return roleArray.some((r) => normalizeRoleShared(r) === userRole);
  };

  const isAdmin = () => isDirector();
  const isFaculty = () => hasRole(['faculty', 'academic_head']);
  const isStudent = () => hasRole(['student']);
  const isDirector = () => isDirectorRole(userProfile?.role);

  return {
    role: userProfile?.role || null,
    hasRole,
    isAdmin,
    isFaculty,
    isStudent,
    isDirector,
  };
}