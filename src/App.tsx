import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import * as pdfjsLib from 'pdfjs-dist'
import { AlignLeft, FileDown, FileUp, MousePointer2, Plus, Printer, Settings2, Trash2 } from 'lucide-react'

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()

type OverlayField = {
  id: string
  label: string
  value: string
  x: number
  y: number
  fontSize: number
  width: number
}

const newField = (x = 0.12, y = 0.16): OverlayField => ({
  id: crypto.randomUUID(), label: 'Novo campo', value: '', x, y, fontSize: 11, width: 28,
})

export default function App() {
  const [templateFile, setTemplateFile] = useState<File | null>(null)
  const [templateKind, setTemplateKind] = useState<'pdf' | 'image' | null>(null)
  const [imageUrl, setImageUrl] = useState('')
  const [fields, setFields] = useState<OverlayField[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [pageSize, setPageSize] = useState({ width: 595.28, height: 841.89 })
  const [renderScale, setRenderScale] = useState(1)
  const [busy, setBusy] = useState(false)
  const [outputMode, setOutputMode] = useState<'overlay' | 'proof'>('overlay')
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const pageRef = useRef<HTMLDivElement>(null)
  const selected = fields.find((field) => field.id === selectedId) ?? null

  const selectedIndex = useMemo(() => fields.findIndex((field) => field.id === selectedId), [fields, selectedId])

  useEffect(() => {
    if (!templateFile || templateKind !== 'pdf' || !canvasRef.current) return
    let cancelled = false
    const render = async () => {
      const data = await templateFile.arrayBuffer()
      const pdf = await pdfjsLib.getDocument({ data }).promise
      const page = await pdf.getPage(1)
      const base = page.getViewport({ scale: 1 })
      const maxWidth = 760
      const scale = Math.min(maxWidth / base.width, 1.25)
      const viewport = page.getViewport({ scale })
      if (cancelled || !canvasRef.current) return
      setPageSize({ width: base.width, height: base.height })
      setRenderScale(scale)
      const canvas = canvasRef.current
      const context = canvas.getContext('2d')
      if (!context) return
      canvas.width = viewport.width
      canvas.height = viewport.height
      await page.render({ canvas, canvasContext: context, viewport }).promise
    }
    render().catch((error) => console.error('Falha ao renderizar o PDF:', error))
    return () => { cancelled = true }
  }, [templateFile, templateKind])

  useEffect(() => {
    if (!templateFile || templateKind !== 'image' || !imageUrl) return
    const image = new Image()
    image.onload = () => setPageSize({ width: image.naturalWidth, height: image.naturalHeight })
    image.src = imageUrl
  }, [templateFile, templateKind, imageUrl])

  const handleTemplate = async (file?: File) => {
    if (!file) return
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
    const isImage = file.type.startsWith('image/')
    if (!isPdf && !isImage) {
      alert('Selecione um arquivo PDF, PNG ou JPG.')
      return
    }
    if (imageUrl) URL.revokeObjectURL(imageUrl)
    setTemplateFile(file)
    setTemplateKind(isPdf ? 'pdf' : 'image')
    setImageUrl(isImage ? URL.createObjectURL(file) : '')
    setFields([])
    setSelectedId(null)
  }

  const addFieldAt = (event: MouseEvent<HTMLDivElement>) => {
    if (!pageRef.current || !templateFile) return
    const bounds = pageRef.current.getBoundingClientRect()
    const x = Math.max(0, Math.min(0.96, (event.clientX - bounds.left) / bounds.width))
    const y = Math.max(0, Math.min(0.98, (event.clientY - bounds.top) / bounds.height))
    const field = newField(x, y)
    setFields((current) => [...current, field])
    setSelectedId(field.id)
  }

  const updateField = (id: string, patch: Partial<OverlayField>) => {
    setFields((current) => current.map((field) => field.id === id ? { ...field, ...patch } : field))
  }

  const generateOverlay = async () => {
    if (!templateFile || !templateKind) return
    setBusy(true)
    try {
      const sourceBytes = await templateFile.arrayBuffer()
      let pdf: PDFDocument
      if (templateKind === 'pdf') {
        if (outputMode === 'proof') {
          pdf = await PDFDocument.load(sourceBytes)
        } else {
          const source = await PDFDocument.load(sourceBytes)
          const firstPage = source.getPages()[0]
          const { width, height } = firstPage.getSize()
          pdf = await PDFDocument.create()
          pdf.addPage([width, height])
        }
      } else {
        pdf = await PDFDocument.create()
        const image = templateFile.type === 'image/png'
          ? await pdf.embedPng(sourceBytes)
          : await pdf.embedJpg(sourceBytes)
        const page = pdf.addPage([image.width, image.height])
        if (outputMode === 'proof') {
          page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height })
        }
      }

      const page = pdf.getPages()[0]
      const { width, height } = page.getSize()
      const font = await pdf.embedFont(StandardFonts.Helvetica)
      for (const field of fields) {
        const value = field.value.trim()
        if (!value) continue
        page.drawText(value, {
          x: field.x * width,
          y: height - field.y * height - field.fontSize,
          size: field.fontSize,
          font,
          color: rgb(0.05, 0.07, 0.1),
          maxWidth: (field.width / 100) * width,
        })
      }

      const output = await pdf.save()
      const blob = new Blob([output], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `${templateFile.name.replace(/\\.[^.]+$/, '')}-${outputMode === 'overlay' ? 'overlay-transparente' : 'prova-completa'}.pdf`
      anchor.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (error) {
      console.error(error)
      alert('Não foi possível gerar o PDF. Verifique o arquivo e tente novamente.')
    } finally {
      setBusy(false)
    }
  }

  const removeSelected = () => {
    if (!selectedId) return
    setFields((current) => current.filter((field) => field.id !== selectedId))
    setSelectedId(null)
  }

  const pageStyle = templateKind === 'pdf'
    ? { width: '100%', aspectRatio: `${pageSize.width} / ${pageSize.height}` }
    : { width: '100%', aspectRatio: `${pageSize.width} / ${pageSize.height}` }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand"><div className="brand-mark">OP</div><div><strong>Overlay Printing</strong><span>Preenchimento e impressão de fichas</span></div></div>
        <div className="top-actions">
          <label className="button secondary"><FileUp size={16} /> Abrir ficha<input type="file" accept="application/pdf,image/png,image/jpeg" hidden onChange={(event) => handleTemplate(event.target.files?.[0])} /></label>
          <button className="button primary" onClick={generateOverlay} disabled={!templateFile || busy}><FileDown size={16} /> {busy ? 'Gerando...' : 'Baixar PDF'}</button>
        </div>
      </header>

      <section className="workspace">
        <aside className="sidebar">
          <div className="section-heading"><div><span className="eyebrow">CONFIGURAÇÃO</span><h2>Campos da ficha</h2></div><Settings2 size={19} /></div>
          <p className="hint">Abra uma ficha em PDF ou imagem. Depois, clique no documento para posicionar cada campo.</p>
          {!templateFile ? (
            <label className="upload-card"><FileUp size={25} /><strong>Carregar documento-base</strong><span>PDF, PNG ou JPG</span><input type="file" accept="application/pdf,image/png,image/jpeg" hidden onChange={(event) => handleTemplate(event.target.files?.[0])} /></label>
          ) : (
            <>
              <div className="file-chip"><span className="file-icon">PDF</span><div><strong>{templateFile.name}</strong><small>{(templateFile.size / 1024).toFixed(0)} KB · primeira página</small></div></div>
              <button className="button add-button" onClick={() => { const field = newField(); setFields((current) => [...current, field]); setSelectedId(field.id) }}><Plus size={16} /> Adicionar campo</button>
              <div className="field-list">
                {fields.map((field, index) => <button key={field.id} className={field.id === selectedId ? 'field-row active' : 'field-row'} onClick={() => setSelectedId(field.id)}><span className="field-number">{String(index + 1).padStart(2, '0')}</span><span><strong>{field.label || 'Campo sem nome'}</strong><small>{field.value || 'Sem valor preenchido'}</small></span></button>)}
                {fields.length === 0 && <div className="empty-fields"><MousePointer2 size={18} /><span>Nenhum campo ainda. Clique na ficha para posicionar o primeiro.</span></div>}
              </div>
            </>
          )}
          <div className="sidebar-foot"><span className="status-dot" /> Processamento local no navegador</div>
        </aside>

        <section className="canvas-area">
          <div className="canvas-toolbar"><div><span className="eyebrow">ÁREA DE TRABALHO</span><h1>Editor de sobreposição</h1></div><span className="page-label">{templateFile ? 'Página 1' : 'Aguardando documento'}</span></div>
          {!templateFile ? (
            <div className="blank-state"><div className="blank-icon"><AlignLeft size={34} /></div><h2>Sua ficha começa aqui</h2><p>Carregue o formulário original para começar a posicionar os dados que serão impressos.</p><label className="button primary"><FileUp size={16} /> Selecionar ficha<input type="file" accept="application/pdf,image/png,image/jpeg" hidden onChange={(event) => handleTemplate(event.target.files?.[0])} /></label></div>
          ) : (
            <div className="paper-stage">
              <div className="paper" ref={pageRef} style={pageStyle} onClick={addFieldAt}>
                {templateKind === 'pdf' ? <canvas ref={canvasRef} className="template-canvas" /> : <img src={imageUrl} className="template-image" alt="Ficha base" />}
                {fields.map((field) => <div key={field.id} className={field.id === selectedId ? 'overlay-field selected' : 'overlay-field'} style={{ left: `${field.x * 100}%`, top: `${field.y * 100}%`, fontSize: `${Math.max(8, field.fontSize * renderScale)}px`, maxWidth: `${field.width}%` }} onClick={(event) => { event.stopPropagation(); setSelectedId(field.id) }}>{field.value || field.label}</div>)}
              </div>
              <p className="canvas-tip"><MousePointer2 size={14} /> Clique em qualquer ponto da ficha para adicionar um campo. Arraste os campos para ajustar a posição.</p>
            </div>
          )}
        </section>

        <aside className="properties">
          <div className="section-heading"><div><span className="eyebrow">PROPRIEDADES</span><h2>Dados do campo</h2></div></div>
          {selected ? (
            <div className="property-form">
              <label>Identificação<input value={selected.label} onChange={(event) => updateField(selected.id, { label: event.target.value })} placeholder="Ex.: Nome completo" /></label>
              <label>Conteúdo a imprimir<textarea rows={3} value={selected.value} onChange={(event) => updateField(selected.id, { value: event.target.value })} placeholder="Digite o dado que será impresso..." /></label>
              <label>Tamanho da fonte <b>{selected.fontSize} pt</b><input type="range" min="6" max="24" value={selected.fontSize} onChange={(event) => updateField(selected.id, { fontSize: Number(event.target.value) })} /></label>
              <label>Largura máxima <b>{selected.width}%</b><input type="range" min="5" max="100" value={selected.width} onChange={(event) => updateField(selected.id, { width: Number(event.target.value) })} /></label>
              <div className="coordinate-grid"><div><small>POSIÇÃO X</small><strong>{(selected.x * 100).toFixed(1)}%</strong></div><div><small>POSIÇÃO Y</small><strong>{(selected.y * 100).toFixed(1)}%</strong></div></div>
              <button className="delete-button" onClick={removeSelected}><Trash2 size={15} /> Remover campo</button>
              <small className="selection-note">Campo {selectedIndex + 1} de {fields.length}</small>
            </div>
          ) : (
            <div className="properties-empty"><MousePointer2 size={22} /><strong>Nenhum campo selecionado</strong><span>Selecione um campo na ficha ou na lista para editar seu conteúdo e aparência.</span></div>
          )}
          <div className="print-card"><Printer size={18} /><strong>Modo de saída</strong><p>Para papel já pré-impresso, escolha somente os dados. Para testar o alinhamento na tela, gere a prova completa.</p><div className="mode-switch"><button className={outputMode === 'overlay' ? 'mode-option active' : 'mode-option'} onClick={() => setOutputMode('overlay')}>Só dados</button><button className={outputMode === 'proof' ? 'mode-option active' : 'mode-option'} onClick={() => setOutputMode('proof')}>Prova completa</button></div><button className="button dark" onClick={generateOverlay} disabled={!templateFile || busy}><Printer size={15} /> {busy ? 'Gerando...' : 'Gerar PDF para impressão'}</button></div>
        </aside>
      </section>
      <footer className="footer"><span>OVERLAY PRINTING <b>·</b> MVP 0.2</span><span>Os arquivos permanecem no seu dispositivo.</span></footer>
    </main>
  )
}