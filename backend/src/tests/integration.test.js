import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';

function systemMongod() {
  if (process.env.MONGOMS_SYSTEM_BINARY && fs.existsSync(process.env.MONGOMS_SYSTEM_BINARY)) {
    return process.env.MONGOMS_SYSTEM_BINARY;
  }
  const root = 'C:\\Program Files\\MongoDB\\Server';
  if (!fs.existsSync(root)) return '';
  const versions = fs.readdirSync(root).sort().reverse();
  for (const version of versions) {
    const executable = path.join(root, version, 'bin', 'mongod.exe');
    if (fs.existsSync(executable)) return executable;
  }
  return '';
}

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'integration-test-secret-key';
process.env.JWT_EXPIRES_IN = '1h';
process.env.CLIENT_ORIGIN = 'http://localhost:5173';

let replSet;
let app;
let request;
let adminToken;
let item;
let saved;

async function tokenFor(user) {
  return jwt.sign({ id: String(user._id), role: user.role }, process.env.JWT_SECRET, { expiresIn: '1h' });
}

describe('persisted stock, roles, and historical prices', () => {
  before(async () => {
    const { MongoMemoryReplSet } = await import('mongodb-memory-server');
    const binary = systemMongod();
    replSet = await MongoMemoryReplSet.create({
      replSet: { count: 1 },
      ...(binary ? { binary: { systemBinary: binary } } : {}),
    });
    process.env.MONGODB_URI = replSet.getUri();
    const { connectDB } = await import('../config/db.js');
    await connectDB();
    const application = await import('../app.js');
    app = application.createApp();
    const supertest = await import('supertest');
    request = supertest.default;
    const { User } = await import('../models/User.js');
    const admin = await User.create({
      name: 'Admin',
      username: 'admin',
      password: await bcrypt.hash('Admin@12345', 10),
      role: 'admin',
      active: true,
    });
    adminToken = await tokenFor(admin);
  }, { timeout: 180000 });

  after(async () => {
    await mongoose.disconnect();
    if (replSet) await replSet.stop();
  });

  it('signs in with the admin account and adds an item', async () => {
    const login = await request(app).post('/api/auth/login').send({ username: 'admin', password: 'Admin@12345' });
    assert.equal(login.status, 200);
    assert.equal(login.body.user.username, 'admin');
    assert.equal(login.body.user.role, 'admin');
    assert.ok(login.body.token);

    const created = await request(app).post('/api/items').set('Authorization', `Bearer ${adminToken}`).send({
      name: 'GM 180',
      category: 'Liquor',
      size: '180 ml',
      unitsPerBox: 48,
      buyingPrice: 75,
      sellingPrice: 100,
    });
    assert.equal(created.status, 201);
    assert.equal(created.body.item.buyingPrice, 75);
    item = created.body.item;
  });

  it('reports database readiness on the health endpoint', async () => {
    const response = await request(app).get('/api/health');
    assert.equal(response.status, 200);
    assert.deepEqual(response.body, { ok: true, service: 'clbsm-api' });
  });

  it('treats the first closing as opening stock and the next closing as that day’s sales', async () => {
    const firstDay = {
      date: '2026-01-15',
      entries: [{
        itemId: item.id,
        openingBoxes: 0,
        openingLoose: 0,
        receivedBoxes: 1,
        receivedLoose: 5,
        closingBoxes: 5,
        closingLoose: 0,
      }],
    };
    const first = await request(app).put('/api/daily-stock').set('Authorization', `Bearer ${adminToken}`).send(firstDay);
    assert.equal(first.status, 200, first.body.message);

    const duplicate = await request(app).put('/api/daily-stock').set('Authorization', `Bearer ${adminToken}`).send(firstDay);
    assert.equal(duplicate.status, 409);

    const openingDay = await request(app).get('/api/daily-stock?date=2026-01-15').set('Authorization', `Bearer ${adminToken}`);
    const openingEntry = openingDay.body.items[0].entry;
    assert.equal(openingDay.body.items[0].firstCount, true);
    assert.equal(openingEntry.openingBoxes, 5);
    assert.equal(openingEntry.receivedBoxes, 0);
    assert.equal(openingEntry.soldBottles, 0);
    saved = openingEntry;

    const saleDay = await request(app).put('/api/daily-stock').set('Authorization', `Bearer ${adminToken}`).send({
      date: '2026-01-16',
      entries: [{
        itemId: item.id,
        openingBoxes: 0,
        openingLoose: 0,
        receivedBoxes: 0,
        receivedLoose: 0,
        closingBoxes: 4,
        closingLoose: 0,
      }],
    });
    assert.equal(saleDay.status, 200, saleDay.body.message);
    const sheet = await request(app).get('/api/daily-stock?date=2026-01-16').set('Authorization', `Bearer ${adminToken}`);
    assert.equal(sheet.body.items[0].firstCount, false);
    assert.equal(sheet.body.items[0].entry.openingBoxes, 5);
    assert.equal(sheet.body.items[0].entry.soldBottles, 48);
    assert.equal(sheet.body.items[0].entry.salesRevenue, 4800);

    const stale = await request(app).put('/api/daily-stock').set('Authorization', `Bearer ${adminToken}`).send({
      date: '2026-01-16',
      entries: [{
        itemId: item.id,
        existingId: sheet.body.items[0].entry.id,
        updatedAt: '2020-01-01T00:00:00.000Z',
        openingBoxes: 5,
        openingLoose: 0,
        receivedBoxes: 0,
        receivedLoose: 0,
        closingBoxes: 3,
        closingLoose: 0,
      }],
    });
    assert.equal(stale.status, 409);
  });

  it('rejects closing stock above available stock and allows an authorized adjustment', async () => {
    const tooHigh = await request(app).put('/api/daily-stock').set('Authorization', `Bearer ${adminToken}`).send({
      date: '2026-01-17',
      entries: [{
        itemId: item.id,
        openingBoxes: 4,
        openingLoose: 0,
        receivedBoxes: 0,
        receivedLoose: 0,
        closingBoxes: 5,
        closingLoose: 0,
      }],
    });
    assert.equal(tooHigh.status, 400);
    assert.equal(tooHigh.body.code, 'CLOSING_EXCEEDS_AVAILABLE');

    const adjustment = await request(app).post('/api/inventory/adjustments').set('Authorization', `Bearer ${adminToken}`).send({
      itemId: item.id,
      date: '2026-01-17',
      boxesDelta: 1,
      looseDelta: 0,
      reason: 'Found one sealed box',
    });
    assert.equal(adjustment.status, 201);

    const savedHigh = await request(app).put('/api/daily-stock').set('Authorization', `Bearer ${adminToken}`).send({
      date: '2026-01-17',
      entries: [{
        itemId: item.id,
        openingBoxes: 4,
        openingLoose: 0,
        receivedBoxes: 0,
        receivedLoose: 0,
        closingBoxes: 5,
        closingLoose: 0,
      }],
    });
    assert.equal(savedHigh.status, 200, savedHigh.body.message);
    const sheet = await request(app).get('/api/daily-stock?date=2026-01-17').set('Authorization', `Bearer ${adminToken}`);
    assert.equal(sheet.body.items[0].entry.openingBoxes, 4);
    assert.equal(sheet.body.items[0].entry.soldBottles, 0);
  });

  it('does not change a saved sale when the current bottle price changes', async () => {
    const updated = await request(app).put(`/api/items/${item.id}`).set('Authorization', `Bearer ${adminToken}`).send({
      name: 'GM 180',
      category: 'Liquor',
      size: '180 ml',
      unitsPerBox: 48,
      buyingPrice: 80,
      sellingPrice: 180,
    });
    assert.equal(updated.status, 200);
    assert.equal(updated.body.item.buyingPrice, 80);
    const sales = await request(app).get('/api/sales?date=2026-01-16').set('Authorization', `Bearer ${adminToken}`);
    assert.equal(sales.body.lines[0].sellingPrice, 100);
    assert.equal(sales.body.lines[0].salesRevenue, 4800);
    assert.equal(sales.body.lines[0].currentPrice, 180);
    assert.equal(sales.body.totalRevenue, 4800);
  });

  it('exports the same total the report shows on screen', async () => {
    const report = await request(app)
      .get('/api/reports/daily-sales?from=2026-01-16&to=2026-01-16')
      .set('Authorization', `Bearer ${adminToken}`);
    assert.equal(report.status, 200);
    assert.equal(report.body.totals.salesRevenue, 4800);
    const exported = await request(app)
      .get('/api/reports/daily-sales/export?format=csv&from=2026-01-16&to=2026-01-16')
      .set('Authorization', `Bearer ${adminToken}`);
    assert.equal(exported.status, 200);
    assert.match(exported.text, /₹4,800\.00/);
    assert.match(exported.text, /16-01-2026/);
  });

  it('copies a changed closing into the next day’s opening', async () => {
    const edited = await request(app).put('/api/daily-stock').set('Authorization', `Bearer ${adminToken}`).send({
      date: '2026-01-15',
      entries: [{
        itemId: item.id,
        existingId: saved.id,
        updatedAt: saved.updatedAt,
        openingBoxes: 0,
        openingLoose: 0,
        receivedBoxes: 0,
        receivedLoose: 0,
        closingBoxes: 6,
        closingLoose: 0,
      }],
    });
    assert.equal(edited.status, 200, edited.body.message);
    const next = await request(app).get('/api/daily-stock?date=2026-01-16').set('Authorization', `Bearer ${adminToken}`);
    assert.equal(next.body.items[0].entry.openingBoxes, 6);
    assert.equal(next.body.items[0].entry.closingBoxes, 4);
    assert.equal(next.body.items[0].entry.soldBottles, 96);
  });
});
