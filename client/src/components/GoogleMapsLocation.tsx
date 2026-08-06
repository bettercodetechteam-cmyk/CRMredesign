import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MapPin, Navigation, Clock, User, Building } from "lucide-react";

interface Location {
  latitude: number;
  longitude: number;
  address: string;
  timestamp: string;
}

interface GoogleMapsLocationProps {
  locations?: Location[];
  currentLocation?: Location;
  onLocationUpdate?: (location: Location) => void;
  readonly?: boolean;
  className?: string;
}

declare global {
  interface Window {
    google: any;
    initMap: () => void;
  }
}

export default function GoogleMapsLocation({ 
  locations = [], 
  currentLocation, 
  onLocationUpdate, 
  readonly = false,
  className = ""
}: GoogleMapsLocationProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<any>(null);
  const [markers, setMarkers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initialize simple map display
  useEffect(() => {
    const initMap = () => {
      if (!mapRef.current) return;

      try {
        // Set up a simple map container with location display
        setIsLoading(false);
      } catch (err) {
        console.error('Error initializing map:', err);
        setError('Failed to load map');
        setIsLoading(false);
      }
    };

    // Initialize immediately since we're not using Google Maps
    initMap();

    return () => {
      // Cleanup
      if (map) {
        // Clear markers
        markers.forEach(marker => marker.setMap(null));
      }
    };
  }, []);

  // Update location display when locations change
  useEffect(() => {
    // Simple location display without Google Maps markers
    if (locations.length > 0) {
      console.log('📍 Locations updated:', locations.length);
    }
  }, [locations]);

  // Get current location
  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by this browser');
      return;
    }

    setIsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const location: Location = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          address: `Location: ${position.coords.latitude.toFixed(6)}, ${position.coords.longitude.toFixed(6)}`,
          timestamp: new Date().toISOString()
        };

        // Update map center
        if (map) {
          map.setCenter({ lat: location.latitude, lng: location.longitude });
        }

        onLocationUpdate?.(location);
        setIsLoading(false);
      },
      (error) => {
        console.error('Geolocation error:', error);
        setError('Failed to get current location');
        setIsLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000
      }
    );
  };

  if (error) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-600">
            <MapPin className="h-5 w-5" />
            Location Error
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <MapPin className="h-12 w-12 mx-auto text-red-400 mb-4" />
            <p className="text-red-600 font-medium">{error}</p>
            <Button 
              onClick={getCurrentLocation} 
              className="mt-4"
              variant="outline"
            >
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5" />
          Location Tracking
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Location Display Container */}
          <div 
            ref={mapRef} 
            className="w-full h-64 rounded-lg border border-gray-200 relative bg-gradient-to-br from-blue-50 to-indigo-50"
          >
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-50 rounded-lg">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                  <p className="text-sm text-gray-600">Loading location...</p>
                </div>
              </div>
            )}
            {!isLoading && currentLocation && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <MapPin className="h-12 w-12 text-blue-600 mx-auto mb-4" />
                  <p className="text-sm text-gray-600">Location captured</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {currentLocation.latitude.toFixed(4)}, {currentLocation.longitude.toFixed(4)}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Location Controls */}
          {!readonly && (
            <div className="flex gap-2">
              <Button 
                onClick={getCurrentLocation}
                disabled={isLoading}
                className="flex-1"
                variant="outline"
              >
                <Navigation className="h-4 w-4 mr-2" />
                Get Current Location
              </Button>
            </div>
          )}

          {/* Location Info */}
          {currentLocation && (
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-lg border border-blue-200">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <MapPin className="h-5 w-5 text-blue-600" />
                </div>
                <div className="flex-1">
                  <h4 className="font-medium text-blue-900 mb-1">Current Location</h4>
                  <p className="text-sm text-blue-700 mb-2">{currentLocation.address}</p>
                  <div className="flex items-center gap-4 text-xs text-blue-600">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(currentLocation.timestamp).toLocaleTimeString()}
                    </span>
                    <span className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      {currentLocation.latitude.toFixed(6)}, {currentLocation.longitude.toFixed(6)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Location History */}
          {locations.length > 1 && (
            <div className="space-y-2">
              <h4 className="font-medium text-gray-900">Location History</h4>
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {locations.slice(1).map((location, index) => (
                  <div key={index} className="flex items-center gap-2 p-2 bg-gray-50 rounded text-sm">
                    <Building className="h-4 w-4 text-gray-400" />
                    <span className="flex-1 text-gray-700">{location.address}</span>
                    <Badge variant="secondary" className="text-xs">
                      {new Date(location.timestamp).toLocaleDateString()}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
} 