'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import DelegateForm from '@/components/registration/DelegateForm';
import PaymentSummary from '@/components/registration/PaymentSummary';
import { useCardPayment } from '@/components/registration/useCardPayment';
import {
  ErrorPanel,
  LoadingPanel,
  PageShell,
  SuccessPanel,
} from '@/components/registration/PageShell';
import { extractCurrency } from '@/lib/payment';
import { EVENT, RSVP, RSVP_RULES } from '@/lib/event';
import {
  SMARTEVENT_API,
  EMAIL_INPUT,
  FIRST_NAME_INPUT,
  LAST_NAME_INPUT,
  buildDelegateForm,
  confirmationEmailSent,
  decodeHtml,
  messageList,
  smartEventJson,
  smartEventPost,
  valuesFromGroups,
  type FormInputGroup,
  type FormValues,
} from '@/lib/registration';

// What Registration-Form-Data-Retriever returns for a valid update token. An
// unknown or expired token comes back as just `{ message: [...] }`.
interface Registration {
  message?: string | string[];
  category?: { name_english: string; fee: string; is_free: 'YES' | 'NO' };
  data?: FormInputGroup[];
  record_unique_data?: {
    ticket_id: number;
    attendence_type: string;
    accompanied: string;
    registration_status: string;
    badge_id: string;
    amount_to_pay: number;
    amount_received: number;
  };
}

type State =
  | { kind: 'loading' }
  | { kind: 'missing' }
  | { kind: 'invalid'; messages: string[] }
  | { kind: 'error' }
  | { kind: 'ready'; registration: Required<Registration> };

export default function UpdateRegistrationPage() {
  return (
    // useSearchParams needs a Suspense boundary to prerender.
    <Suspense
      fallback={
        <Shell>
          <LoadingPanel />
        </Shell>
      }
    >
      <UpdateRegistration />
    </Suspense>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <PageShell eyebrow={EVENT.name} title="Confirm your attendance">
      {children}
    </PageShell>
  );
}

// The page invitees land on from the registration-update link SmartEvent
// emails them: https://<site>/registration/update?token=<update token>.
function UpdateRegistration() {
  const searchParams = useSearchParams();
  const token =
    searchParams.get('token') ||
    searchParams.get('registration_update_token') ||
    '';

  const [state, setState] = useState<State>({ kind: 'loading' });
  const [submitting, setSubmitting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [emailSent, setEmailSent] = useState(true);
  const [answers, setAnswers] = useState<FormValues>({});
  const [payment, setPayment] = useState<{
    transactionId: string;
    orderId: string;
  } | null>(null);
  const card = useCardPayment();

  const load = useCallback(async () => {
    if (!token) {
      setState({ kind: 'missing' });
      return;
    }
    setState({ kind: 'loading' });
    try {
      const res = await smartEventJson<Registration>(
        '/Registration-Form-Data-Retriever',
        { registration_update_token: token },
      );
      if (Array.isArray(res.data) && res.record_unique_data && res.category) {
        setState({
          kind: 'ready',
          registration: res as Required<Registration>,
        });
      } else {
        setState({
          kind: 'invalid',
          messages: messageList(
            res.message,
            'This link is not valid any more.',
          ),
        });
      }
    } catch {
      setState({ kind: 'error' });
    }
  }, [token]);

  useEffect(() => {
    // Mount-time fetch of the invitee's saved registration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  if (saved) {
    return (
      <Shell>
        <SuccessPanel
          {...responseCopy(answers, emailSent, !!payment)}
          payment={payment ?? undefined}
        />
      </Shell>
    );
  }

  if (state.kind === 'loading') {
    return (
      <Shell>
        <LoadingPanel label="Loading your registration…" />
      </Shell>
    );
  }

  if (state.kind === 'error') {
    return (
      <Shell>
        <ErrorPanel
          message="Failed to load your registration. Please try again."
          onRetry={load}
        />
      </Shell>
    );
  }

  if (state.kind === 'missing' || state.kind === 'invalid') {
    return (
      <Shell>
        <LinkProblem
          token={token}
          messages={state.kind === 'invalid' ? state.messages : []}
        />
      </Shell>
    );
  }

  const { registration } = state;
  const record = registration.record_unique_data;
  const outstanding = Math.max(
    0,
    Number(record.amount_to_pay || 0) - Number(record.amount_received || 0),
  );

  async function handleSubmit(values: FormValues): Promise<string[] | void> {
    let paid: {
      orderId?: string;
      paymentToken?: string;
      paymentSession?: string;
      transactionId?: string;
    } = {};

    const isBankTransfer = Object.values(values).some(
      (v) => typeof v === 'string' && v.toLowerCase().includes('bank transfer'),
    );

    // An unpaid balance on a paid category goes through the card gateway
    // before the update is saved, as on the registration page.
    if (
      outstanding > 0 &&
      values[RSVP.attending] === 'Yes' &&
      !isBankTransfer
    ) {
      const result = await card.pay({
        orderId: `ORD-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
        amount: outstanding,
        currency: extractCurrency(registration.category.fee),
        categoryName: decodeHtml(registration.category.name_english),
        categoryId: record.ticket_id,
        attendenceType: record.attendence_type,
        customerEmail: (values[EMAIL_INPUT] as string) || '',
        customerName:
          `${values[FIRST_NAME_INPUT] || ''} ${values[LAST_NAME_INPUT] || ''}`.trim(),
      });
      if (!result.success) {
        return [result.error || 'Payment was not completed. Please try again.'];
      }
      paid = result;
    }

    setSubmitting(true);
    try {
      // Questions now hidden go out blank, so a representative named earlier
      // is cleared when the invitee changes their answer.
      const form = buildDelegateForm(
        registration.data,
        values,
        Object.keys(RSVP_RULES),
      );
      form.append('ticket_id', String(record.ticket_id));
      form.append('attendence_type', record.attendence_type || 'PHYSICAL');
      form.append('accompanied', record.accompanied || 'NO');
      form.append('registration_update_token', token);
      if (paid.transactionId) {
        form.append('order_id', paid.orderId || '');
        form.append('payment_token', paid.paymentToken || '');
        form.append('payment_session', paid.paymentSession || '');
        form.append('acknowleadgment', paid.transactionId);
      }

      const result = await smartEventPost<{
        success?: boolean;
        message?: string | string[];
      }>('/Update-Delegate', form);

      if (!result.ok || result.success === false) {
        return messageList(
          result.message,
          'Your changes could not be saved. Please try again.',
        );
      }
      if (paid.transactionId && paid.orderId) {
        setPayment({
          transactionId: paid.transactionId,
          orderId: paid.orderId,
        });
      }
      setEmailSent(confirmationEmailSent(result.message));
      setAnswers(values);
      setSaved(true);
    } catch {
      return [
        'Something went wrong while saving your registration. Please try again.',
      ];
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Shell>
      <p className="mb-5 text-sm sm:text-base" style={{ color: 'var(--text)' }}>
        You have been invited to attend as{' '}
        <strong className="capitalize">
          {decodeHtml(registration.category.name_english)}
        </strong>
        . Check your details below and let us know whether you will attend.
      </p>
      <DelegateForm
        groups={registration.data}
        initialValues={valuesFromGroups(registration.data)}
        rules={RSVP_RULES}
        submitLabel={(values) =>
          values[RSVP.attending] !== 'Yes'
            ? 'Send my response'
            : outstanding > 0
              ? 'Proceed to payment'
              : 'Confirm attendance'
        }
        submitting={submitting}
        processing={card.processing}
        footer={
          outstanding > 0 && (
            <PaymentSummary fee={registration.category.fee} due={outstanding} />
          )
        }
        onSubmit={handleSubmit}
      />
      {card.modal}
    </Shell>
  );
}

// The confirmation, worded for the invitee's answer to "Will you attend?".
function responseCopy(
  answers: FormValues,
  emailSent: boolean,
  paid: boolean,
): { title: string; message: string } {
  const later = 'You can use the same link to change your response later.';
  const email = emailSent ? ' A confirmation email is on its way.' : '';

  if (answers[RSVP.attending] === 'Maybe') {
    return {
      title: 'Response received',
      message: `Thank you. We have noted that you may attend. Please use the same link to confirm once you know.${email}`,
    };
  }
  if (answers[RSVP.attending] === 'No') {
    const rep =
      answers[RSVP.sendRepresentative] === 'Yes'
        ? `${answers[RSVP.repFirstName] || ''} ${answers[RSVP.repLastName] || ''}`.trim()
        : '';
    return rep
      ? {
          title: 'Representative confirmed',
          message: `Thank you. We have noted that ${rep} will attend on your behalf.${email} ${later}`,
        }
      : {
          title: 'Response received',
          message: `Thank you for letting us know you cannot attend. We will miss you.${email} ${later}`,
        };
  }
  return {
    title: paid
      ? 'Payment received — attendance confirmed'
      : 'Attendance confirmed',
    message: `Thank you. Your details are saved.${email} ${later}`,
  };
}

// Shown for a missing, unknown or expired token. Given the old token,
// SmartEvent can email a fresh link to the address the invitation went to.
function LinkProblem({
  token,
  messages,
}: {
  token: string;
  messages: string[];
}) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<
    | { kind: 'idle' }
    | { kind: 'sending' }
    | { kind: 'sent' }
    | { kind: 'failed'; messages: string[] }
  >({ kind: 'idle' });

  async function requestLink(e: React.FormEvent) {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setStatus({ kind: 'failed', messages: ['Enter a valid email address.'] });
      return;
    }
    setStatus({ kind: 'sending' });
    try {
      const res = await fetch(
        `${SMARTEVENT_API}/Registration-Update-Link-Request`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email,
            registration_update_token: token,
            user_language: 'english',
          }),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) {
        setStatus({
          kind: 'failed',
          messages: messageList(
            data.message,
            'We could not send a new link. Please check the address and try again.',
          ),
        });
        return;
      }
      setStatus({ kind: 'sent' });
    } catch {
      setStatus({
        kind: 'failed',
        messages: ['Something went wrong. Please try again.'],
      });
    }
  }

  return (
    <div className="panel p-6 sm:p-8 max-w-xl mx-auto">
      <h2
        className="text-xl font-semibold mb-2"
        style={{
          color: 'var(--ink)',
          fontFamily: 'var(--font-heading),sans-serif',
        }}
      >
        {token
          ? 'This link has expired or is not valid'
          : 'Registration link needed'}
      </h2>
      <p className="text-sm" style={{ color: 'var(--muted)' }}>
        {token
          ? 'Links are personal and expire after a while. Enter the email address your invitation was sent to and we will email you a new link.'
          : 'This page opens from the RSVP link in your invitation email. Please open the link from that email.'}
      </p>
      {messages.length > 0 && (
        <p className="mt-3 text-sm text-red-600">{messages.join(' ')}</p>
      )}

      {/* SmartEvent issues a new link only in exchange for the old token, so
          without one there is nothing to request. */}
      {!token ? null : status.kind === 'sent' ? (
        <div className="mt-6 p-4 rounded-lg bg-green-50 border border-green-200 text-sm text-green-800">
          A new link is on its way to <strong>{email}</strong>. Check your
          inbox, and your spam folder if it does not arrive in a few minutes.
        </div>
      ) : (
        <form onSubmit={requestLink} className="mt-6" noValidate>
          <label
            htmlFor="link-email"
            className="block text-sm font-medium mb-1.5"
            style={{ color: 'var(--text)' }}
          >
            Email address
          </label>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              id="link-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="flex-1 px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:outline-none border-gray-300 focus:ring-primary-500/30 focus:border-primary-500"
              autoComplete="email"
            />
            <button
              type="submit"
              disabled={status.kind === 'sending'}
              className="btn-primary px-6 py-2.5 rounded-lg text-white text-sm font-semibold disabled:opacity-50"
            >
              {status.kind === 'sending' ? 'Sending…' : 'Send me a new link'}
            </button>
          </div>
          {status.kind === 'failed' && (
            <p className="mt-2 text-sm text-red-600">
              {status.messages.join(' ')}
            </p>
          )}
        </form>
      )}

      <p
        className="mt-6 pt-6 border-t text-sm"
        style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}
      >
        Not invited?{' '}
        <Link
          href="/registration"
          className="underline font-medium"
          style={{ color: 'var(--brand2)' }}
        >
          Register here
        </Link>
        .
      </p>
    </div>
  );
}
