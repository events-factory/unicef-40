import Image from 'next/image';
import { EVENT } from '@/lib/event';

// The MIGEPROF name beside the Government of Rwanda logo, hidden for now.
const SHOW_MINISTRY = false;

interface SiteHeaderProps {
  eyebrow: string;
  title: string;
}

// Co-branded header: Government of Rwanda (MIGEPROF) on the left, UNICEF 40
// years on the right, then the Rwanda flag colours and the title band.
export default function SiteHeader({ eyebrow, title }: SiteHeaderProps) {
  return (
    <header>
      <div style={{ background: 'var(--white)' }}>
        <div
          className="flex items-center justify-between gap-4"
          style={{ maxWidth: 1160, margin: '0 auto', padding: '0 16px' }}
        >
          <div className="flex items-center gap-3 sm:gap-4 min-w-0 py-3 sm:py-4">
            <Image
              src="/rwanda-gov.png"
              alt="Republic of Rwanda"
              width={442}
              height={200}
              priority
              className="h-10 sm:h-16 w-auto shrink-0"
            />
            {SHOW_MINISTRY && (
              <>
                <span
                  aria-hidden
                  className="self-stretch w-px shrink-0"
                  style={{ background: 'var(--border)' }}
                />
                <span className="leading-tight min-w-0">
                  <span
                    className="block text-sm sm:text-base font-bold tracking-wide"
                    style={{ color: 'var(--rw-blue)' }}
                  >
                    {EVENT.ministry}
                  </span>
                  <span
                    className="hidden sm:block text-xs"
                    style={{ color: 'var(--muted)' }}
                  >
                    {EVENT.ministryName}
                  </span>
                </span>
              </>
            )}
          </div>
          <Image
            src="/unicef40.png"
            alt="UNICEF — 40 years in Rwanda"
            width={361}
            height={200}
            priority
            className="h-10 sm:h-16 w-auto shrink-0"
          />
        </div>
      </div>

      <div className="flag-strip" />

      {/* White on UNICEF cyan is too faint for body text, so the band is the
          deeper blue with the cyan as its bottom rule. */}
      <div
        style={{
          background: 'var(--brand2)',
          borderBottom: '4px solid var(--brand)',
        }}
      >
        <div
          style={{
            maxWidth: 1160,
            margin: '0 auto',
            padding: 'clamp(36px,6vw,56px) 16px clamp(32px,5vw,48px)',
          }}
        >
          <p
            className="text-xs font-semibold uppercase"
            style={{
              letterSpacing: 2.4,
              color: 'rgba(255,255,255,0.9)',
              marginBottom: 12,
            }}
          >
            {eyebrow}
          </p>
          <h1
            style={{
              fontFamily: 'var(--font-heading),sans-serif',
              fontSize: 'clamp(28px,4.4vw,44px)',
              fontWeight: 700,
              color: 'var(--white)',
              lineHeight: 1.12,
              letterSpacing: '-0.02em',
              maxWidth: 720,
            }}
          >
            {title}
          </h1>
          <p
            className="mt-4 text-sm sm:text-base flex flex-wrap gap-x-5 gap-y-1"
            style={{ color: 'var(--white)' }}
          >
            <span>{EVENT.date}</span>
            <span>{EVENT.time}</span>
            <span>{EVENT.venue}</span>
          </p>
        </div>
      </div>
    </header>
  );
}
