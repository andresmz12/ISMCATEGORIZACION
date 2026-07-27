import { jsPDF } from 'jspdf'

const PAGE_WIDTH = 215.9 // letter, mm
const PAGE_HEIGHT = 279.4
const MARGIN = 20
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2
const BLANK = '_______________________________'

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

function money(cents: number | null | undefined): string {
  if (cents == null) return BLANK
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function date(d: Date | null | undefined): string {
  if (!d) return BLANK
  return new Date(d).toLocaleDateString('es-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

function line(v: string | null | undefined): string {
  const trimmed = v?.trim()
  return trimmed ? trimmed : BLANK
}

function sectionTitle(doc: jsPDF, cursor: Cursor, title: string) {
  cursor.gap(4)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(27, 73, 101) // brand navy
  doc.text(title, MARGIN, cursor.y)
  doc.setDrawColor(46, 196, 182) // brand teal
  doc.setLineWidth(0.4)
  doc.line(MARGIN, cursor.y + 1.5, MARGIN + CONTENT_WIDTH, cursor.y + 1.5)
  doc.setTextColor(20, 20, 20)
  cursor.gap(7)
}

function field(doc: jsPDF, cursor: Cursor, label: string, value: string) {
  cursor.ensure(6)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text(`${label}:`, MARGIN, cursor.y)
  doc.setFont('helvetica', 'normal')
  doc.text(value, MARGIN + 45, cursor.y)
  cursor.advance(6)
}

function paragraph(doc: jsPDF, cursor: Cursor, text: string) {
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9.5)
  const lines = doc.splitTextToSize(text, CONTENT_WIDTH) as string[]
  for (const l of lines) {
    cursor.ensure(5)
    doc.text(l, MARGIN, cursor.y)
    cursor.advance(5)
  }
  cursor.gap(2)
}

export interface ContractPdfSettings {
  providerCompanyName: string | null
  providerAddress: string | null
  providerCity: string | null
  providerState: string | null
  providerZip: string | null
  providerEmail: string | null
  providerPhone: string | null
  providerTaxId: string | null
}

export interface ContractPdfStore {
  name: string
  address: string | null
}

export interface ContractPdfData {
  id: string
  createdAt: Date

  clientCompanyName: string | null
  clientAddress: string | null
  clientState: string | null
  clientEmail: string | null

  clientFirstName: string | null
  clientLastName: string | null
  clientSignature: string | null // base64 PNG data URL
  clientSignedAt: Date | null

  providerFirstName: string | null
  providerLastName: string | null
  providerSignature: string | null // base64 PNG data URL
  providerSignedAt: Date | null

  servicesScope: string | null
  monthlyFeeCents: number | null
  startDate: Date | null
  additionalTerms: string | null

  stores: ContractPdfStore[]
  settings: ContractPdfSettings | null
}

function addSignatureBlock(
  doc: jsPDF,
  cursor: Cursor,
  x: number,
  width: number,
  heading: string,
  name: string,
  signedAt: Date | null,
  signatureImage: string | null
) {
  const top = cursor.y
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text(heading, x, top)

  const boxY = top + 4
  const boxHeight = 22
  doc.setDrawColor(203, 213, 225)
  doc.setLineWidth(0.3)
  doc.rect(x, boxY, width, boxHeight)

  if (signatureImage) {
    try {
      doc.addImage(signatureImage, 'PNG', x + 2, boxY + 2, width - 4, boxHeight - 4, undefined, 'FAST')
    } catch {
      // Malformed signature data should never take down PDF generation —
      // fall back to leaving the box empty rather than throwing.
    }
  }

  doc.setDrawColor(100, 100, 100)
  doc.line(x, boxY + boxHeight + 5, x + width, boxY + boxHeight + 5)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.text(line(name), x, boxY + boxHeight + 10)
  doc.setFontSize(7.5)
  doc.setTextColor(120, 120, 120)
  doc.text(`Fecha: ${date(signedAt)}`, x, boxY + boxHeight + 14)
  doc.setTextColor(20, 20, 20)
}

// Rebuilds the entire contract PDF from scratch every time it's called (on
// creation, after the client signs, and after the countersignature) — there
// is no existing-PDF patch step, so every field the document needs must be
// passed in fresh each time.
export function renderContractPdf(data: ContractPdfData): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'letter' })
  const cursor = new Cursor(doc)
  const s = data.settings

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.setTextColor(27, 73, 101)
  doc.text('CONTRATO DE PRESTACIÓN DE SERVICIOS', PAGE_WIDTH / 2, cursor.y, { align: 'center' })
  cursor.advance(6)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(120, 120, 120)
  doc.text(`Contrato #${data.id} · Generado el ${date(data.createdAt)}`, PAGE_WIDTH / 2, cursor.y, { align: 'center' })
  doc.setTextColor(20, 20, 20)
  cursor.advance(8)

  sectionTitle(doc, cursor, 'EL PROVEEDOR')
  field(doc, cursor, 'Empresa', line(s?.providerCompanyName))
  field(doc, cursor, 'Dirección', line(s?.providerAddress))
  field(doc, cursor, 'Ciudad / Estado', `${line(s?.providerCity)}, ${line(s?.providerState)} ${s?.providerZip?.trim() || ''}`.trim())
  field(doc, cursor, 'Email', line(s?.providerEmail))
  field(doc, cursor, 'Teléfono', line(s?.providerPhone))
  if (s?.providerTaxId?.trim()) field(doc, cursor, 'Tax ID', s.providerTaxId.trim())

  sectionTitle(doc, cursor, 'EL CLIENTE')
  field(doc, cursor, 'Empresa', line(data.clientCompanyName))
  field(doc, cursor, 'Dirección', line(data.clientAddress))
  field(doc, cursor, 'Estado', line(data.clientState))
  field(doc, cursor, 'Email', line(data.clientEmail))

  if (data.stores.length > 0) {
    sectionTitle(doc, cursor, 'UBICACIONES CUBIERTAS')
    for (const store of data.stores) {
      cursor.ensure(6)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.text(`• ${store.name}${store.address ? ' — ' + store.address : ''}`, MARGIN, cursor.y)
      cursor.advance(6)
    }
  }

  sectionTitle(doc, cursor, 'TÉRMINOS DEL CONTRATO')
  field(doc, cursor, 'Tarifa mensual', money(data.monthlyFeeCents))
  field(doc, cursor, 'Fecha de inicio', date(data.startDate))
  cursor.gap(2)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text('Alcance de los servicios:', MARGIN, cursor.y)
  cursor.advance(6)
  paragraph(doc, cursor, line(data.servicesScope))

  if (data.additionalTerms?.trim()) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    cursor.ensure(6)
    doc.text('Términos adicionales:', MARGIN, cursor.y)
    cursor.advance(6)
    paragraph(doc, cursor, data.additionalTerms.trim())
  }

  sectionTitle(doc, cursor, 'ACUERDO')
  paragraph(
    doc,
    cursor,
    'El Proveedor y el Cliente acuerdan los términos descritos en este documento. Este contrato entra en vigor ' +
      'una vez firmado por ambas partes. El Cliente firma primero a través de un enlace de firma electrónica ' +
      'enviado a su correo; el Proveedor contrafirma posteriormente desde su panel administrativo, completando ' +
      'así el acuerdo. Ambas firmas, junto con la fecha, hora y dirección IP de origen, quedan registradas como ' +
      'evidencia de consentimiento.'
  )

  cursor.gap(14)
  cursor.ensure(45)
  const colWidth = (CONTENT_WIDTH - 10) / 2
  const clientName = [data.clientFirstName, data.clientLastName].filter(Boolean).join(' ')
  const providerName = [data.providerFirstName, data.providerLastName].filter(Boolean).join(' ')

  addSignatureBlock(doc, cursor, MARGIN, colWidth, 'FIRMA DEL CLIENTE', clientName, data.clientSignedAt, data.clientSignature)
  addSignatureBlock(doc, cursor, MARGIN + colWidth + 10, colWidth, 'FIRMA DEL PROVEEDOR', providerName, data.providerSignedAt, data.providerSignature)

  return doc
}

// Raw base64 (no "data:application/pdf;base64," prefix) — stored as-is in
// Contract.pdfData/finalPdfData and reused directly as a SendGrid attachment
// or wrapped in a data: URI for display.
export function pdfToBase64(doc: jsPDF): string {
  return doc.output('datauristring').split(',')[1]
}
