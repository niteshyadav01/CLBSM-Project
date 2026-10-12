import mongoose from 'mongoose';
import { DailyStock } from '../models/DailyStock.js';
import { StockAdjustment } from '../models/StockAdjustment.js';
import { DailyCollection } from '../models/DailyCollection.js';
import { buildReport, buildStockQuery, mapAdjustment, mapStock, matchesFilters } from './reportBuilders.js';
import { getSettings } from './settingsService.js';
import { assertDateRange, formatTimestamp } from '../utils/dates.js';
import { AppError } from '../utils/AppError.js';

const TYPES = new Set(['daily-sales', 'sales-summary', 'item-wise', 'opening-closing', 'movements', 'monthly', 'reconciliation']);

export async function createReport(type, query) {
  if (!TYPES.has(type)) throw new AppError('That report is not available.', 400, 'VALIDATION');
  const settings = await getSettings();
  let from = query.from || '';
  let to = query.to || '';
  const year = query.year || '';
  if (type === 'monthly') {
    if (!/^\d{4}$/.test(year)) throw new AppError('Enter a valid year.', 400, 'VALIDATION');
    from = `${year}-01-01`;
    to = `${year}-12-31`;
  } else {
    assertDateRange(from, to);
  }
  const itemId = query.itemId || '';
  if (itemId && !mongoose.isValidObjectId(itemId)) throw new AppError('Unknown item filter.', 400, 'VALIDATION');

  const filters = { from, to, itemId };
  const stocks = (await DailyStock.find(buildStockQuery(filters)).populate('item', 'name category size sellingPrice').lean())
    .map(mapStock)
    .filter((row) => matchesFilters(row, filters));
  const adjustments = (await StockAdjustment.find(buildStockQuery(filters)).lean())
    .map(mapAdjustment)
    .filter((row) => matchesFilters(row, filters));
  const collectionQuery = { date: { $gte: from, $lte: to } };
  const collections = await DailyCollection.find(collectionQuery).lean();
  const named = stocks.find((row) => row.itemId === String(itemId)) || adjustments.find((row) => row.itemId === String(itemId));
  const report = buildReport(type, { stocks, adjustments, collections }, {
    businessName: settings.businessName,
    from,
    to,
    year,
    generatedAt: formatTimestamp(),
    filterDescription: itemId ? `Item: ${named?.itemName || 'Selected item'}` : 'All items',
  });
  if (!report) throw new AppError('That report is not available.', 400, 'VALIDATION');
  return report;
}
