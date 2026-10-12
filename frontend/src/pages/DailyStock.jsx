import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { evaluateStock } from '@shared/stockCalculation.js';
import { api } from '../api/client';
import { Banner, CountInput, PageHeader, Spinner } from '../components/ui';
import { useConfirm } from '../context/ConfirmContext';
import { useToast } from '../context/ToastContext';
import { formatINR, formatNumber, todayISO } from '../utils/format';

function numberOrNull(value) {
  if (value === '' || value == null) return null;
  const number = Number(value);
  return Number.isInteger(number) ? number : null;
}

function previewRow(row) {
  const closingBoxes = numberOrNull(row.closingBoxes);
  const closingLoose = numberOrNull(row.closingLoose);
  const receivedBoxes = row.firstCount ? 0 : numberOrNull(row.receivedBoxes);
  const receivedLoose = row.firstCount ? 0 : numberOrNull(row.receivedLoose);
  const openingBoxes = row.firstCount ? closingBoxes : row.suggestedOpeningBoxes;
  const openingLoose = row.firstCount ? closingLoose : row.suggestedOpeningLoose;
  if ([openingBoxes, openingLoose, receivedBoxes, receivedLoose, closingBoxes, closingLoose].some((value) => value == null)) {
    return {
      valid: false,
      errors: [{ message: row.firstCount ? 'Enter the stock on hand.' : 'Enter received and closing counts, using 0 where there is none.' }],
      warnings: [],
    };
  }
  if (openingBoxes < 0 || openingLoose < 0) {
    return {
      valid: false,
      errors: [{ message: 'Opening stock would be negative. Check the previous closing and any adjustments.' }],
      warnings: [],
    };
  }
  return evaluateStock({
    openingBoxes,
    openingLoose,
    receivedBoxes,
    receivedLoose,
    closingBoxes,
    closingLoose,
    unitsPerBox: row.unitsPerBox,
    sellingPrice: row.sellingPrice,
    adjustmentBottles: row.adjustmentBottles || 0,
  });
}

function ReadCount({ label, value }) {
  return (
    <div className="min-w-0">
      <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-stone-500">{label}</div>
      <div className="rounded-lg border border-line bg-stone-50 px-3 py-2 text-right text-sm font-semibold tabular-nums">{value}</div>
    </div>
  );
}

export default function DailyStock() {
  const toast = useToast();
  const confirm = useConfirm();
  const [params, setParams] = useSearchParams();
  const date = params.get('date') || todayISO();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function load(nextDate = date) {
    setLoading(true);
    setError('');
    try {
      const sheet = await api(`/daily-stock?date=${nextDate}`);
      setRows(
        sheet.items.map((item) => ({
          itemId: item.itemId,
          name: item.name,
          size: item.size,
          unitsPerBox: item.unitsPerBox,
          sellingPrice: item.sellingPrice,
          adjustmentBottles: item.adjustmentBottles,
          adjustments: item.adjustments,
          firstCount: item.firstCount,
          suggestedOpeningBoxes: item.suggestedOpeningBoxes,
          suggestedOpeningLoose: item.suggestedOpeningLoose,
          suggestedFromDate: item.suggestedFromDate,
          existingId: item.entry?.id || null,
          updatedAt: item.entry?.updatedAt || null,
          receivedBoxes: item.firstCount ? '0' : item.entry ? String(item.entry.receivedBoxes) : '0',
          receivedLoose: item.firstCount ? '0' : item.entry ? String(item.entry.receivedLoose) : '0',
          closingBoxes: item.entry ? String(item.entry.closingBoxes) : '',
          closingLoose: item.entry ? String(item.entry.closingLoose) : '',
        }))
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(date);
  }, [date]);

  useEffect(() => {
    const onKey = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        save();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const previews = useMemo(() => rows.map(previewRow), [rows]);
  const totals = previews.reduce(
    (sum, preview) => ({
      bottles: sum.bottles + (preview.valid ? preview.soldBottles : 0),
      revenue: sum.revenue + (preview.valid ? preview.salesRevenue : 0),
    }),
    { bottles: 0, revenue: 0 }
  );

  function update(index, field, value) {
    setRows((current) => current.map((row, rowIndex) => (rowIndex === index ? { ...row, [field]: value } : row)));
  }

  function copyOpenings() {
    setRows((current) =>
      current.map((row) =>
        row.firstCount
          ? row
          : {
              ...row,
              closingBoxes: String(Math.max(0, row.suggestedOpeningBoxes)),
              closingLoose: String(Math.max(0, row.suggestedOpeningLoose)),
            }
      )
    );
  }

  async function save() {
    const invalid = previews.find((preview) => !preview.valid);
    if (invalid) {
      toast(invalid.errors[0].message, 'error');
      return;
    }
    const warnings = previews.flatMap((preview, index) => preview.warnings.map((warning) => `${rows[index].name}: ${warning.message}`));
    if (warnings.length) {
      const ok = await confirm({
        title: 'Save unusual counts?',
        message: warnings.slice(0, 4).join(' '),
        confirmLabel: 'Save anyway',
      });
      if (!ok) return;
    }
    setSaving(true);
    try {
      const result = await api('/daily-stock', {
        method: 'PUT',
        body: {
          date,
          entries: rows.map((row) => {
            const closingBoxes = Number(row.closingBoxes);
            const closingLoose = Number(row.closingLoose);
            return {
              itemId: row.itemId,
              existingId: row.existingId,
              updatedAt: row.updatedAt,
              openingBoxes: row.firstCount ? closingBoxes : row.suggestedOpeningBoxes,
              openingLoose: row.firstCount ? closingLoose : row.suggestedOpeningLoose,
              receivedBoxes: row.firstCount ? 0 : Number(row.receivedBoxes),
              receivedLoose: row.firstCount ? 0 : Number(row.receivedLoose),
              closingBoxes,
              closingLoose,
            };
          }),
        },
      });
      toast(result.message);
      await load(date);
    } catch (err) {
      toast(err.message, 'error');
      if (err.status === 409) load(date);
    } finally {
      setSaving(false);
    }
  }

  async function remove(row) {
    if (!row.existingId) return;
    const ok = await confirm({
      title: `Delete ${row.name}?`,
      message: 'This removes today’s count. The next saved day will take its opening from the previous closing that remains.',
      confirmLabel: 'Delete entry',
      danger: true,
    });
    if (!ok) return;
    try {
      await api(`/daily-stock/${row.existingId}`, { method: 'DELETE' });
      toast('Stock entry deleted.');
      load(date);
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  return (
    <div className="pb-24 lg:pb-4">
      <PageHeader
        title="Daily stock"
        description="Enter closing stock once for the day. That closing becomes the next day’s opening. The first count is the starting stock and does not count as a sale."
      >
        <input className="field sm:w-44" aria-label="Stock date" type="date" value={date} onChange={(event) => setParams({ date: event.target.value })} />
        <button className="btn-secondary" type="button" onClick={copyOpenings}>No sales today</button>
        <button className="btn-primary" type="button" onClick={save} disabled={saving || loading}>
          {saving ? 'Saving…' : 'Save closing'}
        </button>
      </PageHeader>

      {loading && <Spinner label="Loading stock sheet" />}
      {error && <Banner>{error}</Banner>}
      {!loading && !error && rows.length === 0 && <Banner>No active items yet. Add them in Item Master.</Banner>}

      <div className="space-y-3 lg:hidden">
        {rows.map((row, index) => (
          <StockCard key={row.itemId} row={row} preview={previews[index]} onChange={(field, value) => update(index, field, value)} onDelete={() => remove(row)} />
        ))}
      </div>

      {!loading && rows.length > 0 && (
        <div className="card hidden table-wrap lg:block">
          <table className="grid-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Opening</th>
                <th className="bg-sky-50 text-sky-950">Received boxes</th>
                <th className="bg-amber-50 text-amber-950">Received loose</th>
                <th className="bg-sky-50 text-sky-950">Closing boxes</th>
                <th className="bg-amber-50 text-amber-950">Closing loose</th>
                <th>Sold</th>
                <th>Revenue</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => {
                const preview = previews[index];
                return (
                  <tr key={row.itemId}>
                    <td className="min-w-40">
                      <div className="font-semibold">{row.name}</div>
                      <div className="text-xs text-stone-500">{row.size} · {row.unitsPerBox}/box · {formatINR(row.sellingPrice)}</div>
                      {row.firstCount && <div className="mt-1 text-xs font-semibold text-pine-800">Starting stock</div>}
                      {row.adjustmentBottles !== 0 && <div className="text-xs font-semibold text-pine-800">Adjustment {formatNumber(row.adjustmentBottles)} bottles</div>}
                      {!preview.valid && <div className="mt-1 max-w-xs whitespace-normal text-xs text-red-700">{preview.errors[0]?.message}</div>}
                      {preview.warnings?.map((warning) => (
                        <div key={warning.code} className="mt-1 max-w-xs whitespace-normal text-xs text-amber-800">{warning.message}</div>
                      ))}
                      {row.existingId && (
                        <button className="mt-1 text-xs font-semibold text-red-700" type="button" onClick={() => remove(row)}>Delete</button>
                      )}
                    </td>
                    <td className="whitespace-nowrap text-sm font-semibold leading-5">
                      {row.firstCount ? (
                        'This count'
                      ) : (
                        <>
                          <div>{formatNumber(row.suggestedOpeningBoxes)} boxes</div>
                          <div className="text-stone-500">{formatNumber(row.suggestedOpeningLoose)} loose</div>
                        </>
                      )}
                    </td>
                    <td className="bg-sky-50/40">
                      {row.firstCount ? <span className="text-sm text-stone-400">—</span> : <CountInput tone="storage" value={row.receivedBoxes} onChange={(value) => update(index, 'receivedBoxes', value)} />}
                    </td>
                    <td className="bg-amber-50/40">
                      {row.firstCount ? <span className="text-sm text-stone-400">—</span> : <CountInput tone="table" value={row.receivedLoose} onChange={(value) => update(index, 'receivedLoose', value)} />}
                    </td>
                    <td className="bg-sky-50/40"><CountInput tone="storage" value={row.closingBoxes} onChange={(value) => update(index, 'closingBoxes', value)} /></td>
                    <td className="bg-amber-50/40"><CountInput tone="table" value={row.closingLoose} onChange={(value) => update(index, 'closingLoose', value)} /></td>
                    <td className="font-bold tabular-nums">{preview.valid ? formatNumber(preview.soldBottles) : '—'}</td>
                    <td className="font-bold tabular-nums">{preview.valid ? formatINR(preview.salesRevenue) : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {rows.length > 0 && (
        <div className="fixed inset-x-3 bottom-[4.75rem] z-20 flex flex-col gap-2 rounded-2xl border border-line bg-white px-3 py-3 shadow-card sm:flex-row sm:items-center sm:justify-between lg:sticky lg:bottom-3 lg:inset-x-auto">
          <div className="text-sm">
            <span className="font-bold">{formatNumber(totals.bottles)} bottles</span>
            <span className="mx-2 text-stone-300">·</span>
            <span className="font-bold">{formatINR(totals.revenue)}</span>
          </div>
          <button className="btn-primary w-full sm:w-auto" type="button" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Save closing'}
          </button>
        </div>
      )}
    </div>
  );
}

function StockCard({ row, preview, onChange, onDelete }) {
  return (
    <article className="card p-3 sm:p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-bold">{row.name}</div>
          <div className="text-xs text-stone-500">{row.size} · {row.unitsPerBox} per box · {formatINR(row.sellingPrice)}</div>
        </div>
        {row.existingId && <button className="shrink-0 text-xs font-semibold text-red-700" type="button" onClick={onDelete}>Delete</button>}
      </div>
      {row.firstCount ? (
        <p className="mt-2 text-xs leading-5 text-pine-800">Starting stock. This count becomes tomorrow’s opening. Nothing is sold today.</p>
      ) : (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <ReadCount label="Opening boxes" value={formatNumber(Math.max(0, row.suggestedOpeningBoxes))} />
          <ReadCount label="Opening loose" value={formatNumber(Math.max(0, row.suggestedOpeningLoose))} />
        </div>
      )}
      {!row.firstCount && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <CountInput label="Received boxes" tone="storage" value={row.receivedBoxes} onChange={(value) => onChange('receivedBoxes', value)} />
          <CountInput label="Received loose" tone="table" value={row.receivedLoose} onChange={(value) => onChange('receivedLoose', value)} />
        </div>
      )}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <CountInput label={row.firstCount ? 'Boxes on hand' : 'Closing boxes'} tone="storage" value={row.closingBoxes} onChange={(value) => onChange('closingBoxes', value)} />
        <CountInput label={row.firstCount ? 'Loose on hand' : 'Closing loose'} tone="table" value={row.closingLoose} onChange={(value) => onChange('closingLoose', value)} />
      </div>
      {row.adjustmentBottles !== 0 && <p className="mt-2 text-xs font-semibold text-pine-800">Adjustment {formatNumber(row.adjustmentBottles)} bottles</p>}
      <div className="mt-3 text-sm font-semibold">
        {preview.valid ? `${formatNumber(preview.soldBottles)} sold · ${formatINR(preview.salesRevenue)}` : <span className="font-medium text-red-700">{preview.errors[0]?.message}</span>}
      </div>
    </article>
  );
}
