import sgMail from '@sendgrid/mail'

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

const FONT_STACK = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"

// Full HTML document (not just a fragment) with explicit color-scheme /
// supported-color-schemes meta tags — without these, Apple Mail's dark-mode
// "smart invert" flips our navy header and white text into an inconsistent,
// half-inverted mess on iOS. Table-based layout (rather than plain divs) so
// it also renders consistently in Outlook desktop, which ignores much of
// modern CSS on divs.
function emailShell(opts: { previewText: string; bodyHtml: string }): string {
  return `<!DOCTYPE html>
<html lang="es" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title></title>
<!--[if mso]>
<style>table {border-collapse:collapse;} .fallback-font {font-family:Arial,sans-serif;}</style>
<![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#eef2f6;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">${opts.previewText}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#eef2f6;">
<tr><td align="center" style="padding:40px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 1px 3px rgba(15,43,60,0.10);">
<tr><td style="background-color:#153F58;padding:28px 32px;">
<table role="presentation" cellpadding="0" cellspacing="0"><tr>
<td style="width:36px;height:36px;background-color:#2EC4B6;border-radius:9px;text-align:center;vertical-align:middle;">
<span style="font-family:${FONT_STACK};font-size:14px;font-weight:700;color:#ffffff;line-height:36px;">MP</span>
</td>
<td style="padding-left:12px;">
<span style="font-family:${FONT_STACK};font-size:17px;font-weight:700;color:#ffffff;">My Profit &amp; Loss</span>
</td>
</tr></table>
</td></tr>
<tr><td style="padding:36px 32px 8px;font-family:${FONT_STACK};font-size:15px;line-height:1.65;color:#334155;">
${opts.bodyHtml}
</td></tr>
<tr><td style="padding:24px 32px 28px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="border-top:1px solid #e9edf2;padding-top:18px;">
<p style="margin:0;font-family:${FONT_STACK};font-size:12px;line-height:1.6;color:#94a3b8;">Este es un correo automático de My Profit &amp; Loss. Si no esperabas este mensaje, puedes ignorarlo con confianza.</p>
</td></tr></table>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`
}

function emailButton(label: string, url: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0 6px;"><tr>
<td bgcolor="#1B4965" style="border-radius:8px;">
<a href="${url}" target="_blank" style="display:inline-block;padding:14px 30px;font-family:${FONT_STACK};font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:8px;">${label}</a>
</td>
</tr></table>`
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
          <a href="${process.env.NEXTAUTH_URL || 'https://www.myprofitandloss.com'}/asignaciones"
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

export async function sendContractSignRequestEmail(opts: {
  to: string
  signUrl: string
  providerCompanyName: string
  contractId: string
  pdfBase64?: string // raw base64, no data: prefix — attaches the current draft if provided
  isResend?: boolean
}) {
  if (!process.env.SENDGRID_API_KEY) {
    console.warn('[email] SENDGRID_API_KEY not configured, skipping contract sign-request email')
    return
  }

  sgMail.setApiKey(process.env.SENDGRID_API_KEY)
  const from = process.env.SENDGRID_FROM || 'noreply@myprofitandloss.com'
  const providerCompanyName = escapeHtml(opts.providerCompanyName)

  const [response] = await sgMail.send({
    from: { email: from, name: 'My Profit & Loss' },
    to: opts.to,
    subject: `${opts.isResend ? 'Recordatorio: ' : ''}Contrato de servicios de ${providerCompanyName} — firma requerida`,
    html: emailShell({
      previewText: `${providerCompanyName} te envió un contrato para firmar electrónicamente.`,
      bodyHtml: `
        <p style="margin:0 0 4px;font-size:16px;color:#0f172a;font-weight:600;">Hola,</p>
        <p style="margin:0 0 4px;">
          <strong>${providerCompanyName}</strong> te ha enviado un contrato de servicios para firmar electrónicamente.
          Adjuntamos una copia en PDF para que la revises con calma.
        </p>
        ${emailButton('Revisar y firmar contrato', opts.signUrl)}
      `,
    }),
    attachments: opts.pdfBase64
      ? [
          {
            content: opts.pdfBase64,
            filename: 'Contrato - My Profit and Loss.pdf',
            type: 'application/pdf',
            disposition: 'attachment',
          },
        ]
      : undefined,
  })
  if (response.statusCode >= 400) console.error('[email] SendGrid contract sign-request email failed:', response.statusCode)
}

export async function sendContractReadyForCountersignEmail(opts: {
  to: string
  contractId: string
  clientCompanyName: string
  panelUrl: string
}) {
  if (!process.env.SENDGRID_API_KEY) {
    console.warn('[email] SENDGRID_API_KEY not configured, skipping contract countersign-ready email')
    return
  }

  sgMail.setApiKey(process.env.SENDGRID_API_KEY)
  const from = process.env.SENDGRID_FROM || 'noreply@myprofitandloss.com'
  const clientCompanyName = escapeHtml(opts.clientCompanyName || 'Cliente')

  const [response] = await sgMail.send({
    from: { email: from, name: 'My Profit & Loss' },
    to: opts.to,
    subject: `Contrato firmado por ${clientCompanyName} — falta tu contrafirma`,
    html: emailShell({
      previewText: `${clientCompanyName} ya firmó — el contrato está listo para tu contrafirma.`,
      bodyHtml: `
        <p style="margin:0 0 4px;">
          <strong>${clientCompanyName}</strong> ya firmó el contrato <span style="color:#94a3b8;">#${opts.contractId}</span>.
          Está listo para tu contrafirma.
        </p>
        ${emailButton('Ir al contrato', opts.panelUrl)}
      `,
    }),
  })
  if (response.statusCode >= 400) console.error('[email] SendGrid contract countersign-ready email failed:', response.statusCode)
}

export async function sendContractCompletedEmail(opts: {
  to: string
  contractId: string
  providerCompanyName: string
  finalPdfBase64: string // raw base64, no data: prefix
}) {
  if (!process.env.SENDGRID_API_KEY) {
    console.warn('[email] SENDGRID_API_KEY not configured, skipping contract completed email')
    return
  }

  sgMail.setApiKey(process.env.SENDGRID_API_KEY)
  const from = process.env.SENDGRID_FROM || 'noreply@myprofitandloss.com'
  const providerCompanyName = escapeHtml(opts.providerCompanyName)

  const [response] = await sgMail.send({
    from: { email: from, name: 'My Profit & Loss' },
    to: opts.to,
    subject: `Tu contrato con ${providerCompanyName} está completo`,
    html: emailShell({
      previewText: 'Tu contrato quedó firmado por ambas partes — copia final adjunta.',
      bodyHtml: `
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 18px;"><tr>
          <td style="width:44px;height:44px;background-color:#ecfdf5;border-radius:22px;text-align:center;vertical-align:middle;">
            <span style="font-family:${FONT_STACK};font-size:20px;line-height:44px;color:#059669;">&#10003;</span>
          </td>
        </tr></table>
        <p style="margin:0 0 4px;font-size:16px;color:#0f172a;font-weight:600;">Contrato completado</p>
        <p style="margin:0;">
          El contrato con <strong>${providerCompanyName}</strong> quedó firmado por ambas partes.
          Adjuntamos la copia final en PDF para tus registros.
        </p>
      `,
    }),
    attachments: [
      {
        content: opts.finalPdfBase64,
        filename: 'Contrato Firmado - My Profit and Loss.pdf',
        type: 'application/pdf',
        disposition: 'attachment',
      },
    ],
  })
  if (response.statusCode >= 400) console.error('[email] SendGrid contract completed email failed:', response.statusCode)
}
