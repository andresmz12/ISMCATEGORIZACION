import crypto from 'crypto'
import { prisma } from '@/lib/prisma'
import { renderContractPdf, pdfToBase64, type ContractPdfData } from '@/lib/contract-pdf'

const CONTRACT_INCLUDE = { stores: true } as const

type ContractWithStores = Awaited<ReturnType<typeof prisma.contract.findUniqueOrThrow<{ where: { id: string }; include: typeof CONTRACT_INCLUDE }>>>

async function getSettings() {
  return prisma.contractSettings.findUnique({ where: { id: 1 } })
}

function toPdfData(contract: ContractWithStores, settings: Awaited<ReturnType<typeof getSettings>>): ContractPdfData {
  return {
    id: contract.id,
    createdAt: contract.createdAt,
    clientCompanyName: contract.clientCompanyName,
    clientAddress: contract.clientAddress,
    clientState: contract.clientState,
    clientEmail: contract.clientEmail,
    clientFirstName: contract.clientFirstName,
    clientLastName: contract.clientLastName,
    clientSignature: contract.clientSignature,
    clientSignedAt: contract.clientSignedAt,
    providerFirstName: contract.providerFirstName,
    providerLastName: contract.providerLastName,
    providerSignature: contract.providerSignature,
    providerSignedAt: contract.providerSignedAt,
    servicesScope: contract.servicesScope,
    monthlyFeeCents: contract.monthlyFeeCents,
    startDate: contract.startDate,
    additionalTerms: contract.additionalTerms,
    stores: contract.stores.map(s => ({ name: s.name, address: s.address })),
    settings: settings
      ? {
          providerCompanyName: settings.providerCompanyName,
          providerAddress: settings.providerAddress,
          providerCity: settings.providerCity,
          providerState: settings.providerState,
          providerZip: settings.providerZip,
          providerEmail: settings.providerEmail,
          providerPhone: settings.providerPhone,
          providerTaxId: settings.providerTaxId,
        }
      : null,
  }
}

// Regenerates the contract PDF from the current DB row and persists it —
// called after creation, after the client signs, and after countersigning.
// `final` also writes finalPdfData + a SHA-256 integrity hash; it's kept
// separate from pdfData (the always-current draft/working copy) so the
// pre-signature version stays available even after completion.
export async function regenerateContractPdf(contractId: string, opts: { final: boolean }) {
  const [contract, settings] = await Promise.all([
    prisma.contract.findUniqueOrThrow({ where: { id: contractId }, include: CONTRACT_INCLUDE }),
    getSettings(),
  ])

  const doc = renderContractPdf(toPdfData(contract, settings))
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
  const settings = await getSettings()
  if (!settings?.providerCompanyName?.trim() || !settings?.providerAddress?.trim()) {
    return null
  }
  return settings
}
