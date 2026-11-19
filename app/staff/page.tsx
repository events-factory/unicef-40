import type { Metadata } from 'next';
import RegistrationForm from '@/components/registration/RegistrationForm';
import { EVENT, STAFF } from '@/lib/event';

export const metadata: Metadata = {
  title: 'Staff registration',
  description: `Staff registration for the ${EVENT.name}, ${EVENT.date}, ${EVENT.venue}.`,
};

// Always open, regardless of REGISTRATION.open. STAFF.categoryIds is a module
// constant, so the form's category fetch is not re-triggered on each render.
export default function StaffPage() {
  return (
    <RegistrationForm
      title="Staff registration"
      categoryIds={STAFF.categoryIds}
    />
  );
}
