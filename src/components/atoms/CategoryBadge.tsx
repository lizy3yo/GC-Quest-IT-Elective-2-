import React from 'react';

interface CategoryBadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'ai-generated' | 'public' | 'private';
  className?: string;
}

/**
 * CategoryBadge component for displaying category labels with consistent styling
 * across the application. Supports light and dark modes.
 * 
 * @param variant - The style variant of the badge
 *   - 'default': Green badge (used for general categories, ai-generated, etc.)
 *   - 'ai-generated': Alias for default (green)
 *   - 'public': Green badge for public items
 *   - 'private': Blue badge for private items
 * @param className - Additional CSS classes to apply
 * 
 * @example
 * // Basic usage
 * <CategoryBadge>Math</CategoryBadge>
 * 
 * @example
 * // AI-generated badge
 * <CategoryBadge variant="ai-generated">ai-generated</CategoryBadge>
 * 
 * @example
 * // Public/Private badges
 * <CategoryBadge variant="public">Public</CategoryBadge>
 * <CategoryBadge variant="private">Private</CategoryBadge>
 * 
 * @example
 * // With custom className
 * <CategoryBadge className="ml-2">Custom</CategoryBadge>
 */
export function CategoryBadge({ children, variant = 'default', className = '' }: CategoryBadgeProps) {
  const baseStyles = 'inline-flex items-center justify-center px-2 py-0.5 text-[0.6875rem] font-semibold whitespace-nowrap rounded-full transition-colors';
  
  const variantStyles = {
    default: 'bg-[#E8F5E9] text-[#2E7D32] dark:bg-[#1C2B1C] dark:text-[#04C40A]',
    'ai-generated': 'bg-[#E8F5E9] text-[#2E7D32] dark:bg-[#1C2B1C] dark:text-[#04C40A]',
    public: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    private: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  };

  return (
    <span className={`${baseStyles} ${variantStyles[variant]} ${className}`}>
      {children}
    </span>
  );
}
