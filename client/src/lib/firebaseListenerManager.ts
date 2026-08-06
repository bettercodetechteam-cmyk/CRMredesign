/**
 * Centralized Firebase Listener Manager
 * Prevents duplicate listeners on the same collections and manages subscriptions
 */

import { collection, query, where, orderBy, limit, onSnapshot, Unsubscribe, DocumentSnapshot, QuerySnapshot } from 'firebase/firestore';
import { db } from './firebase';

type ListenerCallback<T = any> = (data: T[]) => void;
type DocumentChangeCallback<T = any> = (changes: Array<{ type: 'added' | 'modified' | 'removed'; data: T }>) => void;

interface ListenerOptions {
  centreId?: string;
  limit?: number;
  orderBy?: { field: string; direction: 'asc' | 'desc' };
  useDocumentChanges?: boolean; // Only emit changes, not full snapshots
}

interface ActiveListener {
  unsubscribe: Unsubscribe;
  callbacks: Set<ListenerCallback>;
  documentChangeCallbacks: Set<DocumentChangeCallback>;
  collectionName: string;
  options: ListenerOptions;
}

class FirebaseListenerManager {
  private listeners: Map<string, ActiveListener> = new Map();
  private lastSnapshot: Map<string, any[]> = new Map();

  /**
   * Subscribe to a collection with automatic deduplication
   */
  subscribe<T = any>(
    collectionName: string,
    callback: ListenerCallback<T>,
    options: ListenerOptions = {}
  ): () => void {
    const listenerKey = this.getListenerKey(collectionName, options);

    // Check if listener already exists
    let activeListener = this.listeners.get(listenerKey);

    if (!activeListener) {
      // Create new listener
      activeListener = this.createListener(collectionName, options);
      this.listeners.set(listenerKey, activeListener);
    }

    // Add callback to existing listener
    activeListener.callbacks.add(callback as ListenerCallback);

    // Immediately call with cached data if available
    const cached = this.lastSnapshot.get(listenerKey);
    if (cached) {
      try {
        callback(cached);
      } catch (error) {
        console.error('Error in listener callback:', error);
      }
    }

    // Return unsubscribe function
    return () => {
      this.unsubscribe(listenerKey, callback);
    };
  }

  /**
   * Subscribe to document changes only (more efficient)
   */
  subscribeToChanges<T = any>(
    collectionName: string,
    callback: DocumentChangeCallback<T>,
    options: ListenerOptions = {}
  ): () => void {
    const listenerKey = this.getListenerKey(collectionName, options);

    // Check if listener already exists
    let activeListener = this.listeners.get(listenerKey);

    if (!activeListener) {
      // Create new listener
      activeListener = this.createListener(collectionName, { ...options, useDocumentChanges: true });
      this.listeners.set(listenerKey, activeListener);
    }

    // Add callback to existing listener
    activeListener.documentChangeCallbacks.add(callback as DocumentChangeCallback);

    // Return unsubscribe function
    return () => {
      const listener = this.listeners.get(listenerKey);
      if (listener) {
        listener.documentChangeCallbacks.delete(callback as DocumentChangeCallback);
        
        // If no callbacks left, remove listener
        if (listener.callbacks.size === 0 && listener.documentChangeCallbacks.size === 0) {
          listener.unsubscribe();
          this.listeners.delete(listenerKey);
          this.lastSnapshot.delete(listenerKey);
        }
      }
    };
  }

  /**
   * Create a new listener
   */
  private createListener(collectionName: string, options: ListenerOptions): ActiveListener {
    if (!db) {
      throw new Error('Firebase database not initialized');
    }

    // Build query
    let q: any = collection(db, collectionName);
    
    // Add where clause if centreId provided
    if (options.centreId) {
      q = query(q as any, where('centreId', '==', options.centreId));
    }

    // Apply ordering if provided
    if (options.orderBy?.field) {
      q = query(q as any, orderBy(options.orderBy.field, options.orderBy.direction));
    }

    // Apply limit if provided (critical for quota management)
    if (typeof options.limit === 'number' && options.limit > 0) {
      q = query(q as any, limit(options.limit));
    }

    const callbacks: Set<ListenerCallback> = new Set();
    const documentChangeCallbacks: Set<DocumentChangeCallback> = new Set();

    // Create onSnapshot listener
    const unsubscribe = onSnapshot(
      q as any,
      (snapshot: QuerySnapshot) => {
        try {
          const data = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));

          // Store latest snapshot for immediate delivery to new subscribers
          const listenerKey = this.getListenerKey(collectionName, options);
          this.lastSnapshot.set(listenerKey, data);

          // Emit to all callbacks
          callbacks.forEach(callback => {
            try {
              callback(data);
            } catch (error) {
              console.error('Error in listener callback:', error);
            }
          });

          // Emit changes if using document changes mode
          if (options.useDocumentChanges || documentChangeCallbacks.size > 0) {
            const changes = snapshot.docChanges().map(change => ({
              type: change.type,
              data: {
                id: change.doc.id,
                ...change.doc.data()
              }
            }));

            documentChangeCallbacks.forEach(callback => {
              try {
                callback(changes);
              } catch (error) {
                console.error('Error in document change callback:', error);
              }
            });
          }
        } catch (error) {
          console.error('Error processing snapshot:', error);
        }
      },
      (error) => {
        console.error(`Error listening to ${collectionName}:`, error);
      }
    );

    return {
      unsubscribe,
      callbacks,
      documentChangeCallbacks,
      collectionName,
      options
    };
  }

  /**
   * Unsubscribe a callback
   */
  private unsubscribe(listenerKey: string, callback: ListenerCallback): void {
    const listener = this.listeners.get(listenerKey);
    if (!listener) return;

    listener.callbacks.delete(callback);

    // If no callbacks left, remove listener
    if (listener.callbacks.size === 0 && listener.documentChangeCallbacks.size === 0) {
      listener.unsubscribe();
      this.listeners.delete(listenerKey);
      this.lastSnapshot.delete(listenerKey);
    }
  }

  /**
   * Generate unique key for listener
   */
  private getListenerKey(collectionName: string, options: ListenerOptions): string {
    const parts = [collectionName];
    if (options.centreId) parts.push(`centre:${options.centreId}`);
    if (options.limit) parts.push(`limit:${options.limit}`);
    if (options.orderBy) parts.push(`order:${options.orderBy.field}:${options.orderBy.direction}`);
    return parts.join('|');
  }

  /**
   * Get active listener count
   */
  getActiveListenerCount(): number {
    return this.listeners.size;
  }

  /**
   * Get active listeners info (for debugging)
   */
  getActiveListeners(): Array<{ collection: string; callbackCount: number; changeCallbackCount: number }> {
    return Array.from(this.listeners.entries()).map(([key, listener]) => ({
      collection: listener.collectionName,
      callbackCount: listener.callbacks.size,
      changeCallbackCount: listener.documentChangeCallbacks.size
    }));
  }

  /**
   * Cleanup all listeners
   */
  cleanup(): void {
    this.listeners.forEach(listener => {
      listener.unsubscribe();
    });
    this.listeners.clear();
    this.lastSnapshot.clear();
  }

  /**
   * Cleanup listeners for a specific collection
   */
  cleanupCollection(collectionName: string): void {
    const keysToDelete: string[] = [];
    this.listeners.forEach((listener, key) => {
      if (listener.collectionName === collectionName) {
        listener.unsubscribe();
        keysToDelete.push(key);
      }
    });
    keysToDelete.forEach(key => {
      this.listeners.delete(key);
      this.lastSnapshot.delete(key);
    });
  }
}

// Export singleton instance
export const firebaseListenerManager = new FirebaseListenerManager();

// Cleanup on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    firebaseListenerManager.cleanup();
  });
}

