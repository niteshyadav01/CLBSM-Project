import { DailyStock } from '../models/DailyStock.js';
import { DailyCollection } from '../models/DailyCollection.js';
import { roundMoney } from '../../../shared/stockCalculation.js';
import { isISODate } from '../utils/dates.js';
import { AppError } from '../utils/AppError.js';
import { parseOrThrow, collectionSchema } from '../utils/validate.js';
import { logAudit } from './auditService.js';

export async function getSalesDay(date) {
  if (!isISODate(date)) throw new AppError('Enter a valid date.', 400, 'VALIDATION');
  const stocks = await DailyStock.find({ date }).populate('item', 'name sellingPrice').sort({ itemName: 1 });
  const lines = stocks.map((record) => ({
    id: String(record._id),
    itemId: String(record.item?._id || record.item),
    itemName: record.item?.name || record.itemName,
    size: record.size,
    unitsPerBox: record.unitsPerBox,
    soldBottles: record.soldBottles,
    sellingPrice: record.sellingPrice,
    currentPrice: record.item?.sellingPrice ?? record.sellingPrice,
    salesRevenue: record.salesRevenue,
    openingTotal: record.openingTotal,
    receivedTotal: record.receivedTotal,
    closingTotal: record.closingTotal,
    adjustmentBottles: record.adjustmentBottles,
  }));
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
