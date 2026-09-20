export type MeasurementUnit = 'mm' | 'cm' | 'm' | 'mg' | 'g' | 'kg' | 'ml' | 'L' | 'un'

type UnitDefinition = { family: 'length' | 'weight' | 'volume' | 'count'; factor: number; label: string }

export const units: Record<MeasurementUnit, UnitDefinition> = {
  mm: { family: 'length', factor: 0.001, label: 'Milímetro (mm)' },
  cm: { family: 'length', factor: 0.01, label: 'Centímetro (cm)' },
  m: { family: 'length', factor: 1, label: 'Metro (m)' },
  mg: { family: 'weight', factor: 0.001, label: 'Miligrama (mg)' },
  g: { family: 'weight', factor: 1, label: 'Grama (g)' },
  kg: { family: 'weight', factor: 1000, label: 'Quilograma (kg)' },
  ml: { family: 'volume', factor: 0.001, label: 'Mililitro (ml)' },
  L: { family: 'volume', factor: 1, label: 'Litro (L)' },
  un: { family: 'count', factor: 1, label: 'Unidade (un)' },
}

export function areCompatibleUnits(source: MeasurementUnit, target: MeasurementUnit) {
  return units[source].family === units[target].family
}

export function convertQuantity(quantity: number, source: MeasurementUnit, target: MeasurementUnit) {
  if (!areCompatibleUnits(source, target)) return null
  return quantity * units[source].factor / units[target].factor
}

export function materialUsageCost(quantity: number, usageUnit: MeasurementUnit, pricePerUnit: number, priceUnit: MeasurementUnit) {
  const converted = convertQuantity(quantity, usageUnit, priceUnit)
  return converted === null ? null : Math.max(0, converted) * Math.max(0, pricePerUnit)
}