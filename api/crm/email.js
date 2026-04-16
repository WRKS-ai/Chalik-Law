// CRM Adapter — Email fallback (no CRM)
// Sends a notification email via fetch to a simple SMTP relay or service like Resend/Postmark
// Env vars: NOTIFICATION_EMAIL, RESEND_API_KEY (or swap for your mail service)

export async function submitViaEmail({ firstName, lastName, email, phone, revenue, vertical, qualified }) {
  const NOTIFICATION_EMAIL = process.env.NOTIFICATION_EMAIL;
  const RESEND_API_KEY     = process.env.RESEND_API_KEY;

  if (!NOTIFICATION_EMAIL) throw new Error('Missing NOTIFICATION_EMAIL env var');
  if (!RESEND_API_KEY)      throw new Error('Missing RESEND_API_KEY env var — swap this for your mail service if needed');

  const subject = `New ${qualified ? '✅ Qualified' : '❌ Unqualified'} Lead — ${vertical}`;
  const html = `
    <h2>${subject}</h2>
    <table>
      <tr><td><strong>Name</strong></td><td>${firstName} ${lastName}</td></tr>
      <tr><td><strong>Email</strong></td><td>${email}</td></tr>
      <tr><td><strong>Phone</strong></td><td>${phone}</td></tr>
      <tr><td><strong>Revenue Band</strong></td><td>${revenue}</td></tr>
      <tr><td><strong>Vertical</strong></td><td>${vertical}</td></tr>
      <tr><td><strong>Qualified</strong></td><td>${qualified ? 'Yes' : 'No'}</td></tr>
    </table>
  `;

  // Using Resend (resend.com) — swap for Postmark, SendGrid, etc. as needed
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: 'funnel@yourdomain.com', to: NOTIFICATION_EMAIL, subject, html }),
  });

  if (!r.ok) { const t = await r.text().catch(() => ''); throw new Error(`Email send ${r.status}: ${t.slice(0,200)}`); }
}
