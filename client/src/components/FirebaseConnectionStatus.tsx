import { useState, useEffect } from 'react';
import { firebaseHelpers } from '@/lib/firebaseHelpers';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Wifi, WifiOff, RefreshCw, AlertCircle } from 'lucide-react';

export default function FirebaseConnectionStatus() {
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [lastCheck, setLastCheck] = useState<Date | null>(null);

  const checkConnection = async () => {
    setIsChecking(true);
    try {
      const connected = await firebaseHelpers.checkConnection();
      setIsConnected(connected);
      setLastCheck(new Date());
    } catch (error) {
      console.error('Connection check failed:', error);
      setIsConnected(false);
    } finally {
      setIsChecking(false);
    }
  };

  const enableConnection = async () => {
    setIsChecking(true);
    try {
      await firebaseHelpers.enableNetwork();
      await checkConnection();
    } catch (error) {
      console.error('Failed to enable connection:', error);
    } finally {
      setIsChecking(false);
    }
  };

  const disableConnection = async () => {
    setIsChecking(true);
    try {
      await firebaseHelpers.disableNetwork();
      setIsConnected(false);
      setLastCheck(new Date());
    } catch (error) {
      console.error('Failed to disable connection:', error);
    } finally {
      setIsChecking(false);
    }
  };

  // Check connection on mount and every 30 seconds
  useEffect(() => {
    checkConnection();
    
    const interval = setInterval(checkConnection, 30000);
    return () => clearInterval(interval);
  }, []);

  if (isConnected === null) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <RefreshCw className="w-4 h-4 animate-spin" />
        Checking connection...
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg border">
      <div className="flex items-center gap-2">
        {isConnected ? (
          <Wifi className="w-4 h-4 text-green-600" />
        ) : (
          <WifiOff className="w-4 h-4 text-red-600" />
        )}
        
        <Badge 
          variant={isConnected ? "default" : "destructive"}
          className="text-xs"
        >
          {isConnected ? "Connected" : "Disconnected"}
        </Badge>
      </div>

      {lastCheck && (
        <span className="text-xs text-gray-500">
          Last check: {lastCheck.toLocaleTimeString()}
        </span>
      )}

      <div className="flex items-center gap-1">
        <Button
          size="sm"
          variant="outline"
          onClick={checkConnection}
          disabled={isChecking}
          className="h-6 px-2 text-xs"
        >
          {isChecking ? (
            <RefreshCw className="w-3 h-3 animate-spin" />
          ) : (
            <RefreshCw className="w-3 h-3" />
          )}
        </Button>

        {!isConnected && (
          <Button
            size="sm"
            variant="outline"
            onClick={enableConnection}
            disabled={isChecking}
            className="h-6 px-2 text-xs text-green-600 hover:text-green-700"
          >
            <Wifi className="w-3 h-3" />
          </Button>
        )}

        {isConnected && (
          <Button
            size="sm"
            variant="outline"
            onClick={disableConnection}
            disabled={isChecking}
            className="h-6 px-2 text-xs text-red-600 hover:text-red-700"
          >
            <WifiOff className="w-3 h-3" />
          </Button>
        )}
      </div>

      {!isConnected && (
        <div className="flex items-center gap-1 text-xs text-amber-600">
          <AlertCircle className="w-3 h-3" />
          <span>Database offline</span>
        </div>
      )}
    </div>
  );
}