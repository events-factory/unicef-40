# UNICEF Rwanda 40th Anniversary — Registration

Registration and RSVP site for the UNICEF Rwanda 40th Anniversary Children's
Gala (20 November 2026, Kigali Convention Centre), co-branded with the
Government of Rwanda (MIGEPROF). Built on the SmartEvent registration API,
following the same approach as the `EAMJA` project.

## Getting started

```bash
npm install
npm run dev     # http://localhost:3000/registration
```

`/` redirects to `/registration`.

## Event code

SmartEvent knows the event by its internal code `6acc7e78c8d96`, but the API
rejects that and wants the encrypted token from the SmartEvent dashboard. It is
set in `.env.local` (gitignored) and stays server-side — the browser only ever
calls this app's own `/api/smartevent/*` routes.

```bash
# .env.local
SMARTEVENT_API_URL=https://app.smartevent.rw/Api
SMARTEVENT_EVENT_CODE=<the encrypted event token>
```

Fallbacks live in [lib/smartevent.ts](lib/smartevent.ts).

## Pages

### `/registration` — open registration

1. `GET /Registration-Page-Api` — reads the event's attendance type. A `HYBRID`
   event shows an in-person/virtual chooser first; this one is `PHYSICAL`, so
   it is skipped.
2. `POST /Display-Registration-Categories` — the category cards. With a single
   category (today: "delegate", free) its form opens straight away.
3. `POST /Display-Categories-Form-Inputs` — the form, one step per input group.
4. Paid categories open the Mastercard embedded checkout
   (`/api/smartevent/Initialize-Payment`). Free ones skip this.
5. `POST /Register-Delegate` — saves the registration.

### `/registration/update?token=…` — invitation RSVP

The link in the invitation email. Invitees confirm or edit the registration
SmartEvent already holds for them.

1. `POST /Registration-Form-Data-Retriever` with `registration_update_token`
   returns the same form shape as step 3 above, with each input's saved
   `value`, plus `record_unique_data` (`ticket_id`, `attendence_type`,
   `accompanied`, `amount_to_pay`, `amount_received`).
2. The form opens prefilled. An unpaid balance goes through card payment first.
3. `POST /Update-Delegate` — the same fields as `Register-Delegate`, plus
   `registration_update_token`.

An unknown or expired token shows SmartEvent's message and a form that calls
`PATCH /Registration-Update-Link-Request` to email a new link. SmartEvent only
issues a new link in exchange for the old token, so without a token the page
just points back to the invitation email.

SmartEvent's invitation email links to its own hosted page:

```
https://unicefrwanda729b.ev.smartevent.rw/Registration-Update/en/<registration_update_token>
```

This site serves the same path, so pointing the template at this domain is
enough:

```
https://<site>/Registration-Update/en/<registration_update_token>
```

It redirects to `/registration/update?token=…`, which also accepts
`registration_update_token=` as the query name.

### "Your RSVP" questions

The delegate form in SmartEvent has a "Your RSVP" group:
- **Will you attend?** (Yes / No / Maybe)
- **Will you send someone to represent you?**
- The representative's name, position, organization, email and phone.

The representative is saved on the invitee's own record.

SmartEvent forms have no conditional fields, so the show/hide logic is in this app, in `RSVP_RULES` in [lib/event.ts](lib/event.ts):
- The representative question shows only for "No".
- The representative's fields show only when that answer is "Yes".
- Fields are required only while they are shown.

In SmartEvent, keep these inputs optional. When their input codes change, update `RSVP`.

- On the invitation page, hidden questions are sent blank. That way, a representative named earlier is cleared if the invitee changes their answer.
- `/registration` leaves the group out and sends "Will you attend?" as Yes.

## SmartEvent quirks

- Failures come back as a 400 with only `{ message: [...] }` — no
  `success: false` — so the HTTP status is what decides success.
- A registration can succeed (200) while the confirmation email fails; the
  message then contains "no email have been sent". The success screens say so
  instead of promising an email.
- `Register-Delegate` rejects an email already registered for the event.

## Layout

| Path | Purpose |
| --- | --- |
| [app/registration/page.tsx](app/registration/page.tsx) | Registration flow |
| [app/registration/update/page.tsx](app/registration/update/page.tsx) | Invitation RSVP / edit flow |
| [components/registration/DelegateForm.tsx](components/registration/DelegateForm.tsx) | SmartEvent's dynamic form, shared by both pages |
| [components/registration/useCardPayment.tsx](components/registration/useCardPayment.tsx) | Card checkout hook and modal |
| [components/registration/PaymentSummary.tsx](components/registration/PaymentSummary.tsx) | Fee breakdown on the last step |
| [components/registration/PageShell.tsx](components/registration/PageShell.tsx) | Page frame plus loading, error and success panels |
| [components/SiteHeader.tsx](components/SiteHeader.tsx) | Co-branded header (Government of Rwanda · MIGEPROF, UNICEF 40) |
| [app/api/smartevent/[...path]/route.ts](app/api/smartevent/) | Proxy that injects the event code |
| [app/api/smartevent/Initialize-Payment/route.ts](app/api/smartevent/Initialize-Payment/route.ts) | Opens a card checkout session |
| [lib/registration.ts](lib/registration.ts) | Form types, API helpers, `delegate_data` builder |
| [lib/event.ts](lib/event.ts) | Event name, date, venue for page copy |
| [lib/smartevent.ts](lib/smartevent.ts) | API URL and event token |
| [lib/payment.ts](lib/payment.ts) | Mastercard Checkout.js integration |
