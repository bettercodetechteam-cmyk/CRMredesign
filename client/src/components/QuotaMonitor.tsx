/**
 * Quota Monitor Component
 * Displays Firebase quota usage and alerts
 */

import React, { useState, useEffect } from 'react';
import { quotaMonitor, QuotaAlert } from '@/lib/quotaMonitor';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  AlertTriangle, 
  XCircle, 
  CheckCircle, 
  RefreshCw,
  Database,
  Upload,
  Download,
  Trash2,
  HardDrive
} from 'lucide-react';

interface QuotaMonitorProps {
  className?: string;
  showAlerts?: boolean;
  compact?: boolean;
}

export default function QuotaMonitor({ 
  className = '', 
  showAlerts = true, 
  compact = false 
}: QuotaMonitorProps) {
  const [usage, setUsage] = useState(quotaMonitor.getUsageStats());
  const [alerts, setAlerts] = useState<QuotaAlert[]>([]);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Subscribe to quota alerts
    const unsubscribeAlerts = quotaMonitor.onAlert((alert) => {
      setAlerts(prev => [alert, ...prev.slice(0, 9)]); // Keep last 10 alerts
    });

    // Update usage stats periodically
    const interval = setInterval(() => {
      setUsage(quotaMonitor.getUsageStats());
    }, 30000); // Update every 30 seconds

    return () => {
      unsubscribeAlerts();
      clearInterval(interval);
    };
  }, []);

  const getStatusColor = (percentage: number) => {
    if (percentage >= 100) return 'text-red-600';
    if (percentage >= 90) return 'text-orange-600';
    if (percentage >= 75) return 'text-yellow-600';
    return 'text-green-600';
  };

  const getStatusIcon = (percentage: number) => {
    if (percentage >= 100) return <XCircle className="h-4 w-4" />;
    if (percentage >= 90) return <AlertTriangle className="h-4 w-4" />;
    if (percentage >= 75) return <AlertTriangle className="h-4 w-4" />;
    return <CheckCircle className="h-4 w-4" />;
  };

  const getStatusBadge = (percentage: number) => {
    if (percentage >= 100) return <Badge variant="destructive">Exceeded</Badge>;
    if (percentage >= 90) return <Badge variant="destructive">Critical</Badge>;
    if (percentage >= 75) return <Badge variant="secondary">Warning</Badge>;
    return <Badge variant="default">Healthy</Badge>;
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const formatBytes = (bytes: number) => {
    if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${bytes} B`;
  };

  const handleResetUsage = () => {
    quotaMonitor.resetUsage();
    setUsage(quotaMonitor.getUsageStats());
    setAlerts([]);
  };

  const handleClearAlerts = () => {
    quotaMonitor.clearAlerts();
    setAlerts([]);
  };

  if (compact) {
    const maxPercentage = Math.max(
      usage.percentages.reads || 0,
      usage.percentages.writes || 0,
      usage.percentages.deletes || 0
    );

    return (
      <div className={`flex items-center space-x-2 ${className}`}>
        <Database className="h-4 w-4" />
        <span className="text-sm">Quota:</span>
        <div className="flex items-center space-x-1">
          {getStatusIcon(maxPercentage)}
          <span className={`text-sm font-medium ${getStatusColor(maxPercentage)}`}>
            {maxPercentage.toFixed(0)}%
          </span>
        </div>
        {maxPercentage >= 75 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsVisible(true)}
            className="h-6 px-2 text-xs"
          >
            View Details
          </Button>
        )}
      </div>
    );
  }

  return (
    <>
      <Card className={className}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center space-x-2">
              <Database className="h-5 w-5" />
              <span>Firebase Quota Monitor</span>
            </CardTitle>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setUsage(quotaMonitor.getUsageStats())}
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleResetUsage}
                className="text-xs"
              >
                Reset
              </Button>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {/* Quota Usage */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Reads */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Download className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-medium">Reads</span>
                </div>
                <div className="flex items-center space-x-2">
                  {getStatusBadge(usage.percentages.reads || 0)}
                  <span className="text-sm text-gray-600">
                    {formatNumber(usage.usage.reads)} / {formatNumber(usage.limits.reads)}
                  </span>
                </div>
              </div>
              <Progress 
                value={usage.percentages.reads || 0} 
                className="h-2"
              />
            </div>

            {/* Writes */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Upload className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-medium">Writes</span>
                </div>
                <div className="flex items-center space-x-2">
                  {getStatusBadge(usage.percentages.writes || 0)}
                  <span className="text-sm text-gray-600">
                    {formatNumber(usage.usage.writes)} / {formatNumber(usage.limits.writes)}
                  </span>
                </div>
              </div>
              <Progress 
                value={usage.percentages.writes || 0} 
                className="h-2"
              />
            </div>

            {/* Deletes */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Trash2 className="h-4 w-4 text-red-600" />
                  <span className="text-sm font-medium">Deletes</span>
                </div>
                <div className="flex items-center space-x-2">
                  {getStatusBadge(usage.percentages.deletes || 0)}
                  <span className="text-sm text-gray-600">
                    {formatNumber(usage.usage.deletes)} / {formatNumber(usage.limits.deletes)}
                  </span>
                </div>
              </div>
              <Progress 
                value={usage.percentages.deletes || 0} 
                className="h-2"
              />
            </div>

            {/* Storage */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <HardDrive className="h-4 w-4 text-purple-600" />
                  <span className="text-sm font-medium">Storage</span>
                </div>
                <div className="flex items-center space-x-2">
                  {getStatusBadge(usage.percentages.storage || 0)}
                  <span className="text-sm text-gray-600">
                    {formatBytes(usage.usage.storage * 1024 * 1024)} / {formatBytes(usage.limits.storage * 1024 * 1024)}
                  </span>
                </div>
              </div>
              <Progress 
                value={usage.percentages.storage || 0} 
                className="h-2"
              />
            </div>
          </div>

          {/* Alerts */}
          {showAlerts && alerts.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium">Recent Alerts</h4>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearAlerts}
                  className="text-xs"
                >
                  Clear
                </Button>
              </div>
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {alerts.slice(0, 5).map((alert, index) => (
                  <Alert key={index} className={`py-2 ${
                    alert.type === 'exceeded' ? 'border-red-200 bg-red-50' :
                    alert.type === 'critical' ? 'border-orange-200 bg-orange-50' :
                    'border-yellow-200 bg-yellow-50'
                  }`}>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription className="text-xs">
                      {alert.message}
                      <span className="text-gray-500 ml-2">
                        {new Date(alert.timestamp).toLocaleTimeString()}
                      </span>
                    </AlertDescription>
                  </Alert>
                ))}
              </div>
            </div>
          )}

          {/* Last Reset */}
          <div className="text-xs text-gray-500 text-center">
            Last reset: {new Date(usage.usage.lastReset).toLocaleString()}
          </div>
        </CardContent>
      </Card>
    </>
  );
}
