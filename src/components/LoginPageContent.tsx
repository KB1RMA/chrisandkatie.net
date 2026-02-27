'use client';

/**
 * Login page content — manages the toggle between invitation code form and admin form.
 *
 * Renders the invitation code form by default. An unobtrusive "Admin sign in"
 * link reveals the admin credentials form (username/password) for site admins.
 */
import { useState } from 'react';
import { InvitationCodeForm } from '@/components/InvitationCodeForm';
import { LoginForm } from '@/components/LoginForm';

type LoginPageContentProps = {
  marcellusClassName: string;
  /** Pre-filled invitation code from query param (QR deep-link). */
  initialCode?: string;
};

/**
 * Toggleable login view: invitation code form (default) or admin form.
 *
 * @param marcellusClassName - Marcellus font class for headings.
 * @param initialCode - Optional code from URL for QR deep-link auto-submit.
 */
export function LoginPageContent({
  marcellusClassName,
  initialCode,
}: LoginPageContentProps) {
  const [showAdminForm, setShowAdminForm] = useState(false);

  if (showAdminForm) {
    return (
      <div>
        <LoginForm marcellusClassName={marcellusClassName} />
        <p className="mt-4 text-center text-sm text-[#9e9090]">
          <button
            type="button"
            onClick={() => setShowAdminForm(false)}
            className="text-[#9e3f3f] underline-offset-2 hover:underline"
          >
            Back to invitation code sign in
          </button>
        </p>
      </div>
    );
  }

  return (
    <div>
      <InvitationCodeForm
        marcellusClassName={marcellusClassName}
        initialCode={initialCode}
      />
      <p className="mt-4 text-center text-sm text-[#9e9090]">
        <button
          type="button"
          onClick={() => setShowAdminForm(true)}
          className="text-[#9e9090] underline-offset-2 hover:underline"
        >
          Admin sign in
        </button>
      </p>
    </div>
  );
}
