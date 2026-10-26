// Server-side SmartEvent configuration.
//
// The event code identifies UNICEF Rwanda 40th Anniversary (internal code
// 6acc7e78c8d96) to SmartEvent. The API rejects that internal code and wants
// this encrypted token instead, sent either as an `Authorization` header (GET
// reads) or as an `event_code` field (POSTs). Both values are overridable from
// the environment; point the URL at https://sandbox.smartevent.rw/Api to work
// against sandbox.
export const SMARTEVENT_API_URL =
  process.env.SMARTEVENT_API_URL || 'https://app.smartevent.rw/Api';

export const EVENT_CODE =
  process.env.SMARTEVENT_EVENT_CODE ||
  'w3YlOAtRZ0ElXFYtjQb2Nk1jVlRrRXRFL1M1cGp2WnYwNVkzckE9PQ==';
