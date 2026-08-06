// Source Manager - Centralized source management for the CRM
import { collection, getDocs, query, addDoc, orderBy, Timestamp, where } from 'firebase/firestore';
import { db } from './firebase';
import { LEAD_SOURCES } from './leadDataCleaningService';

// Use standardized sources from cleaning service
export const defaultSources = [...LEAD_SOURCES];

// Source color mapping
export const getSourceColor = (source: string) => {
  const colors = {
    "Instagram Ad": "bg-pink-600 text-white",
    "Instagram": "bg-pink-600 text-white",
    "Facebook": "bg-blue-500 text-white", 
    "Facebook Ad": "bg-blue-500 text-white",
    "Just Dial": "bg-orange-600 text-white",
    "MIS": "bg-purple-600 text-white",
    "Hoarding": "bg-red-600 text-white",
    "Pamphlet": "bg-cyan-600 text-white",
    "Radio Ad": "bg-purple-800 text-white",
    "Website": "bg-indigo-600 text-white",
    "Walk-in": "bg-green-600 text-white",
    "Direct Walk-in": "bg-green-600 text-white",
    "Referral": "bg-teal-600 text-white",
    "Social Media": "bg-blue-400 text-white",
    "Email Campaign": "bg-blue-600 text-white",
    "Phone Call": "bg-green-500 text-white",
    "Other": "bg-gray-600 text-white",
    // Additional variations to ensure all sources are covered
    "facebook": "bg-blue-500 text-white",
    "mis": "bg-purple-600 text-white",
    "pamphlet": "bg-cyan-600 text-white",
    "website": "bg-indigo-600 text-white",
    "referral": "bg-teal-600 text-white",
    "other": "bg-gray-600 text-white"
  };
  return colors[source as keyof typeof colors] || "bg-gray-600 text-white";
};

// Normalize source names to handle variations and typos
export const normalizeSourceName = (source: string): string => {
  if (!source) return "Other";
  
  const normalized = source.trim().toLowerCase();
  
  // Special handling for Justdial variations - check if contains "just" and "dial"
  if (normalized.includes('just') && normalized.includes('dial')) {
    return 'Just Dial';
  }
  
  // Handle common variations and typos
  const sourceMappings: Record<string, string> = {
    'fb': 'Facebook',
    'facebook': 'Facebook',
    'instagram': 'Instagram',
    'insta': 'Instagram',
    'website': 'Website',
    'web': 'Website',
    'referral': 'Referral',
    'referred': 'Referral',
    'pamphlet': 'Pamphlet',
    'pamphlets': 'Pamphlet',
    'mis': 'MIS',
    'walkin': 'Walk-in',
    'walk-in': 'Walk-in',
    'direct walkin': 'Direct Walk-in',
    'direct walk-in': 'Direct Walk-in',
    'socialmedia': 'Social Media',
    'social media': 'Social Media',
    'emailcampaign': 'Email Campaign',
    'email campaign': 'Email Campaign',
    'phonecall': 'Phone Call',
    'phone call': 'Phone Call',
    'radioad': 'Radio Ad',
    'radio ad': 'Radio Ad',
    'hoarding': 'Hoarding',
    'other': 'Other',
    'unknown': 'Other',
    '': 'Other',
  };
  
  return sourceMappings[normalized] || source;
};

// Get all sources (default + existing + custom)
// Custom sources from Firestore appear first (newest first), then default sources
export const getAllSources = async (centreId?: string): Promise<string[]> => {
  try {
    // Get custom sources from Firestore (stored permanently)
    const customSourcesRef = collection(db, "customSources");
    
    // Fetch all documents and filter/sort in memory to avoid composite index requirement
    let customSourcesQuery = query(customSourcesRef);
    const customSourcesSnapshot = await getDocs(customSourcesQuery);
    
    // Filter by centreId if provided and sort by createdAt in memory
    const customSourcesData: Array<{ source: string; createdAt: any }> = [];
    customSourcesSnapshot.forEach((doc) => {
      const data = doc.data();
      if (data.source && data.source.trim()) {
        // Filter by centreId if provided
        if (!centreId || data.centreId === centreId) {
          customSourcesData.push({
            source: data.source.trim(),
            createdAt: data.createdAt || Timestamp.now()
          });
        }
      }
    });
    
    // Sort by createdAt descending (newest first)
    customSourcesData.sort((a, b) => {
      const aTime = a.createdAt?.toMillis?.() || a.createdAt?.seconds * 1000 || 0;
      const bTime = b.createdAt?.toMillis?.() || b.createdAt?.seconds * 1000 || 0;
      return bTime - aTime; // Descending order
    });
    
    const customSources = customSourcesData.map(item => item.source);
    
    // Get existing sources from leads data (for backward compatibility)
    const leadsRef = collection(db, "leads");
    const q = query(leadsRef);
    const querySnapshot = await getDocs(q);
    
    const existingSources = new Set<string>();
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      if (data.source && data.source.trim()) {
        // Normalize source name to handle variations like "Justdial", "Just Dial", "JUST Dial", etc.
        const normalizedSource = normalizeSourceName(data.source.trim());
        existingSources.add(normalizedSource);
      }
    });
    
    // Migrate localStorage custom sources to Firestore (one-time migration)
    const savedCustomSources = JSON.parse(localStorage.getItem('customSources') || '[]');
    if (savedCustomSources.length > 0 && centreId) {
      // Migrate to Firestore
      for (const source of savedCustomSources) {
        if (!customSources.includes(source)) {
          try {
            await addDoc(customSourcesRef, {
              source: source.trim(),
              centreId: centreId,
              createdAt: Timestamp.now(),
              migrated: true
            });
            customSources.unshift(source.trim()); // Add to beginning
          } catch (err) {
            console.warn('Error migrating source to Firestore:', err);
          }
        }
      }
      // Clear localStorage after migration
      localStorage.removeItem('customSources');
    }
    
    // Normalize custom sources to handle variations
    const normalizedCustomSources = customSources.map(s => normalizeSourceName(s));
    
    // Combine sources: Custom sources first (newest first), then default sources, then existing from leads
    // Remove duplicates and ensure custom sources stay at the top
    const defaultSet = new Set(defaultSources);
    const existingSet = new Set(Array.from(existingSources).filter(s => !defaultSet.has(s)));
    
    // Custom sources at the top (already sorted newest first), then defaults, then other existing
    const allSources = [
      ...normalizedCustomSources, // Custom sources first (newest first) - normalized
      ...defaultSources, // Then default sources
      ...Array.from(existingSet) // Then other existing sources from leads (already normalized)
    ];
    
    // Remove duplicates while preserving order (custom sources stay at top)
    // Use case-insensitive comparison to catch variations like "Justdial", "Just Dial", etc.
    const uniqueSources: string[] = [];
    const seen = new Set<string>();
    const seenLower = new Set<string>();
    let hasJustDial = false;
    
    for (const source of allSources) {
      const sourceLower = source.toLowerCase();
      const isJustDial = sourceLower.includes('just') && sourceLower.includes('dial');
      
      // Special handling for Just Dial variations
      if (isJustDial) {
        if (!hasJustDial) {
          // Add standardized "Just Dial" only once
          uniqueSources.push('Just Dial');
          seen.add('Just Dial');
          seenLower.add('just dial');
          hasJustDial = true;
        }
        // Skip all other Just Dial variations
        continue;
      }
      
      // Check if we've seen this source (case-insensitive)
      if (!seenLower.has(sourceLower)) {
        seenLower.add(sourceLower);
        seen.add(source);
        uniqueSources.push(source);
      }
    }
    
    return uniqueSources;
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Error fetching sources:', error);
    }
    // Fallback to default sources + custom sources from localStorage
    const savedCustomSources = JSON.parse(localStorage.getItem('customSources') || '[]');
    return [...new Set([...savedCustomSources, ...defaultSources])];
  }
};

// Add a new custom source to Firestore (permanent storage)
// Returns the new source if successful
export const addCustomSource = async (newSource: string, centreId?: string): Promise<string | null> => {
  if (!newSource || !newSource.trim()) {
    return null;
  }
  
  const trimmedSource = newSource.trim();
  
  try {
    // Check if source already exists in Firestore
    const customSourcesRef = collection(db, "customSources");
    const existingQuery = query(customSourcesRef);
    const existingSnapshot = await getDocs(existingQuery);
    
    let sourceExists = false;
    existingSnapshot.forEach((doc) => {
      const data = doc.data();
      if (data.source && data.source.trim().toLowerCase() === trimmedSource.toLowerCase()) {
        sourceExists = true;
      }
    });
    
    if (sourceExists) {
      return null; // Source already exists
    }
    
    // Add to Firestore
    const docRef = await addDoc(customSourcesRef, {
      source: trimmedSource,
      centreId: centreId || 'global',
      createdAt: Timestamp.now(),
      createdBy: centreId || 'system'
    });
    
    // Also save to localStorage as backup
    const savedCustomSources = JSON.parse(localStorage.getItem('customSources') || '[]');
    if (!savedCustomSources.includes(trimmedSource)) {
      savedCustomSources.unshift(trimmedSource); // Add to beginning
      localStorage.setItem('customSources', JSON.stringify(savedCustomSources));
    }
    
    return trimmedSource;
  } catch (error) {
    console.error('Error adding custom source to Firestore:', error);
    
    // Fallback to localStorage
    const savedCustomSources = JSON.parse(localStorage.getItem('customSources') || '[]');
    if (!savedCustomSources.includes(trimmedSource)) {
      savedCustomSources.unshift(trimmedSource); // Add to beginning
      localStorage.setItem('customSources', JSON.stringify(savedCustomSources));
      return trimmedSource;
    }
    
    return null;
  }
};

// Get custom sources from Firestore (newest first)
export const getCustomSources = async (centreId?: string): Promise<string[]> => {
  try {
    const customSourcesRef = collection(db, "customSources");
    
    // Fetch all documents and filter/sort in memory to avoid composite index requirement
    const customSourcesQuery = query(customSourcesRef);
    const snapshot = await getDocs(customSourcesQuery);
    
    // Filter by centreId if provided and sort by createdAt in memory
    const sourcesData: Array<{ source: string; createdAt: any }> = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      if (data.source && data.source.trim()) {
        // Filter by centreId if provided
        if (!centreId || data.centreId === centreId) {
          sourcesData.push({
            source: data.source.trim(),
            createdAt: data.createdAt || Timestamp.now()
          });
        }
      }
    });
    
    // Sort by createdAt descending (newest first)
    sourcesData.sort((a, b) => {
      const aTime = a.createdAt?.toMillis?.() || a.createdAt?.seconds * 1000 || 0;
      const bTime = b.createdAt?.toMillis?.() || b.createdAt?.seconds * 1000 || 0;
      return bTime - aTime; // Descending order
    });
    
    const sources = sourcesData.map(item => item.source);
    
    return sources;
  } catch (error) {
    console.error('Error fetching custom sources:', error);
    // Fallback to localStorage
    return JSON.parse(localStorage.getItem('customSources') || '[]');
  }
};

// Event system for source updates
export const sourceManagerEvents = {
  // Notify all components when sources change
  notifySourceUpdate: (newSource?: string) => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('sourcesUpdated', {
        detail: {
          newSource,
          timestamp: Date.now()
        }
      }));
    }
  },
  
  // Subscribe to source updates
  subscribe: (callback: (event: CustomEvent) => void) => {
    if (typeof window !== 'undefined') {
      window.addEventListener('sourcesUpdated', callback as EventListener);
      return () => window.removeEventListener('sourcesUpdated', callback as EventListener);
    }
    return () => {};
  }
};
