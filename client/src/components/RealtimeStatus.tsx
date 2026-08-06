import React from 'react';
import { Wifi, WifiOff, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface RealtimeStatusProps {
  isConnected: boolean;
  lastUpdate?: Date | null;
  className?: string;
}

export default function RealtimeStatus({ isConnected, lastUpdate, className = "" }: RealtimeStatusProps) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {isConnected ? (
        <div className="flex items-center gap-1">
          <Wifi className="w-4 h-4 text-green-500" />
          <span className="text-xs text-green-600">Live</span>
        </div>
      ) : (
        <div className="flex items-center gap-1">
          <WifiOff className="w-4 h-4 text-red-500" />
          <span className="text-xs text-red-600">Offline</span>
        </div>
      )}
      
      {lastUpdate && (
        <div className="flex items-center gap-1">
          <Clock className="w-3 h-3 text-gray-400" />
          <span className="text-xs text-gray-500">
            {lastUpdate.toLocaleTimeString()}
          </span>
        </div>
      )}
    </div>
  );
}
