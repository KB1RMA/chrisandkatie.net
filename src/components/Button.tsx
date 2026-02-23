'use client';

import type { Route } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import classNames from 'classnames';
import { trackNavigateToPath } from '@/lib/analytics';

const baseButtonClassName = [
  'inline-block',
  'bg-[#9e3f3f]',
  'hover:bg-[#b76565]',
  'text-white',
  'font-semibold',
  'py-3',
  'px-8',
  'rounded-md',
  'shadow-sm',
  'transition-colors',
  'duration-200',
];

export type ButtonProps = {
  children: ReactNode;
  href?: Route;
  onClick?: () => void;
  className?: string | string[];
  type?: 'button' | 'submit' | 'reset';
  disabled?: boolean;
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
}: ButtonProps) {
  const combinedClassName = classNames(
    baseButtonClassName,
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
