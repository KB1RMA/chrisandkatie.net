/**
 * Invitation code recovery page.
 *
 * Allows unauthenticated guests to retrieve their invitation code by
 * submitting their last name and the street address their invitation was
 * mailed to. Interactive form behaviour is handled by RecoveryForm.
 */
import { RecoveryForm } from '@/components/RecoveryForm';

export default function RecoverPage() {
  return (
    <div className="font-roboto flex min-h-screen items-center justify-start bg-gradient-to-br from-[#fff7f4] to-[#f3dedb] px-4 py-12 sm:justify-center sm:px-6 lg:px-8">
      <div className="w-full max-w-md">
        <RecoveryForm />
      </div>
    </div>
  );
}
