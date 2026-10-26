'use client';

import { useState, useEffect, useCallback } from 'react';
import DelegateForm from '@/components/registration/DelegateForm';
import PaymentSummary from '@/components/registration/PaymentSummary';
import { useCardPayment } from '@/components/registration/useCardPayment';
import {
  ErrorPanel,
  LoadingPanel,
  PageShell,
  SuccessPanel,
} from '@/components/registration/PageShell';
import {
  requiresPayment,
  parseFeeAmount,
  extractCurrency,
} from '@/lib/payment';
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
  type FormInputGroup,
  type FormValues,
  type RegistrationCategory,
} from '@/lib/registration';

type Attendance = 'PHYSICAL' | 'VIRTUAL';

export default function RegistrationPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [eventType, setEventType] = useState<'HYBRID' | Attendance | null>(
    null,
  );
  const [attendanceType, setAttendanceType] = useState<Attendance | null>(null);
  const [categories, setCategories] = useState<RegistrationCategory[]>([]);
  const [selectedCategory, setSelectedCategory] =
    useState<RegistrationCategory | null>(null);
  const [formGroups, setFormGroups] = useState<FormInputGroup[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [badgeId, setBadgeId] = useState('');
  const [emailSent, setEmailSent] = useState(true);
  const [payment, setPayment] = useState<{
    transactionId: string;
    orderId: string;
  } | null>(null);
  const card = useCardPayment();

  // `attendance` is passed in rather than read from state because the
  // auto-select below runs in the same tick as setAttendanceType, before the
  // state has settled.
  const selectCategory = useCallback(
    async (category: RegistrationCategory, attendance: Attendance) => {
      setSelectedCategory(category);
      setLoading(true);
      try {
        const data = await smartEventJson<{ data: FormInputGroup[] }>(
          '/Display-Categories-Form-Inputs',
          {
            category: category.id,
            attendence: attendance,
            operation: 'get-form-inputs',
          },
        );
        setFormGroups(data.data || []);
      } catch {
        setError('Failed to load the RSVP form. Please try again.');
      }
      setLoading(false);
    },
    [],
  );

  const loadCategories = useCallback(
    async (type: Attendance) => {
      setLoading(true);
      try {
        const data = await smartEventJson<{ data: RegistrationCategory[] }>(
          '/Display-Registration-Categories',
          { attendence: type, operation: 'get-categories' },
        );
        const list = data.data || [];
        setCategories(list);
        // A single category leaves nothing to choose, so its form opens
        // straight away — selectCategory clears the loading state itself,
        // which keeps it one uninterrupted spinner rather than two.
        if (list.length === 1) {
          await selectCategory(list[0], type);
          return;
        }
      } catch {
        setError('Failed to load the RSVP options. Please try again.');
      }
      setLoading(false);
    },
    [selectCategory],
  );

  // A non-hybrid event has only one possible attendance type, so its
  // categories are fetched straight away and the chooser is skipped.
  const loadRegistrationPage = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${SMARTEVENT_API}/Registration-Page-Api`);
      const data = await res.json();
      const type: 'HYBRID' | Attendance =
        data?.event_description?.event_type || 'PHYSICAL';
      setEventType(type);
      if (type !== 'HYBRID') {
        setAttendanceType(type);
        await loadCategories(type);
        return;
      }
    } catch {
      setError('Failed to load the RSVP page. Please try again.');
    }
    setLoading(false);
  }, [loadCategories]);

  useEffect(() => {
    // Mount-time fetch of the event's registration settings. The lint rule
    // flags the loading/error reset this performs before awaiting, which is
    // exactly what a fetch-on-mount needs to do.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadRegistrationPage();
  }, [loadRegistrationPage]);

  async function selectAttendance(type: Attendance) {
    setAttendanceType(type);
    await loadCategories(type);
  }

  // Persists the registration to SmartEvent. Called after a card payment
  // succeeds, or directly for bank-transfer and free categories.
  async function finalizeRegistration(
    category: RegistrationCategory,
    values: FormValues,
    paid: {
      orderId?: string;
      paymentToken?: string;
      paymentSession?: string;
      transactionId?: string;
    },
  ): Promise<string[] | void> {
    setSubmitting(true);
    try {
      // Signing up here is itself the RSVP, so "Will you attend?" is
      // answered for them.
      const submitForm = buildDelegateForm(formGroups, {
        ...values,
        [RSVP.attending]: 'Yes',
      });
      submitForm.append('ticket_id', String(category.id));
      submitForm.append('attendence_type', attendanceType || 'PHYSICAL');
      submitForm.append('accompanied', 'NO');
      submitForm.append('registration_type', 'single');
      submitForm.append('grand_total', String(parseFeeAmount(category.fee)));
      submitForm.append('order_id', paid.orderId || '');
      submitForm.append('payment_token', paid.paymentToken || '');
      submitForm.append('payment_session', paid.paymentSession || '');
      submitForm.append('acknowleadgment', paid.transactionId || '');

      const result = await smartEventPost<{
        success?: boolean;
        message?: string | string[];
        registration_number?: string | number;
      }>('/Register-Delegate', submitForm);

      if (!result.ok || result.success === false) {
        return messageList(
          result.message,
          'Your RSVP could not be saved. Please try again.',
        );
      }
      if (
        result.registration_number != null &&
        result.registration_number !== ''
      ) {
        setBadgeId(String(result.registration_number));
      }
      if (paid.transactionId && paid.orderId) {
        setPayment({
          transactionId: paid.transactionId,
          orderId: paid.orderId,
        });
      }
      setEmailSent(confirmationEmailSent(result.message));
      setSubmitted(true);
    } catch {
      return [
        'Something went wrong while sending your RSVP. Please try again.',
      ];
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmit(values: FormValues): Promise<string[] | void> {
    if (!selectedCategory) return ['Please select a category'];

    const isBankTransfer = Object.values(values).some(
      (v) => typeof v === 'string' && v.toLowerCase().includes('bank transfer'),
    );

    // Bank transfer and free categories save straight away; everything else
    // goes through the card gateway first.
    if (!requiresPayment(selectedCategory.fee) || isBankTransfer) {
      return finalizeRegistration(selectedCategory, values, {});
    }

    const customerEmail = (values[EMAIL_INPUT] as string) || '';
    if (!customerEmail) return ['Email is required for payment processing'];

    const result = await card.pay({
      orderId: `ORD-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
      amount: parseFeeAmount(selectedCategory.fee),
      currency: extractCurrency(selectedCategory.fee),
      categoryName: decodeHtml(selectedCategory.name_english),
      categoryId: selectedCategory.id,
      attendenceType: attendanceType || 'PHYSICAL',
      customerEmail,
      customerName:
        `${values[FIRST_NAME_INPUT] || ''} ${values[LAST_NAME_INPUT] || ''}`.trim(),
    });
    if (!result.success) {
      return [result.error || 'Payment was not completed. Please try again.'];
    }

    return finalizeRegistration(selectedCategory, values, {
      orderId: result.orderId,
      paymentToken: result.paymentToken,
      paymentSession: result.paymentSession,
      transactionId: result.transactionId,
    });
  }

  const shell = (children: React.ReactNode) => (
    <PageShell eyebrow={EVENT.name} title="Confirm your attendance">
      {children}
    </PageShell>
  );

  if (submitted) {
    return shell(
      <SuccessPanel
        title={
          payment
            ? 'Payment received — attendance confirmed'
            : 'Attendance confirmed'
        }
        message={
          emailSent
            ? 'Thank you for confirming your attendance. A confirmation email with your details is on its way.'
            : 'Thank you for confirming your attendance. Your RSVP is saved, but we could not send the confirmation email just now. The organisers will be in touch.'
        }
        registrationNumber={badgeId}
        payment={payment ?? undefined}
      />,
    );
  }

  if (loading) return shell(<LoadingPanel />);
  if (error) {
    return shell(<ErrorPanel message={error} onRetry={loadRegistrationPage} />);
  }

  if (eventType === 'HYBRID' && !attendanceType) {
    return shell(
      <div className="panel p-8">
        <h2
          className="text-xl font-semibold text-center mb-6"
          style={{
            fontFamily: 'var(--font-heading),sans-serif',
            color: 'var(--ink)',
          }}
        >
          How will you attend?
        </h2>
        <div className="grid md:grid-cols-2 gap-6 max-w-2xl mx-auto">
          {(['PHYSICAL', 'VIRTUAL'] as const).map((type) => (
            <button
              key={type}
              onClick={() => selectAttendance(type)}
              className="cat-card p-6 border rounded-2xl text-center"
            >
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
                style={{ background: 'var(--brand-tint)' }}
              >
                <svg
                  className="w-8 h-8"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  style={{ color: 'var(--brand2)' }}
                >
                  {type === 'PHYSICAL' ? (
                    <>
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                    </>
                  ) : (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                    />
                  )}
                </svg>
              </div>
              <h3
                className="text-lg font-semibold mb-1"
                style={{
                  color: 'var(--ink)',
                  fontFamily: 'var(--font-heading),sans-serif',
                }}
              >
                {type === 'PHYSICAL' ? 'In person' : 'Virtual'}
              </h3>
              <p className="text-sm" style={{ color: 'var(--muted)' }}>
                {type === 'PHYSICAL'
                  ? 'Join us at the venue'
                  : 'Attend online from anywhere'}
              </p>
            </button>
          ))}
        </div>
      </div>,
    );
  }

  if (!selectedCategory) {
    return shell(
      <div>
        <div className="flex items-center justify-between mb-5 gap-4">
          <h2
            className="text-xl font-semibold"
            style={{
              fontFamily: 'var(--font-heading),sans-serif',
              color: 'var(--ink)',
            }}
          >
            Select your category
          </h2>
          {eventType === 'HYBRID' && (
            <button
              onClick={() => setAttendanceType(null)}
              className="text-sm"
              style={{ color: 'var(--brand2)' }}
            >
              Change attendance
            </button>
          )}
        </div>
        {categories.length === 0 ? (
          <p className="text-center py-8" style={{ color: 'var(--muted)' }}>
            RSVPs are not open at the moment.
          </p>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {categories.map((category) => {
              const isFree = !requiresPayment(category.fee);
              const discountedFrom =
                !isFree &&
                category.normal_fee &&
                parseFeeAmount(category.normal_fee) >
                  parseFeeAmount(category.fee)
                  ? category.normal_fee
                  : null;
              return (
                <div
                  key={category.id}
                  className="cat-card rounded-2xl border p-6 flex flex-col h-full"
                >
                  <div className="flex items-start justify-between gap-3">
                    <h3
                      className="text-base font-semibold leading-snug capitalize"
                      style={{
                        color: 'var(--ink)',
                        fontFamily: 'var(--font-heading),sans-serif',
                      }}
                    >
                      {decodeHtml(category.name_english)}
                    </h3>
                    {isFree && (
                      <span
                        className="shrink-0 text-[11px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full"
                        style={{
                          color: '#15803D',
                          background: 'rgba(22,163,74,0.10)',
                        }}
                      >
                        Free
                      </span>
                    )}
                  </div>

                  {!isFree && (
                    <p
                      className="mt-3 text-2xl font-semibold flex items-baseline gap-2 flex-wrap"
                      style={{
                        color: 'var(--ink)',
                        fontFamily: 'var(--font-heading),sans-serif',
                      }}
                    >
                      <span>{category.fee}</span>
                      {discountedFrom && (
                        <span
                          className="text-sm font-normal line-through"
                          style={{ color: 'var(--muted)' }}
                        >
                          {discountedFrom}
                        </span>
                      )}
                    </p>
                  )}

                  <p
                    className="mt-3 mb-6 text-xs"
                    style={{ color: 'var(--muted)' }}
                  >
                    {category.early_payment_date
                      ? `Early bird ends ${category.early_payment_date}`
                      : `RSVP by ${category.end_date}`}
                  </p>

                  <button
                    onClick={() => selectCategory(category, attendanceType!)}
                    className="btn-primary w-full py-2.5 rounded-lg text-white text-sm font-semibold mt-auto"
                  >
                    Select
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>,
    );
  }

  const paymentRequired = requiresPayment(selectedCategory.fee);

  return shell(
    <>
      <DelegateForm
        // Remounts with fresh answers when the category changes.
        key={selectedCategory.id}
        groups={withoutRsvp(formGroups)}
        submitLabel={
          paymentRequired ? 'Proceed to payment' : 'Confirm attendance'
        }
        submitting={submitting}
        processing={card.processing}
        footer={
          paymentRequired && (
            <PaymentSummary
              fee={selectedCategory.fee}
              normalFee={selectedCategory.normal_fee}
            />
          )
        }
        // With a single category there is nothing to go back to.
        back={
          categories.length > 1
            ? {
                label: 'Change category',
                onClick: () => setSelectedCategory(null),
              }
            : undefined
        }
        onSubmit={handleSubmit}
      />
      {card.modal}
    </>,
  );
}

// The invitation-only "Your RSVP" questions (will you attend, representative)
// do not apply to people signing up themselves.
function withoutRsvp(groups: FormInputGroup[]): FormInputGroup[] {
  return groups
    .map((g) => ({
      ...g,
      inputs: g.inputs.filter(({ input }) => !(input.inputcode in RSVP_RULES)),
    }))
    .filter((g) => g.inputs.length > 0);
}
