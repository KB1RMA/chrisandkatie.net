'use client';

import type { Route } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { trackNavigateToPath } from '@/lib/analytics';

const baseButtonClassName = [
  'inline-block',
  'font-semibold',
  'py-3',
  'px-8',
  'rounded-md',
  'shadow-sm',
  'transition-colors',
  'duration-200',
  'focus:outline-none',
  'focus:ring-2',
  'focus:ring-offset-2',
];

const primaryVariantClassName = [
  'bg-[#9e3f3f]',
  'hover:bg-[#b76565]',
  'text-white',
  'focus:ring-[#9e3f3f]',
];

const secondaryVariantClassName = [
  'border-2',
  'border-[#9e3f3f]',
  'text-[#9e3f3f]',
  'hover:bg-[#fff7f4]',
  'focus:ring-[#9e3f3f]',
];

export type ButtonProps = {
  children: ReactNode;
  href?: Route;
  onClick?: () => void;
  className?: string | string[];
  type?: 'button' | 'submit' | 'reset';
  disabled?: boolean;
  variant?: 'primary' | 'secondary';
};

/**
 * Shared button component for links and actions.
 *
 * @param props - Button configuration including label, href, and handlers.
 * @returns A styled button or link element.
 * @throws {Error} Does not throw.
 */
export function Button({
  children,
  href,
  onClick,
  className,
  type = 'button',
  disabled = false,
  variant = 'primary',
}: ButtonProps) {
  const variantClassName =
    variant === 'secondary'
      ? secondaryVariantClassName
      : primaryVariantClassName;

  const combinedClassName = cn(
    baseButtonClassName,
    variantClassName,
    {
      'opacity-50 cursor-not-allowed': disabled,
    },
    className,
  );

  const handleClick = () => {
    if (href) {
      trackNavigateToPath(href);
    }

    onClick?.();
  };

  if (href) {
    return (
      <Link href={href} onClick={handleClick} className={combinedClassName}>
        {children}
      </Link>
    );
  }

  return (
    <button
      type={type}
      onClick={handleClick}
      className={combinedClassName}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
