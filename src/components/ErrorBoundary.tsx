'use client';

/**
 * Error boundary component to gracefully handle RSVP form errors.
 *
 * Catches errors during rendering and displays a user-friendly message
 * without exposing technical details or database information.
 */
import { Component, type ReactNode } from 'react';

type ErrorBoundaryProps = {
  children: ReactNode;
  fallback?: ReactNode;
};

type ErrorBoundaryState = {
  hasError: boolean;
};

/**
 * React error boundary that catches rendering errors and shows a fallback UI.
 *
 * @param children - Child components to protect.
 * @param fallback - Optional custom fallback UI; defaults to a generic error message.
 */
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  override render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
            <p className="mb-2 font-medium text-red-700">
              Something went wrong
            </p>
            <p className="text-sm text-red-600">
              An unexpected error occurred. Please refresh the page and try
              again. If the problem persists, please contact us directly.
            </p>
          </div>
        )
      );
    }

    return this.props.children;
  }
}
