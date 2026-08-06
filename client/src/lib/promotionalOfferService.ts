import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  serverTimestamp,
} from "firebase/firestore";
import { db, queryDocsWithServerFallback } from "./firebase";
import { PromotionalOffer } from "./types";

const COLLECTION_NAME = "promotional_offers";

class PromotionalOfferService {
  /**
   * Get all promotional offers sorted by priority DESC and createdAt DESC
   */
  async getAllOffers(): Promise<PromotionalOffer[]> {
    try {
      // Simplified query to avoid index errors, we'll sort on client side
      const q = query(collection(db, COLLECTION_NAME));
      const querySnapshot = await queryDocsWithServerFallback(q);
      const offers = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as PromotionalOffer[];

      // Sort by priority DESC, then by createdAt DESC
      return offers.sort((a, b) => {
        if (b.priority !== a.priority) {
          return b.priority - a.priority;
        }
        const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
        const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
        return dateB.getTime() - dateA.getTime();
      });
    } catch (error) {
      console.error("Error getting promotional offers:", error);
      throw error;
    }
  }

  /**
   * Create a new promotional offer
   */
  async createOffer(offer: Omit<PromotionalOffer, "id" | "createdAt">): Promise<string> {
    try {
      const docRef = await addDoc(collection(db, COLLECTION_NAME), {
        ...offer,
        createdAt: serverTimestamp(),
      });
      return docRef.id;
    } catch (error) {
      console.error("Error creating promotional offer:", error);
      throw error;
    }
  }

  /**
   * Update an existing promotional offer
   */
  async updateOffer(id: string, updates: Partial<PromotionalOffer>): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      await updateDoc(docRef, {
        ...updates,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error("Error updating promotional offer:", error);
      throw error;
    }
  }

  /**
   * Toggle the active status of an offer
   */
  async toggleOfferStatus(id: string, active: boolean): Promise<void> {
    return this.updateOffer(id, { active });
  }

  /**
   * Delete a promotional offer
   */
  async deleteOffer(id: string): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      await deleteDoc(docRef);
    } catch (error) {
      console.error("Error deleting promotional offer:", error);
      throw error;
    }
  }
}

export default new PromotionalOfferService();
