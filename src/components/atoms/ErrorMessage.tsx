import React from 'react';

interface ErrorMessageProps {
  error?: string | Error | null;
  className?: string;
}

export const ErrorMessage: React.FC<ErrorMessageProps> = ({ 
  error,
  className = '' 
}) => {
  if (!error) return null;

  const errorMessage = typeof error === 'string' ? error : error.message;

  return (
    <div className={`bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded ${className}`}>
      <p className="text-sm">{errorMessage}</p>
    </div>
  );
};
