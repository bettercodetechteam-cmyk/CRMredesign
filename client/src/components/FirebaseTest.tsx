import React, { useState, useEffect } from 'react';
import { auth } from '@/lib/firebase';
import { signOut } from 'firebase/auth';

const FirebaseTest: React.FC = () => {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check if auth is initialized before using it
    if (!auth) {
      console.warn('⚠️ Firebase Auth is not initialized.');
      setLoading(false);
      setError('Firebase Auth is not initialized. Please check environment variables.');
      return;
    }

    const unsubscribe = auth.onAuthStateChanged((user) => {
      setUser(user);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);



  const signOutUser = async () => {
    if (!auth) {
      setError('Firebase Auth is not initialized.');
      return;
    }
    
    try {
      await signOut(auth);
      console.log('✅ Sign out successful');
    } catch (error) {
      console.error('❌ Sign out failed:', error);
      setError('Sign out failed. Please try again.');
    }
  };

  return (
    <div className="p-6 max-w-md mx-auto bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-4">Firebase Test</h2>
      
      <div className="space-y-4">
        {!user ? (
          <div className="bg-gray-100 p-4 rounded text-center">
            <p className="text-gray-600">Google sign-in has been removed</p>
            <p className="text-sm text-gray-500">Use the main login form instead</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-green-100 p-4 rounded">
              <p className="font-semibold">✅ Signed in successfully!</p>
              <p>Email: {user.email}</p>
              <p>Name: {user.displayName}</p>
            </div>
            
            <button
              onClick={signOutUser}
              className="w-full bg-red-500 text-white py-2 px-4 rounded hover:bg-red-600"
            >
              Sign Out
            </button>
          </div>
        )}
        
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            <p className="font-bold">Error:</p>
            <p>{error}</p>
          </div>
        )}
        
        <div className="text-sm text-gray-600">
          <p>Firebase Auth Status: {auth ? '✅ Initialized' : '❌ Not initialized'}</p>
          <p>Current User: {user ? '✅ Signed in' : '❌ Not signed in'}</p>
        </div>
      </div>
    </div>
  );
};

export default FirebaseTest;
