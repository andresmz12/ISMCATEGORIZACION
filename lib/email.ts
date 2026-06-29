import nodemailer from 'nodemailer'

function getTransport() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  })
}

export async function sendAssignmentEmail(opts: {
  to: string
  assigneeName: string
  assignerName: string
  businessName: string
  title: string
  description?: string | null
  dueDate?: Date | null
}) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn('[email] SMTP not configured, skipping assignment email')
    return
  }

  const transport = getTransport()
  const from = process.env.SMTP_FROM || process.env.SMTP_USER

  const dueLine = opts.dueDate
    ? `<p><strong>Fecha límite:</strong> ${new Date(opts.dueDate).toLocaleDateString('es-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>`
    : ''

  await transport.sendMail({
    from: `"My Profit & Loss" <${from}>`,
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
}
