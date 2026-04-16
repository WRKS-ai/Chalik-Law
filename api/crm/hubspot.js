// CRM Adapter — HubSpot
// Env vars: HUBSPOT_API_KEY, HUBSPOT_PORTAL_ID

export async function submitToHubSpot({ firstName, lastName, email, phone, revenue, vertical, qualified }) {
  const API_KEY = process.env.HUBSPOT_API_KEY;
  if (!API_KEY) throw new Error('Missing HUBSPOT_API_KEY env var');

  // Upsert contact
  const r = await fetch('https://api.hubapi.com/crm/v3/objects/contacts', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      properties: {
        firstname:    firstName,
        lastname:     lastName,
        email,
        phone,
        hs_lead_status: 'NEW',
        lead_source:  `Funnel — ${vertical}`,
        revenue_band: revenue,
        funnel_vertical: vertical,
        funnel_qualified: String(qualified),
      },
    }),
  });

  if (!r.ok) {
    // 409 = contact already exists — update instead
    if (r.status === 409) {
      const errData = await r.json().catch(() => ({}));
      const contactId = errData?.message?.match(/ID: (\d+)/)?.[1];
      if (contactId) {
        await fetch(`https://api.hubapi.com/crm/v3/objects/contacts/${contactId}`, {
          method: 'PATCH',
          headers: { 'Authorization': `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ properties: { phone, revenue_band: revenue, funnel_vertical: vertical, funnel_qualified: String(qualified) } }),
        });
        return;
      }
    }
    const t = await r.text().catch(() => '');
    throw new Error(`HubSpot contact ${r.status}: ${t.slice(0,200)}`);
  }
}
