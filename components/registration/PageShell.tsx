import type { ReactNode } from 'react';
import SiteHeader from '@/components/SiteHeader';

// Header plus the centred content column every registration screen uses.
export function PageShell({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader eyebrow={eyebrow} title={title} />
      <main
        className="flex-1"
        style={{
          maxWidth: 1160,
          margin: '0 auto',
          width: '100%',
          padding: '40px 16px 64px',
        }}
      >
        {children}
      </main>
    </div>
  );
}

export function LoadingPanel({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="panel p-10 text-center">
      <div
        className="animate-spin w-12 h-12 border-4 rounded-full mx-auto mb-4"
        style={{ borderColor: 'var(--brand)', borderTopColor: 'transparent' }}
      />
      <p style={{ color: 'var(--muted)' }}>{label}</p>
    </div>
  );
}

export function ErrorPanel({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="panel p-10 text-center">
      <p className="text-red-600 mb-4">{message}</p>
      <button
        onClick={onRetry}
        className="btn-primary px-6 py-2.5 rounded-lg text-white text-sm font-semibold"
      >
        Try again
      </button>
    </div>
  );
}

interface SuccessPanelProps {
  title: string;
  message: string;
  registrationNumber?: string;
  payment?: { transactionId: string; orderId: string };
}

export function SuccessPanel({
  title,
  message,
  registrationNumber,
  payment,
}: SuccessPanelProps) {
  return (
    <div className="flex justify-center">
      <div className="panel p-8 text-center max-w-lg w-full">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg
            className="w-10 h-10 text-green-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
        <h2
          className="text-2xl font-bold mb-4"
          style={{
            color: 'var(--ink)',
            fontFamily: 'var(--font-heading),sans-serif',
          }}
        >
          {title}
        </h2>
        <p style={{ color: 'var(--muted)' }}>{message}</p>
        {registrationNumber && (
          <div
            className="mt-6 p-4 rounded-lg border"
            style={{
              background: 'var(--brand-tint)',
              borderColor: 'rgba(0,174,239,0.4)',
            }}
          >
            <p
              className="text-xs uppercase tracking-wide font-semibold"
              style={{ color: 'var(--brand2)' }}
            >
              Registration number
            </p>
            <p
              className="text-2xl font-bold font-mono mt-1"
              style={{ color: 'var(--ink)' }}
            >
              {registrationNumber}
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>
              Keep this for check-in.
            </p>
          </div>
        )}
        {payment && (
          <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg text-left">
            <h3 className="text-sm font-semibold text-green-800 mb-3">
              Payment details
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <span style={{ color: 'var(--muted)' }}>Transaction ID</span>
                <span className="font-mono font-medium truncate">
                  {payment.transactionId}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span style={{ color: 'var(--muted)' }}>Order ID</span>
                <span className="font-mono font-medium truncate">
                  {payment.orderId}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span style={{ color: 'var(--muted)' }}>Status</span>
                <span className="text-green-600 font-medium">Paid</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
