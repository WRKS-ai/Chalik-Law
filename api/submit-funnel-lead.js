// POST /api/submit-funnel-lead
// Captures VSL form submission, returns { qualified: bool }
// CRM provider controlled by CRM_PROVIDER env var (ghl | hubspot | hqintake | email)
// Optional: LEAD_LOG_WEBHOOK env var pipes every submission to a Google Sheets
// (or compatible) webhook for our own visibility — independent of vendor CRM.

import { submitToGHL }      from './crm/ghl.js';
import { submitToHubSpot }  from './crm/hubspot.js';
import { submitToHQIntake } from './crm/hqintake.js';
import { submitViaEmail }   from './crm/email.js';

// Fall timing values that route to the unqualified page
// Must match the radio value used in the catalyst page form
const UNQUALIFIED_VALUES = [
  'more-than-4-years',
];

// Fire-and-forget POST to LEAD_LOG_WEBHOOK with submission data.
// Failures here are logged but never affect the user-facing response or
// the vendor delivery — purely an observability sidecar.
async function logLead(data) {
  const URL = process.env.LEAD_LOG_WEBHOOK;
  if (!URL) return;
  const controller = new AbortController();
  const timeout   = setTimeout(() => controller.abort(), 4000);
  try {
    await fetch(URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(data),
      signal:  controller.signal,
      redirect:'follow',
    });
  } catch (err) {
    console.error('lead-log webhook error:', err && err.message ? err.message : err);
  } finally {
    clearTimeout(timeout);
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  const { name, email, phone, fallTiming, medicalCare, vertical = 'slip-and-fall' } = req.body || {};
  if (!name || !email || !phone || !fallTiming) {
    return res.status(400).json({ error: 'name, email, phone, and fallTiming are required' });
  }

  const qualified = !UNQUALIFIED_VALUES.includes(fallTiming);
  const firstName = name.trim().split(' ')[0];
  const lastName  = name.trim().split(' ').slice(1).join(' ') || '';
  const provider  = (process.env.CRM_PROVIDER || 'ghl').toLowerCase();
  const payload   = {
    firstName, lastName, name, email, phone,
    fallTiming, medicalCare: medicalCare || '',
    revenue: fallTiming, // kept for CRM adapter compatibility
    vertical, qualified,
  };

  let vendorResult = null;
  let vendorError  = null;
  try {
    if      (provider === 'ghl')       vendorResult = await submitToGHL(payload);
    else if (provider === 'hubspot')   vendorResult = await submitToHubSpot(payload);
    else if (provider === 'hqintake')  vendorResult = await submitToHQIntake(payload);
    else if (provider === 'email')     vendorResult = await submitViaEmail(payload);
    else throw new Error(`Unknown CRM_PROVIDER: ${provider}`);
  } catch (err) {
    vendorError = err;
    console.error('submit-funnel-lead vendor error:', err);
  }

  // Log to our sheet regardless of vendor outcome — failures still useful
  // for debugging. Awaited (with timeout) so Vercel doesn't kill the
  // background fetch before it reaches Apps Script.
  await logLead({
    qualified,
    name,
    email,
    phone,
    fallTiming,
    medicalCare:  medicalCare || '',
    vertical,
    vendorLeadId: (vendorResult && vendorResult.leadId) || '',
    status:       vendorError ? 'vendor_error' : 'sent',
  });

  if (vendorError) {
    return res.status(500).json({ error: 'Submission failed', detail: String(vendorError).slice(0, 300) });
  }
  return res.status(200).json({ success: true, qualified });
}
