import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import ExcelJS from 'exceljs';
import { buildReport, buildStockQuery, mapStock, matchesFilters } from '../services/reportBuilders.js';
import { exportReport, toCsv } from '../services/exportService.js';

const meta = {
  businessName: 'Country Liquor Bar',
  from: '2026-10-01',
  to: '2026-10-02',
  generatedAt: '12-10-2026 10:00:00 IST',
  filterDescription: 'Item: GM 180',
};

function stock(overrides) {
  return {
    date: '2026-10-01',
    itemId: 'item-a',
    itemName: 'GM 180',
    category: 'Liquor',
    size: '180 ml',
    unitsPerBox: 48,
    sellingPrice: 100,
    salesRevenue: 4800,
    soldBottles: 48,
    openingBoxes: 5,
    openingLoose: 0,
    receivedBoxes: 0,
    receivedLoose: 0,
    closingBoxes: 4,
    closingLoose: 0,
    openingTotal: 240,
    receivedTotal: 0,
    closingTotal: 192,
    adjustmentBottles: 0,
    availableTotal: 240,
    ...overrides,
  };
}

describe('reports and exports', () => {
  it('uses the saved selling price instead of a later item-master price', () => {
    const mapped = mapStock({
      ...stock(),
      item: { _id: 'item-a', name: 'GM 180', category: 'Liquor', size: '180 ml', sellingPrice: 999 },
      itemName: 'Previous label',
    });
    assert.equal(mapped.itemName, 'GM 180');
    assert.equal(mapped.sellingPrice, 100);
    assert.equal(mapped.salesRevenue, 4800);
  });

  it('makes export totals match the filtered on-screen report', async () => {
    const rows = [
      stock(),
      stock({
        date: '2026-10-02',
        itemId: 'item-b',
        itemName: 'Hidden Brand',
        soldBottles: 9,
        salesRevenue: 999,
        sellingPrice: 111,
      }),
    ];
    const filters = { from: '2026-10-01', to: '2026-10-02', itemId: 'item-a' };
    assert.deepEqual(buildStockQuery(filters), {
      date: { $gte: '2026-10-01', $lte: '2026-10-02' },
      item: 'item-a',
    });
    const filtered = rows.filter((row) => matchesFilters(row, filters));
    const report = buildReport('daily-sales', { stocks: filtered }, meta);
    assert.equal(report.rows.length, 1);
    assert.equal(report.totals.soldBottles, report.rows.reduce((sum, row) => sum + row.soldBottles, 0));
    assert.equal(report.totals.salesRevenue, report.rows.reduce((sum, row) => sum + row.salesRevenue, 0));
    assert.equal(report.totals.salesRevenue, 4800);

    const csv = toCsv(report);
    assert.match(csv, /Country Liquor Bar/);
    assert.match(csv, /GM 180/);
    assert.doesNotMatch(csv, /Hidden Brand/);
    assert.match(csv, /₹4,800\.00/);
    assert.match(csv, /01-10-2026/);

    const file = await exportReport(report, 'xlsx');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(file.buffer);
    const sheet = workbook.getWorksheet('Report');
    const values = [];
    sheet.eachRow((row) => values.push(row.values.slice(1)));
    const totalRow = values.find((row) => row[0] === 'Total');
    assert.equal(totalRow[5], 4800);
    assert.equal(values.some((row) => row.includes('Hidden Brand')), false);

    const pdf = await exportReport(report, 'pdf');
    assert.equal(pdf.buffer.subarray(0, 4).toString(), '%PDF');
    const pdfText = [...pdf.buffer.toString('latin1').matchAll(/<([0-9A-Fa-f]+)>/g)]
      .map((match) => Buffer.from(match[1], 'hex').toString('latin1'))
      .join('');
    assert.match(pdfText, /Country Liquor Bar/);
    assert.match(pdfText, /GM 180/);
    assert.match(pdfText, /Total/);
  });
});
