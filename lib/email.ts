import sgMail from '@sendgrid/mail'

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export async function sendAssignmentEmail(opts: {
  to: string
  assigneeName: string
  assignerName: string
  businessName: string
  title: string
  description?: string | null
  dueDate?: Date | null
  isReassignment?: boolean
}) {
  if (!process.env.SENDGRID_API_KEY) {
    console.warn('[email] SENDGRID_API_KEY not configured, skipping assignment email')
    return
  }

  sgMail.setApiKey(process.env.SENDGRID_API_KEY)

  const from = process.env.SENDGRID_FROM || 'noreply@myprofitandloss.com'

  const assigneeName = escapeHtml(opts.assigneeName)
  const assignerName = escapeHtml(opts.assignerName)
  const businessName = escapeHtml(opts.businessName)
  const title = escapeHtml(opts.title)
  const description = opts.description ? escapeHtml(opts.description) : null

  const dueLine = opts.dueDate
    ? `<p><strong>Fecha límite:</strong> ${new Date(opts.dueDate).toLocaleDateString('es-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>`
    : ''

  const subject = opts.isReassignment
    ? `Te han reasignado: ${opts.title}`
    : `Nueva asignación: ${opts.title}`

  const introText = opts.isReassignment
    ? `<strong>${assignerName}</strong> te ha reasignado la siguiente tarea en <strong>${businessName}</strong>.`
    : `<strong>${assignerName}</strong> te ha asignado una nueva tarea contable en el negocio <strong>${businessName}</strong>.`

  const [response] = await sgMail.send({
    from: { email: from, name: 'My Profit & Loss' },
    to: opts.to,
    subject,
    html: `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto">
        <div style="background:#1B4965;padding:24px 32px;border-radius:8px 8px 0 0">
          <h1 style="color:#fff;font-size:20px;margin:0">My Profit &amp; Loss</h1>
        </div>
        <div style="background:#f8fafc;padding:32px;border-radius:0 0 8px 8px;border:1px solid #e2e8f0;border-top:none">
          <p style="color:#334155;font-size:16px">Hola <strong>${assigneeName}</strong>,</p>
          <p style="color:#475569">${introText}</p>
          <div style="background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:20px;margin:20px 0">
            <h2 style="color:#1B4965;font-size:16px;margin:0 0 8px">${title}</h2>
            ${description ? `<p style="color:#64748b;font-size:14px;margin:0">${description}</p>` : ''}
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
  if (response.statusCode >= 400) console.error('[email] SendGrid assignment email failed:', response.statusCode)
}

export async function sendWelcomeEmail(opts: {
  to: string
  name: string
  inviteUrl: string
  businessName: string
  inviterName: string
}) {
  if (!process.env.SENDGRID_API_KEY) {
    console.warn('[email] SENDGRID_API_KEY not configured, skipping welcome email')
    return
  }

  sgMail.setApiKey(process.env.SENDGRID_API_KEY)

  const from = process.env.SENDGRID_FROM || 'noreply@myprofitandloss.com'

  const name = escapeHtml(opts.name)
  const inviterName = escapeHtml(opts.inviterName)
  const businessName = escapeHtml(opts.businessName)

  const [response] = await sgMail.send({
    from: { email: from, name: 'My Profit & Loss' },
    to: opts.to,
    subject: 'Bienvenido a My Profit & Loss – Configura tu cuenta',
    html: `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto">
        <div style="background:#1B4965;padding:24px 32px;border-radius:8px 8px 0 0">
          <h1 style="color:#fff;font-size:20px;margin:0">My Profit &amp; Loss</h1>
        </div>
        <div style="background:#f8fafc;padding:32px;border-radius:0 0 8px 8px;border:1px solid #e2e8f0;border-top:none">
          <p style="color:#334155;font-size:16px">Hola <strong>${name}</strong>,</p>
          <p style="color:#475569">
            <strong>${inviterName}</strong> te ha invitado a unirte al equipo de
            <strong>${businessName}</strong> en My Profit &amp; Loss.
          </p>
          <p style="color:#475569">Haz clic en el botón para elegir tu propia contraseña y activar tu cuenta. Este enlace es de un solo uso y expira en 7 días.</p>
          <a href="${opts.inviteUrl}"
             style="display:inline-block;background:#1B4965;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;font-size:14px;margin-top:8px">
            Configurar mi contraseña
          </a>
        </div>
      </div>
    `,
  })
  if (response.statusCode >= 400) console.error('[email] SendGrid welcome email failed:', response.statusCode)
}
