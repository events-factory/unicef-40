import RegistrationForm from '@/components/registration/RegistrationForm';
import { ClosedPanel, PageShell } from '@/components/registration/PageShell';
import { EVENT, REGISTRATION } from '@/lib/event';

export default function RegistrationPage() {
  if (!REGISTRATION.open) {
    return (
      <PageShell eyebrow={EVENT.name} title="Confirm your attendance">
        <ClosedPanel
          title={REGISTRATION.closedTitle}
          message={REGISTRATION.closedMessage}
        />
      </PageShell>
    );
  }
  return <RegistrationForm title="Confirm your attendance" />;
}
