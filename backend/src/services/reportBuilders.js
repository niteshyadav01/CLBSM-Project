import { roundMoney } from '../../../shared/stockCalculation.js';
import { formatDisplayDate } from '../utils/dates.js';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function buildStockQuery({ from, to, itemId } = {}) {
  const query = {};
  if (from || to) {
    query.date = {};
    if (from) query.date.$gte = from;
    if (to) query.date.$lte = to;
  }
  if (itemId) query.item = itemId;
  return query;
}

export function matchesFilters(row, { from, to, itemId } = {}) {
  if (from && row.date < from) return false;
  if (to && row.date > to) return false;
  if (itemId && String(row.itemId || row.item) !== String(itemId)) return false;
  return true;
}

export function mapStock(record) {
  const item = record.item && typeof record.item === 'object' ? record.item : null;
  return {
    date: record.date,
    itemId: String(item?._id || record.itemId || record.item),
    itemName: item?.name || record.itemName,
    category: item?.category || record.category,
    size: item?.size || record.size,
    unitsPerBox: record.unitsPerBox,
    sellingPrice: record.sellingPrice,
    salesRevenue: record.salesRevenue,
    soldBottles: record.soldBottles,
    openingBoxes: record.openingBoxes,
    openingLoose: record.openingLoose,
    receivedBoxes: record.receivedBoxes,
    receivedLoose: record.receivedLoose,
    closingBoxes: record.closingBoxes,
    closingLoose: record.closingLoose,
    openingTotal: record.openingTotal,
    receivedTotal: record.receivedTotal,
    closingTotal: record.closingTotal,
    adjustmentBottles: record.adjustmentBottles || 0,
    availableTotal: record.availableTotal,
  };
}

export function mapAdjustment(record) {
  const item = record.item && typeof record.item === 'object' ? record.item : null;
  return {
    date: record.date,
    itemId: String(item?._id || record.itemId || record.item),
    itemName: item?.name || record.itemName,
    boxesDelta: record.boxesDelta,
    looseDelta: record.looseDelta,
    bottleDelta: record.bottleDelta,
    reason: record.reason,
    userName: record.userName,
    createdAt: record.createdAt,
  };
}

function sum(rows, key) {
  return roundMoney(rows.reduce((total, row) => total + Number(row[key] || 0), 0));
}

function baseMeta(meta) {
  return {
    businessName: meta.businessName || 'Country Liquor Bar',
    title: meta.title,
    from: meta.from || '',
    to: meta.to || '',
    generatedAt: meta.generatedAt,
    filterDescription: meta.filterDescription || '',
  };
}

export function buildReport(type, data, meta) {
  switch (type) {
    case 'daily-sales':
      return dailySales(data.stocks || [], meta);
    case 'sales-summary':
      return salesSummary(data.stocks || [], data.collections || [], meta);
    case 'item-wise':
      return itemWise(data.stocks || [], meta);
    case 'opening-closing':
      return openingClosing(data.stocks || [], meta);
    case 'movements':
      return movements(data.stocks || [], data.adjustments || [], meta);
    case 'monthly':
      return monthly(data.stocks || [], meta);
    case 'reconciliation':
      return reconciliation(data.stocks || [], data.collections || [], meta);
    default:
      return null;
  }
}

function dailySales(stocks, meta) {
  const rows = [...stocks]
    .sort((a, b) => a.date.localeCompare(b.date) || a.itemName.localeCompare(b.itemName))
    .map((row) => ({
      date: row.date,
      itemName: row.itemName,
      size: row.size,
      soldBottles: row.soldBottles,
      sellingPrice: row.sellingPrice,
      salesRevenue: row.salesRevenue,
    }));
  return {
    type: 'daily-sales',
    meta: baseMeta({ ...meta, title: 'Daily sales report' }),
    columns: [
      { key: 'date', label: 'Date', type: 'date' },
      { key: 'itemName', label: 'Item', type: 'text' },
      { key: 'size', label: 'Size', type: 'text' },
      { key: 'soldBottles', label: 'Bottles sold', type: 'number' },
      { key: 'sellingPrice', label: 'Price per bottle', type: 'money' },
      { key: 'salesRevenue', label: 'Revenue', type: 'money' },
    ],
    rows,
    totals: { soldBottles: sum(rows, 'soldBottles'), salesRevenue: sum(rows, 'salesRevenue') },
  };
}

function salesSummary(stocks, collections, meta) {
  const byDate = new Map();
  for (const row of stocks) {
    const current = byDate.get(row.date) || { date: row.date, soldBottles: 0, salesRevenue: 0, collected: 0, difference: 0 };
    current.soldBottles += row.soldBottles;
    current.salesRevenue = roundMoney(current.salesRevenue + row.salesRevenue);
    byDate.set(row.date, current);
  }
  for (const collection of collections) {
    const collected = roundMoney((collection.cash || 0) + (collection.upi || 0) + (collection.card || 0) + (collection.other || 0));
    const current = byDate.get(collection.date) || { date: collection.date, soldBottles: 0, salesRevenue: 0, collected: 0, difference: 0 };
    current.collected = collected;
    byDate.set(collection.date, current);
  }
  const rows = [...byDate.values()]
    .map((row) => ({ ...row, difference: roundMoney(row.salesRevenue - row.collected) }))
    .sort((a, b) => a.date.localeCompare(b.date));
  return {
    type: 'sales-summary',
    meta: baseMeta({ ...meta, title: 'Date-wise sales summary' }),
    columns: [
      { key: 'date', label: 'Date', type: 'date' },
      { key: 'soldBottles', label: 'Bottles sold', type: 'number' },
      { key: 'salesRevenue', label: 'Revenue', type: 'money' },
      { key: 'collected', label: 'Collected', type: 'money' },
      { key: 'difference', label: 'Difference', type: 'money' },
    ],
    rows,
    totals: {
      soldBottles: sum(rows, 'soldBottles'),
      salesRevenue: sum(rows, 'salesRevenue'),
      collected: sum(rows, 'collected'),
      difference: sum(rows, 'difference'),
    },
  };
}

function itemWise(stocks, meta) {
  const byItem = new Map();
  for (const row of stocks) {
    const current = byItem.get(row.itemId) || {
      itemName: row.itemName,
      size: row.size,
      soldBottles: 0,
      salesRevenue: 0,
    };
    current.soldBottles += row.soldBottles;
    current.salesRevenue = roundMoney(current.salesRevenue + row.salesRevenue);
    byItem.set(row.itemId, current);
  }
  const rows = [...byItem.values()]
    .map((row) => ({
      ...row,
      averagePrice: row.soldBottles ? roundMoney(row.salesRevenue / row.soldBottles) : 0,
    }))
    .sort((a, b) => a.itemName.localeCompare(b.itemName));
  return {
    type: 'item-wise',
    meta: baseMeta({ ...meta, title: 'Item-wise sales report' }),
    columns: [
      { key: 'itemName', label: 'Item', type: 'text' },
      { key: 'size', label: 'Size', type: 'text' },
      { key: 'soldBottles', label: 'Bottles sold', type: 'number' },
      { key: 'salesRevenue', label: 'Revenue', type: 'money' },
      { key: 'averagePrice', label: 'Average price', type: 'money' },
    ],
    rows,
    totals: { soldBottles: sum(rows, 'soldBottles'), salesRevenue: sum(rows, 'salesRevenue') },
  };
}

function openingClosing(stocks, meta) {
  const rows = [...stocks]
    .sort((a, b) => a.date.localeCompare(b.date) || a.itemName.localeCompare(b.itemName))
    .map((row) => ({
      date: row.date,
      itemName: row.itemName,
      size: row.size,
      unitsPerBox: row.unitsPerBox,
      openingBoxes: row.openingBoxes,
      openingLoose: row.openingLoose,
      openingTotal: row.openingTotal,
      closingBoxes: row.closingBoxes,
      closingLoose: row.closingLoose,
      closingTotal: row.closingTotal,
    }));
  return {
    type: 'opening-closing',
    meta: baseMeta({ ...meta, title: 'Opening and closing stock report' }),
    columns: [
      { key: 'date', label: 'Date', type: 'date' },
      { key: 'itemName', label: 'Item', type: 'text' },
      { key: 'size', label: 'Size', type: 'text' },
      { key: 'unitsPerBox', label: 'Units per box', type: 'number' },
      { key: 'openingBoxes', label: 'Opening boxes', type: 'number' },
      { key: 'openingLoose', label: 'Opening loose', type: 'number' },
      { key: 'openingTotal', label: 'Opening bottles', type: 'number' },
      { key: 'closingBoxes', label: 'Closing boxes', type: 'number' },
      { key: 'closingLoose', label: 'Closing loose', type: 'number' },
      { key: 'closingTotal', label: 'Closing bottles', type: 'number' },
    ],
    rows,
    totals: { openingTotal: sum(rows, 'openingTotal'), closingTotal: sum(rows, 'closingTotal') },
  };
}

function movements(stocks, adjustments, meta) {
  const rows = [...stocks]
    .sort((a, b) => a.date.localeCompare(b.date) || a.itemName.localeCompare(b.itemName))
    .map((row) => {
      const notes = adjustments
        .filter((adjustment) => adjustment.date === row.date && adjustment.itemId === row.itemId)
        .map((adjustment) => adjustment.reason)
        .join('; ');
      return {
        date: row.date,
        itemName: row.itemName,
        openingTotal: row.openingTotal,
        receivedTotal: row.receivedTotal,
        adjustmentBottles: row.adjustmentBottles,
        soldBottles: row.soldBottles,
        closingTotal: row.closingTotal,
        notes,
      };
    });
  const stockKeys = new Set(stocks.map((row) => `${row.date}:${row.itemId}`));
  for (const adjustment of adjustments) {
    if (stockKeys.has(`${adjustment.date}:${adjustment.itemId}`)) continue;
    rows.push({
      date: adjustment.date,
      itemName: adjustment.itemName,
      openingTotal: 0,
      receivedTotal: 0,
      adjustmentBottles: adjustment.bottleDelta,
      soldBottles: 0,
      closingTotal: 0,
      notes: adjustment.reason,
    });
  }
  rows.sort((a, b) => a.date.localeCompare(b.date) || a.itemName.localeCompare(b.itemName));
  return {
    type: 'movements',
    meta: baseMeta({ ...meta, title: 'Stock movement and adjustment report' }),
    columns: [
      { key: 'date', label: 'Date', type: 'date' },
      { key: 'itemName', label: 'Item', type: 'text' },
      { key: 'openingTotal', label: 'Opening bottles', type: 'number' },
      { key: 'receivedTotal', label: 'Received bottles', type: 'number' },
      { key: 'adjustmentBottles', label: 'Adjustment bottles', type: 'number' },
      { key: 'soldBottles', label: 'Sold bottles', type: 'number' },
      { key: 'closingTotal', label: 'Closing bottles', type: 'number' },
      { key: 'notes', label: 'Adjustment notes', type: 'text' },
    ],
    rows,
    totals: {
      receivedTotal: sum(rows, 'receivedTotal'),
      adjustmentBottles: sum(rows, 'adjustmentBottles'),
      soldBottles: sum(rows, 'soldBottles'),
    },
  };
}

function monthly(stocks, meta) {
  const year = String(meta.year || '');
  const rows = MONTHS.map((month, index) => {
    const key = `${year}-${String(index + 1).padStart(2, '0')}`;
    const matching = stocks.filter((row) => row.date.startsWith(key));
    return {
      month,
      soldBottles: matching.reduce((total, row) => total + row.soldBottles, 0),
      salesRevenue: sum(matching, 'salesRevenue'),
    };
  });
  return {
    type: 'monthly',
    meta: baseMeta({ ...meta, title: `Monthly revenue report ${year}`, from: `${year}-01-01`, to: `${year}-12-31` }),
    columns: [
      { key: 'month', label: 'Month', type: 'text' },
      { key: 'soldBottles', label: 'Bottles sold', type: 'number' },
      { key: 'salesRevenue', label: 'Revenue', type: 'money' },
    ],
    rows,
    totals: { soldBottles: sum(rows, 'soldBottles'), salesRevenue: sum(rows, 'salesRevenue') },
  };
}

function reconciliation(stocks, collections, meta) {
  const revenueByDate = new Map();
  for (const row of stocks) {
    revenueByDate.set(row.date, roundMoney((revenueByDate.get(row.date) || 0) + row.salesRevenue));
  }
  const collectionMap = new Map(collections.map((collection) => [collection.date, collection]));
  const dates = new Set([...revenueByDate.keys(), ...collections.map((collection) => collection.date)]);
  const rows = [...dates].sort().map((date) => {
    const collection = collectionMap.get(date);
    const salesRevenue = revenueByDate.get(date) || 0;
    const cash = collection?.cash || 0;
    const upi = collection?.upi || 0;
    const card = collection?.card || 0;
    const other = collection?.other || 0;
    const collected = roundMoney(cash + upi + card + other);
    return {
      date,
      salesRevenue,
      cash,
      upi,
      card,
      other,
      collected,
      difference: roundMoney(salesRevenue - collected),
    };
  });
  return {
    type: 'reconciliation',
    meta: baseMeta({ ...meta, title: 'Cash collection reconciliation report' }),
    columns: [
      { key: 'date', label: 'Date', type: 'date' },
      { key: 'salesRevenue', label: 'Calculated revenue', type: 'money' },
      { key: 'cash', label: 'Cash', type: 'money' },
      { key: 'upi', label: 'UPI', type: 'money' },
      { key: 'card', label: 'Card', type: 'money' },
      { key: 'other', label: 'Other', type: 'money' },
      { key: 'collected', label: 'Total collected', type: 'money' },
      { key: 'difference', label: 'Difference', type: 'money' },
    ],
    rows,
    totals: {
      salesRevenue: sum(rows, 'salesRevenue'),
      cash: sum(rows, 'cash'),
      upi: sum(rows, 'upi'),
      card: sum(rows, 'card'),
      other: sum(rows, 'other'),
      collected: sum(rows, 'collected'),
      difference: sum(rows, 'difference'),
    },
  };
}

export function displayValue(value, type, symbol = '₹') {
  if (value == null || value === '') return '';
  if (type === 'date') return formatDisplayDate(value);
  if (type === 'money') {
    const formatted = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value || 0));
    return `${symbol}${formatted}`;
  }
  if (type === 'number') return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(Number(value || 0));
  return String(value);
}
