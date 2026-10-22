import { useState, useEffect, createContext, useContext, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User as FirebaseUser,
  onAuthStateChanged,
  signOut as firebaseSignOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail
} from 'firebase/auth';
import { doc, getDoc, getDocFromServer, onSnapshot, setDoc, updateDoc, collection, query, where, getDocs, addDoc } from 'firebase/firestore';
import { auth, db, firebaseOff } from '@/lib/firebase';

import type { ModulePermission } from '@shared/permissions';
import { homePathForRole, isDirectorEmail, getMigrationRoleForEmail, normalizeRole } from '@shared/permissions';
import { loginEmailForContact } from '@shared/syllabusLogic';

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

function facultyPendingSeenKey(uid: string): string {
  return `faculty-pending-seen:${uid}`;
}

function facultyPendingHoldKey(uid: string): string {
  return `faculty-pending-hold:${uid}`;
}

function markFacultyPendingShown(uid: string) {
  try {
    localStorage.setItem(facultyPendingSeenKey(uid), '1');
    sessionStorage.setItem(facultyPendingHoldKey(uid), '1');
  } catch {
    // Private browsing can block storage; the screen still shows this visit.
  }
}

function clearFacultyPendingHold(uid?: string) {
  if (!uid) return;
  try {
    sessionStorage.removeItem(facultyPendingHoldKey(uid));
  } catch {
    // Ignore storage failures during sign-out.
  }
}

/** Faculty see the waiting screen on the first sign-in only. Later visits go into the app. */
function facultyStillWaiting(profile: { uid?: string; role?: string; approved?: boolean } | null): boolean {
  if (!profile || profile.approved !== false) return false;
  if (normalizeRole(profile.role) !== 'faculty' || !profile.uid) return true;
  try {
    if (sessionStorage.getItem(facultyPendingHoldKey(profile.uid)) === '1') return true;
    if (localStorage.getItem(facultyPendingSeenKey(profile.uid)) === '1') return false;
  } catch {
    return true;
  }
  markFacultyPendingShown(profile.uid);
  return true;
}

function openFacultyAfterFirstPending(profile: UserProfile): UserProfile {
  if (profile.approved === false && normalizeRole(profile.role) === 'faculty' && !facultyStillWaiting(profile)) {
    return { ...profile, approved: true };
  }
  return profile;
}

function asDate(value: unknown): Date | undefined {
  if (!value) return undefined;
  if (value instanceof Date) return value;
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  }
  if (typeof value === 'object' && value !== null && 'toDate' in value && typeof (value as { toDate?: unknown }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate();
  }
  return undefined;
}

function profileFromUserData(uid: string, data: Record<string, unknown>): UserProfile {
  return {
    id: uid,
    uid,
    email: String(data.email ?? ''),
    firstName: String(data.firstName ?? ''),
    lastName: String(data.lastName ?? ''),
    role: String(data.role ?? 'pending'),
    centreId: String(data.centreId || 'default-centre'),
    createdAt: asDate(data.createdAt),
    updatedAt: asDate(data.updatedAt),
    approved: true,
    permissionsGranted: (data.permissionsGranted as ModulePermission[] | undefined) ?? [],
    permissionsRevoked: (data.permissionsRevoked as ModulePermission[] | undefined) ?? [],
  };
}

interface AuthContextType {
  user: FirebaseUser | null;
  userProfile: UserProfile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<string>;
  signUp: (email: string, password: string, userData: Partial<UserProfile>) => Promise<void>;

  resetPassword: (email: string) => Promise<void>;
  refreshUserProfile: () => Promise<void>;
  updateProfile?: (userData: Partial<UserProfile>) => Promise<void>;
  login?: (userData: any, role?: string) => void; // Keep for Director demo only
  reloadFromStorage?: () => void;
}

// Create context with a default value
const LOCAL_PROFILE_KEY = 'demoUserProfile';

function localDirectorProfile(email: string): UserProfile {
  return {
    id: 'local-director',
    uid: 'local-director',
    email: email.trim() || 'local@localhost',
    firstName: 'Local',
    lastName: 'Director',
    role: 'director',
    centreId: 'default-centre',
    approved: true,
    permissionsGranted: [],
    permissionsRevoked: [],
  };
}

function readLocalProfile(): UserProfile | null {
  try {
    const raw = localStorage.getItem(LOCAL_PROFILE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as UserProfile;
    return parsed?.uid ? parsed : null;
  } catch {
    return null;
  }
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  userProfile: null,
  loading: false,
  signOut: async () => {},
  signIn: async () => '',
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
  const authGeneration = useRef(0);

  const fetchUserProfile = async (uid: string): Promise<UserProfile | null> => {
    if (!db) {
      console.warn('⚠️ Firebase Firestore is not initialized. Cannot fetch user profile.');
      return null;
    }
    
    try {

      if (auth?.currentUser?.uid === uid) {
        await auth.currentUser.getIdToken();
      }
      const userRef = doc(db, 'users', uid);
      const readProfile = () => Promise.race([
        getDocFromServer(userRef),
        new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('The account check timed out. Stay on this page and try again.')), 15000);
        }),
      ]);
      let userDoc;
      try {
        userDoc = await readProfile();
      } catch (readError: any) {
        if (readError?.code !== 'permission-denied' || auth?.currentUser?.uid !== uid) throw readError;
        await auth.currentUser.getIdToken(true);
        userDoc = await readProfile();
      }


      if (userDoc.exists()) {
        const data = userDoc.data();

        const profile = {
          id: uid, // Use UID as document ID
          uid, // Keep for backward compatibility
          email: data.email,
          firstName: data.firstName,
          lastName: data.lastName,
          role: data.role,
          centreId: data.centreId || 'default-centre', // Provide fallback centreId
          createdAt: asDate(data.createdAt),
          updatedAt: asDate(data.updatedAt),
          approved: true,
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
      throw error;
    }
  };

  const refreshUserProfile = useCallback(async () => {
    if (!user) return;
    try {
      const profile = await fetchUserProfile(user.uid);
      if (profile) setUserProfile(profile);
    } catch {
      // Keep the current profile when Firestore is briefly unreachable.
    }
  }, [user]);

  const signOut = useCallback(async () => {
    clearFacultyPendingHold(user?.uid);
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
  }, [navigate, user]);

  const clearAllSessionData = useCallback(() => {
    localStorage.removeItem('demoUser');
    localStorage.removeItem('demoUserProfile');
    localStorage.removeItem('authToken');
    localStorage.removeItem('userSession');
    localStorage.removeItem('userProfile');
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    if (firebaseOff) {
      if (!email.trim() || !password) {
        throw new Error('Enter an email and password.');
      }
      const profile = localDirectorProfile(email);
      localStorage.setItem(LOCAL_PROFILE_KEY, JSON.stringify(profile));
      setUserProfile(profile);
      setLoading(false);
      return profile.role;
    }

    if (!auth) {
      const errorMsg = import.meta.env.PROD 
        ? 'Firebase is not configured. Please contact your administrator. The application needs to be rebuilt with Firebase environment variables.'
        : 'Firebase Auth is not initialized. Please check your .env file and restart the dev server.';
      throw new Error(errorMsg);
    }
    
    try {
      const nextEmail = loginEmailForContact(email);
      if (!nextEmail) {
        throw new Error('Enter an email or a 10-digit mobile number.');
      }
      const currentEmail = auth.currentUser?.email?.trim().toLowerCase() ?? '';
      if (auth.currentUser && currentEmail !== nextEmail) {
        authGeneration.current += 1;
        setUser(null);
        setUserProfile(null);
        await firebaseSignOut(auth);
      }
      const userCredential = await signInWithEmailAndPassword(auth, nextEmail, password);
      const firebaseUser = userCredential.user;
      if (typeof auth.authStateReady === 'function') {
        await auth.authStateReady();
      }
      if (auth.currentUser?.uid !== firebaseUser.uid) {
        throw new Error('The account could not be opened. Refresh the page and sign in again.');
      }
      
      const profile = await fetchUserProfile(firebaseUser.uid);
      if (auth.currentUser?.uid !== firebaseUser.uid) {
        throw new Error('Sign-in was interrupted. Try that account again.');
      }
      let role = profile?.role ?? 'pending';
      
      if (!profile) {
        const migratedRole = getMigrationRoleForEmail(firebaseUser.email || email);
        const knownDirector = isDirectorEmail(firebaseUser.email || email);
        if (migratedRole || knownDirector) {
          throw new Error('This login has no account profile yet. Ask a director to approve it, then sign in again.');
        }
        const basicProfile = {
          id: firebaseUser.uid,
          uid: firebaseUser.uid,
          email: firebaseUser.email || email,
          firstName: firebaseUser.displayName?.split(' ')[0] || 'User',
          lastName: firebaseUser.displayName?.split(' ')[1] || '',
          role: 'pending',
          approved: false,
          permissionsGranted: [],
          permissionsRevoked: [],
          createdAt: new Date(),
          updatedAt: new Date()
        };
        
        await setDoc(doc(db, 'users', firebaseUser.uid), basicProfile);
        role = basicProfile.role;
        setUserProfile({ ...basicProfile, approved: true });
      } else {
        setUserProfile({ ...openFacultyAfterFirstPending(profile), approved: true });
      }
      return role;
      
    } catch (error: any) {
      console.error('Sign in failed:', error);
      
      // Handle specific Firebase Auth errors
      if (error.code === 'auth/user-not-found') {
        throw new Error('No account found with this email or mobile number');
      } else if (error.code === 'auth/wrong-password') {
        throw new Error('Invalid email, mobile number, or password');
      } else if (error.code === 'auth/too-many-requests') {
        throw new Error('Too many failed attempts. Please try again later.');
      } else if (error.code === 'auth/user-disabled') {
        throw new Error('This account has been disabled. Please contact support.');
      } else if (error.code === 'permission-denied') {
        throw new Error('The account could not be opened. Refresh the page and sign in again.');
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
    if (firebaseOff) {
      setUserProfile(readLocalProfile());
      setLoading(false);
      return;
    }

    // Check if auth is initialized before using it
    if (!auth) {
      console.warn('⚠️ Firebase Auth is not initialized. Authentication features will not work.');
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      const generation = ++authGeneration.current;

      if (firebaseUser) {
        setUser(firebaseUser);
        setUserProfile((current) => (current?.uid === firebaseUser.uid ? current : null));
        try {
          const profile = await fetchUserProfile(firebaseUser.uid);
          if (generation !== authGeneration.current) return;
          if (profile) {
            const opened = openFacultyAfterFirstPending(profile);
            setUserProfile(opened);
            if (opened.approved !== false && window.location.pathname === '/pending-approval') {
              navigate(homePathForRole(opened.role), { replace: true });
            }
          } else {
            setUserProfile(null);
          }
        } catch {
          if (generation !== authGeneration.current) return;
          setUserProfile((current) => (current?.uid === firebaseUser.uid ? current : null));
        }
      } else {
        clearAllSessionData();
        if (generation !== authGeneration.current) return;
        setUser(null);
        setUserProfile(null);
      }

      if (generation === authGeneration.current) setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (firebaseOff || !user || !db) return;

    const unsubscribe = onSnapshot(
      doc(db, 'users', user.uid),
      (snapshot) => {
        if (auth?.currentUser?.uid !== user.uid) return;
        if (!snapshot.exists()) return;
        // A saved offline copy can still say "waiting" after the account was approved.
        if (snapshot.metadata.fromCache || snapshot.metadata.hasPendingWrites) return;
        const profile = openFacultyAfterFirstPending(
          profileFromUserData(user.uid, snapshot.data() as Record<string, unknown>)
        );
        setUserProfile(profile);
        setLoading(false);
        if (profile.approved !== false && window.location.pathname === '/pending-approval') {
          navigate(homePathForRole(profile.role), { replace: true });
        }
      },
      () => {
        // Keep the screen that is already open if this live check drops.
      }
    );

    return () => unsubscribe();
  }, [user, navigate]);

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