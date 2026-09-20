import { calculateOrderTotal, money } from './domain'

export type QuotePdfItem = { name: string; quantity: number; unitPrice: number }
export type QuotePdfImage = { name: string; caption?: string; blob: Blob }

export type QuotePdfInput = {
  businessName: string
  businessPhone?: string | null
  customerName: string
  customerPhone?: string | null
  customerEmail?: string | null
  number: string
  issuedOn: string
  validUntil?: string | null
  promisedFor?: string | null
  paymentTerms?: string | null
  notes?: string | null
  discountAmount?: number
  items: QuotePdfItem[]
  images: QuotePdfImage[]
}

function date(value?: string | null) {
  return value ? new Date(`${value}T12:00:00`).toLocaleDateString('pt-BR') : 'Não informado'
}

function dataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

export async function downloadQuotePdf(input: QuotePdfInput) {
  const { jsPDF } = await import('jspdf')
  const document = new jsPDF({ unit: 'mm', format: 'a4' })
  const width = document.internal.pageSize.getWidth()
  const height = document.internal.pageSize.getHeight()
  let cursor = 20
  const ensureSpace = (space: number) => {
    if (cursor + space > height - 20) { document.addPage(); cursor = 20 }
  }
  const text = (value: string, size = 10, color: [number, number, number] = [66, 56, 52]) => {
    document.setFontSize(size); document.setTextColor(...color)
    const lines = document.splitTextToSize(value, width - 40)
    ensureSpace(lines.length * 5 + 2)
    document.text(lines, 20, cursor)
    cursor += lines.length * 5 + 3
  }

  document.setFillColor(131, 77, 67)
  document.rect(0, 0, width, 36, 'F')
  document.setTextColor(255, 255, 255)
  document.setFontSize(22); document.text(input.businessName || 'Linha & Laço', 20, 17)
  document.setFontSize(10); document.text('ORÇAMENTO', 20, 26)
  document.text(input.number, width - 20, 26, { align: 'right' })
  cursor = 47

  document.setTextColor(131, 77, 67); document.setFontSize(11); document.text('CLIENTE', 20, cursor); cursor += 6
  text(input.customerName, 12)
  text([input.customerPhone, input.customerEmail].filter(Boolean).join(' · ') || 'Contato não informado')
  cursor += 3

  document.setTextColor(131, 77, 67); document.setFontSize(11); document.text('DETALHES', 20, cursor); cursor += 6
  text(`Emissão: ${date(input.issuedOn)}   |   Validade: ${date(input.validUntil)}   |   Entrega prevista: ${date(input.promisedFor)}`)
  if (input.businessPhone) text(`Contato do ateliê: ${input.businessPhone}`)
  cursor += 4

  document.setFillColor(245, 235, 230); document.rect(20, cursor, width - 40, 8, 'F')
  document.setTextColor(88, 65, 58); document.setFontSize(9)
  document.text('ITEM', 22, cursor + 5.3); document.text('QTD.', width - 75, cursor + 5.3); document.text('VALOR', width - 22, cursor + 5.3, { align: 'right' }); cursor += 12
  input.items.forEach((item) => {
    ensureSpace(8); document.setTextColor(66, 56, 52); document.setFontSize(10)
    document.text(item.name, 22, cursor); document.text(String(item.quantity), width - 75, cursor)
    document.text(money.format(item.quantity * item.unitPrice), width - 22, cursor, { align: 'right' }); cursor += 7
  })
  const total = calculateOrderTotal(input.items.map((item) => ({ quantity: item.quantity, unitPrice: item.unitPrice })), input.discountAmount ?? 0)
  if ((input.discountAmount ?? 0) > 0) text(`Desconto: ${money.format(input.discountAmount ?? 0)}`, 10)
  document.setDrawColor(210, 189, 180); document.line(20, cursor, width - 20, cursor); cursor += 8
  document.setFontSize(14); document.setTextColor(131, 77, 67); document.text(`Total: ${money.format(total)}`, width - 20, cursor, { align: 'right' }); cursor += 13

  if (input.paymentTerms) { document.setTextColor(131, 77, 67); document.setFontSize(11); document.text('CONDIÇÕES DE PAGAMENTO', 20, cursor); cursor += 6; text(input.paymentTerms) }
  if (input.notes) { document.setTextColor(131, 77, 67); document.setFontSize(11); document.text('OBSERVAÇÕES', 20, cursor); cursor += 6; text(input.notes) }

  for (const image of input.images) {
    const source = await dataUrl(image.blob)
    ensureSpace(90)
    document.setTextColor(131, 77, 67); document.setFontSize(11); document.text('REFERÊNCIA VISUAL', 20, cursor); cursor += 6
    const properties = document.getImageProperties(source)
    const ratio = properties.width / properties.height
    const imageWidth = width - 40
    const imageHeight = Math.min(82, imageWidth / ratio)
    document.addImage(source, 'JPEG', 20, cursor, imageWidth, imageHeight)
    cursor += imageHeight + 5
    if (image.caption) text(image.caption, 9)
  }

  document.setFontSize(8); document.setTextColor(130, 120, 115)
  document.text('Linha & Laço · orçamento gerado digitalmente', width / 2, height - 10, { align: 'center' })
  document.save(`orcamento-${input.number.toLowerCase()}.pdf`)
}