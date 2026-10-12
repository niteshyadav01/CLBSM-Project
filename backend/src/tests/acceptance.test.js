import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  calculateStock,
  evaluateStock,
  resolveSnapshot,
  salesRevenueFromSnapshot,
} from '../../../shared/stockCalculation.js';
import { assertCanWrite } from '../services/stockRules.js';

const base = {
  openingLoose: 0,
  receivedBoxes: 0,
  receivedLoose: 0,
  closingLoose: 0,
  unitsPerBox: 48,
  sellingPrice: 100,
  adjustmentBottles: 0,
};

describe('stock calculations', () => {
  it('sells 48 bottles when one sealed box of 48 leaves stock', () => {
    const result = evaluateStock({ ...base, openingBoxes: 5, closingBoxes: 4 });
    assert.equal(result.valid, true);
    assert.equal(result.openingTotal, 240);
    assert.equal(result.closingTotal, 192);
    assert.equal(result.soldBottles, 48);
    assert.equal(result.salesRevenue, 4800);
  });

  it('treats a sealed box moved to the table as zero sales', () => {
    const result = evaluateStock({
      ...base,
      openingBoxes: 2,
      openingLoose: 10,
      closingBoxes: 1,
      closingLoose: 58,
    });
    assert.equal(result.valid, true);
    assert.equal(result.openingTotal, 106);
    assert.equal(result.closingTotal, 106);
    assert.equal(result.soldBottles, 0);
    assert.equal(result.salesRevenue, 0);
  });

  it('sells 28 bottles after receiving 48 and closing at 120', () => {
    const loose = evaluateStock({
      ...base,
      openingBoxes: 0,
      openingLoose: 100,
      receivedLoose: 48,
      closingBoxes: 0,
      closingLoose: 120,
    });
    const boxed = evaluateStock({
      ...base,
      openingBoxes: 0,
      openingLoose: 100,
      receivedBoxes: 1,
      closingBoxes: 0,
      closingLoose: 120,
    });
    assert.equal(loose.soldBottles, 28);
    assert.equal(boxed.soldBottles, 28);
    assert.equal(calculateStock({ ...base, openingBoxes: 0, openingLoose: 100, receivedLoose: 48, closingBoxes: 0, closingLoose: 120 }).soldBottles, 28);
  });

  it('rejects closing stock above available stock unless an adjustment covers it', () => {
    const rejected = evaluateStock({ ...base, openingBoxes: 5, closingBoxes: 6 });
    assert.equal(rejected.valid, false);
    assert.equal(rejected.errors[0].code, 'CLOSING_EXCEEDS_AVAILABLE');

    const authorized = evaluateStock({ ...base, openingBoxes: 5, closingBoxes: 6, adjustmentBottles: 48 });
    assert.equal(authorized.valid, true);
    assert.equal(authorized.soldBottles, 0);
  });

  it('keeps historical revenue on the saved price when the item price changes', () => {
    const existing = { unitsPerBox: 48, sellingPrice: 90 };
    const item = { unitsPerBox: 48, sellingPrice: 140 };
    const snapshot = resolveSnapshot(existing, item);
    assert.equal(snapshot.sellingPrice, 90);
    assert.equal(snapshot.unitsPerBox, 48);
    assert.equal(resolveSnapshot(null, item).sellingPrice, 140);
    assert.equal(salesRevenueFromSnapshot(10, snapshot.sellingPrice), 900);
    item.sellingPrice = 200;
    assert.equal(salesRevenueFromSnapshot(10, snapshot.sellingPrice), 900);
  });

  it('blocks a second device from creating a duplicate or overwriting a newer save', () => {
    const existing = { _id: 'abc123', updatedAt: '2026-10-12T08:00:00.000Z' };
    assert.doesNotThrow(() => assertCanWrite(null, null, null));
    assert.throws(() => assertCanWrite(existing, null, null), /already exists/);
    assert.throws(() => assertCanWrite(existing, 'abc123', '2026-10-12T07:00:00.000Z'), /another device/);
    assert.doesNotThrow(() => assertCanWrite(existing, 'abc123', '2026-10-12T08:00:00.000Z'));
  });
});
