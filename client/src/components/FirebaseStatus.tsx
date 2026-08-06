import { useEffect, useState } from 'react';
import { app, analytics } from '@/lib/firebase';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle, XCircle, AlertCircle } from 'lucide-react';

export default function FirebaseStatus() {
  const [connectionStatus, setConnectionStatus] = useState<{
    app: boolean;
    analytics: boolean;
    apiKey: boolean;
  }>({
    app: false,
    analytics: false,
    apiKey: false
  });

  useEffect(() => {
    // Check Firebase connection status
    const checkConnection = () => {
      const apiKeyExists = !!import.meta.env.VITE_GOOGLE_API_KEY;
      const appInitialized = !!app;
      const analyticsInitialized = !!analytics;

      setConnectionStatus({
        app: appInitialized,
        analytics: analyticsInitialized,
        apiKey: apiKeyExists
      });

      // Log detailed status
      console.log('🔍 Firebase Connection Status:');
      console.log(`  API Key: ${apiKeyExists ? '✅' : '❌'}`);
      console.log(`  App: ${appInitialized ? '✅' : '❌'}`);
      console.log(`  Analytics: ${analyticsInitialized ? '✅' : '❌'}`);
    };

    checkConnection();
  }, []);

  const getStatusIcon = (status: boolean) => {
    return status ? (
      <CheckCircle className="w-4 h-4 text-green-500" />
    ) : (
      <XCircle className="w-4 h-4 text-red-500" />
    );
  };

  const getOverallStatus = () => {
    if (connectionStatus.app && connectionStatus.analytics && connectionStatus.apiKey) {
      return { status: 'Connected', color: 'bg-green-100 text-green-800', icon: <CheckCircle className="w-4 h-4" /> };
    } else if (connectionStatus.apiKey) {
      return { status: 'Partial', color: 'bg-yellow-100 text-yellow-800', icon: <AlertCircle className="w-4 h-4" /> };
    } else {
      return { status: 'Disconnected', color: 'bg-red-100 text-red-800', icon: <XCircle className="w-4 h-4" /> };
    }
  };

  const overall = getOverallStatus();

  return (
    <Card className="w-full max-w-md">
      <CardContent className="p-4">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm">Firebase Status</h3>
            <Badge className={overall.color}>
              <div className="flex items-center gap-1">
                {overall.icon}
                {overall.status}
              </div>
            </Badge>
          </div>
          
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span>API Key</span>
              {getStatusIcon(connectionStatus.apiKey)}
            </div>
            <div className="flex items-center justify-between">
              <span>Firebase App</span>
              {getStatusIcon(connectionStatus.app)}
            </div>
            <div className="flex items-center justify-between">
              <span>Analytics</span>
              {getStatusIcon(connectionStatus.analytics)}
            </div>
          </div>

          {!connectionStatus.apiKey && (
            <div className="text-xs text-gray-600 bg-gray-50 p-2 rounded">
              Add VITE_GOOGLE_API_KEY to environment variables
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}