// CRM Adapter — Inspree (vendor webhook → syncs to their HubSpot → Convoso dialer)
// Env vars:
//   INSPREE_WEBHOOK_TOKEN     (required — bearer auth)
//   INSPREE_WEBHOOK_URL       (default: https://hubspot-sync.inspree.com/webhooks/vendor-lead)
//   INSPREE_CASE_TYPE         (default: "Slip and Fall - Chalik & Chalik")
//   INSPREE_MARKETING_SOURCE  (default: "WRKS Online - Chalik & Chalik")

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

export async function submitToInspree({ firstName, lastName, email, phone, fallTiming, medicalCare, qualified }) {
  const URL   = process.env.INSPREE_WEBHOOK_URL   || 'https://hubspot-sync.inspree.com/webhooks/vendor-lead';
  const TOKEN = process.env.INSPREE_WEBHOOK_TOKEN;
  if (!TOKEN) throw new Error('Missing INSPREE_WEBHOOK_TOKEN env var');

  const body = {
    firstname:            firstName,
    lastname:             lastName,
    email,
    phone,
    state:                'FL',
    case_type:            process.env.INSPREE_CASE_TYPE        || 'Slip and Fall - Chalik & Chalik',
    marketing_source:     process.env.INSPREE_MARKETING_SOURCE || 'WRKS Online - Chalik & Chalik',
    status_of_lead:       'New Lead',
    incident_description: buildIncidentDescription({ qualified, fallTiming, medicalCare }),
    at_fault:             'No',
    injured:              medicalCare === 'not-yet' ? 'No' : 'Yes',
    attorney_retained:    'No',
  };

  const r = await fetch(URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!r.ok) {
    const t = await r.text().catch(() => '');
    throw new Error(`Inspree webhook ${r.status}: ${t.slice(0, 300)}`);
  }
}
