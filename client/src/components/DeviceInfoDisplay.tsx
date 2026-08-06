import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Smartphone, 
  Monitor, 
  Tablet, 
  Globe, 
  Wifi, 
  Info,
  Clock,
  Shield
} from 'lucide-react';

interface DeviceInfo {
  browser: string;
  os: string;
  device: string;
  userAgent: string;
  platform: string;
  vendor: string;
  language: string;
  screenResolution: string;
  timezone: string;
  connectionType?: string;
}

interface DeviceInfoDisplayProps {
  deviceInfo: DeviceInfo;
  showTitle?: boolean;
  compact?: boolean;
}

export default function DeviceInfoDisplay({ deviceInfo, showTitle = true, compact = false }: DeviceInfoDisplayProps) {
  const getDeviceIcon = (device: string) => {
    switch (device.toLowerCase()) {
      case 'mobile':
        return <Smartphone className="h-4 w-4 text-blue-600" />;
      case 'tablet':
        return <Tablet className="h-4 w-4 text-purple-600" />;
      default:
        return <Monitor className="h-4 w-4 text-green-600" />;
    }
  };

  const getDeviceColor = (device: string) => {
    switch (device.toLowerCase()) {
      case 'mobile':
        return 'text-blue-600';
      case 'tablet':
        return 'text-purple-600';
      default:
        return 'text-green-600';
    }
  };

  if (compact) {
    return (
      <div className="flex items-center gap-2 text-sm">
        {getDeviceIcon(deviceInfo.device)}
        <span className={getDeviceColor(deviceInfo.device)}>
          {deviceInfo.device} • {deviceInfo.browser} • {deviceInfo.os}
        </span>
      </div>
    );
  }

  return (
    <Card className="border-0 shadow-sm bg-gradient-to-r from-gray-50 to-blue-50">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Smartphone className="h-4 w-4 text-blue-600" />
          {showTitle ? 'Device Information' : 'Device Details'}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Device Type */}
          <div className="flex items-center gap-2 text-sm">
            {getDeviceIcon(deviceInfo.device)}
            <span className="font-medium text-gray-700">Device:</span>
            <Badge variant="outline" className={getDeviceColor(deviceInfo.device)}>
              {deviceInfo.device}
            </Badge>
          </div>

          {/* Browser */}
          <div className="flex items-center gap-2 text-sm">
            <Globe className="h-4 w-4 text-blue-600" />
            <span className="font-medium text-gray-700">Browser:</span>
            <span className="text-gray-900">{deviceInfo.browser}</span>
          </div>

          {/* Operating System */}
          <div className="flex items-center gap-2 text-sm">
            <Monitor className="h-4 w-4 text-green-600" />
            <span className="font-medium text-gray-700">OS:</span>
            <span className="text-gray-900">{deviceInfo.os}</span>
          </div>

          {/* Platform */}
          <div className="flex items-center gap-2 text-sm">
            <Info className="h-4 w-4 text-gray-600" />
            <span className="font-medium text-gray-700">Platform:</span>
            <span className="text-gray-900">{deviceInfo.platform}</span>
          </div>

          {/* Screen Resolution */}
          <div className="flex items-center gap-2 text-sm">
            <Monitor className="h-4 w-4 text-purple-600" />
            <span className="font-medium text-gray-700">Screen:</span>
            <span className="text-gray-900">{deviceInfo.screenResolution}</span>
          </div>

          {/* Connection Type */}
          <div className="flex items-center gap-2 text-sm">
            <Wifi className="h-4 w-4 text-orange-600" />
            <span className="font-medium text-gray-700">Connection:</span>
            <span className="text-gray-900">{deviceInfo.connectionType || 'Unknown'}</span>
          </div>

          {/* Timezone */}
          <div className="flex items-center gap-2 text-sm">
            <Clock className="h-4 w-4 text-gray-600" />
            <span className="font-medium text-gray-700">Timezone:</span>
            <span className="text-gray-900">{deviceInfo.timezone}</span>
          </div>

          {/* Language */}
          <div className="flex items-center gap-2 text-sm">
            <Globe className="h-4 w-4 text-indigo-600" />
            <span className="font-medium text-gray-700">Language:</span>
            <span className="text-gray-900">{deviceInfo.language}</span>
          </div>

          {/* Security Status */}
          <div className="flex items-center gap-2 text-sm">
            <Shield className="h-4 w-4 text-green-600" />
            <span className="font-medium text-gray-700">Status:</span>
            <Badge variant="default" className="text-xs">
              Verified
            </Badge>
          </div>
        </div>

        {/* Additional Info */}
        <div className="text-xs text-gray-500 bg-gray-100 p-2 rounded">
          <span className="font-medium">User Agent:</span> {deviceInfo.userAgent.substring(0, 80)}...
        </div>
      </CardContent>
    </Card>
  );
} 