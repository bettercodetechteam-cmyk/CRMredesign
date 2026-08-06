/**
 * Offline Indicator Component
 * Shows when the app is in offline mode due to quota exceeded
 */

import React, { useState, useEffect } from 'react';
import { fallbackService } from '@/lib/fallbackService';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  WifiOff, 
  Wifi, 
  RefreshCw, 
  Database, 
  Clock,
  AlertTriangle
} from 'lucide-react';

interface OfflineIndicatorProps {
  className?: string;
  showDetails?: boolean;
}

export default function OfflineIndicator({ 
  className = '', 
  showDetails = false 
}: OfflineIndicatorProps) {
  const [isOffline, setIsOffline] = useState(fallbackService.isInOfflineMode());
  const [message, setMessage] = useState('');
  const [stats, setStats] = useState(fallbackService.getFallbackStats());

  useEffect(() => {
    // Subscribe to offline mode changes
    const unsubscribe = fallbackService.onOfflineModeChange((offline) => {
      setIsOffline(offline);
      setMessage(fallbackService.getOfflineMessage());
    });

    // Update stats periodically
    const interval = setInterval(() => {
      setStats(fallbackService.getFallbackStats());
    }, 30000); // Update every 30 seconds

    // Initial message
    setMessage(fallbackService.getOfflineMessage());

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, []);

  const handleSync = async () => {
    try {
      await fallbackService.syncFallbackData();
    } catch (error) {
      console.error('Failed to sync data:', error);
    }
  };

  const formatDataAge = (age: number) => {
    const hours = Math.floor(age / (1000 * 60 * 60));
    const minutes = Math.floor((age % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ago`;
    }
    return `${minutes}m ago`;
  };

  if (!isOffline) {
    return null;
  }

  return (
    <div className={className}>
      <Alert className="border-orange-200 bg-orange-50">
        <WifiOff className="h-4 w-4 text-orange-600" />
        <AlertDescription className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-orange-800 font-medium">Offline Mode</span>
            <Badge variant="secondary" className="text-xs">
              Quota Exceeded
            </Badge>
          </div>
          <div className="flex items-center space-x-2">
            {showDetails && (
              <div className="flex items-center space-x-4 text-sm text-orange-700">
                <div className="flex items-center space-x-1">
                  <Database className="h-3 w-3" />
                  <span>{stats.totalRecords} records</span>
                </div>
                <div className="flex items-center space-x-1">
                  <Clock className="h-3 w-3" />
                  <span>{formatDataAge(stats.dataAge)}</span>
                </div>
              </div>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleSync}
              className="h-6 px-2 text-xs border-orange-300 text-orange-700 hover:bg-orange-100"
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              Sync
            </Button>
          </div>
        </AlertDescription>
      </Alert>

      {showDetails && (
        <div className="mt-2 p-3 bg-orange-50 rounded-lg border border-orange-200">
          <div className="text-sm text-orange-800">
            <p className="mb-2">{message}</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
              {Object.entries(stats.collections).map(([collection, count]) => (
                <div key={collection} className="flex items-center space-x-1">
                  <Database className="h-3 w-3" />
                  <span className="capitalize">{collection}:</span>
                  <span className="font-medium">{count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
