import { Item } from '../models/Item.js';
import { DailyStock } from '../models/DailyStock.js';
import { AuditLog } from '../models/AuditLog.js';
import { getSettings } from './settingsService.js';
import { addDays, formatDisplayDate, isISODate } from '../utils/dates.js';
import { AppError } from '../utils/AppError.js';
import { roundMoney } from '../../../shared/stockCalculation.js';

export async function getDashboard(from, to = from) {
  if (!isISODate(from) || !isISODate(to)) throw new AppError('Enter a valid date.', 400, 'VALIDATION');
  if (from > to) throw new AppError('The start date must be on or before the end date.', 400, 'VALIDATION');
  const span = Math.round((Date.parse(to) - Date.parse(from)) / 86400000);
  if (span > 366) throw new AppError('Choose a period of one year or less.', 400, 'VALIDATION');

  const settings = await getSettings();
  const records = await DailyStock.find({ date: { $gte: from, $lte: to } }).lean();
  const openingDay = records.filter((record) => record.date === from);
  const closingDay = records.filter((record) => record.date === to);
  const previous = await DailyStock.find({ date: addDays(from, -1) }).lean();

  const sumField = (rows, field) => rows.reduce((total, row) => total + Number(row[field] || 0), 0);
  const chart = [];
  for (let day = from; day <= to; day = addDays(day, 1)) {
    const rows = records.filter((record) => record.date === day);
    chart.push({
      date: day,
      label: formatDisplayDate(day).slice(0, 5),
      revenue: roundMoney(sumField(rows, 'salesRevenue')),
      bottles: sumField(rows, 'soldBottles'),
    });
  }

  const items = await Item.find({ active: true }).sort({ name: 1 }).lean();
  const lowStock = items
    .map((item) => ({
      id: String(item._id),
      name: item.name,
      size: item.size,
      totalBottles: item.currentBoxes * item.unitsPerBox + item.currentLoose,
      currentBoxes: item.currentBoxes,
      currentLoose: item.currentLoose,
    }))
    .filter((item) => item.totalBottles <= settings.lowStockThresholdBottles);

  const salesByItem = new Map();
  for (const record of records) {
    const key = String(record.item);
    const current = salesByItem.get(key) || {
      itemId: key,
      name: record.itemName,
      size: record.size,
      soldBottles: 0,
      revenue: 0,
    };
    current.name = record.itemName;
    current.size = record.size;
    current.soldBottles += record.soldBottles;
    current.revenue = roundMoney(current.revenue + record.salesRevenue);
    salesByItem.set(key, current);
  }
  for (const item of items) {
    const key = String(item._id);
    if (salesByItem.has(key)) continue;
    salesByItem.set(key, {
      itemId: key,
      name: item.name,
      size: item.size,
      soldBottles: 0,
      revenue: 0,
    });
  }

  const activity = await AuditLog.find().sort({ createdAt: -1 }).limit(8).lean();

  return {
    from,
    to,
    date: to,
    businessName: settings.businessName,
    hasEntry: records.length > 0,
    totals: {
      soldBottles: sumField(records, 'soldBottles'),
      revenue: roundMoney(sumField(records, 'salesRevenue')),
      previousRevenue: roundMoney(sumField(previous, 'salesRevenue')),
      openingBottles: sumField(openingDay, 'openingTotal'),
      receivedBottles: sumField(records, 'receivedTotal'),
      availableBottles: sumField(closingDay, 'availableTotal'),
      closingBottles: sumField(closingDay, 'closingTotal'),
      closingBoxes: sumField(closingDay, 'closingBoxes'),
      closingLoose: sumField(closingDay, 'closingLoose'),
    },
    items: [...salesByItem.values()].sort((a, b) => b.revenue - a.revenue || a.name.localeCompare(b.name)),
    chart,
    lowStock,
    lowStockThreshold: settings.lowStockThresholdBottles,
    activity: activity.map((entry) => ({
      id: String(entry._id),
      action: entry.action,
      summary: entry.summary,
      userName: entry.userName,
      createdAt: entry.createdAt,
    })),
  };
}
