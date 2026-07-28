import crypto from 'crypto'
import { prisma } from '@/lib/prisma'
import { renderContractPdf, pdfToBase64, type ContractPdfData } from '@/lib/contract-pdf'

export async function getContractSettings() {
  return prisma.contractSettings.findUnique({ where: { id: 1 } })
}

// True once the Proveedor has a saved signature + signer name to reuse —
// the signal that lets a client's own signature auto-complete a contract
// instead of waiting on a staff countersignature.
export function hasReusableProviderSignature(settings: Awaited<ReturnType<typeof getContractSettings>>): boolean {
  return !!(settings?.providerSignatureDataUrl && settings?.providerSignerFirstName?.trim() && settings?.providerSignerLastName?.trim())
}

function toPdfData(contract: NonNullable<Awaited<ReturnType<typeof prisma.contract.findUnique>>>): ContractPdfData {
  return {
    id: contract.id,
    clientCompanyName: contract.clientCompanyName,
    clientAddress: contract.clientAddress,
    clientState: contract.clientState,
    clientFirstName: contract.clientFirstName,
    clientLastName: contract.clientLastName,
    clientSignature: contract.clientSignature,
    clientSignedAt: contract.clientSignedAt,
    providerFirstName: contract.providerFirstName,
    providerLastName: contract.providerLastName,
    providerSignature: contract.providerSignature,
    providerSignedAt: contract.providerSignedAt,
    monthlyFeeCents: contract.monthlyFeeCents,
    paymentDueDay: contract.paymentDueDay,
    // Uses the snapshot taken at creation time, not a live ContractSettings
    // lookup — a later address change must not retroactively alter contracts
    // that were already sent out.
    settings: {
      providerCompanyName: contract.providerCompanyNameSnapshot,
      providerAddress: contract.providerAddressSnapshot,
    },
  }
}

// Regenerates the contract PDF from the current DB row and persists it —
// called after creation, after the client signs, and after countersigning
// (manual or auto-complete). `final` also writes finalPdfData + a SHA-256
// integrity hash; kept separate from pdfData (the always-current
// draft/working copy) so the pre-signature version stays available even
// after completion.
export async function regenerateContractPdf(contractId: string, opts: { final: boolean }) {
  const contract = await prisma.contract.findUniqueOrThrow({ where: { id: contractId } })

  const doc = renderContractPdf(toPdfData(contract))
  const base64 = pdfToBase64(doc)

  const data: { pdfData: string; finalPdfData?: string; pdfHash?: string } = { pdfData: base64 }
  if (opts.final) {
    data.finalPdfData = base64
    data.pdfHash = crypto.createHash('sha256').update(Buffer.from(base64, 'base64')).digest('hex')
  }

  await prisma.contract.update({ where: { id: contractId }, data })
  return data
}

export async function requireProviderSettings() {
  const settings = await getContractSettings()
  if (!settings?.providerCompanyName?.trim() || !settings?.providerAddress?.trim()) {
    return null
  }
  return settings
}
