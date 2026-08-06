import React, { Component, ReactNode } from 'react';
import { AlertTriangle, Wifi, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface NetworkErrorBoundaryState {
  hasNetworkError: boolean;
  errorCount: number;
  lastErrorTime: number;
}

interface NetworkErrorBoundaryProps {
  children: ReactNode;
  maxErrors?: number;
  errorWindowMs?: number;
}

class NetworkErrorBoundary extends Component<NetworkErrorBoundaryProps, NetworkErrorBoundaryState> {
  constructor(props: NetworkErrorBoundaryProps) {
    super(props);
    this.state = {
      hasNetworkError: false,
      errorCount: 0,
      lastErrorTime: 0
    };
  }

  static getDerivedStateFromError(error: Error): Partial<NetworkErrorBoundaryState> | null {
    // Check if it's a network-related error
    const isNetworkError = 
      error.message.includes('QUIC_PROTOCOL_ERROR') ||
      error.message.includes('ERR_CONNECTION_CLOSED') ||
      error.message.includes('ERR_NETWORK_CHANGED') ||
      error.message.includes('ERR_BLOCKED_BY_CLIENT') ||
      error.message.includes('Failed to fetch') ||
      error.message.includes('NetworkError');

    if (isNetworkError) {
      return {
        hasNetworkError: true,
        errorCount: 1,
        lastErrorTime: Date.now()
      };
    }

    return null;
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    const now = Date.now();
    const { errorWindowMs = 30000 } = this.props; // 30 seconds window

    // Check if we're within the error window
    if (now - this.state.lastErrorTime < errorWindowMs) {
      this.setState(prevState => ({
        errorCount: prevState.errorCount + 1
      }));
    } else {
      // Reset error count if outside window
      this.setState({
        errorCount: 1,
        lastErrorTime: now
      });
    }

    // Log the error for debugging
    console.warn('Network error caught by boundary:', {
      error: error.message,
      errorInfo,
      errorCount: this.state.errorCount
    });
  }

  handleRetry = () => {
    this.setState({
      hasNetworkError: false,
      errorCount: 0,
      lastErrorTime: 0
    });
  }

  handleRefresh = () => {
    window.location.reload();
  }

  render() {
    const { hasNetworkError, errorCount } = this.state;
    const { children, maxErrors = 3 } = this.props;

    if (!hasNetworkError) {
      return children;
    }

    // If too many errors, show a more serious message
    if (errorCount >= maxErrors) {
      return (
        <div className="flex items-center justify-center min-h-screen bg-gray-50">
          <div className="text-center p-8 max-w-md">
            <WifiOff className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Network Connection Issues
            </h2>
            <p className="text-gray-600 mb-4">
              We're experiencing persistent network connectivity problems. 
              This might be due to:
            </p>
            <ul className="text-sm text-gray-600 mb-6 text-left space-y-1">
              <li>• Unstable internet connection</li>
              <li>• Firewall or network restrictions</li>
              <li>• Service temporarily unavailable</li>
            </ul>
            <div className="space-y-3">
              <Button 
                onClick={this.handleRefresh}
                className="w-full"
                variant="default"
              >
                Refresh Page
              </Button>
              <Button 
                onClick={this.handleRetry}
                className="w-full"
                variant="outline"
              >
                Try Again
              </Button>
            </div>
          </div>
        </div>
      );
    }

    // Show a less intrusive error message
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <div className="bg-white border border-red-200 rounded-lg shadow-lg p-4 max-w-sm">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <h3 className="text-sm font-medium text-gray-900 mb-1">
                Network Connection Issue
              </h3>
              <p className="text-xs text-gray-600 mb-3">
                Temporary connection problem detected. Your data is safe.
              </p>
              <div className="flex space-x-2">
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={this.handleRetry}
                  className="text-xs"
                >
                  Retry
                </Button>
                <Button 
                  size="sm" 
                  variant="ghost"
                  onClick={() => this.setState({ hasNetworkError: false })}
                  className="text-xs"
                >
                  Dismiss
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
}

export default NetworkErrorBoundary;
