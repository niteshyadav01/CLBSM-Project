import mongoose from 'mongoose';
import { Item } from '../models/Item.js';
import { DailyStock } from '../models/DailyStock.js';
import { StockAdjustment } from '../models/StockAdjustment.js';
import { evaluateStock, resolveSnapshot } from '../../../shared/stockCalculation.js';
import { isISODate } from '../utils/dates.js';
import { AppError } from '../utils/AppError.js';
import { parseOrThrow, saveStockSchema, adjustmentSchema } from '../utils/validate.js';
import { q, withTransaction } from '../config/db.js';
import { logAudit } from './auditService.js';
import { assertCanWrite } from './stockRules.js';

async function insert(Model, doc, session) {
  if (!session) return Model.create(doc);
  const [created] = await Model.create([doc], { session });
  return created;
}

function assertObjectId(id) {
  if (!mongoose.isValidObjectId(id)) throw new AppError('That record could not be found.', 404, 'NOT_FOUND');
}

async function openingSuggestion(itemId, date, session) {
  const expected = await expectedOpening(itemId, date, session);
  if (expected) return { boxes: expected.boxes, loose: expected.loose, fromDate: expected.date };
  const prior = await q(StockAdjustment.find({ item: itemId, date: { $lt: date } }), session);
  let boxes = 0;
  let loose = 0;
  for (const adjustment of prior) {
    boxes += adjustment.boxesDelta;
    loose += adjustment.looseDelta;
  }
  return { boxes, loose, fromDate: null };
}

export async function expectedOpening(itemId, date, session) {
  const prev = await q(DailyStock.findOne({ item: itemId, date: { $lt: date } }).sort({ date: -1 }), session);
  if (!prev) return null;
  const adjustments = await q(StockAdjustment.find({ item: itemId, date: { $gt: prev.date, $lt: date } }), session);
  let boxes = prev.closingBoxes;
  let loose = prev.closingLoose;
  for (const adjustment of adjustments) {
    boxes += adjustment.boxesDelta;
    loose += adjustment.looseDelta;
  }
  return { boxes, loose, date: prev.date };
}

export async function recalculateCurrentStock(item, session) {
  const latest = await q(DailyStock.findOne({ item: item._id }).sort({ date: -1 }), session);
  let boxes = 0;
  let loose = 0;
  let asOf = null;
  if (latest) {
    boxes = latest.closingBoxes;
    loose = latest.closingLoose;
    asOf = latest.date;
    const later = await q(StockAdjustment.find({ item: item._id, date: { $gt: latest.date } }), session);
    for (const adjustment of later) {
      boxes += adjustment.boxesDelta;
      loose += adjustment.looseDelta;
    }
  } else {
    const adjustments = await q(StockAdjustment.find({ item: item._id }), session);
    for (const adjustment of adjustments) {
      boxes += adjustment.boxesDelta;
      loose += adjustment.looseDelta;
    }
  }
  if (boxes < 0 || loose < 0) {
    throw new AppError(`${item.name} would have negative stock. Check the adjustment and the daily counts.`, 400, 'NEGATIVE_STOCK');
  }
  item.currentBoxes = boxes;
  item.currentLoose = loose;
  item.stockAsOfDate = asOf;
  await item.save(session ? { session } : undefined);
  return item;
}

async function adjustmentBottlesFor(itemId, date, session) {
  const adjustments = await q(StockAdjustment.find({ item: itemId, date }), session);
  return adjustments.reduce((sum, adjustment) => sum + adjustment.bottleDelta, 0);
}

async function applyOpeningRule(itemId, date, entry, session) {
  const previous = await q(DailyStock.findOne({ item: itemId, date: { $lt: date } }).sort({ date: -1 }), session);
  if (!previous) {
    return {
      openingBoxes: entry.closingBoxes,
      openingLoose: entry.closingLoose,
      receivedBoxes: 0,
      receivedLoose: 0,
    };
  }
  const expected = await openingSuggestion(itemId, date, session);
  if (expected.boxes < 0 || expected.loose < 0) {
    throw new AppError('Opening stock would be negative. Check the previous closing and any adjustments.', 400, 'NEGATIVE_STOCK');
  }
  return {
    openingBoxes: expected.boxes,
    openingLoose: expected.loose,
    receivedBoxes: entry.receivedBoxes,
    receivedLoose: entry.receivedLoose,
  };
}

async function refreshNextOpening(itemId, date, session) {
  const next = await q(DailyStock.findOne({ item: itemId, date: { $gt: date } }).sort({ date: 1 }), session);
  if (!next) return;
  const previous = await q(DailyStock.findOne({ item: itemId, date: { $lt: next.date } }).sort({ date: -1 }), session);
  if (!previous) {
    next.openingBoxes = next.closingBoxes;
    next.openingLoose = next.closingLoose;
    next.receivedBoxes = 0;
    next.receivedLoose = 0;
  } else {
    const expected = await openingSuggestion(itemId, next.date, session);
    if (expected.boxes < 0 || expected.loose < 0) {
      throw new AppError(`${next.itemName}: the next day’s opening would be negative.`, 400, 'NEGATIVE_STOCK');
    }
    next.openingBoxes = expected.boxes;
    next.openingLoose = expected.loose;
  }
  await recomputeDailyRecord(next, session);
}

function payloadFrom({ entry, item, existing, snapshot, evaluated, user, date }) {
  return {
    date,
    item: item._id,
    itemName: item.name,
    category: item.category,
    size: item.size,
    unitsPerBox: snapshot.unitsPerBox,
    sellingPrice: snapshot.sellingPrice,
    openingBoxes: entry.openingBoxes,
    openingLoose: entry.openingLoose,
    receivedBoxes: entry.receivedBoxes,
    receivedLoose: entry.receivedLoose,
    closingBoxes: entry.closingBoxes,
    closingLoose: entry.closingLoose,
    adjustmentBottles: evaluated.adjustmentBottles,
    openingTotal: evaluated.openingTotal,
    receivedTotal: evaluated.receivedTotal,
    closingTotal: evaluated.closingTotal,
    availableTotal: evaluated.available,
    soldBottles: evaluated.soldBottles,
    salesRevenue: evaluated.salesRevenue,
    flags: evaluated.warnings.map((warning) => warning.code),
    enteredBy: existing?.enteredBy || user.id,
    updatedBy: user.id,
  };
}

export async function saveDailyStock({ date, entries, user }) {
  if (!isISODate(date)) throw new AppError('Enter a valid date.', 400, 'VALIDATION');
  const data = parseOrThrow(saveStockSchema, { date, entries });

  return withTransaction(async (session) => {
    const itemIds = data.entries.map((entry) => entry.itemId);
    if (new Set(itemIds).size !== itemIds.length) {
      throw new AppError('Each item can only be entered once per day.', 400, 'DUPLICATE_ENTRY');
    }
    for (const itemId of itemIds) assertObjectId(itemId);

    const items = await q(Item.find({ _id: { $in: itemIds } }), session);
    const itemMap = new Map(items.map((item) => [String(item._id), item]));
    const existingList = await q(DailyStock.find({ date: data.date, item: { $in: itemIds } }), session);
    const existingMap = new Map(existingList.map((record) => [String(record.item), record]));

    const prepared = [];
    for (const entry of data.entries) {
      const item = itemMap.get(entry.itemId);
      if (!item) throw new AppError('One of the selected items no longer exists.', 404, 'NOT_FOUND');
      const existing = existingMap.get(entry.itemId) || null;
      if (!item.active && !existing) throw new AppError(`${item.name} is inactive and cannot be added.`, 400, 'INACTIVE_ITEM');
      assertCanWrite(existing, entry.existingId || null, entry.updatedAt || null);
      const snapshot = resolveSnapshot(existing, item);
      const adjustmentBottles = await adjustmentBottlesFor(item._id, data.date, session);
      const ruled = await applyOpeningRule(item._id, data.date, entry, session);
      const normalized = {
        ...entry,
        openingBoxes: ruled.openingBoxes,
        openingLoose: ruled.openingLoose,
        receivedBoxes: ruled.receivedBoxes,
        receivedLoose: ruled.receivedLoose,
      };
      const evaluated = evaluateStock({
        openingBoxes: normalized.openingBoxes,
        openingLoose: normalized.openingLoose,
        receivedBoxes: normalized.receivedBoxes,
        receivedLoose: normalized.receivedLoose,
        closingBoxes: normalized.closingBoxes,
        closingLoose: normalized.closingLoose,
        unitsPerBox: snapshot.unitsPerBox,
        sellingPrice: snapshot.sellingPrice,
        adjustmentBottles,
      });
      if (!evaluated.valid) {
        throw new AppError(`${item.name}: ${evaluated.errors[0].message}`, 400, evaluated.errors[0].code, {
          itemId: entry.itemId,
          errors: evaluated.errors,
        });
      }
      prepared.push({ entry: normalized, item, existing, snapshot, evaluated });
    }

    const saved = [];
    for (const row of prepared) {
      const payload = payloadFrom({ ...row, user, date: data.date });
      let savedDoc;
      if (row.existing) {
        Object.assign(row.existing, payload);
        await row.existing.save(session ? { session } : undefined);
        savedDoc = row.existing;
      } else {
        savedDoc = await insert(DailyStock, payload, session);
      }
      saved.push(savedDoc);
      await refreshNextOpening(row.item._id, data.date, session);
      await recalculateCurrentStock(row.item, session);
    }

    const soldBottles = prepared.reduce((sum, row) => sum + row.evaluated.soldBottles, 0);
    const salesRevenue = prepared.reduce((sum, row) => sum + row.evaluated.salesRevenue, 0);
    await logAudit(
      {
        user,
        action: 'STOCK_SAVE',
        entity: 'DailyStock',
        entityId: data.date,
        summary: `Saved daily stock for ${data.date} (${prepared.length} items, ${soldBottles} bottles).`,
        details: { date: data.date, soldBottles, salesRevenue },
      },
      session
    );

    return {
      entries: saved,
      warnings: prepared.flatMap((row) =>
        row.evaluated.warnings.map((warning) => ({
          itemId: String(row.item._id),
          itemName: row.item.name,
          code: warning.code,
          message: warning.message,
        }))
      ),
    };
  });
}

export async function recomputeDailyRecord(record, session) {
  const adjustmentBottles = await adjustmentBottlesFor(record.item, record.date, session);
  const evaluated = evaluateStock({
    openingBoxes: record.openingBoxes,
    openingLoose: record.openingLoose,
    receivedBoxes: record.receivedBoxes,
    receivedLoose: record.receivedLoose,
    closingBoxes: record.closingBoxes,
    closingLoose: record.closingLoose,
    unitsPerBox: record.unitsPerBox,
    sellingPrice: record.sellingPrice,
    adjustmentBottles,
  });
  if (!evaluated.valid) {
    throw new AppError(`${record.itemName}: ${evaluated.errors[0].message}`, 400, evaluated.errors[0].code, evaluated.errors[0]);
  }
  record.adjustmentBottles = evaluated.adjustmentBottles;
  record.openingTotal = evaluated.openingTotal;
  record.receivedTotal = evaluated.receivedTotal;
  record.closingTotal = evaluated.closingTotal;
  record.availableTotal = evaluated.available;
  record.soldBottles = evaluated.soldBottles;
  record.salesRevenue = evaluated.salesRevenue;
  record.flags = evaluated.warnings.map((warning) => warning.code);
  await record.save(session ? { session } : undefined);
  return record;
}

async function onHandAfter(item, boxesDelta, looseDelta, session) {
  const latest = await q(DailyStock.findOne({ item: item._id }).sort({ date: -1 }), session);
  let boxes = latest ? latest.closingBoxes : 0;
  let loose = latest ? latest.closingLoose : 0;
  const later = latest
    ? await q(StockAdjustment.find({ item: item._id, date: { $gt: latest.date } }), session)
    : await q(StockAdjustment.find({ item: item._id }), session);
  for (const adjustment of later) {
    boxes += adjustment.boxesDelta;
    loose += adjustment.looseDelta;
  }
  return { boxes: boxes + boxesDelta, loose: loose + looseDelta, latest };
}

export async function createAdjustment({ itemId, date, boxesDelta, looseDelta, reason, user }) {
  const data = parseOrThrow(adjustmentSchema, { itemId, date, boxesDelta, looseDelta, reason });
  if (!isISODate(data.date)) throw new AppError('Enter a valid date.', 400, 'VALIDATION');
  if (data.boxesDelta === 0 && data.looseDelta === 0) {
    throw new AppError('Enter a change in boxes or loose bottles.', 400, 'VALIDATION');
  }
  assertObjectId(data.itemId);

  return withTransaction(async (session) => {
    const item = await q(Item.findById(data.itemId), session);
    if (!item) throw new AppError('Item not found.', 404, 'NOT_FOUND');
    const record = await q(DailyStock.findOne({ item: item._id, date: data.date }), session);
    const unitsPerBox = record?.unitsPerBox || item.unitsPerBox;
    const bottleDelta = data.boxesDelta * unitsPerBox + data.looseDelta;
    const latest = await q(DailyStock.findOne({ item: item._id }).sort({ date: -1 }), session);
    const appliesToOnHand = !latest || data.date > latest.date;

    if (appliesToOnHand) {
      const projected = await onHandAfter(item, data.boxesDelta, data.looseDelta, session);
      if (projected.boxes < 0 || projected.loose < 0) {
        throw new AppError('This adjustment would make stock negative.', 400, 'NEGATIVE_STOCK');
      }
    }

    if (record) {
      const currentAdj = await adjustmentBottlesFor(item._id, data.date, session);
      const evaluated = evaluateStock({
        openingBoxes: record.openingBoxes,
        openingLoose: record.openingLoose,
        receivedBoxes: record.receivedBoxes,
        receivedLoose: record.receivedLoose,
        closingBoxes: record.closingBoxes,
        closingLoose: record.closingLoose,
        unitsPerBox: record.unitsPerBox,
        sellingPrice: record.sellingPrice,
        adjustmentBottles: currentAdj + bottleDelta,
      });
      if (!evaluated.valid) {
        throw new AppError(`${item.name}: ${evaluated.errors[0].message}`, 400, evaluated.errors[0].code);
      }
    } else if (latest && data.date < latest.date) {
      throw new AppError('Add a daily stock entry for that date before adjusting it, or choose the latest stock date or a later date.', 400, 'VALIDATION');
    }

    const adjustment = await insert(
      StockAdjustment,
      {
        date: data.date,
        item: item._id,
        itemName: item.name,
        unitsPerBox,
        boxesDelta: data.boxesDelta,
        looseDelta: data.looseDelta,
        bottleDelta,
        reason: data.reason,
        user: user.id,
        userName: user.name,
      },
      session
    );

    if (record) await recomputeDailyRecord(record, session);
    await refreshNextOpening(item._id, data.date, session);
    await recalculateCurrentStock(item, session);
    await logAudit(
      {
        user,
        action: 'ADJUSTMENT',
        entity: 'StockAdjustment',
        entityId: adjustment._id,
        summary: `Adjusted ${item.name} on ${data.date}: ${data.boxesDelta} boxes, ${data.looseDelta} loose bottles. ${data.reason}`,
        details: { date: data.date, itemId: String(item._id), boxesDelta: data.boxesDelta, looseDelta: data.looseDelta, bottleDelta, reason: data.reason },
      },
      session
    );
    return adjustment;
  });
}

export async function deleteDailyStock(id, user) {
  assertObjectId(id);
  return withTransaction(async (session) => {
    const record = await q(DailyStock.findById(id), session);
    if (!record) throw new AppError('Stock entry not found.', 404, 'NOT_FOUND');
    const item = await q(Item.findById(record.item), session);
    const snapshot = { date: record.date, itemName: record.itemName, id: String(record._id), itemId: record.item };
    await record.deleteOne(session ? { session } : undefined);
    await refreshNextOpening(snapshot.itemId, snapshot.date, session);
    if (item) await recalculateCurrentStock(item, session);
    await logAudit(
      {
        user,
        action: 'STOCK_DELETE',
        entity: 'DailyStock',
        entityId: snapshot.id,
        summary: `Deleted the ${snapshot.date} stock entry for ${snapshot.itemName}.`,
        details: snapshot,
      },
      session
    );
    return snapshot;
  });
}

function presentEntry(record) {
  if (!record) return null;
  return {
    id: String(record._id),
    updatedAt: record.updatedAt,
    openingBoxes: record.openingBoxes,
    openingLoose: record.openingLoose,
    receivedBoxes: record.receivedBoxes,
    receivedLoose: record.receivedLoose,
    closingBoxes: record.closingBoxes,
    closingLoose: record.closingLoose,
    unitsPerBox: record.unitsPerBox,
    sellingPrice: record.sellingPrice,
    adjustmentBottles: record.adjustmentBottles,
    openingTotal: record.openingTotal,
    receivedTotal: record.receivedTotal,
    closingTotal: record.closingTotal,
    availableTotal: record.availableTotal,
    soldBottles: record.soldBottles,
    salesRevenue: record.salesRevenue,
    flags: record.flags || [],
  };
}

export async function getDailyStockSheet(date) {
  if (!isISODate(date)) throw new AppError('Enter a valid date.', 400, 'VALIDATION');
  const entries = await DailyStock.find({ date }).lean();
  const enteredIds = entries.map((entry) => entry.item);
  const items = await Item.find({ $or: [{ active: true }, { _id: { $in: enteredIds } }] }).sort({ name: 1 }).lean();
  const entryMap = new Map(entries.map((entry) => [String(entry.item), entry]));
  const adjustments = await StockAdjustment.find({ date, item: { $in: items.map((item) => item._id) } })
    .sort({ createdAt: 1 })
    .lean();

  const rows = [];
  for (const item of items) {
    const entry = entryMap.get(String(item._id)) || null;
    const suggestion = await openingSuggestion(item._id, date);
    const itemAdjustments = adjustments.filter((adjustment) => String(adjustment.item) === String(item._id));
    const unitsPerBox = entry?.unitsPerBox || item.unitsPerBox;
    const sellingPrice = entry?.sellingPrice ?? item.sellingPrice;
    rows.push({
      itemId: String(item._id),
      name: item.name,
      category: item.category,
      size: item.size,
      active: item.active,
      unitsPerBox,
      sellingPrice,
      currentPrice: item.sellingPrice,
      currentBoxes: item.currentBoxes,
      currentLoose: item.currentLoose,
      suggestedOpeningBoxes: suggestion.boxes,
      suggestedOpeningLoose: suggestion.loose,
      suggestedFromDate: suggestion.fromDate,
      firstCount: !suggestion.fromDate,
      adjustmentBottles: itemAdjustments.reduce((sum, adjustment) => sum + adjustment.bottleDelta, 0),
      adjustments: itemAdjustments.map((adjustment) => ({
        id: String(adjustment._id),
        boxesDelta: adjustment.boxesDelta,
        looseDelta: adjustment.looseDelta,
        bottleDelta: adjustment.bottleDelta,
        reason: adjustment.reason,
        userName: adjustment.userName,
        createdAt: adjustment.createdAt,
      })),
      entry: presentEntry(entry),
    });
  }
  return { date, items: rows };
}
