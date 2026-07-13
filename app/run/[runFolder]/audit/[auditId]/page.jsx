import Link from 'next/link';
import { notFound } from 'next/navigation';
import { loadAuditDetail } from '../../../../../lib/lighthouse-audits';
import { formatDateTime } from '../../../../../lib/date-time';

export const dynamic = 'force-dynamic';

function formatNumber(value, digits = 2) {
  return Number.isFinite(value) ? value.toFixed(digits) : 'n/a';
}

function formatScore(value) {
  return Number.isFinite(value) ? `${(value * 100).toFixed(1)}%` : 'n/a';
}

function stringifyValue(value) {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function artifactHref(relativePath) {
  return `/api/reports?file=${encodeURIComponent(relativePath)}`;
}

function DetailsTable({ headings, items }) {
  if (!headings.length || !items.length) {
    return <p className="text-sm text-slate-300">No tabular detail items available for this occurrence.</p>;
  }

  const previewItems = items.slice(0, 200);

  return (
    <div className="overflow-x-auto rounded-2xl border border-white/10 bg-slate-950/30 p-3">
      <table className="min-w-full border-collapse text-xs">
        <thead>
          <tr className="border-b border-white/10 text-left text-slate-300">
            {headings.map((heading, index) => (
              <th key={`${heading.key}-${index}`} className="py-2 pr-3">{heading.label || heading.key || `col-${index + 1}`}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {previewItems.map((item, rowIndex) => (
            <tr key={rowIndex} className="border-b border-white/5 align-top">
              {headings.map((heading, index) => (
                <td key={`${rowIndex}-${heading.key}-${index}`} className="py-2 pr-3 text-slate-200 break-all">
                  {stringifyValue(item?.[heading.key])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {items.length > previewItems.length && (
        <p className="mt-2 text-xs text-slate-400">
          Showing first {previewItems.length} rows out of {items.length}. Open the raw report JSON for full detail.
        </p>
      )}
    </div>
  );
}

export default async function AuditDetailPage({ params }) {
  const resolvedParams = await params;
  const runFolder = decodeURIComponent(resolvedParams.runFolder ?? '');
  const auditId = decodeURIComponent(resolvedParams.auditId ?? '');

  const detail = await loadAuditDetail(runFolder, auditId);
  if (!detail) {
    notFound();
  }

  if (!detail.occurrences.length) {
    return (
      <div className="space-y-4 min-w-0">
        <section className="rounded-3xl border border-white/10 bg-white/5 p-5">
          <h1 className="text-2xl font-semibold text-white">Audit {auditId} not found in run {runFolder}</h1>
          <Link href={`/run/${encodeURIComponent(runFolder)}`} className="mt-3 inline-block rounded-lg border border-white/20 bg-white/5 px-3 py-1.5 text-sm text-slate-100 hover:border-cyan-300/40 hover:bg-cyan-400/10">
            Back to run workspace
          </Link>
        </section>
      </div>
    );
  }

  const meta = detail.auditMeta;

  return (
    <div className="space-y-6 min-w-0">
      <section className="rounded-3xl border border-white/10 bg-white/5 p-5">
        <p className="text-xs uppercase tracking-[0.25em] text-cyan-200/70">Audit Deep Dive</p>
        <h1 className="mt-2 text-2xl font-semibold text-white">{meta?.title || auditId}</h1>
        <p className="mt-2 text-sm text-slate-300 break-all">{auditId}</p>
        {meta?.description && <p className="mt-2 text-sm text-slate-300">{meta.description}</p>}
        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          <Link href={`/run/${encodeURIComponent(runFolder)}`} className="rounded-lg border border-white/20 bg-white/5 px-3 py-1.5 text-slate-100 hover:border-cyan-300/40 hover:bg-cyan-400/10">
            Back to run workspace
          </Link>
          <Link href="/runs" className="rounded-lg border border-white/20 bg-white/5 px-3 py-1.5 text-slate-100 hover:border-cyan-300/40 hover:bg-cyan-400/10">
            Run catalog
          </Link>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <article className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Occurrences</p>
          <p className="mt-2 text-3xl font-semibold text-white">{detail.occurrences.length}</p>
        </article>
        <article className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Failures</p>
          <p className="mt-2 text-3xl font-semibold text-rose-300">{meta?.failed ?? 0}</p>
        </article>
        <article className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Avg Score</p>
          <p className="mt-2 text-3xl font-semibold text-white">{formatScore(meta?.avgScore)}</p>
        </article>
        <article className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">FCP Savings</p>
          <p className="mt-2 text-3xl font-semibold text-white">{formatNumber(meta?.savingsFcpMs, 0)} ms</p>
        </article>
        <article className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">LCP Savings</p>
          <p className="mt-2 text-3xl font-semibold text-white">{formatNumber(meta?.savingsLcpMs, 0)} ms</p>
        </article>
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/5 p-5 overflow-x-auto">
        <h2 className="text-lg font-semibold text-white">Audit Occurrences (General Overview)</h2>
        <table className="mt-3 min-w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-white/10 text-left text-slate-300">
              <th className="py-2 pr-4">Framework</th>
              <th className="py-2 pr-4">Route</th>
              <th className="py-2 pr-4">Preset</th>
              <th className="py-2 pr-4">Iteration</th>
              <th className="py-2 pr-4">Score Mode</th>
              <th className="py-2 pr-4">Score</th>
              <th className="py-2 pr-4">Numeric Value</th>
              <th className="py-2 pr-4">Display</th>
              <th className="py-2 pr-4">Details Type</th>
              <th className="py-2 pr-4">Item Count</th>
              <th className="py-2 pr-4">Report</th>
            </tr>
          </thead>
          <tbody>
            {detail.occurrences.map((entry) => (
              <tr key={entry.key} className="border-b border-white/5">
                <td className="py-2 pr-4 text-slate-100">{entry.framework}</td>
                <td className="py-2 pr-4 text-slate-200">{entry.route}</td>
                <td className="py-2 pr-4 text-slate-200">{entry.preset}</td>
                <td className="py-2 pr-4 text-slate-200">{entry.iteration}</td>
                <td className="py-2 pr-4 text-slate-200">{entry.scoreDisplayMode}</td>
                <td className="py-2 pr-4 text-slate-200">{Number.isFinite(entry.score) ? formatScore(entry.score) : 'n/a'}</td>
                <td className="py-2 pr-4 text-slate-200">{Number.isFinite(entry.numericValue) ? `${formatNumber(entry.numericValue, 2)} ${entry.numericUnit || ''}`.trim() : 'n/a'}</td>
                <td className="py-2 pr-4 text-slate-200">{entry.displayValue || 'n/a'}</td>
                <td className="py-2 pr-4 text-slate-200">{entry.detailsType}</td>
                <td className="py-2 pr-4 text-slate-200">{entry.itemCount}</td>
                <td className="py-2 pr-4 text-xs">
                  <a href={artifactHref(entry.reportLinks.json)} target="_blank" rel="noreferrer" className="text-cyan-300 hover:text-cyan-100">JSON</a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-white">Occurrence Detail Accordions (Max Detail)</h2>
        {detail.occurrences.map((entry) => (
          <details key={`detail-${entry.key}`} className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <summary className="cursor-pointer text-sm font-medium text-slate-100">
              {entry.framework} | {entry.route} | {entry.preset} | iter {entry.iteration} | {entry.detailsType}
            </summary>
            <div className="mt-3 space-y-3">
              <p className="text-xs text-slate-300">
                Timestamp: {formatDateTime(entry.timestamp)} | Score mode: {entry.scoreDisplayMode} | Score: {Number.isFinite(entry.score) ? formatScore(entry.score) : 'n/a'}
              </p>
              <DetailsTable headings={entry.headings} items={entry.items} />
              <details className="rounded-xl border border-white/10 bg-slate-950/30 p-3">
                <summary className="cursor-pointer text-xs text-slate-200">Raw audit JSON</summary>
                <pre className="mt-2 max-h-112 overflow-auto whitespace-pre-wrap break-all text-xs text-slate-300">
                  {JSON.stringify(entry.audit, null, 2)}
                </pre>
              </details>
            </div>
          </details>
        ))}
      </section>
    </div>
  );
}
