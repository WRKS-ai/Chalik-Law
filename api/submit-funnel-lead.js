// POST /api/submit-funnel-lead
// Captures VSL form submission, returns { qualified: bool }
// CRM provider controlled by CRM_PROVIDER env var (ghl | hubspot | email)

import { submitToGHL }      from './crm/ghl.js';
import { submitToHubSpot }  from './crm/hubspot.js';
import { submitToHQIntake } from './crm/hqintake.js';
import { submitViaEmail }   from './crm/email.js';

// Fall timing values that route to the unqualified page
// Must match the radio value used in the catalyst page form
const UNQUALIFIED_VALUES = [
  'more-than-4-years',
];

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

  try {
    if      (provider === 'ghl')       await submitToGHL(payload);
    else if (provider === 'hubspot')   await submitToHubSpot(payload);
    else if (provider === 'hqintake')  await submitToHQIntake(payload);
    else if (provider === 'email')     await submitViaEmail(payload);
    else throw new Error(`Unknown CRM_PROVIDER: ${provider}`);

    return res.status(200).json({ success: true, qualified });
  } catch (err) {
    console.error('submit-funnel-lead error:', err);
    return res.status(500).json({ error: 'Submission failed', detail: String(err).slice(0, 300) });
  }
}
