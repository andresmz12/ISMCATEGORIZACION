'use client'
import { useEffect, useState } from 'react'
import { SignatureCanvas } from '@/components/SignatureCanvas'

interface ContractPublicData {
  id: string
  status: 'SENT' | 'CLIENT_SIGNED' | 'COMPLETED'
  clientCompanyName: string | null
  clientAddress: string | null
  clientState: string | null
  clientEmail: string | null
  monthlyFeeCents: number | null
  paymentDueDay: number | null
  clientSignedAt: string | null
  providerCompanyName: string | null
}

export default function SignContractPage({ params }: { params: { token: string } }) {
  const [contract, setContract] = useState<ContractPublicData | null>(null)
  const [loadError, setLoadError] = useState('')
  const [loading, setLoading] = useState(true)

  const [companyName, setCompanyName] = useState('')
  const [address, setAddress] = useState('')
  const [state, setState] = useState('')
  const [email, setEmail] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [signature, setSignature] = useState<string | null>(null)
  const [consent, setConsent] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [done, setDone] = useState(false)

  useEffect(() => {
    fetch(`/api/contracts/sign/${params.token}`)
      .then(async res => {
        if (!res.ok) throw new Error((await res.json()).error || 'No se pudo cargar el contrato')
        return res.json()
      })
      .then((data: ContractPublicData) => {
        setContract(data)
        setCompanyName(data.clientCompanyName || '')
        setAddress(data.clientAddress || '')
        setState(data.clientState || '')
        setEmail(data.clientEmail || '')
      })
      .catch(e => setLoadError(e.message))
      .finally(() => setLoading(false))
  }, [params.token])

  async function handleSubmit() {
    if (!consent || !firstName.trim() || !lastName.trim() || !signature) return
    setSubmitting(true)
    setSubmitError('')
    try {
      const res = await fetch(`/api/contracts/sign/${params.token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName,
          lastName,
          signatureBase64: signature,
          consent,
          clientCompanyName: companyName,
          clientAddress: address,
          clientState: state,
          clientEmail: email,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'No se pudo enviar la firma')
      setDone(true)
    } catch (e: any) {
      setSubmitError(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-gray-400 text-sm">Cargando...</div>
  }

  if (loadError || !contract) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="card p-8 max-w-sm text-center">
          <p className="text-red-600 font-medium">{loadError || 'Enlace inválido'}</p>
        </div>
      </div>
    )
  }

  const alreadySigned = contract.status !== 'SENT' || done

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <p className="font-bold text-[#1B4965]">{contract.providerCompanyName || 'Contrato de servicios'}</p>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10 space-y-6">
        {alreadySigned ? (
          <div className="card p-8 text-center space-y-3">
            <p className="text-2xl">✓</p>
            <p className="font-semibold text-gray-900">
              {done ? 'Firma registrada correctamente' : 'Este contrato ya fue firmado'}
            </p>
            <p className="text-sm text-gray-500">
              {contract.status === 'COMPLETED'
                ? 'El contrato quedó completado por ambas partes. Revisa tu correo para la copia final.'
                : 'Estamos a la espera de la contrafirma del proveedor. Te avisaremos por correo cuando el contrato quede completo.'}
            </p>
            <a href={`/api/contracts/sign/${params.token}/pdf`} target="_blank" rel="noreferrer" className="btn-secondary inline-flex mt-2">
              Ver PDF
            </a>
          </div>
        ) : (
          <>
            <div className="card p-0 overflow-hidden">
              <iframe src={`/api/contracts/sign/${params.token}/pdf`} className="w-full" style={{ height: 500 }} title="Contrato" />
            </div>

            <div className="card p-6 space-y-4">
              <h2 className="section-title">Datos del cliente</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Empresa</label>
                  <input className="input" value={companyName} onChange={e => setCompanyName(e.target.value)} disabled={!!contract.clientCompanyName} />
                </div>
                <div>
                  <label className="label">Estado</label>
                  <input className="input" value={state} onChange={e => setState(e.target.value)} disabled={!!contract.clientState} />
                </div>
                <div className="col-span-2">
                  <label className="label">Dirección</label>
                  <input className="input" value={address} onChange={e => setAddress(e.target.value)} disabled={!!contract.clientAddress} />
                </div>
                <div className="col-span-2">
                  <label className="label">Email</label>
                  <input type="email" className="input" value={email} onChange={e => setEmail(e.target.value)} disabled={!!contract.clientEmail} />
                </div>
              </div>
            </div>

            <div className="card p-6 space-y-4">
              <h2 className="section-title">Firma</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Nombre</label>
                  <input className="input" value={firstName} onChange={e => setFirstName(e.target.value)} />
                </div>
                <div>
                  <label className="label">Apellido</label>
                  <input className="input" value={lastName} onChange={e => setLastName(e.target.value)} />
                </div>
              </div>

              <SignatureCanvas onSignatureChange={setSignature} />

              <label className="flex items-start gap-2 text-sm text-gray-600">
                <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} className="mt-0.5" />
                Acepto los términos de este contrato y consiento en firmarlo electrónicamente.
              </label>

              {submitError && <p className="text-sm text-red-600">{submitError}</p>}

              <button
                className="btn-primary w-full"
                disabled={submitting || !consent || !firstName.trim() || !lastName.trim() || !signature}
                onClick={handleSubmit}
              >
                {submitting ? 'Enviando...' : 'Firmar contrato'}
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
