import bcrypt from 'bcryptjs';
import { User } from './models/User.js';
import { Item } from './models/Item.js';
import { DailyStock } from './models/DailyStock.js';
import { Settings } from './models/Settings.js';
import { PriceHistory } from './models/PriceHistory.js';
import { saveDailyStock, createAdjustment } from './services/stockService.js';
import { saveCollection } from './services/salesService.js';
import { addDays, todayISO } from './utils/dates.js';
import { roundMoney } from '../../shared/stockCalculation.js';

export const SEED_USERS = [
  { name: 'Bar Admin', username: 'admin', password: 'admin#2026', role: 'admin' },
];

export async function ensureUsernames() {
  const indexes = await User.collection.indexes();
  const emailIndex = indexes.find((index) => index.key && index.key.email);
  if (emailIndex) await User.collection.dropIndex(emailIndex.name);
  const legacy = await User.collection.find({ username: { $exists: false }, email: { $exists: true } }).toArray();
  for (const user of legacy) {
    const username = String(user.email).split('@')[0].toLowerCase();
    await User.collection.updateOne({ _id: user._id }, { $set: { username }, $unset: { email: '' } });
  }
  await User.updateMany({ username: { $in: ['manager', 'staff'] } }, { $set: { active: false } });
}

export const SEED_ITEMS = [
  { name: 'GM 180', category: 'Liquor', size: '180 ml', unitsPerBox: 48, sellingPrice: 120 },
  { name: 'GM 90', category: 'Liquor', size: '90 ml', unitsPerBox: 100, sellingPrice: 70 },
  { name: 'Tango 180', category: 'Liquor', size: '180 ml', unitsPerBox: 48, sellingPrice: 110 },
  { name: 'Tango 90', category: 'Liquor', size: '90 ml', unitsPerBox: 100, sellingPrice: 65 },
  { name: 'Soaf 180', category: 'Liquor', size: '180 ml', unitsPerBox: 48, sellingPrice: 100 },
  { name: 'Soaf 90', category: 'Liquor', size: '90 ml', unitsPerBox: 100, sellingPrice: 60 },
  { name: 'RD 180', category: 'Liquor', size: '180 ml', unitsPerBox: 48, sellingPrice: 90 },
];

function plan(unitsPerBox, low) {
  if (low) {
    return [
      { openingBoxes: 2, openingLoose: 0, receivedBoxes: 0, receivedLoose: 0, closingBoxes: 1, closingLoose: 20 },
      { openingBoxes: 1, openingLoose: 20, receivedBoxes: 0, receivedLoose: 0, closingBoxes: 0, closingLoose: 40 },
      { openingBoxes: 0, openingLoose: 40, receivedBoxes: 0, receivedLoose: 0, closingBoxes: 0, closingLoose: 25 },
    ];
  }
  if (unitsPerBox === 100) {
    return [
      { openingBoxes: 5, openingLoose: 0, receivedBoxes: 0, receivedLoose: 0, closingBoxes: 4, closingLoose: 40 },
      { openingBoxes: 4, openingLoose: 40, receivedBoxes: 1, receivedLoose: 0, closingBoxes: 5, closingLoose: 10 },
      { openingBoxes: 5, openingLoose: 10, receivedBoxes: 0, receivedLoose: 0, closingBoxes: 4, closingLoose: 50 },
    ];
  }
  return [
    { openingBoxes: 8, openingLoose: 0, receivedBoxes: 0, receivedLoose: 0, closingBoxes: 7, closingLoose: 30 },
    { openingBoxes: 7, openingLoose: 30, receivedBoxes: 1, receivedLoose: 0, closingBoxes: 8, closingLoose: 10 },
    { openingBoxes: 8, openingLoose: 10, receivedBoxes: 0, receivedLoose: 0, closingBoxes: 7, closingLoose: 40 },
  ];
}

export async function bootstrapProduction() {
  await ensureUsernames();
  if (process.env.NODE_ENV !== 'production') return;

  const activeAdmin = await User.exists({ role: 'admin', active: true });
  if (activeAdmin) return;

  const seed = SEED_USERS[0];
  const username = (process.env.INITIAL_ADMIN_USERNAME || seed.username).trim().toLowerCase();
  const password = process.env.INITIAL_ADMIN_PASSWORD || seed.password;
  if (!/^[a-zA-Z0-9._-]{3,40}$/.test(username)) {
    throw new Error('INITIAL_ADMIN_USERNAME must be 3–40 letters, numbers, dots, underscores, or hyphens.');
  }
  if (password.length < 8) {
    throw new Error('INITIAL_ADMIN_PASSWORD must contain at least 8 characters.');
  }

  const existing = await User.findOne({ username });
  if (existing) {
    if (existing.role !== 'admin') {
      throw new Error('The admin user name belongs to a non-admin account.');
    }
    existing.active = true;
    await existing.save();
    console.log(`Activated the production admin account ${username}.`);
    return;
  }

  await User.create({
    name: process.env.INITIAL_ADMIN_NAME?.trim() || seed.name,
    username,
    password: await bcrypt.hash(password, 12),
    role: 'admin',
    active: true,
  });
  console.log(`Created the production admin account ${username}.`);
}

export async function runSeed() {
  if (process.env.NODE_ENV === 'production') {
    await bootstrapProduction();
    return;
  }

  await ensureUsernames();

  const users = {};
  for (const seed of SEED_USERS) {
    let user = await User.findOne({ username: seed.username });
    if (!user) {
      user = await User.create({
        name: seed.name,
        username: seed.username,
        password: await bcrypt.hash(seed.password, 10),
        role: seed.role,
        active: true,
      });
      console.log(`Created ${seed.role} account: ${seed.username}`);
    }
    users[seed.role] = user;
  }

  await Settings.findOneAndUpdate(
    { key: 'app' },
    {
      key: 'app',
      businessName: 'Country Liquor Bar',
      address: '',
      phone: '',
      lowStockThresholdBottles: 48,
    },
    { upsert: true }
  );

  const admin = { id: String(users.admin._id), name: users.admin.name, role: 'admin' };
  const items = [];
  for (const seed of SEED_ITEMS) {
    let item = await Item.findOne({ nameKey: seed.name.toLowerCase() });
    if (!item) {
      item = await Item.create({ ...seed, nameKey: seed.name.toLowerCase(), active: true, createdBy: users.admin._id });
      await PriceHistory.create({
        item: item._id,
        itemName: item.name,
        price: item.sellingPrice,
        previousPrice: null,
        effectiveFrom: new Date(),
        changedBy: users.admin._id,
        changedByName: users.admin.name,
      });
    }
    items.push(item);
  }

  if ((await DailyStock.countDocuments()) > 0) {
    console.log('Daily stock already exists, so sample days were left unchanged.');
    return;
  }

  const today = todayISO();
  const dates = [addDays(today, -2), addDays(today, -1), today];
  for (let index = 0; index < dates.length; index += 1) {
    const entries = items.map((item) => ({
      itemId: String(item._id),
      ...plan(item.unitsPerBox, item.name === 'Soaf 90')[index],
    }));
    await saveDailyStock({ date: dates[index], entries, user: admin });
  }

  const rd = items.find((item) => item.name === 'RD 180');
  await createAdjustment({
    itemId: String(rd._id),
    date: today,
    boxesDelta: 0,
    looseDelta: -2,
    reason: '2 bottles with broken seals excluded from sales',
    user: admin,
  });

  for (const date of dates) {
    const rows = await DailyStock.find({ date });
    const revenue = roundMoney(rows.reduce((sum, row) => sum + row.salesRevenue, 0));
    await saveCollection(
      {
        date,
        cash: revenue,
        upi: 0,
        card: 0,
        other: 0,
        notes: 'Cash matches calculated sales.',
      },
      admin
    );
  }

  console.log('Sample stock for the last three days, one adjustment, and collections were created.');
  console.log('Sample selling prices are placeholders. Change them in Item Master.');
}
