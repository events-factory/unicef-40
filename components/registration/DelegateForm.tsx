'use client';

import { useState, useCallback, type ReactNode } from 'react';
import SearchableSelect from '@/components/SearchableSelect';
import {
  isInputShown,
  shownValues,
  type FormInput,
  type FormInputGroup,
  type FormInputOption,
  type FormValues,
  type InputRules,
} from '@/lib/registration';

const PRIVACY_POLICY_URL = 'https://smartevent.rw/privacy-policy';
const TERMS_OF_USE_URL = 'https://smartevent.rw/terms-of-use';
const CONSENT_ERROR =
  'You must accept the Privacy Policy and Terms of Use to continue';

// A plain <select> gets unwieldy past this many options (country lists, for
// example), so those switch to the searchable variant.
const SEARCHABLE_THRESHOLD = 12;

// Radios, textareas, checkbox groups and notes take the full row.
const FULL_WIDTH_TYPES = [10, 15, 16, 17];

interface DelegateFormProps {
  groups: FormInputGroup[];
  initialValues?: FormValues;
  // May depend on the answers, e.g. "Confirm attendance" vs "Send my response".
  submitLabel: string | ((values: FormValues) => string);
  // Follow-up questions and extra required fields; see InputRules.
  rules?: InputRules;
  submitting: boolean;
  // A card payment is being prepared; locks the form like `submitting`.
  processing?: boolean;
  // Shown on the final step, above the consent box (the payment summary).
  footer?: ReactNode;
  // The step-0 back button. Omitted when there is nothing to go back to.
  back?: { label: string; onClick: () => void };
  // Gets only the answers to questions currently shown. Resolves to error
  // messages to show in the banner, or nothing on success.
  onSubmit: (values: FormValues) => Promise<string[] | void>;
}

// SmartEvent's dynamic delegate form: one step per input group, validated a
// step at a time, with the consent tick on the last step. Used by both the
// registration page and the update-link page.
export default function DelegateForm({
  groups,
  initialValues = {},
  submitLabel,
  rules = {},
  submitting,
  processing = false,
  footer,
  back,
  onSubmit,
}: DelegateFormProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [formValues, setFormValues] = useState<FormValues>(initialValues);
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  // Agreement to SmartEvent's privacy policy and terms, required on every
  // category. It gates submission only — SmartEvent has no field for it, so
  // it is not part of the submitted delegate data.
  const [consentGiven, setConsentGiven] = useState(false);
  const [consentError, setConsentError] = useState(false);

  const busy = submitting || processing;
  const lastStep = currentStep === groups.length - 1;

  const validateStep = useCallback(() => {
    const currentGroup = groups[currentStep];
    if (!currentGroup) return true;

    const errors: string[] = [];
    const fieldErrs: Record<string, string> = {};

    currentGroup.inputs.forEach(({ input }) => {
      if (!isInputShown(input.inputcode, formValues, rules)) return;
      const value = formValues[input.inputcode];
      const isEmpty =
        !value ||
        (Array.isArray(value) && value.length === 0) ||
        (typeof value === 'string' && value.trim() === '');

      if (isRequired(input) && isEmpty) {
        const msg = `${input.nameEnglish} is required`;
        errors.push(msg);
        fieldErrs[input.inputcode] = msg;
        return;
      }

      if (!isEmpty && typeof value === 'string') {
        if (input.inputtype.id === 5) {
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
            const msg = `${input.nameEnglish} must be a valid email address`;
            errors.push(msg);
            fieldErrs[input.inputcode] = msg;
          }
        }
        if (input.inputtype.id === 12) {
          if (
            !/^[\d\s+()-]+$/.test(value) ||
            value.replace(/\D/g, '').length < 7
          ) {
            const msg = `${input.nameEnglish} must be a valid phone number`;
            errors.push(msg);
            fieldErrs[input.inputcode] = msg;
          }
        }
      }
    });

    setFormErrors(errors);
    setFieldErrors(fieldErrs);

    if (errors.length > 0) scrollToForm();

    return errors.length === 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep, groups, formValues, rules]);

  function isRequired(input: FormInput) {
    return input.is_mandatory === 'YES' || !!rules[input.inputcode]?.required;
  }

  function scrollToForm() {
    document
      .querySelector('form')
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function handleInputChange(inputCode: string, value: string | string[]) {
    setFormValues((prev) => ({ ...prev, [inputCode]: value }));
    if (fieldErrors[inputCode]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[inputCode];
        return next;
      });
    }
  }

  function nextStep() {
    if (validateStep()) {
      setFormErrors([]);
      setFieldErrors({});
      setCurrentStep((prev) => Math.min(prev + 1, groups.length - 1));
    }
  }

  function prevStep() {
    setFormErrors([]);
    setFieldErrors({});
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Both checks run before returning so a missing tick and missing fields
    // are reported together rather than one after the other.
    const stepValid = validateStep();
    setConsentError(!consentGiven);
    if (!consentGiven) {
      setFormErrors((prev) => [...prev, CONSENT_ERROR]);
      if (stepValid) scrollToForm();
    }
    if (!stepValid || !consentGiven) return;

    setFormErrors([]);
    const errors = await onSubmit(shownValues(formValues, rules));
    if (errors && errors.length > 0) {
      setFormErrors(errors);
      scrollToForm();
    }
  }

  function renderInput(input: FormInput, unordered: FormInputOption[]) {
    const inputValue = formValues[input.inputcode] ?? '';
    const required = isRequired(input);
    const order = rules[input.inputcode]?.optionOrder;
    const options = order
      ? [...unordered].sort(
          (a, b) =>
            rank(order, a.contentEnglish) - rank(order, b.contentEnglish),
        )
      : unordered;
    const hasError = !!fieldErrors[input.inputcode];
    const base =
      'w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:outline-none';
    const errorClass = hasError
      ? 'border-red-500 focus:ring-red-400'
      : 'border-gray-300 focus:ring-primary-500/30 focus:border-primary-500';

    const errorText = hasError ? (
      <p className="mt-1 text-sm text-red-600">
        {fieldErrors[input.inputcode]}
      </p>
    ) : null;

    const textInput = (type: string) => (
      <>
        <input
          type={type}
          id={input.inputcode}
          value={inputValue as string}
          onChange={(e) => handleInputChange(input.inputcode, e.target.value)}
          className={`${base} ${errorClass}`}
          required={required}
        />
        {errorText}
      </>
    );

    switch (input.inputtype.id) {
      case 2:
        if (options.length > SEARCHABLE_THRESHOLD) {
          return (
            <>
              <SearchableSelect
                id={input.inputcode}
                options={options.map((opt) => ({
                  value: opt.contentEnglish,
                  label: opt.contentEnglish,
                }))}
                value={inputValue as string}
                onChange={(v) => handleInputChange(input.inputcode, v)}
                hasError={hasError}
              />
              {errorText}
            </>
          );
        }
        return (
          <>
            <select
              id={input.inputcode}
              value={inputValue as string}
              onChange={(e) =>
                handleInputChange(input.inputcode, e.target.value)
              }
              className={`${base} ${errorClass} bg-white appearance-none pr-10 cursor-pointer`}
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%236B7A85' stroke-width='2'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E")`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 0.75rem center',
                backgroundSize: '1.1rem',
              }}
              required={required}
            >
              <option value="">Select an option</option>
              {options.map((opt) => (
                <option key={opt.id} value={opt.contentEnglish}>
                  {opt.contentEnglish}
                </option>
              ))}
            </select>
            {errorText}
          </>
        );
      case 4:
        return textInput('date');
      case 5:
        return textInput('email');
      case 8:
        return textInput('number');
      case 10:
        return (
          <>
            <div
              className={
                hasError ? 'p-2 border-2 border-red-500 rounded-lg' : ''
              }
            >
              <div className="flex flex-wrap gap-2">
                {options.map((opt) => {
                  const selected = inputValue === opt.contentEnglish;
                  return (
                    <label
                      key={opt.id}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg border text-sm cursor-pointer transition-colors"
                      style={{
                        borderColor: selected ? 'var(--brand)' : '#d1d5db',
                        background: selected ? 'var(--brand-tint)' : '#fff',
                        color: selected ? 'var(--brand2)' : 'var(--text)',
                        fontWeight: selected ? 600 : 400,
                      }}
                    >
                      <input
                        type="radio"
                        name={input.inputcode}
                        value={opt.contentEnglish}
                        checked={selected}
                        onChange={(e) =>
                          handleInputChange(input.inputcode, e.target.value)
                        }
                        className="w-4 h-4 accent-primary-500"
                        required={required}
                      />
                      <span>{opt.contentEnglish}</span>
                    </label>
                  );
                })}
              </div>
            </div>
            {errorText}
          </>
        );
      case 12:
        return textInput('tel');
      case 15:
        return (
          <>
            <textarea
              id={input.inputcode}
              value={inputValue as string}
              onChange={(e) =>
                handleInputChange(input.inputcode, e.target.value)
              }
              rows={4}
              className={`${base} ${errorClass}`}
              required={required}
            />
            {errorText}
          </>
        );
      case 16:
        return (
          <>
            <div
              className={
                hasError
                  ? 'p-3 border-2 border-red-500 rounded-lg space-y-2'
                  : 'space-y-2'
              }
            >
              {options.map((opt) => (
                <label key={opt.id} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    value={opt.contentEnglish}
                    checked={
                      Array.isArray(inputValue)
                        ? inputValue.includes(opt.contentEnglish)
                        : inputValue === opt.contentEnglish
                    }
                    onChange={(e) => {
                      const current = Array.isArray(inputValue)
                        ? inputValue
                        : inputValue
                          ? [inputValue as string]
                          : [];
                      handleInputChange(
                        input.inputcode,
                        e.target.checked
                          ? [...current, e.target.value]
                          : current.filter((v) => v !== e.target.value),
                      );
                    }}
                    className="w-4 h-4 accent-primary-500"
                  />
                  <span>{opt.contentEnglish}</span>
                </label>
              ))}
            </div>
            {errorText}
          </>
        );
      case 17:
        return (
          <p
            className="p-4 rounded-lg"
            style={{ background: 'var(--light)', color: 'var(--muted)' }}
          >
            {input.nameEnglish}
          </p>
        );
      default:
        return textInput('text');
    }
  }

  const group = groups[currentStep];
  const shownInputs = (group?.inputs ?? []).filter(({ input }) =>
    isInputShown(input.inputcode, formValues, rules),
  );
  // A lone column field reads better spanning the full width.
  const singleColumn =
    !!group &&
    shownInputs.filter(
      (it) => !FULL_WIDTH_TYPES.includes(it.input.inputtype.id),
    ).length === 1;

  return (
    <div className="panel overflow-hidden">
      {groups.length > 1 && (
        <div
          className="px-6 border-b flex gap-6 overflow-x-auto no-scrollbar"
          style={{ borderColor: 'var(--border)' }}
        >
          {groups.map((g, index) => {
            const done = index < currentStep;
            const current = index === currentStep;
            return (
              <button
                key={g.group.id}
                type="button"
                onClick={() => {
                  if (done) setCurrentStep(index);
                }}
                className="relative py-4 text-sm whitespace-nowrap transition-colors flex items-center gap-2"
                style={{
                  color: current
                    ? 'var(--ink)'
                    : done
                      ? 'var(--text)'
                      : 'var(--muted)',
                  fontWeight: current ? 600 : 400,
                  cursor: done ? 'pointer' : 'default',
                }}
              >
                <span
                  className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[11px] font-semibold shrink-0"
                  style={{
                    background: current
                      ? 'var(--brand)'
                      : done
                        ? 'var(--brand-tint)'
                        : 'var(--light)',
                    color: current
                      ? 'var(--white)'
                      : done
                        ? 'var(--brand2)'
                        : 'var(--muted)',
                    border: current ? 'none' : '1px solid var(--border)',
                  }}
                >
                  {index + 1}
                </span>
                {g.group.name}
                {current && (
                  <span
                    className="absolute left-0 right-0 bottom-0 h-0.5"
                    style={{ background: 'var(--brand)' }}
                  />
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* noValidate: validateStep() owns validation so every field's error is
          reported at once, in the same styled banner the multi-step "Next"
          button uses, rather than the browser surfacing them one native
          bubble at a time. */}
      <form onSubmit={handleSubmit} className="p-6" noValidate>
        {formErrors.length > 0 && (
          <div className="bg-red-50 border-2 border-red-300 rounded-lg p-4 mb-6">
            <div className="flex items-start gap-3">
              <svg
                className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
              <div>
                <h3 className="text-sm font-semibold text-red-800 mb-2">
                  Please fix the following
                </h3>
                <ul className="list-disc list-inside text-red-700 text-sm space-y-1">
                  {formErrors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {group && (
          <div className="space-y-5">
            <h3
              className="text-lg font-semibold"
              style={{
                color: 'var(--ink)',
                fontFamily: 'var(--font-heading),sans-serif',
              }}
            >
              {group.group.name}
            </h3>
            <div
              className="rounded-xl border bg-white p-4 sm:p-5"
              style={{ borderColor: 'var(--border)' }}
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-4">
                {shownInputs.map(({ input, options }) => {
                  const fullWidth =
                    singleColumn ||
                    FULL_WIDTH_TYPES.includes(input.inputtype.id);
                  return (
                    <div
                      key={input.inputcode}
                      className={fullWidth ? 'sm:col-span-2' : ''}
                    >
                      {input.inputtype.id !== 17 && (
                        <label
                          htmlFor={input.inputcode}
                          className="block text-sm font-medium mb-1.5"
                          style={{ color: 'var(--text)' }}
                        >
                          {input.nameEnglish}
                          {isRequired(input) && (
                            <span className="text-red-500 ml-1">*</span>
                          )}
                        </label>
                      )}
                      {renderInput(input, options)}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {lastStep && !processing && footer}

        {processing && (
          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="animate-spin w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full" />
              <p className="text-sm font-medium text-blue-800">
                Preparing your secure payment…
              </p>
            </div>
          </div>
        )}

        {/* Consent — shown on the final step, since it gates submission. */}
        {lastStep && (
          <div
            className="mt-5 rounded-xl border p-4 sm:p-5"
            style={{
              borderColor: consentError ? '#ef4444' : 'var(--border)',
              background: consentError
                ? 'rgba(239,68,68,0.04)'
                : 'var(--white)',
            }}
          >
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={consentGiven}
                onChange={(e) => {
                  setConsentGiven(e.target.checked);
                  if (e.target.checked) {
                    setConsentError(false);
                    // Also drop it from the summary banner, otherwise that
                    // keeps demanding a tick already given.
                    setFormErrors((prev) =>
                      prev.filter((msg) => msg !== CONSENT_ERROR),
                    );
                  }
                }}
                className="w-4 h-4 mt-0.5 shrink-0 accent-primary-500"
                aria-invalid={consentError}
                aria-describedby={consentError ? 'consent-error' : undefined}
              />
              <span className="text-sm" style={{ color: 'var(--text)' }}>
                I have read and agree to the{' '}
                <a
                  href={PRIVACY_POLICY_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline font-medium"
                  style={{ color: 'var(--brand2)' }}
                  onClick={(e) => e.stopPropagation()}
                >
                  Privacy Policy
                </a>{' '}
                and the{' '}
                <a
                  href={TERMS_OF_USE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline font-medium"
                  style={{ color: 'var(--brand2)' }}
                  onClick={(e) => e.stopPropagation()}
                >
                  Terms of Use
                </a>
                .<span className="text-red-500 ml-1">*</span>
              </span>
            </label>
            {consentError && (
              <p id="consent-error" className="mt-2 text-sm text-red-600 pl-7">
                {CONSENT_ERROR}
              </p>
            )}
          </div>
        )}

        {/* Navigation */}
        <div
          className="flex justify-between mt-8 pt-6 border-t"
          style={{ borderColor: 'var(--border)' }}
        >
          {/* With nothing to go back to, step 0 shows a spacer that keeps the
              primary button right-aligned. */}
          {currentStep === 0 && !back ? (
            <span />
          ) : (
            <button
              type="button"
              onClick={currentStep > 0 ? prevStep : back!.onClick}
              disabled={busy}
              className="px-6 py-2.5 border rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
              style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
            >
              {currentStep > 0 ? 'Previous' : back!.label}
            </button>
          )}
          {!lastStep ? (
            <button
              // Distinct keys keep React from reusing one DOM node for both
              // buttons: mutating `type` from button to submit mid-click makes
              // the same click submit the form.
              key="next"
              type="button"
              onClick={nextStep}
              disabled={busy}
              className="btn-primary px-6 py-2.5 rounded-lg text-white text-sm font-semibold disabled:opacity-50"
            >
              Next
            </button>
          ) : (
            <button
              key="submit"
              type="submit"
              disabled={busy}
              className="btn-primary px-6 py-2.5 rounded-lg text-white text-sm font-semibold disabled:opacity-50 flex items-center gap-2"
            >
              {busy && (
                <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
              )}
              {processing
                ? 'Processing…'
                : submitting
                  ? 'Submitting…'
                  : typeof submitLabel === 'function'
                    ? submitLabel(shownValues(formValues, rules))
                    : submitLabel}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

// Options missing from the order keep their place after the listed ones.
function rank(order: string[], option: string) {
  const i = order.indexOf(option);
  return i === -1 ? order.length : i;
}
