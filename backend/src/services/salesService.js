import { Item } from '../models/Item.js';
import { DailyStock } from '../models/DailyStock.js';
import { DailyCollection } from '../models/DailyCollection.js';
import { roundMoney } from '../../../shared/stockCalculation.js';
import { isISODate } from '../utils/dates.js';
import { AppError } from '../utils/AppError.js';
import { parseOrThrow, collectionSchema } from '../utils/validate.js';
import { logAudit } from './auditService.js';

export async function getSalesDay(date) {
  if (!isISODate(date)) throw new AppError('Enter a valid date.', 400, 'VALIDATION');
  const stocks = await DailyStock.find({ date }).sort({ itemName: 1 }).lean();
  const stockIds = stocks.map((record) => record.item);
  const items = await Item.find({ $or: [{ active: true }, { _id: { $in: stockIds } }] }).sort({ name: 1 }).lean();
  const stockByItem = new Map(stocks.map((record) => [String(record.item), record]));
  const seen = new Set();
  const lines = items.map((item) => {
    seen.add(String(item._id));
    const record = stockByItem.get(String(item._id));
    if (!record) {
      return {
        id: String(item._id),
        itemId: String(item._id),
        itemName: item.name,
        category: item.category,
        size: item.size,
        unitsPerBox: item.unitsPerBox,
        soldBottles: 0,
        sellingPrice: item.sellingPrice,
        buyingPrice: item.buyingPrice ?? 0,
        currentPrice: item.sellingPrice,
        salesRevenue: 0,
        openingTotal: 0,
        receivedTotal: 0,
        closingTotal: 0,
        adjustmentBottles: 0,
        counted: false,
      };
    }
    return {
      id: String(record._id),
      itemId: String(item._id),
      itemName: item.name || record.itemName,
      category: item.category || record.category,
      size: record.size,
      unitsPerBox: record.unitsPerBox,
      soldBottles: record.soldBottles,
      sellingPrice: record.sellingPrice,
      buyingPrice: item.buyingPrice ?? 0,
      currentPrice: item.sellingPrice,
      salesRevenue: record.salesRevenue,
      openingTotal: record.openingTotal,
      receivedTotal: record.receivedTotal,
      closingTotal: record.closingTotal,
      adjustmentBottles: record.adjustmentBottles,
      counted: true,
    };
  });
  for (const record of stocks) {
    if (seen.has(String(record.item))) continue;
    lines.push({
      id: String(record._id),
      itemId: String(record.item),
      itemName: record.itemName,
      category: record.category,
      size: record.size,
      unitsPerBox: record.unitsPerBox,
      soldBottles: record.soldBottles,
      sellingPrice: record.sellingPrice,
      buyingPrice: 0,
      currentPrice: record.sellingPrice,
      salesRevenue: record.salesRevenue,
      openingTotal: record.openingTotal,
      receivedTotal: record.receivedTotal,
      closingTotal: record.closingTotal,
      adjustmentBottles: record.adjustmentBottles,
      counted: true,
    });
  }
  const totalBottles = lines.reduce((sum, line) => sum + line.soldBottles, 0);
  const totalRevenue = roundMoney(lines.reduce((sum, line) => sum + line.salesRevenue, 0));
  const collection = await DailyCollection.findOne({ date }).lean();
  const collected = collection
    ? roundMoney((collection.cash || 0) + (collection.upi || 0) + (collection.card || 0) + (collection.other || 0))
    : 0;
  const expense = collection?.expense || 0;
  const upi = collection?.upi || 0;
  return {
    date,
    lines,
    totalBottles,
    totalRevenue,
    hasEntry: lines.length > 0,
    collection: {
      cash: collection?.cash || 0,
      upi,
      card: collection?.card || 0,
      other: collection?.other || 0,
      expense,
      notes: collection?.notes || '',
      total: collected,
      recordedByName: collection?.recordedByName || '',
      updatedAt: collection?.updatedAt || null,
    },
    difference: roundMoney(totalRevenue - collected),
    cashInHand: roundMoney(totalRevenue - expense - upi),
  };
}

export async function saveCollection(body, user) {
  const data = parseOrThrow(collectionSchema, body);
  if (!isISODate(data.date)) throw new AppError('Enter a valid date.', 400, 'VALIDATION');
  for (const key of ['cash', 'upi', 'card', 'other', 'expense']) {
    const value = data[key];
    if (Math.abs(value * 100 - Math.round(value * 100)) > 1e-6) {
      throw new AppError('Collection amounts can have at most two decimal places.', 400, 'VALIDATION');
    }
  }
  const collection = await DailyCollection.findOneAndUpdate(
    { date: data.date },
    {
      date: data.date,
      cash: data.cash,
      upi: data.upi,
      card: data.card,
      other: data.other,
      expense: data.expense,
      notes: data.notes || '',
      recordedBy: user.id,
      recordedByName: user.name,
    },
    { upsert: true, new: true, runValidators: true }
  );
  await logAudit({
    user,
    action: 'COLLECTION_SAVE',
    entity: 'DailyCollection',
    entityId: data.date,
    summary: `Recorded collections for ${data.date}.`,
    details: { cash: data.cash, upi: data.upi, card: data.card, other: data.other, expense: data.expense },
  });
  return getSalesDay(data.date).then((sales) => ({ ...sales, collectionId: String(collection._id) }));
}
