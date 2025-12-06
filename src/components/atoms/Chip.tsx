import React from 'react';

interface ChipProps {
  children: React.ReactNode;
  variant?: 'default' | 'arrow' | 'badge';
  className?: string;
}

export function Chip({ children, variant = 'default', className = '' }: ChipProps) {
  const baseStyles = 'inline-flex items-center justify-center rounded-full transition-all duration-150';
  
  const variantStyles = {
    default: 'px-3 py-1 text-sm font-medium bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
    arrow: 'w-9 h-9 border-none bg-transparent text-[#475569] dark:bg-transparent dark:text-[#94a3b8] dark:border-none',
    badge: 'px-2 py-0.5 text-[0.6875rem] font-semibold whitespace-nowrap bg-[#E8F5E9] text-[#2E7D32] dark:bg-[#1C2B1C] dark:text-[#04C40A]'
  };

  return (
    <span className={`${baseStyles} ${variantStyles[variant]} ${className}`}>
      {children}
    </span>
  );
}
