import { Item } from '../models/Item.js';
import { DailyStock } from '../models/DailyStock.js';
import { StockAdjustment } from '../models/StockAdjustment.js';
import { getSettings } from './settingsService.js';
import { isISODate } from '../utils/dates.js';
import { AppError } from '../utils/AppError.js';
import mongoose from 'mongoose';

function range(from, to) {
  if (from && !isISODate(from)) throw new AppError('Enter a valid from date.', 400, 'VALIDATION');
  if (to && !isISODate(to)) throw new AppError('Enter a valid to date.', 400, 'VALIDATION');
  if (from && to && from > to) throw new AppError('The start date must be on or before the end date.', 400, 'VALIDATION');
  const query = {};
  if (from || to) {
    query.date = {};
    if (from) query.date.$gte = from;
    if (to) query.date.$lte = to;
  }
  return query;
}

export async function getInventory({ from, to } = {}) {
  const settings = await getSettings();
  const dateQuery = range(from, to);
  const items = await Item.find().sort({ active: -1, name: 1 }).lean();
  const stocks = await DailyStock.find(dateQuery).lean();
  return {
    from: from || '',
    to: to || '',
    lowStockThreshold: settings.lowStockThresholdBottles,
    items: items.map((item) => {
      const rows = stocks.filter((row) => String(row.item) === String(item._id));
      const totalBottles = item.currentBoxes * item.unitsPerBox + item.currentLoose;
      return {
        id: String(item._id),
        name: item.name,
        category: item.category,
        size: item.size,
        unitsPerBox: item.unitsPerBox,
        active: item.active,
        currentBoxes: item.currentBoxes,
        currentLoose: item.currentLoose,
        totalBottles,
        fullBoxes: Math.floor(totalBottles / item.unitsPerBox),
        remainderBottles: totalBottles % item.unitsPerBox,
        equivalentBoxes: item.unitsPerBox ? totalBottles / item.unitsPerBox : 0,
        receivedBottles: rows.reduce((sum, row) => sum + row.receivedTotal, 0),
        soldBottles: rows.reduce((sum, row) => sum + row.soldBottles, 0),
        lowStock: item.active && totalBottles <= settings.lowStockThresholdBottles,
        stockAsOfDate: item.stockAsOfDate,
      };
    }),
  };
}

export async function getItemHistory(itemId, { from, to } = {}) {
  if (!mongoose.isValidObjectId(itemId)) throw new AppError('Item not found.', 404, 'NOT_FOUND');
  const item = await Item.findById(itemId).lean();
  if (!item) throw new AppError('Item not found.', 404, 'NOT_FOUND');
  const dateQuery = range(from, to);
  const query = { item: item._id, ...dateQuery };
  const stocks = await DailyStock.find(query).sort({ date: -1 }).lean();
  const adjustments = await StockAdjustment.find(query).sort({ date: -1, createdAt: -1 }).lean();
  const events = [
    ...stocks.map((row) => ({
      type: 'count',
      date: row.date,
      createdAt: row.updatedAt,
      openingBoxes: row.openingBoxes,
      openingLoose: row.openingLoose,
      receivedBoxes: row.receivedBoxes,
      receivedLoose: row.receivedLoose,
      closingBoxes: row.closingBoxes,
      closingLoose: row.closingLoose,
      soldBottles: row.soldBottles,
      salesRevenue: row.salesRevenue,
      sellingPrice: row.sellingPrice,
      adjustmentBottles: row.adjustmentBottles,
    })),
    ...adjustments.map((row) => ({
      type: 'adjustment',
      date: row.date,
      createdAt: row.createdAt,
      boxesDelta: row.boxesDelta,
      looseDelta: row.looseDelta,
      bottleDelta: row.bottleDelta,
      reason: row.reason,
      userName: row.userName,
    })),
  ].sort((a, b) => b.date.localeCompare(a.date) || String(b.createdAt).localeCompare(String(a.createdAt)));

  return {
    item: {
      id: String(item._id),
      name: item.name,
      size: item.size,
      unitsPerBox: item.unitsPerBox,
      currentBoxes: item.currentBoxes,
      currentLoose: item.currentLoose,
    },
    events,
  };
}
