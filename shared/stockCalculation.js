

export const MESSAGES = {
  INVALID_COUNT: 'Enter a whole number of 0 or more.',
  INVALID_PACK: 'Units per box must be a whole number of at least 1.',
  INVALID_PRICE: 'Selling price must be a valid amount of 0 or more.',
  INVALID_ADJUSTMENT: 'Stock adjustment bottles must be a whole number.',
  NEGATIVE_STOCK: 'Stock cannot be negative.',
  CLOSING_EXCEEDS_AVAILABLE:
    'Closing stock is higher than available stock. Record an authorized stock adjustment before saving.',
  NEGATIVE_SALES: 'Calculated sales cannot be negative.',
  OPENING_VARIANCE: 'Opening stock does not match the previous closing stock plus later adjustments.',
  HIGH_SALES: 'Sales look unusually high. Please confirm the counts.',
};

const COUNT_FIELDS = [
  'openingBoxes',
  'openingLoose',
  'receivedBoxes',
  'receivedLoose',
  'closingBoxes',
  'closingLoose',
];

export function roundMoney(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.round((number + Number.EPSILON) * 100) / 100;
}

export function isMoney(value) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1_000_000) return false;
  return Math.abs(value * 100 - Math.round(value * 100)) < 1e-6;
}

export function isWholeCount(value) {
  return Number.isInteger(value) && value >= 0 && value <= 1_000_000;
}

export function calculateStock({
  openingBoxes,
  openingLoose,
  receivedBoxes,
  receivedLoose,
  closingBoxes,
  closingLoose,
  unitsPerBox,
  adjustmentBottles = 0,
  sellingPrice,
}) {
  const openingTotal = openingBoxes * unitsPerBox + openingLoose;
  const receivedTotal = receivedBoxes * unitsPerBox + receivedLoose;
  const closingTotal = closingBoxes * unitsPerBox + closingLoose;
  const available = openingTotal + receivedTotal + adjustmentBottles;
  const soldBottles = available - closingTotal;
  const salesRevenue = roundMoney(soldBottles * sellingPrice);
  return {
    openingTotal,
    receivedTotal,
    closingTotal,
    adjustmentBottles,
    available,
    soldBottles,
    salesRevenue,
  };
}

export function evaluateStock(input) {
  const errors = [];
  const warnings = [];

  for (const field of COUNT_FIELDS) {
    if (!isWholeCount(input[field])) {
      errors.push({ code: 'INVALID_COUNT', field, message: MESSAGES.INVALID_COUNT });
    }
  }
  if (!Number.isInteger(input.unitsPerBox) || input.unitsPerBox < 1 || input.unitsPerBox > 10000) {
    errors.push({ code: 'INVALID_PACK', field: 'unitsPerBox', message: MESSAGES.INVALID_PACK });
  }
  if (!isMoney(input.sellingPrice)) {
    errors.push({ code: 'INVALID_PRICE', field: 'sellingPrice', message: MESSAGES.INVALID_PRICE });
  }
  if (!Number.isInteger(input.adjustmentBottles || 0)) {
    errors.push({ code: 'INVALID_ADJUSTMENT', field: 'adjustmentBottles', message: MESSAGES.INVALID_ADJUSTMENT });
  }

  if (errors.length) {
    return { valid: false, errors, warnings };
  }

  const calc = calculateStock({ ...input, adjustmentBottles: input.adjustmentBottles || 0 });

  if (calc.available < 0 || calc.closingTotal < 0) {
    errors.push({ code: 'NEGATIVE_STOCK', message: MESSAGES.NEGATIVE_STOCK });
  }
  if (calc.closingTotal > calc.available) {
    errors.push({
      code: 'CLOSING_EXCEEDS_AVAILABLE',
      message: MESSAGES.CLOSING_EXCEEDS_AVAILABLE,
      available: calc.available,
      closing: calc.closingTotal,
    });
  }
  if (calc.soldBottles < 0) {
    errors.push({ code: 'NEGATIVE_SALES', message: MESSAGES.NEGATIVE_SALES });
  }

  const hasExpected = input.expectedOpeningBoxes != null && input.expectedOpeningLoose != null;
  if (hasExpected && (input.expectedOpeningBoxes !== input.openingBoxes || input.expectedOpeningLoose !== input.openingLoose)) {
    warnings.push({ code: 'OPENING_VARIANCE', message: MESSAGES.OPENING_VARIANCE });
  }
  if (errors.length === 0 && calc.soldBottles > input.unitsPerBox * 30) {
    warnings.push({ code: 'HIGH_SALES', message: MESSAGES.HIGH_SALES });
  }

  return { ...calc, valid: errors.length === 0, errors, warnings };
}

/** Keep the price and pack size that were saved with a day. Item-master edits must not flow into old days. */
export function resolveSnapshot(existing, item) {
  if (existing) {
    return { unitsPerBox: existing.unitsPerBox, sellingPrice: existing.sellingPrice };
  }
  return { unitsPerBox: item.unitsPerBox, sellingPrice: item.sellingPrice };
}

export function salesRevenueFromSnapshot(soldBottles, sellingPrice) {
  return roundMoney(soldBottles * sellingPrice);
}
