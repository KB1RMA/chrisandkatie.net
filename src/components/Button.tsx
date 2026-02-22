'use client';

import type { Route } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import classNames from 'classnames';
import { trackNavigateToPath } from '@/lib/analytics';

const baseButtonClassName = [
  'inline-block',
  'bg-gradient-to-r',
  'from-[#a34a4a]',
  'to-[#cf7b78]',
  'hover:from-[#8f3d3d]',
  'hover:to-[#b86562]',
  'text-white',
  'font-semibold',
  'py-3',
  'px-8',
  'rounded-full',
  'shadow-lg',
  'transition-all',
  'duration-200',
];

export type ButtonProps = {
  children: ReactNode;
  href?: Route;
  onClick?: () => void;
  className?: string | string[];
  type?: 'button' | 'submit' | 'reset';
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
}: ButtonProps) {
  const combinedClassName = classNames(baseButtonClassName, className);

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
    <button type={type} onClick={handleClick} className={combinedClassName}>
      {children}
    </button>
  );
}
