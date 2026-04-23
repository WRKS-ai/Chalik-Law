// CRM Adapter — HQIntake (vendor lead intake → syncs to their HubSpot → Convoso dialer)
//
// Endpoint:  POST https://app.hqintake.com/api/vendor/inbound
// Auth:      X-Api-Key header
// marketing_source is auto-set from the API key on the vendor's side
// (resolves to "WRKS Online - Chalik & Chalik"), so we don't send it.
// Rate limit: 20 leads/min per key.
//
// Env vars:
//   HQINTAKE_API_KEY      (required — X-Api-Key value)
//   HQINTAKE_WEBHOOK_URL  (default: https://app.hqintake.com/api/vendor/inbound)
//   HQINTAKE_CASE_TYPE    (default: "Slip and Fall - Chalik & Chalik")

const FALL_TIMING_LABELS = {
  'within-2-years':    'within the last 2 years',
  '2-to-4-years':      '2 to 4 years ago',
  'more-than-4-years': 'more than 4 years ago',
};

const MEDICAL_CARE_LABELS = {
  'yes-er':     'ER or ambulance',
  'yes-doctor': 'saw a doctor',
  'not-yet':    'not yet',
};

function buildIncidentDescription({ qualified, fallTiming, medicalCare }) {
  const timing = FALL_TIMING_LABELS[fallTiming]   || fallTiming   || 'unspecified';
  const care   = MEDICAL_CARE_LABELS[medicalCare] || medicalCare  || 'not specified';
  if (!qualified) {
    return `[UNQUALIFIED - DO NOT DIAL] Florida Walmart slip and fall. Fall occurred ${timing} (outside FL statute of limitations). Medical care: ${care}.`;
  }
  return `Florida Walmart slip and fall. Fall occurred ${timing}. Medical care: ${care}.`;
}

export async function submitToHQIntake({ firstName, lastName, email, phone, fallTiming, medicalCare, qualified }) {
  const URL = process.env.HQINTAKE_WEBHOOK_URL || 'https://app.hqintake.com/api/vendor/inbound';
  const KEY = process.env.HQINTAKE_API_KEY;
  if (!KEY) throw new Error('Missing HQINTAKE_API_KEY env var');

  const body = {
    firstname:            firstName,
    lastname:             lastName,
    phone,
    email,
    state:                'FL',
    case_type:            process.env.HQINTAKE_CASE_TYPE || 'Slip and Fall - Chalik & Chalik',
    // Extra context fields — vendor may pass through to HubSpot.
    // If any cause rejection, strip them here.
    incident_description: buildIncidentDescription({ qualified, fallTiming, medicalCare }),
    at_fault:             'No',
    injured:              medicalCare === 'not-yet' ? 'No' : 'Yes',
    attorney_retained:    'No',
  };

  const r = await fetch(URL, {
    method: 'POST',
    headers: {
      'X-Api-Key':    KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!r.ok) {
    const t = await r.text().catch(() => '');
    throw new Error(`HQIntake ${r.status}: ${t.slice(0, 300)}`);
  }

  // Success response: {"received": true, "leadId": "...", "source": "WRKS Online - Chalik & Chalik"}
  return await r.json().catch(() => ({ received: true }));
}
