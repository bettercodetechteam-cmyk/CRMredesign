import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { MapPin, Globe, AlertCircle, ExternalLink } from 'lucide-react';

interface SimpleMapLocationProps {
  latitude: number;
  longitude: number;
  address: string;
}

export default function SimpleMapLocation({ latitude, longitude, address }: SimpleMapLocationProps) {
  return (
    <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
            <MapPin className="h-4 w-4 text-green-600" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-green-900">Current Location</p>
            <p className="text-sm text-green-700 mt-1 break-words">{address}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
} 