import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Utility function to merge Tailwind CSS classes with clsx and twMerge.
 * Combines classnames with tailwind-merge to handle conflicting Tailwind utilities.
 *
 * @param inputs - Class names to merge
 * @returns Merged class names with Tailwind conflicts resolved
 */
export function cn(...inputs: Parameters<typeof clsx>) {
  return twMerge(clsx(inputs));
}
