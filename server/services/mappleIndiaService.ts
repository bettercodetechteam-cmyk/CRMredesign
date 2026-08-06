import axios from 'axios';
import https from 'https';

interface MappleLocationResult {
  address: string;
  formattedAddress: string;
  location: {
    lat: number;
    lng: number;
  };
  components: {
    street?: string;
    city?: string;
    state?: string;
    country?: string;
    postalCode?: string;
  };
}

export class MappleIndiaService {
  private static apiKey = '528fbac6759fa0a0f25d0e6ec5257dca';
  private static baseUrl = 'https://api.mappleindia.com/v1';

  // Get location details from coordinates using Google API
  static async getLocationFromCoordinates(lat: number, lng: number): Promise<MappleLocationResult | null> {
    try {
      console.log('🔍 Getting location from Google API...');
      
      const apiKey =
        process.env.GOOGLE_MAPS_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY;
      if (!apiKey) {
        return null;
      }

      const response = await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
        params: {
          latlng: `${lat},${lng}`,
          key: apiKey
        },
        timeout: 8000
      });

      if (response.data && response.data.status === 'OK' && response.data.results.length > 0) {
        const result = response.data.results[0];
        const address = result.formatted_address;
        
        // Parse address components
        const components: any = {};
        result.address_components.forEach((component: any) => {
          const types = component.types;
          if (types.includes('route')) {
            components.street = component.long_name;
          } else if (types.includes('locality')) {
            components.city = component.long_name;
          } else if (types.includes('administrative_area_level_1')) {
            components.state = component.long_name;
          } else if (types.includes('country')) {
            components.country = component.long_name;
          } else if (types.includes('postal_code')) {
            components.postalCode = component.long_name;
          }
        });
        
        return {
          address: address,
          formattedAddress: address,
          location: {
            lat: lat,
            lng: lng
          },
          components: {
            street: components.street || '',
            city: components.city || '',
            state: components.state || '',
            country: components.country || 'India',
            postalCode: components.postalCode || ''
          }
        };
      }

      return null;
    } catch (error) {
      console.error('❌ Google API error:', error);
      return null;
    }
  }

  // Get a human-readable address from coordinates
  static async getAddressFromCoordinates(lat: number, lng: number): Promise<string> {
    try {
      console.log('📍 Getting address from Google API...');
      
      // Use only Google API
      const result = await this.getLocationFromCoordinates(lat, lng);
      if (result) {
        const fullAddress = result.formattedAddress;
        
        // Check if we're at Zica Zima center locations
        if (this.isZicaZimaLocation(lat, lng, fullAddress)) {
          console.log('✅ Zica Zima location detected');
          return 'ZICA ZIMA PCMC';
        }
        
        // Check for other known locations and provide friendly names
        const friendlyName = this.getFriendlyLocationName(lat, lng, fullAddress);
        if (friendlyName) {
          console.log('✅ Friendly location name found:', friendlyName);
          return friendlyName;
        }
        
        // Return a simplified version of the address
        const simplifiedAddress = this.simplifyAddress(fullAddress);
        console.log('✅ Simplified address:', simplifiedAddress);
        return simplifiedAddress;
      }
      
      // Fallback to coordinates if Google API fails
      const fallbackAddress = `Location: ${lat.toFixed(6)}, ${lng.toFixed(6)}`;
      console.log('⚠️ Using fallback address:', fallbackAddress);
      return fallbackAddress;
    } catch (error) {
      console.error('❌ Error getting address from coordinates:', error);
      return `Location: ${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    }
  }

  // Function to check if location is at Zica Zima Pimpri-Chinchwad center
  private static isZicaZimaLocation(lat: number, lng: number, address: string): boolean {
    // Zica Zima Pimpri-Chinchwad coordinates
    const zicaZimaPimpriChinchwad = { lat: 18.6304, lng: 73.7888 };
    
    // Calculate distance from Zica Zima Pimpri-Chinchwad center (in km)
    const distance = this.calculateDistance(lat, lng, zicaZimaPimpriChinchwad.lat, zicaZimaPimpriChinchwad.lng);
    
    // If within 300 meters of the center
    if (distance <= 0.3) {
      console.log('📍 Detected Zica Zima Pimpri-Chinchwad location');
      return true;
    }
    
    // Also check if address contains Zica Zima related keywords
    const zicaKeywords = ['zica', 'zima', 'pimpri', 'chinchwad'];
    const addressLower = address.toLowerCase();
    const hasZicaKeywords = zicaKeywords.some(keyword => addressLower.includes(keyword));
    
    if (hasZicaKeywords) {
      console.log('📍 Address contains Zica Zima keywords');
      return true;
    }
    
    return false;
  }

  // Function to get friendly location names for other known places
  private static getFriendlyLocationName(lat: number, lng: number, address: string): string | null {
    const addressLower = address.toLowerCase();
    
    // Check for common locations and provide friendly names
    if (addressLower.includes('pune') && addressLower.includes('maharashtra')) {
      return 'Pune City Center';
    }
    
    if (addressLower.includes('mumbai') && addressLower.includes('maharashtra')) {
      return 'Mumbai City Center';
    }
    
    if (addressLower.includes('delhi')) {
      return 'Delhi City Center';
    }
    
    if (addressLower.includes('bangalore') || addressLower.includes('bengaluru')) {
      return 'Bangalore City Center';
    }
    
    if (addressLower.includes('hyderabad')) {
      return 'Hyderabad City Center';
    }
    
    if (addressLower.includes('chennai')) {
      return 'Chennai City Center';
    }
    
    return null;
  }

  // Function to simplify address for better display
  private static simplifyAddress(fullAddress: string): string {
    // Remove postal codes and extra details
    let simplified = fullAddress
      .replace(/\d{6}/g, '') // Remove postal codes
      .replace(/, India$/, '') // Remove "India" suffix
      .replace(/, Maharashtra$/, '') // Remove "Maharashtra" suffix
      .replace(/,\s*,/g, ',') // Remove double commas
      .replace(/^\s*,\s*/, '') // Remove leading comma
      .replace(/,\s*$/, ''); // Remove trailing comma
    
    // If the address is still too long, take only the first two parts
    const parts = simplified.split(',').filter(part => part.trim().length > 0);
    if (parts.length > 2) {
      simplified = parts.slice(0, 2).join(', ');
    }
    
    return simplified.trim();
  }

  // Function to calculate distance between two coordinates (Haversine formula)
  private static calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Radius of the Earth in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c; // Distance in kilometers
    return distance;
  }

  // Get detailed location information
  static async getLocationDetails(lat: number, lng: number): Promise<{
    address: string;
    street: string;
    city: string;
    state: string;
    country: string;
    postalCode: string;
  } | null> {
    try {
      const result = await this.getLocationFromCoordinates(lat, lng);
      if (result) {
        return {
          address: result.formattedAddress,
          street: result.components.street || '',
          city: result.components.city || '',
          state: result.components.state || '',
          country: result.components.country || 'India',
          postalCode: result.components.postalCode || ''
        };
      }
      
      return null;
    } catch (error) {
      console.error('❌ Error getting location details:', error);
      return null;
    }
  }

  // Validate if the service is working
  static async testConnection(): Promise<boolean> {
    try {
      // Test with a known location (Pune, Maharashtra)
      const testLat = 18.5204;
      const testLng = 73.8567;
      
      console.log('🧪 Testing Google API service connection...');
      const result = await this.getLocationFromCoordinates(testLat, testLng);
      
      if (result) {
        console.log('✅ Google API service is working');
        return true;
      } else {
        console.log('⚠️ Google API service returned null');
        return false;
      }
    } catch (error) {
      console.error('❌ Google API service test failed:', error);
      return false;
    }
  }
}

export default MappleIndiaService; 