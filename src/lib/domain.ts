export const orderStatuses = ['quoted', 'approved', 'in_production', 'delivered', 'cancelled'] as const
export type OrderStatus = (typeof orderStatuses)[number]
export type MaterialCost = { quantity: number; unitCost: number }

export const statusLabels: Record<OrderStatus, string> = {
  quoted: 'Orçamento',
  approved: 'Aprovado',
  in_production: 'Em produção',
  delivered: 'Entregue',
  cancelled: 'Cancelado',
}

const transitions: Partial<Record<OrderStatus, OrderStatus>> = {
  quoted: 'approved',
  approved: 'in_production',
  in_production: 'delivered',
}

export function nextOrderStatus(status: OrderStatus): OrderStatus | null {
  return transitions[status] ?? null
}

export function calculateOrderTotal(items: Array<{ quantity: number; unitPrice: number }>, discount = 0) {
  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)
  return Math.max(0, subtotal - discount)
}

export function calculateMaterialCost(materials: MaterialCost[]) {
  return materials.reduce((sum, material) => sum + Math.max(0, material.quantity) * Math.max(0, material.unitCost), 0)
}

export function calculateSuggestedPrice(productionCost: number, markupPercentage: number) {
  return Math.max(0, productionCost) * (1 + Math.max(0, markupPercentage) / 100)
}

export const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

export function usernameToAuthEmail(username: string) {
  const normalized = username.trim().toLowerCase()
  if (!/^[a-z0-9][a-z0-9._-]{2,31}$/.test(normalized)) return null
  return `${normalized}@users.example.com`
}
