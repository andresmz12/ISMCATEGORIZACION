'use client'
import { useEffect, useState, useRef } from 'react'
import { useActiveBiz } from '@/lib/use-active-biz'

interface DocType {
  id: string
  name: string
  description: string | null
  required: boolean
  _count: { documents: number }
}

interface Doc {
  id: string
  filename: string
  mimeType: string
  notes: string | null
  createdAt: string
  documentTypeId: string
  documentTypeName: string
  uploadedBy: string
}

export default function DocumentosPage() {
  const { activeBizId } = useActiveBiz()
  const [docTypes, setDocTypes] = useState<DocType[]>([])
  const [docs, setDocs] = useState<Doc[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'tipos' | 'archivos'>('archivos')

  // Document type form
  const [showTypeModal, setShowTypeModal] = useState(false)
  const [editTypeId, setEditTypeId] = useState<string | null>(null)
  const [typeForm, setTypeForm] = useState({ name: '', description: '', required: false })
  const [typeError, setTypeError] = useState('')
  const [typeSaving, setTypeSaving] = useState(false)

  // Upload modal
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [uploadForm, setUploadForm] = useState({ documentTypeId: '', notes: '' })
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  // Selected doc type filter
  const [filterTypeId, setFilterTypeId] = useState<string>('all')

  async function loadAll() {
    if (!activeBizId) return
    setLoading(true)
    const [t, d] = await Promise.all([
      fetch(`/api/documents/types?businessId=${activeBizId}`).then(r => r.json()),
      fetch(`/api/documents?businessId=${activeBizId}`).then(r => r.json()),
    ])
    setDocTypes(Array.isArray(t) ? t : [])
    setDocs(Array.isArray(d) ? d : [])
    setLoading(false)
  }

  useEffect(() => { loadAll() }, [activeBizId])

  // --- Document Types CRUD ---
  function openNewType() {
    setEditTypeId(null)
    setTypeForm({ name: '', description: '', required: false })
    setTypeError('')
    setShowTypeModal(true)
  }

  function openEditType(dt: DocType) {
    setEditTypeId(dt.id)
    setTypeForm({ name: dt.name, description: dt.description || '', required: dt.required })
    setTypeError('')
    setShowTypeModal(true)
  }

  async function saveType() {
    if (!typeForm.name.trim()) { setTypeError('El nombre es requerido'); return }
    setTypeSaving(true)
    setTypeError('')
    const url = editTypeId ? `/api/documents/types/${editTypeId}` : '/api/documents/types'
    const method = editTypeId ? 'PATCH' : 'POST'
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ businessId: activeBizId, ...typeForm }),
    })
    setTypeSaving(false)
    if (!res.ok) {
      const d = await res.json()
      setTypeError(d.error || 'Error al guardar')
      return
    }
    setShowTypeModal(false)
    loadAll()
  }

  async function deleteType(id: string, name: string, count: number) {
    if (count > 0 && !confirm(`Este tipo tiene ${count} documento(s). ¿Eliminar de todas formas? Los documentos también se eliminarán.`)) return
    if (count === 0 && !confirm(`¿Eliminar el tipo "${name}"?`)) return
    await fetch(`/api/documents/types/${id}`, { method: 'DELETE' })
    loadAll()
  }

  // --- Document Upload ---
  async function upload() {
    if (!uploadFile) { setUploadError('Selecciona un archivo'); return }
    if (!uploadForm.documentTypeId) { setUploadError('Selecciona el tipo de documento'); return }
    setUploading(true)
    setUploadError('')

    const reader = new FileReader()
    reader.onload = async (e) => {
      const base64 = (e.target?.result as string).split(',')[1]
      const res = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId: activeBizId,
          documentTypeId: uploadForm.documentTypeId,
          filename: uploadFile.name,
          data: base64,
          mimeType: uploadFile.type || 'application/octet-stream',
          notes: uploadForm.notes,
        }),
      })
      setUploading(false)
      if (!res.ok) {
        const d = await res.json()
        setUploadError(d.error || 'Error al subir')
        return
      }
      setShowUploadModal(false)
      setUploadFile(null)
      setUploadForm({ documentTypeId: '', notes: '' })
      loadAll()
    }
    reader.readAsDataURL(uploadFile)
  }

  async function downloadDoc(id: string, filename: string) {
    const res = await fetch(`/api/documents/${id}`)
    if (!res.ok) return
    const { data, mimeType } = await res.json()
    const link = document.createElement('a')
    link.href = `data:${mimeType};base64,${data}`
    link.download = filename
    link.click()
  }

  async function deleteDoc(id: string) {
    if (!confirm('¿Eliminar este documento?')) return
    await fetch(`/api/documents/${id}`, { method: 'DELETE' })
    loadAll()
  }

  const filteredDocs = filterTypeId === 'all' ? docs : docs.filter(d => d.documentTypeId === filterTypeId)

  if (!activeBizId) {
    return (
      <div className="card p-10 text-center text-gray-500">
        Selecciona un negocio para ver sus documentos.
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Documentos</h1>
          <p className="text-sm text-gray-500 mt-0.5">Gestiona los documentos del negocio: W-2, 1099, estados de cuenta y más.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setShowUploadModal(true); setUploadError('') }} className="btn-primary">
            + Subir documento
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {(['archivos', 'tipos'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === tab
                ? 'border-[#1B4965] text-[#1B4965]'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab === 'archivos' ? 'Archivos subidos' : 'Tipos de documento'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="card p-8 text-center text-gray-400 text-sm">Cargando...</div>
      ) : activeTab === 'tipos' ? (
        /* --- TIPOS DE DOCUMENTO --- */
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={openNewType} className="btn-secondary text-sm">+ Nuevo tipo</button>
          </div>
          {docTypes.length === 0 ? (
            <div className="card p-10 text-center">
              <div className="text-4xl mb-3">📁</div>
              <p className="text-gray-600 font-medium">Sin tipos de documento</p>
              <p className="text-sm text-gray-400 mt-1">Crea tipos como "W-2", "1099", "Estado de cuenta", etc.</p>
              <button onClick={openNewType} className="btn-primary mt-5">+ Crear primer tipo</button>
            </div>
          ) : (
            <div className="card overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Nombre</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase hidden sm:table-cell">Descripción</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Requerido</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Archivos</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {docTypes.map(dt => (
                    <tr key={dt.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-800">{dt.name}</td>
                      <td className="px-4 py-3 text-gray-500 hidden sm:table-cell">{dt.description || '—'}</td>
                      <td className="px-4 py-3 text-center">
                        {dt.required
                          ? <span className="text-xs font-medium bg-red-50 text-red-600 px-2 py-0.5 rounded-full">Sí</span>
                          : <span className="text-xs text-gray-400">No</span>}
                      </td>
                      <td className="px-4 py-3 text-center text-gray-600">{dt._count.documents}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-3">
                          <button onClick={() => openEditType(dt)} className="text-xs text-[#1B4965] hover:underline font-medium">Editar</button>
                          <button onClick={() => deleteType(dt.id, dt.name, dt._count.documents)} className="text-xs text-red-500 hover:text-red-700 font-medium">Eliminar</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        /* --- ARCHIVOS SUBIDOS --- */
        <div className="space-y-4">
          {/* Filter by type */}
          {docTypes.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setFilterTypeId('all')}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${filterTypeId === 'all' ? 'bg-[#1B4965] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                Todos ({docs.length})
              </button>
              {docTypes.map(dt => (
                <button
                  key={dt.id}
                  onClick={() => setFilterTypeId(dt.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${filterTypeId === dt.id ? 'bg-[#1B4965] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                >
                  {dt.name} ({dt._count.documents})
                  {dt.required && dt._count.documents === 0 && <span className="ml-1 text-red-400">!</span>}
                </button>
              ))}
            </div>
          )}

          {filteredDocs.length === 0 ? (
            <div className="card p-10 text-center">
              <div className="text-4xl mb-3">📄</div>
              <p className="text-gray-600 font-medium">Sin documentos</p>
              <p className="text-sm text-gray-400 mt-1">Sube el primer documento con el botón de arriba.</p>
            </div>
          ) : (
            <div className="card overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Archivo</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Tipo</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase hidden sm:table-cell">Subido por</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase hidden md:table-cell">Fecha</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredDocs.map(doc => (
                    <tr key={doc.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{getFileEmoji(doc.mimeType)}</span>
                          <span className="font-medium text-gray-800 truncate max-w-[180px]">{doc.filename}</span>
                        </div>
                        {doc.notes && <p className="text-xs text-gray-400 mt-0.5 pl-7">{doc.notes}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium">{doc.documentTypeName}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 hidden sm:table-cell">{doc.uploadedBy}</td>
                      <td className="px-4 py-3 text-gray-400 text-xs hidden md:table-cell">
                        {new Date(doc.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-3">
                          <button onClick={() => downloadDoc(doc.id, doc.filename)} className="text-xs text-[#1B4965] hover:underline font-medium">Descargar</button>
                          <button onClick={() => deleteDoc(doc.id)} className="text-xs text-red-500 hover:text-red-700 font-medium">Eliminar</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Document Type Modal */}
      {showTypeModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4">{editTypeId ? 'Editar tipo' : 'Nuevo tipo de documento'}</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Nombre *</label>
                <input className="input w-full" placeholder="Nombre del tipo de documento" value={typeForm.name} onChange={e => setTypeForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Descripción (opcional)</label>
                <input className="input w-full" placeholder="Descripción del documento (opcional)" value={typeForm.description} onChange={e => setTypeForm(f => ({ ...f, description: e.target.value }))} />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={typeForm.required} onChange={e => setTypeForm(f => ({ ...f, required: e.target.checked }))} className="rounded" />
                <span className="text-sm text-gray-700">Documento requerido</span>
              </label>
              {typeError && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{typeError}</p>}
            </div>
            <div className="flex gap-2 mt-5 justify-end">
              <button onClick={() => setShowTypeModal(false)} className="btn-secondary">Cancelar</button>
              <button onClick={saveType} disabled={typeSaving} className="btn-primary disabled:opacity-50">
                {typeSaving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Subir documento</h3>
            {docTypes.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-gray-500 text-sm">Primero crea al menos un tipo de documento.</p>
                <button onClick={() => { setShowUploadModal(false); setActiveTab('tipos'); openNewType() }} className="btn-primary mt-4">
                  Crear tipo de documento
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Tipo de documento *</label>
                  <select className="input w-full" value={uploadForm.documentTypeId} onChange={e => setUploadForm(f => ({ ...f, documentTypeId: e.target.value }))}>
                    <option value="">Seleccionar...</option>
                    {docTypes.map(dt => <option key={dt.id} value={dt.id}>{dt.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Archivo *</label>
                  <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx,.csv" className="block w-full text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-[#1B4965] file:text-white hover:file:bg-[#163d52] cursor-pointer"
                    onChange={e => setUploadFile(e.target.files?.[0] || null)} />
                  <p className="text-xs text-gray-400 mt-1">PDF, imágenes, Word, Excel — máx. 10 MB</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Notas (opcional)</label>
                  <input className="input w-full" placeholder="Notas adicionales (opcional)" value={uploadForm.notes} onChange={e => setUploadForm(f => ({ ...f, notes: e.target.value }))} />
                </div>
                {uploadError && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{uploadError}</p>}
              </div>
            )}
            {docTypes.length > 0 && (
              <div className="flex gap-2 mt-5 justify-end">
                <button onClick={() => { setShowUploadModal(false); setUploadFile(null) }} className="btn-secondary">Cancelar</button>
                <button onClick={upload} disabled={uploading} className="btn-primary disabled:opacity-50">
                  {uploading ? 'Subiendo...' : 'Subir'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function getFileEmoji(mime: string) {
  if (mime.includes('pdf')) return '📕'
  if (mime.includes('image')) return '🖼️'
  if (mime.includes('word') || mime.includes('document')) return '📝'
  if (mime.includes('excel') || mime.includes('spreadsheet') || mime.includes('csv')) return '📊'
  return '📄'
}
