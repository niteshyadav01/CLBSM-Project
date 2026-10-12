import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { displayValue } from './reportBuilders.js';
import { formatDisplayDate } from '../utils/dates.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const regularFont = path.resolve(__dirname, '../../assets/NotoSans-Regular.ttf');
const boldFont = path.resolve(__dirname, '../../assets/NotoSans-Bold.ttf');

function periodLabel(meta) {
  if (meta.from && meta.to) return `${formatDisplayDate(meta.from)} to ${formatDisplayDate(meta.to)}`;
  return meta.filterDescription || '';
}

function csvCell(value) {
  const text = String(value ?? '');
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  if (/[",\n\r]/.test(safe)) return `"${safe.replace(/"/g, '""')}"`;
  return safe;
}

export function toCsv(report) {
  const lines = [
    report.meta.businessName,
    report.meta.title,
    periodLabel(report.meta) ? `Period,${periodLabel(report.meta)}` : '',
    `Generated,${report.meta.generatedAt}`,
    report.meta.filterDescription ? `Filter,${report.meta.filterDescription}` : '',
    '',
    report.columns.map((column) => csvCell(column.label)).join(','),
    ...report.rows.map((row) => report.columns.map((column) => csvCell(displayValue(row[column.key], column.type))).join(',')),
  ];
  const totals = report.columns.map((column, index) => {
    if (index === 0) return 'Total';
    if (report.totals[column.key] == null) return '';
    return csvCell(displayValue(report.totals[column.key], column.type));
  });
  lines.push(totals.join(','));
  return `\uFEFF${lines.filter((line, index) => line !== '' || index > 4).join('\r\n')}`;
}

export async function toXlsx(report) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = report.meta.businessName;
  const sheet = workbook.addWorksheet('Report', { views: [{ showGridLines: false }] });
  sheet.addRow([report.meta.businessName]);
  sheet.addRow([report.meta.title]);
  sheet.addRow([periodLabel(report.meta) ? `Period: ${periodLabel(report.meta)}` : '']);
  sheet.addRow([`Generated: ${report.meta.generatedAt}`]);
  if (report.meta.filterDescription) sheet.addRow([`Filter: ${report.meta.filterDescription}`]);
  sheet.addRow([]);
  const header = sheet.addRow(report.columns.map((column) => column.label));
  header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF164C3C' } };
  for (const row of report.rows) {
    const excelRow = sheet.addRow(
      report.columns.map((column) => {
        const value = row[column.key];
        if (column.type === 'money' || column.type === 'number') return Number(value || 0);
        if (column.type === 'date') return displayValue(value, 'date');
        return value ?? '';
      })
    );
    report.columns.forEach((column, index) => {
      if (column.type === 'money') excelRow.getCell(index + 1).numFmt = '"₹"#,##,##0.00';
    });
  }
  const totalRow = sheet.addRow(
    report.columns.map((column, index) => {
      if (index === 0) return 'Total';
      if (report.totals[column.key] == null) return '';
      if (column.type === 'money' || column.type === 'number') return Number(report.totals[column.key]);
      return report.totals[column.key];
    })
  );
  totalRow.font = { bold: true };
  report.columns.forEach((column, index) => {
    if (column.type === 'money' && report.totals[column.key] != null) totalRow.getCell(index + 1).numFmt = '"₹"#,##,##0.00';
  });
  report.columns.forEach((column, index) => {
    sheet.getColumn(index + 1).width = Math.max(14, column.label.length + 4);
  });
  sheet.getColumn(1).width = 22;
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

function pdfBuffer(doc) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });
}

export function toPdf(report) {
  const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 36, compress: false });
  const done = pdfBuffer(doc);
  const hasFont = fs.existsSync(regularFont);
  const symbol = hasFont ? '₹' : 'Rs.';
  if (hasFont) {
    doc.registerFont('Regular', regularFont);
    doc.registerFont('Bold', fs.existsSync(boldFont) ? boldFont : regularFont);
  }
  const applyFont = (text, bold) => {
    const unicode = /[^\u0000-\u00ff]/.test(String(text ?? ''));
    if (unicode && hasFont) doc.font(bold ? 'Bold' : 'Regular');
    else doc.font(bold ? 'Helvetica-Bold' : 'Helvetica');
    return doc;
  };
  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const columns = report.columns;
  const colWidth = pageWidth / columns.length;

  const drawHeader = () => {
    applyFont(report.meta.businessName, true).fontSize(16).fillColor('#10211b').text(report.meta.businessName, doc.page.margins.left, 36, { width: pageWidth });
    applyFont(report.meta.title, true).fontSize(13).text(report.meta.title, { width: pageWidth });
    applyFont('', false).fontSize(9).fillColor('#3f4d46');
    const bits = [periodLabel(report.meta) ? `Period: ${periodLabel(report.meta)}` : '', `Generated: ${report.meta.generatedAt}`, report.meta.filterDescription ? `Filter: ${report.meta.filterDescription}` : '']
      .filter(Boolean)
      .join('   ·   ');
    doc.text(bits, { width: pageWidth });
    doc.moveDown(0.4);
    return doc.y;
  };

  let y = drawHeader();
  const bottom = doc.page.height - 42;

  const drawColumnHeader = () => {
    doc.save();
    doc.rect(doc.page.margins.left, y, pageWidth, 18).fill('#164c3c');
    doc.fillColor('#ffffff').fontSize(7.5);
    columns.forEach((column, index) => {
      applyFont(column.label, true).fontSize(7.5).fillColor('#ffffff').text(column.label, doc.page.margins.left + index * colWidth + 3, y + 5, { width: colWidth - 6, lineBreak: false });
    });
    doc.restore();
    y += 18;
  };

  const drawRow = (row, bold, shade) => {
    if (y + 16 > bottom) {
      doc.addPage();
      y = 36;
      drawColumnHeader();
    }
    if (shade) doc.rect(doc.page.margins.left, y, pageWidth, 16).fill('#f4f1ea');
    columns.forEach((column, index) => {
      const raw = bold && index === 0 && row[column.key] == null ? 'Total' : row[column.key];
      const text = bold && index === 0 ? 'Total' : displayValue(raw, column.type, symbol);
      applyFont(text, bold).fontSize(7.5).fillColor('#10211b').text(String(text ?? ''), doc.page.margins.left + index * colWidth + 3, y + 4, { width: colWidth - 6, lineBreak: false });
    });
    y += 16;
  };

  if (!report.rows.length) {
    applyFont('No records for this filter.', false).fontSize(11).fillColor('#10211b').text('No records for this filter.', doc.page.margins.left, y + 12);
    doc.end();
    return done;
  }

  drawColumnHeader();
  report.rows.forEach((row, index) => drawRow(row, false, index % 2 === 1));
  const totalSource = {};
  columns.forEach((column, index) => {
    totalSource[column.key] = index === 0 ? 'Total' : report.totals[column.key];
  });
  drawRow(totalSource, true, false);
  doc.end();
  return done;
}

export async function exportReport(report, format) {
  const slug = report.type || 'report';
  const stamp = (report.meta.from && report.meta.to ? `${report.meta.from}_to_${report.meta.to}` : 'export').replace(/[^\dA-Za-z_-]/g, '');
  if (format === 'csv') {
    return { buffer: Buffer.from(toCsv(report), 'utf8'), mime: 'text/csv; charset=utf-8', filename: `${slug}-${stamp}.csv` };
  }
  if (format === 'xlsx') {
    return {
      buffer: await toXlsx(report),
      mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      filename: `${slug}-${stamp}.xlsx`,
    };
  }
  if (format === 'pdf') {
    return { buffer: await toPdf(report), mime: 'application/pdf', filename: `${slug}-${stamp}.pdf` };
  }
  return null;
}
