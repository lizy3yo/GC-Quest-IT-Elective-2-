import React from 'react';
import { LoadingSpinner } from '@/components/atoms/LoadingSpinner';
import { ErrorMessage } from '@/components/atoms/ErrorMessage';

interface DataContainerProps {
  state: 'idle' | 'loading' | 'success' | 'error';
  error?: string | Error | null;
  emptyMessage?: string;
  loadingMessage?: string;
  children: React.ReactNode;
  className?: string;
}

export const DataContainer: React.FC<DataContainerProps> = ({
  state,
  error,
  emptyMessage = 'No data available',
  loadingMessage = 'Loading...',
  children,
  className = ''
}) => {
  if (state === 'loading') {
    return (
      <div className={`flex flex-col items-center justify-center py-8 ${className}`}>
        <LoadingSpinner size="lg" />
        <p className="mt-4 text-gray-600">{loadingMessage}</p>
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div className={className}>
        <ErrorMessage error={error} />
      </div>
    );
  }

  if (state === 'success') {
    return <div className={className}>{children}</div>;
  }

  return (
    <div className={`text-center py-8 text-gray-600 ${className}`}>
      {emptyMessage}
    </div>
  );
};
