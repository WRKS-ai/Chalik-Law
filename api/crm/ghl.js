// CRM Adapter — GoHighLevel
// Env vars: GHL_API_KEY, GHL_LOCATION_ID
// Optional: GHL_PIPELINE_ID, GHL_PIPELINE_STAGE_ID

export async function submitToGHL({ firstName, lastName, email, phone, revenue, vertical, qualified }) {
  const GHL_API_KEY     = process.env.GHL_API_KEY;
  const GHL_LOCATION_ID = process.env.GHL_LOCATION_ID;
  if (!GHL_API_KEY || !GHL_LOCATION_ID) throw new Error('Missing GHL env vars: GHL_API_KEY and GHL_LOCATION_ID');

  const tags = ['lead-optin-form', `funnel-${vertical}`, qualified ? 'funnel-qualified' : 'funnel-unqualified', `revenue-${revenue}`];

  const r = await fetch('https://services.leadconnectorhq.com/contacts/upsert', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${GHL_API_KEY}`, 'Version': '2021-07-28', 'Content-Type': 'application/json' },
    body: JSON.stringify({ locationId: GHL_LOCATION_ID, firstName, lastName, email, phone, tags, source: `Funnel — ${vertical}` }),
  });

  if (!r.ok) { const t = await r.text().catch(() => ''); throw new Error(`GHL upsert ${r.status}: ${t.slice(0,200)}`); }
  const data    = await r.json().catch(() => ({}));
  const contact = data?.contact || data?.new_contact || data;

  if (contact?.id) {
    createOpportunity({ contactId: contact.id, firstName, lastName, vertical, qualified, revenue })
      .catch(e => console.error('GHL opportunity failed:', e));
  }
}

async function createOpportunity({ contactId, firstName, lastName, vertical, qualified, revenue }) {
  const PIPELINE_ID = process.env.GHL_PIPELINE_ID;
  const STAGE_ID    = process.env.GHL_PIPELINE_STAGE_ID;
  if (!PIPELINE_ID || !STAGE_ID) { console.warn('GHL pipeline IDs not set — skipping opportunity'); return; }

  const r = await fetch('https://services.leadconnectorhq.com/opportunities/', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${process.env.GHL_API_KEY}`, 'Version': '2021-07-28', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      locationId: process.env.GHL_LOCATION_ID, pipelineId: PIPELINE_ID, pipelineStageId: STAGE_ID,
      name: `${firstName} ${lastName} — ${vertical} (${qualified ? 'qualified' : 'unqualified'})`,
      status: 'open', contactId,
      customFields: [{ key: 'revenue_band', field_value: revenue }, { key: 'vertical', field_value: vertical }],
    }),
  });
  if (!r.ok) { const t = await r.text().catch(() => ''); throw new Error(`GHL opportunity ${r.status}: ${t.slice(0,200)}`); }
}
