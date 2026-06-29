import sgMail from '@sendgrid/mail'

export async function sendAssignmentEmail(opts: {
  to: string
  assigneeName: string
  assignerName: string
  businessName: string
  title: string
  description?: string | null
  dueDate?: Date | null
}) {
  if (!process.env.SENDGRID_API_KEY) {
    console.warn('[email] SENDGRID_API_KEY not configured, skipping assignment email')
    return
  }

  sgMail.setApiKey(process.env.SENDGRID_API_KEY)

  const from = process.env.SENDGRID_FROM || 'noreply@myprofitandloss.com'
  console.log('[email] Sending assignment email to:', opts.to, 'from:', from)

  const dueLine = opts.dueDate
    ? `<p><strong>Fecha límite:</strong> ${new Date(opts.dueDate).toLocaleDateString('es-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>`
    : ''

  const [response] = await sgMail.send({
    from: { email: from, name: 'My Profit & Loss' },
    to: opts.to,
    subject: `Nueva asignación: ${opts.title}`,
    html: `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto">
        <div style="background:#1B4965;padding:24px 32px;border-radius:8px 8px 0 0">
          <h1 style="color:#fff;font-size:20px;margin:0">My Profit &amp; Loss</h1>
        </div>
        <div style="background:#f8fafc;padding:32px;border-radius:0 0 8px 8px;border:1px solid #e2e8f0;border-top:none">
          <p style="color:#334155;font-size:16px">Hola <strong>${opts.assigneeName}</strong>,</p>
          <p style="color:#475569">
            <strong>${opts.assignerName}</strong> te ha asignado una nueva tarea contable en
            el negocio <strong>${opts.businessName}</strong>.
          </p>
          <div style="background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:20px;margin:20px 0">
            <h2 style="color:#1B4965;font-size:16px;margin:0 0 8px">${opts.title}</h2>
            ${opts.description ? `<p style="color:#64748b;font-size:14px;margin:0">${opts.description}</p>` : ''}
            ${dueLine}
          </div>
          <a href="${process.env.NEXTAUTH_URL || 'https://myprofitandloss.com'}/asignaciones"
             style="display:inline-block;background:#1B4965;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;font-size:14px">
            Ver mis asignaciones
          </a>
        </div>
      </div>
    `,
  })
  console.log('[email] SendGrid status:', response.statusCode)
}
