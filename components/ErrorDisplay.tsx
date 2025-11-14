import React from 'react';

interface ErrorDisplayProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  retryText?: string;
  className?: string;
}

export default function ErrorDisplay({
  title = 'Error',
  message,
  onRetry,
  retryText = 'Try Again',
  className = '',
}: ErrorDisplayProps) {
  return (
    <div
      className={`p-6 bg-red-900/20 border border-red-800 rounded-lg ${className}`}
      role="alert"
      aria-live="assertive"
    >
      <div className="flex items-start gap-3">
        <span className="text-2xl" aria-hidden="true">
          ⚠️
        </span>
        <div className="flex-1">
          <h3 className="text-red-400 font-semibold mb-2">{title}</h3>
          <p className="text-red-300 text-sm mb-4">{message}</p>
          {onRetry && (
            <button
              onClick={onRetry}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors font-medium focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-black"
              aria-label={retryText}
            >
              {retryText}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}