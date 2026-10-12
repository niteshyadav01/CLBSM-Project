import { Item } from '../models/Item.js';
import { DailyStock } from '../models/DailyStock.js';
import { PriceHistory } from '../models/PriceHistory.js';
import { AppError } from '../utils/AppError.js';
import { parseOrThrow, itemSchema, itemStatusSchema } from '../utils/validate.js';
import { escapeRegex } from '../utils/money.js';
import { isMoney } from '../../../shared/stockCalculation.js';
import { logAudit } from './auditService.js';

function publicItem(item) {
  return {
    id: String(item._id),
    name: item.name,
    category: item.category,
    size: item.size,
    unitsPerBox: item.unitsPerBox,
    sellingPrice: item.sellingPrice,
    active: item.active,
    currentBoxes: item.currentBoxes,
    currentLoose: item.currentLoose,
    stockAsOfDate: item.stockAsOfDate,
    totalBottles: item.currentBoxes * item.unitsPerBox + item.currentLoose,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

async function assertUniqueName(name, exceptId) {
  const existing = await Item.findOne({ nameKey: name.toLowerCase(), ...(exceptId ? { _id: { $ne: exceptId } } : {}) });
  if (existing) throw new AppError('An item with this name already exists.', 409, 'DUPLICATE');
}

export async function listItems({ search = '', includeInactive = true } = {}) {
  const query = {};
  if (!includeInactive) query.active = true;
  if (search) query.name = new RegExp(escapeRegex(search), 'i');
  const items = await Item.find(query).sort({ active: -1, name: 1 });
  return items.map(publicItem);
}

export async function createItem(body, user) {
  const data = parseOrThrow(itemSchema, body);
  if (!isMoney(data.sellingPrice)) throw new AppError('Enter a valid selling price.', 400, 'VALIDATION');
  await assertUniqueName(data.name);
  const item = await Item.create({
    ...data,
    nameKey: data.name.toLowerCase(),
    active: data.active !== false,
    createdBy: user.id,
  });
  await PriceHistory.create({
    item: item._id,
    itemName: item.name,
    price: item.sellingPrice,
    previousPrice: null,
    effectiveFrom: new Date(),
    changedBy: user.id,
    changedByName: user.name,
  });
  await logAudit({
    user,
    action: 'ITEM_CREATE',
    entity: 'Item',
    entityId: item._id,
    summary: `Added item ${item.name} (${item.size}, ${item.unitsPerBox} per box, ₹${item.sellingPrice}).`,
  });
  return publicItem(item);
}

export async function updateItem(id, body, user) {
  const data = parseOrThrow(itemSchema, body);
  if (!isMoney(data.sellingPrice)) throw new AppError('Enter a valid selling price.', 400, 'VALIDATION');
  const item = await Item.findById(id);
  if (!item) throw new AppError('Item not found.', 404, 'NOT_FOUND');
  await assertUniqueName(data.name, item._id);
  const previousPrice = item.sellingPrice;
  const previousUnits = item.unitsPerBox;
  item.name = data.name;
  item.nameKey = data.name.toLowerCase();
  item.category = data.category;
  item.size = data.size;
  item.unitsPerBox = data.unitsPerBox;
  item.sellingPrice = data.sellingPrice;
  if (data.active != null) item.active = data.active;
  await item.save();

  if (previousPrice !== item.sellingPrice) {
    await PriceHistory.create({
      item: item._id,
      itemName: item.name,
      price: item.sellingPrice,
      previousPrice,
      effectiveFrom: new Date(),
      changedBy: user.id,
      changedByName: user.name,
    });
    await logAudit({
      user,
      action: 'PRICE_CHANGE',
      entity: 'Item',
      entityId: item._id,
      summary: `Changed ${item.name} bottle price from ₹${previousPrice} to ₹${item.sellingPrice}. Earlier sales keep the old price.`,
      details: { previousPrice, price: item.sellingPrice },
    });
  }
  if (previousUnits !== item.unitsPerBox) {
    await logAudit({
      user,
      action: 'ITEM_UPDATE',
      entity: 'Item',
      entityId: item._id,
      summary: `Changed ${item.name} units per box from ${previousUnits} to ${item.unitsPerBox}. Saved days keep their original pack size.`,
    });
  } else if (previousPrice === item.sellingPrice) {
    await logAudit({
      user,
      action: 'ITEM_UPDATE',
      entity: 'Item',
      entityId: item._id,
      summary: `Updated item ${item.name}.`,
    });
  }
  return publicItem(item);
}

export async function setItemStatus(id, body, user) {
  const data = parseOrThrow(itemStatusSchema, body);
  const item = await Item.findById(id);
  if (!item) throw new AppError('Item not found.', 404, 'NOT_FOUND');
  item.active = data.active;
  await item.save();
  await logAudit({
    user,
    action: 'ITEM_STATUS',
    entity: 'Item',
    entityId: item._id,
    summary: `${data.active ? 'Activated' : 'Deactivated'} item ${item.name}.`,
  });
  return publicItem(item);
}

export async function removeItem(id, user) {
  const item = await Item.findById(id);
  if (!item) throw new AppError('Item not found.', 404, 'NOT_FOUND');
  const used = await DailyStock.exists({ item: item._id });
  if (used) throw new AppError('This item has stock history. Deactivate it instead of deleting it.', 400, 'IN_USE');
  await item.deleteOne();
  await logAudit({
    user,
    action: 'ITEM_DELETE',
    entity: 'Item',
    entityId: id,
    summary: `Deleted item ${item.name}.`,
  });
}
