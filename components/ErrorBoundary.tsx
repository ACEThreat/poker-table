'use client';

import React, { Component, ReactNode } from 'react';
import ErrorDisplay from './ErrorDisplay';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    // Log error details for debugging
    console.error('ErrorBoundary caught an error:', error);
    console.error('Error info:', errorInfo);
    
    // Update state with error info
    this.setState({
      errorInfo,
    });

    // In production, you could send error to a logging service here
    // Example: logErrorToService(error, errorInfo);
  }

  handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      // Custom fallback UI provided by parent
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default fallback UI
      const errorMessage = this.state.error?.message || 'An unexpected error occurred';
      const isDevelopment = process.env.NODE_ENV === 'development';

      return (
        <div className="min-h-screen bg-black text-gray-100 p-4 md:p-8 flex items-center justify-center">
          <div className="max-w-2xl w-full">
            <ErrorDisplay
              title="Application Error"
              message={errorMessage}
              onRetry={this.handleReset}
              retryText="Reload Page"
              className="mb-4"
            />
            
            {isDevelopment && this.state.errorInfo && (
              <div className="mt-4 p-4 bg-gray-900 border border-gray-800 rounded-lg">
                <h4 className="text-gray-400 font-semibold mb-2 text-sm">
                  Error Details (Development Mode):
                </h4>
                <pre className="text-xs text-gray-500 overflow-auto max-h-64">
                  {this.state.error?.stack}
                </pre>
                {this.state.errorInfo.componentStack && (
                  <div className="mt-2">
                    <h5 className="text-gray-400 font-semibold mb-1 text-xs">
                      Component Stack:
                    </h5>
                    <pre className="text-xs text-gray-500 overflow-auto max-h-32">
                      {this.state.errorInfo.componentStack}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;