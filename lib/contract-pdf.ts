import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

const PAGE_WIDTH = 215.9 // letter, mm
const PAGE_HEIGHT = 279.4
const MARGIN = 20
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2
const BLANK = '__________________'

// Tracks the current Y position and moves to a fresh page automatically once
// content stops fitting — every draw call goes through here instead of each
// caller doing its own page-break math.
class Cursor {
  y = MARGIN
  constructor(private doc: jsPDF) {}

  ensure(height: number) {
    if (this.y + height > PAGE_HEIGHT - MARGIN) {
      this.doc.addPage()
      this.y = MARGIN
    }
  }

  advance(height: number) {
    this.y += height
  }

  gap(height: number) {
    this.ensure(height)
    this.y += height
  }
}

function line(v: string | null | undefined): string {
  const trimmed = v?.trim()
  return trimmed ? trimmed : BLANK
}

function money(cents: number | null | undefined): string {
  if (cents == null) return BLANK
  return (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function day(d: number | null | undefined): string {
  return d != null ? String(d) : '____'
}

function formattedDate(d: Date | null | undefined): string {
  if (!d) return BLANK
  return new Date(d).toLocaleDateString('es-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

function heading(doc: jsPDF, cursor: Cursor, text: string) {
  // Reserve room for the heading plus the first couple of lines that follow
  // it, not just its own height — otherwise a heading can land as the last
  // line on a page with its paragraph stranded on the next one.
  cursor.ensure(24)
  cursor.gap(3)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(20, 20, 20)
  doc.text(text, MARGIN, cursor.y)
  cursor.gap(6)
}

function paragraph(doc: jsPDF, cursor: Cursor, text: string, opts?: { bullet?: boolean }) {
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  const indent = opts?.bullet ? 5 : 0
  const prefix = opts?.bullet ? '•  ' : ''
  const lines = doc.splitTextToSize(prefix + text, CONTENT_WIDTH - indent) as string[]
  for (const l of lines) {
    cursor.ensure(5.2)
    doc.text(l, MARGIN + indent, cursor.y)
    cursor.advance(5.2)
  }
  cursor.gap(1.5)
}

function addSignatureBlock(
  doc: jsPDF,
  cursor: Cursor,
  x: number,
  width: number,
  heading: string,
  companyOrName: string,
  signerName: string,
  signedAt: Date | null,
  signatureImage: string | null
) {
  const top = cursor.y
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text(heading, x, top)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text(companyOrName, x, top + 5)

  const boxY = top + 8
  const boxHeight = 20
  doc.setDrawColor(203, 213, 225)
  doc.setLineWidth(0.3)
  doc.rect(x, boxY, width, boxHeight)
  doc.setFontSize(7.5)
  doc.setTextColor(150, 150, 150)
  doc.text('Firma', x + 2, boxY + 4)
  doc.setTextColor(20, 20, 20)

  if (signatureImage) {
    try {
      doc.addImage(signatureImage, 'PNG', x + 2, boxY + 4, width - 4, boxHeight - 6, undefined, 'FAST')
    } catch {
      // Malformed signature data should never take down PDF generation —
      // fall back to leaving the box empty rather than throwing.
    }
  }

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.text(`Nombre: ${line(signerName)}`, x, boxY + boxHeight + 6)
  doc.text(`Fecha: ${formattedDate(signedAt)}`, x, boxY + boxHeight + 11)
}

export interface ContractPdfSettings {
  providerCompanyName: string | null
  providerAddress: string | null
}

export interface ContractPdfData {
  id: string

  clientCompanyName: string | null
  clientAddress: string | null
  clientState: string | null

  clientFirstName: string | null
  clientLastName: string | null
  clientSignature: string | null // base64 PNG data URL
  clientSignedAt: Date | null

  providerFirstName: string | null
  providerLastName: string | null
  providerSignature: string | null // base64 PNG data URL
  providerSignedAt: Date | null

  monthlyFeeCents: number | null
  paymentDueDay: number | null

  settings: ContractPdfSettings | null
}

// Renders the "Contrato de Servicio de Software — MyProfitandLoss" — the
// legal clauses below are fixed text taken verbatim from the signed
// reference contract; only the fields interpolated below (provider/client
// identity, price, payment day, signatures) vary per contract. Rebuilt from
// scratch every time (creation, client signature, countersignature) since
// there is no patch step — every field the document needs is passed in fresh.
export function renderContractPdf(data: ContractPdfData): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'letter' })
  const cursor = new Cursor(doc)
  const s = data.settings
  const providerName = line(s?.providerCompanyName)
  const providerAddress = line(s?.providerAddress)

  // The contract is only legally "signed" once both parties have — use the
  // countersignature date as the execution date; blank until then.
  const executionDate = formattedDate(data.providerSignedAt)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.text('CONTRATO DE SERVICIO DE SOFTWARE', PAGE_WIDTH / 2, cursor.y, { align: 'center' })
  cursor.advance(7)
  doc.text('"MyProfitandLoss"', PAGE_WIDTH / 2, cursor.y, { align: 'center' })
  cursor.advance(9)

  paragraph(
    doc,
    cursor,
    `Este contrato se firma el día ${executionDate} entre ${providerName} ("el Proveedor"), con domicilio en ` +
      `${providerAddress}, Illinois; y ${line(data.clientCompanyName)} ("el Cliente"), con domicilio en ` +
      `${line(data.clientAddress)}, Estado de ${line(data.clientState)}. Ambas partes aceptan lo siguiente:`
  )

  heading(doc, cursor, '1. OBJETO Y LICENCIA DE USO')
  paragraph(
    doc,
    cursor,
    'El Proveedor le da permiso al Cliente de usar el software "MyProfitandLoss" en su negocio, para clasificar, ' +
      'organizar y administrar sus transacciones financieras y generar reportes contables. Este permiso es solo ' +
      'para el Cliente: no se puede copiar, revender, ni compartir con otros negocios. El Software y todo lo ' +
      'relacionado con él (código, diseño, marca, modelos de inteligencia artificial usados internamente) siempre ' +
      'son propiedad del Proveedor.'
  )

  heading(doc, cursor, '2. NATURALEZA DEL SERVICIO')
  paragraph(
    doc,
    cursor,
    'El Software está dirigido principalmente a contadores y profesionales de contabilidad, como herramienta de ' +
      'apoyo para clasificar, organizar y generar reportes de las transacciones financieras de sus propios ' +
      'clientes. El Software no reemplaza el criterio profesional del Cliente: las clasificaciones y reportes ' +
      'generados (incluyendo los que usan inteligencia artificial) son un apoyo administrativo, no un dictamen ' +
      'contable, fiscal o de auditoría. El Cliente, como profesional de la contabilidad, es el único responsable ' +
      'de revisar y validar la información antes de usarla o entregarla a sus propios clientes, y de cumplir con ' +
      'las leyes fiscales y contables, así como con las normas de su profesión, que le apliquen.'
  )

  heading(doc, cursor, '3. PRECIO Y FORMA DE PAGO')
  paragraph(
    doc,
    cursor,
    `Suscripción mensual: según el plan contratado (Independiente, Contador), pagada por adelantado, a más ` +
      `tardar el día ${day(data.paymentDueDay)} de cada mes. No se cobra costo de instalación.`,
    { bullet: true }
  )
  paragraph(
    doc,
    cursor,
    'Si el Cliente tiene un atraso de 5 días en un pago, el Proveedor puede suspender el acceso al Software hasta ' +
      'que se ponga al día.',
    { bullet: true }
  )
  paragraph(doc, cursor, 'Los pagos no se reembolsan. Si el precio cambia, se avisará con 30 días de anticipación.', { bullet: true })

  cursor.gap(2)
  autoTable(doc, {
    startY: cursor.y,
    margin: { left: MARGIN, right: MARGIN },
    head: [['Concepto', 'Monto']],
    body: [['Suscripción mensual del Software (según plan: Independiente / Contador)', `$${money(data.monthlyFeeCents)} USD / mes`]],
    theme: 'grid',
    headStyles: { fillColor: [27, 73, 101], fontSize: 9 },
    bodyStyles: { fontSize: 9 },
    columnStyles: { 1: { cellWidth: 45, halign: 'right' } },
  })
  cursor.y = (doc as any).lastAutoTable.finalY + 6

  heading(doc, cursor, '4. CONFIDENCIALIDAD Y DATOS')
  paragraph(
    doc,
    cursor,
    'Ambas partes mantendrán en privado la información que se comparta por este contrato. Los datos financieros, ' +
      'transacciones, recibos y reportes de los clientes del Cliente que se ingresen al Software siguen siendo ' +
      'propiedad del Cliente, y este es responsable de contar con la autorización de sus propios clientes para ' +
      'procesar dicha información en el Software. El uso de funciones de inteligencia artificial (clasificación ' +
      'automática, lectura de recibos, asistente financiero) implica que la información pertinente puede ' +
      'procesarse a través de proveedores externos de IA únicamente con fines de generar el resultado solicitado, ' +
      'sin que esto le dé al Proveedor ni a terceros derechos sobre los datos del Cliente. Si hay una falla de ' +
      'seguridad, el Proveedor avisará al Cliente dentro de 72 horas.'
  )

  heading(doc, cursor, '5. DURACIÓN Y CANCELACIÓN')
  paragraph(
    doc,
    cursor,
    'Este contrato se renueva cada mes de forma automática. Cualquiera de las partes lo puede cancelar avisando ' +
      'por escrito con 15 días de anticipación. El Proveedor puede cancelarlo de inmediato si el Cliente no paga ' +
      'por más de 30 días, o si usa el Software de forma indebida (por ejemplo, compartiendo su acceso, ' +
      'copiándolo, o usándolo para algo ilegal). Al terminar el contrato, el Proveedor entregará al Cliente sus ' +
      'datos (transacciones, clientes, reportes, registros) dentro de 15 días, y después podrá eliminarlos. El ' +
      'Software se desactivará y el Cliente deberá cubrir cualquier saldo pendiente.'
  )

  heading(doc, cursor, '6. LEY QUE APLICA')
  paragraph(
    doc,
    cursor,
    'Este contrato se rige por las leyes del Estado de Illinois. Si surge algún problema, las partes intentarán ' +
      'resolverlo hablando directamente primero; si no se resuelve, se llevará a los tribunales del Condado de ' +
      'Cook, Illinois.'
  )

  cursor.gap(4)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  cursor.ensure(6)
  doc.text('Ambas partes firman de conformidad con lo aquí establecido.', MARGIN, cursor.y)
  cursor.gap(10)

  cursor.ensure(42)
  const colWidth = (CONTENT_WIDTH - 10) / 2
  const clientSignerName = [data.clientFirstName, data.clientLastName].filter(Boolean).join(' ')
  const providerSignerName = [data.providerFirstName, data.providerLastName].filter(Boolean).join(' ')

  addSignatureBlock(doc, cursor, MARGIN, colWidth, 'EL PROVEEDOR', providerName, providerSignerName, data.providerSignedAt, data.providerSignature)
  addSignatureBlock(
    doc,
    cursor,
    MARGIN + colWidth + 10,
    colWidth,
    'EL CLIENTE',
    line(data.clientCompanyName),
    clientSignerName,
    data.clientSignedAt,
    data.clientSignature
  )

  return doc
}

// Raw base64 (no "data:application/pdf;base64," prefix) — stored as-is in
// Contract.pdfData/finalPdfData and reused directly as a SendGrid attachment
// or wrapped in a data: URI for display.
export function pdfToBase64(doc: jsPDF): string {
  return doc.output('datauristring').split(',')[1]
}
