import type { InputRules } from '@/lib/registration';

// Display details for the event, as worded in the invitation email. They only
// feed page copy, so they live here instead of being fetched on every page
// load.
export const EVENT = {
  name: "UNICEF Rwanda 40th Anniversary Children's Gala",
  date: "World Children's Day, 20 November 2026",
  time: '2:00 p.m. – 5:00 p.m.',
  venue: 'Kigali Convention Centre',
  ministry: 'MIGEPROF',
  ministryName: 'Ministry of Gender and Family Promotion',
};

// The "Your RSVP" group in SmartEvent's delegate form. An invitee who will
// not attend can name a representative, saved on the invitee's own record.
export const RSVP = {
  attending: 'input_id_1793026294',
  sendRepresentative: 'input_id_1793026349',
  repFirstName: 'input_id_1793026432',
  repLastName: 'input_id_1793026476',
  repPosition: 'input_id_1793026521',
  repOrganization: 'input_id_1793026563',
  repEmail: 'input_id_1793026602',
  repPhone: 'input_id_1793026654',
};

const representative = {
  showWhen: { input: RSVP.sendRepresentative, equals: 'Yes' },
};

// SmartEvent marks these optional so it accepts any combination; the page
// asks for them only when they apply.
export const RSVP_RULES: InputRules = {
  [RSVP.attending]: { required: true, optionOrder: ['Yes', 'No', 'Maybe'] },
  [RSVP.sendRepresentative]: {
    showWhen: { input: RSVP.attending, equals: 'No' },
    required: true,
    optionOrder: ['Yes', 'No'],
  },
  [RSVP.repFirstName]: { ...representative, required: true },
  [RSVP.repLastName]: { ...representative, required: true },
  [RSVP.repPosition]: { ...representative, required: true },
  [RSVP.repOrganization]: representative,
  [RSVP.repEmail]: { ...representative, required: true },
  [RSVP.repPhone]: { ...representative, required: true },
};
