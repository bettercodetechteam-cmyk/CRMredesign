import React, { useState, useEffect, useRef } from 'react';
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { enhancedReminderService, ActiveNotification } from '@/lib/enhancedReminderService';
import { dataSyncService } from '@/lib/dataSyncService';
import EnhancedReminderPopup from './EnhancedReminderPopup';
import ReminderNotification from './ReminderNotification';

export default function GlobalReminderNotification() {
  const { toast } = useToast();
  const { userProfile } = useAuth();
  const [activeNotifications, setActiveNotifications] = useState<ActiveNotification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState<ActiveNotification | null>(null);
  const [handledReminders, setHandledReminders] = useState<Set<string>>(new Set());
  const handledRemindersRef = useRef<Set<string>>(new Set());
  const [showPopup, setShowPopup] = useState(false);
  const [reminderTimers, setReminderTimers] = useState<Map<string, NodeJS.Timeout>>(new Map());
  const reminderTimersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Load handled reminders from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('handledReminders');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setHandledReminders(new Set(parsed));
      } catch (error) {
        console.error('Error loading handled reminders from localStorage:', error);
      }
    }
  }, []);

  // Save handled reminders to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('handledReminders', JSON.stringify(Array.from(handledReminders)));
  }, [handledReminders]);

  useEffect(() => {
    if (!userProfile?.centreId || !userProfile?.uid) return;
    if (userProfile.role === 'student' || userProfile.role === 'parent') return;

    if (process.env.NODE_ENV === 'development') {
    }
    enhancedReminderService.init(userProfile.centreId);

    const unsubscribeReminder = enhancedReminderService.subscribe((notifications) => {
      if (process.env.NODE_ENV === 'development') {
      }
      
      // Filter out reminders that have already been handled
      const newNotifications = notifications.filter(notification => 
        !handledRemindersRef.current.has(notification.reminder.id)
      );
      
      if (process.env.NODE_ENV === 'development') {
      }
      
      if (newNotifications.length > 0) {
        setActiveNotifications(newNotifications);
        setShowNotifications(true);
        // Set the first notification as selected
        setSelectedNotification(newNotifications[0]);
        
        // Show popup for the first notification
        setShowPopup(true);
        
        // Start recurring reminders for each notification
        newNotifications.forEach(notification => {
          startRecurringReminder(notification.reminder.id, notification.reminder);
        });
      } else {
        setActiveNotifications([]);
        setShowNotifications(false);
        setSelectedNotification(null);
        setShowPopup(false);
      }
    });

    // Subscribe to data sync events for real-time updates
    const unsubscribeLead = dataSyncService.subscribe('lead', (event) => {
      if (process.env.NODE_ENV === 'development') {
      }
      if (event.action === 'updated' || event.action === 'deleted') {
        enhancedReminderService.forceRefresh();
      }
    });

    const unsubscribeStatus = dataSyncService.subscribe('status', (event) => {
      if (event.action === 'updated') {
        enhancedReminderService.forceRefresh();
      }
    });

    const unsubscribeReminderSync = dataSyncService.subscribe('reminder', (event) => {
      if (event.action === 'updated' || event.action === 'deleted') {
        enhancedReminderService.forceRefresh();
      }
    });

    return () => {
      unsubscribeReminder();
      unsubscribeLead();
      unsubscribeStatus();
      unsubscribeReminderSync();
      
      // Clean up all timers
      reminderTimersRef.current.forEach(timer => {
        clearInterval(timer);
      });
      reminderTimersRef.current.clear();
    };
  }, [userProfile]);

  // Sync refs with state
  useEffect(() => {
    handledRemindersRef.current = handledReminders;
    reminderTimersRef.current = reminderTimers;
  }, [handledReminders, reminderTimers]);

  // Clean up handled reminders that no longer exist
  useEffect(() => {
    if (activeNotifications.length > 0) {
      const currentReminderIds = new Set(activeNotifications.map(n => n.reminder.id));
      
      setHandledReminders(prev => {
        const cleaned = new Set<string>();
        prev.forEach(id => {
          if (currentReminderIds.has(id)) {
            cleaned.add(id);
          }
        });
        return cleaned;
      });
    }
  }, [activeNotifications]);

  // Function to start recurring reminder timer
  const startRecurringReminder = (reminderId: string, reminder: any) => {
    // Clear existing timer if any
    const existingTimer = reminderTimersRef.current.get(reminderId);
    if (existingTimer) {
      clearInterval(existingTimer);
    }

    // Start new timer that shows reminder every 10 minutes
    const timer = setInterval(() => {
      
      // Check if reminder is still due today
      const today = new Date();
      const reminderDate = new Date(reminder.dueDate);
      const isSameDay = today.toDateString() === reminderDate.toDateString();
      
      if (isSameDay) {
        // Show the reminder popup again
        const notification = {
          reminder: reminder,
          isRecurring: true
        };
        
        setActiveNotifications(prev => {
          const existing = prev.find(n => n.reminder.id === reminderId);
          if (!existing) {
            return [...prev, notification];
          }
          return prev;
        });
        
        setSelectedNotification(notification);
        setShowPopup(true);
        setShowNotifications(true);
      } else {
        // Stop the timer if it's no longer the same day
        clearInterval(timer);
        setReminderTimers(prev => {
          const newMap = new Map(prev);
          newMap.delete(reminderId);
          return newMap;
        });
      }
    }, 10 * 60 * 1000); // 10 minutes

    // Store the timer
    setReminderTimers(prev => {
      const newMap = new Map(prev);
      newMap.set(reminderId, timer);
      return newMap;
    });
  };

  // Function to stop recurring reminder timer
  const stopRecurringReminder = (reminderId: string) => {
    const timer = reminderTimersRef.current.get(reminderId);
    if (timer) {
      clearInterval(timer);
      setReminderTimers(prev => {
        const newMap = new Map(prev);
        newMap.delete(reminderId);
        return newMap;
      });
    }
  };

  const handleReminderUpdate = (reminderId: string, updates: any) => {
    
    // Stop the recurring timer for this reminder
    stopRecurringReminder(reminderId);
    
    // Mark this reminder as handled
    const newHandledReminders = new Set([...handledRemindersRef.current, reminderId]);
    setHandledReminders(newHandledReminders);
    handledRemindersRef.current = newHandledReminders;
    
    // Remove from active notifications
    setActiveNotifications(prev => {
      const filtered = prev.filter(n => n.reminder.id !== reminderId);
      return filtered;
    });
    
    // Close the popup since the reminder was handled
    setShowNotifications(false);
    setSelectedNotification(null);
    setShowPopup(false);
    
  };

  const handleClosePopup = () => {
    // Don't mark as handled when just closing - let it keep reminding
    // Only hide the popup temporarily
    setShowNotifications(false);
    setSelectedNotification(null);
    setShowPopup(false);
  };

  const handleDismissReminder = (reminderId: string) => {
    
    // Stop the recurring timer for this reminder
    stopRecurringReminder(reminderId);
    
    // Mark this reminder as handled (dismissed)
    const newHandledReminders = new Set([...handledRemindersRef.current, reminderId]);
    setHandledReminders(newHandledReminders);
    handledRemindersRef.current = newHandledReminders;
    
    // Remove from active notifications
    setActiveNotifications(prev => {
      const filtered = prev.filter(n => n.reminder.id !== reminderId);
      return filtered;
    });
    
    // Close the popup
    setShowNotifications(false);
    setSelectedNotification(null);
    setShowPopup(false);
    
  };

  // Function to clear handled reminders (useful for testing or when user wants to see all notifications)
  const clearHandledReminders = () => {
    setHandledReminders(new Set());
    handledRemindersRef.current = new Set();
  };

  return (
    <>
      {/* Show only the main popup modal, not the smaller notification cards */}
      {showPopup && selectedNotification && (
        <EnhancedReminderPopup
          reminder={selectedNotification.reminder}
          onClose={handleClosePopup}
          onUpdate={handleReminderUpdate}
          onDismiss={() => handleDismissReminder(selectedNotification.reminder.id)}
        />
      )}
    </>
  );
} 