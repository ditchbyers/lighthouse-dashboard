import Link from 'next/link';
import { notFound } from 'next/navigation';
import { loadRunWorkspace } from '../../../lib/lighthouse-audits';
import { formatDateTime } from '../../../lib/date-time';

export const dynamic = 'force-dynamic';

function formatNumber(value, digits = 2) {
  return Number.isFinite(value) ? value.toFixed(digits) : 'n/a';
}

function formatScore(value) {
  return Number.isFinite(value) ? `${(value * 100).toFixed(1)}%` : 'n/a';
}

function artifactHref(relativePath) {
  return `/api/reports?file=${encodeURIComponent(relativePath)}`;
}

export default async function SingleRunPage({ params }) {
  const resolvedParams = await params;
  const runFolder = decodeURIComponent(resolvedParams.runFolder ?? '');
  const workspace = await loadRunWorkspace(runFolder);

  if (!workspace) {
    notFound();
  }

  const uniqueFrameworks = new Set(workspace.rows.map((row) => `${row.framework}-${row.version}`));
  const uniqueRoutes = new Set(workspace.rows.map((row) => row.route));
  const uniquePresets = new Set(workspace.rows.map((row) => row.preset));

  return (
    <div className="space-y-6 min-w-0">
      <section className="rounded-3xl border border-white/10 bg-white/5 p-5">
        <p className="text-xs uppercase tracking-[0.25em] text-cyan-200/70">Single Run Diagnostic Workspace</p>
        <h1 className="mt-2 text-2xl font-semibold text-white">Run {workspace.runFolder}</h1>
        <p className="mt-2 text-sm text-slate-300">
          Full-fidelity view of one benchmark run. Jump from category-level summary to individual audits and raw artifacts.
        </p>
        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          <Link href="/runs" className="rounded-lg border border-white/20 bg-white/5 px-3 py-1.5 text-slate-100 hover:border-cyan-300/40 hover:bg-cyan-400/10">
            Back to run catalog
          </Link>
          <Link href={`/?runs=${encodeURIComponent(workspace.runFolder)}`} className="rounded-lg border border-cyan-300/30 bg-cyan-400/10 px-3 py-1.5 text-cyan-100 hover:bg-cyan-400/20">
            Open run in overview filters
          </Link>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <article className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Rows</p>
          <p className="mt-2 text-3xl font-semibold text-white">{workspace.rows.length}</p>
        </article>
        <article className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Frameworks</p>
          <p className="mt-2 text-3xl font-semibold text-white">{uniqueFrameworks.size}</p>
        </article>
        <article className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Routes</p>
          <p className="mt-2 text-3xl font-semibold text-white">{uniqueRoutes.size}</p>
        </article>
        <article className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Presets</p>
          <p className="mt-2 text-3xl font-semibold text-white">{uniquePresets.size}</p>
        </article>
        <article className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Run Warnings</p>
          <p className="mt-2 text-3xl font-semibold text-white">{workspace.runContext.runWarnings.length}</p>
        </article>
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/5 p-5 overflow-x-auto">
        <h2 className="text-lg font-semibold text-white">Run Context and Reproducibility</h2>
        <table className="mt-3 min-w-full border-collapse text-sm">
          <tbody>
            {[
              ['Lighthouse version', workspace.runContext.lighthouseVersion],
              ['Fetch time', formatDateTime(workspace.runContext.fetchTime)],
              ['Gather mode', workspace.runContext.gatherMode],
              ['Requested URL', workspace.runContext.requestedUrl],
              ['Final URL', workspace.runContext.finalUrl],
              ['Form factor', workspace.runContext.formFactor],
              ['Throttling method', workspace.runContext.throttlingMethod],
              ['Benchmark index', formatNumber(workspace.runContext.benchmarkIndex, 0)],
              ['User agent', workspace.runContext.userAgent],
            ].map(([label, value]) => (
              <tr key={label} className="border-b border-white/10">
                <td className="w-72 py-2 pr-4 text-slate-300">{label}</td>
                <td className="py-2 text-slate-100 break-all">{value || 'n/a'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/5 p-5 overflow-x-auto">
        <h2 className="text-lg font-semibold text-white">Category Score Envelope (Within This Run)</h2>
        <table className="mt-3 min-w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-white/10 text-left text-slate-300">
              <th className="py-2 pr-4">Category</th>
              <th className="py-2 pr-4">Average</th>
              <th className="py-2 pr-4">Minimum</th>
              <th className="py-2 pr-4">Maximum</th>
            </tr>
          </thead>
          <tbody>
            {workspace.categoryStats.map((category) => (
              <tr key={category.id} className="border-b border-white/5">
                <td className="py-2 pr-4 text-slate-100">{category.title}</td>
                <td className="py-2 pr-4 text-slate-200">{formatScore(category.scoreAvg)}</td>
                <td className="py-2 pr-4 text-slate-200">{formatScore(category.scoreMin)}</td>
                <td className="py-2 pr-4 text-slate-200">{formatScore(category.scoreMax)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/5 p-5 overflow-x-auto">
        <h2 className="text-lg font-semibold text-white">General Overview Rows (Compact)</h2>
        <table className="mt-3 min-w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-white/10 text-left text-slate-300">
              <th className="py-2 pr-4">Framework</th>
              <th className="py-2 pr-4">Route</th>
              <th className="py-2 pr-4">Preset</th>
              <th className="py-2 pr-4">Iteration</th>
              <th className="py-2 pr-4">Performance</th>
              <th className="py-2 pr-4">FCP (ms)</th>
              <th className="py-2 pr-4">LCP (ms)</th>
              <th className="py-2 pr-4">TBT (ms)</th>
              <th className="py-2 pr-4">CLS</th>
              <th className="py-2 pr-4">Warnings</th>
              <th className="py-2 pr-4">Artifacts</th>
            </tr>
          </thead>
          <tbody>
            {workspace.rows.map((row) => (
              <tr key={`${row.framework}-${row.version}-${row.preset}-${row.route}-${row.iteration}`} className="border-b border-white/5">
                <td className="py-2 pr-4 text-slate-100">{row.framework}-{row.version}</td>
                <td className="py-2 pr-4 text-slate-200">{row.route}</td>
                <td className="py-2 pr-4 text-slate-200">{row.preset}</td>
                <td className="py-2 pr-4 text-slate-200">{row.iteration}</td>
                <td className="py-2 pr-4 text-slate-200">{formatScore(row.performanceScore)}</td>
                <td className="py-2 pr-4 text-slate-200">{formatNumber(row.firstContentfulPaintMs, 0)}</td>
                <td className="py-2 pr-4 text-slate-200">{formatNumber(row.largestContentfulPaintMs, 0)}</td>
                <td className="py-2 pr-4 text-slate-200">{formatNumber(row.totalBlockingTimeMs, 0)}</td>
                <td className="py-2 pr-4 text-slate-200">{formatNumber(row.cumulativeLayoutShift, 3)}</td>
                <td className="py-2 pr-4 text-slate-200">{row.runWarningCount}</td>
                <td className="py-2 pr-4 text-xs">
                  <div className="flex gap-2">
                    <a href={artifactHref(row.jsonReportRelativePath)} target="_blank" rel="noreferrer" className="text-cyan-300 hover:text-cyan-100">json</a>
                    <a href={artifactHref(row.htmlReportRelativePath)} target="_blank" rel="noreferrer" className="text-cyan-300 hover:text-cyan-100">html</a>
                    <a href={artifactHref(row.csvReportRelativePath)} target="_blank" rel="noreferrer" className="text-cyan-300 hover:text-cyan-100">csv</a>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/5 p-5 overflow-x-auto">
        <h2 className="text-lg font-semibold text-white">Audit Index (Run Diagnostics)</h2>
        <table className="mt-3 min-w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-white/10 text-left text-slate-300">
              <th className="py-2 pr-4">Audit</th>
              <th className="py-2 pr-4">Mode</th>
              <th className="py-2 pr-4">Category refs</th>
              <th className="py-2 pr-4">Occurrences</th>
              <th className="py-2 pr-4">Failures</th>
              <th className="py-2 pr-4">Items</th>
              <th className="py-2 pr-4">Avg Score</th>
              <th className="py-2 pr-4">FCP Savings (ms)</th>
              <th className="py-2 pr-4">LCP Savings (ms)</th>
              <th className="py-2 pr-4">Action</th>
            </tr>
          </thead>
          <tbody>
            {workspace.audits.map((audit) => (
              <tr key={audit.id} className="border-b border-white/5 align-top">
                <td className="py-2 pr-4 text-slate-100">
                  <div>{audit.title}</div>
                  <div className="text-xs text-slate-400">{audit.id}</div>
                </td>
                <td className="py-2 pr-4 text-slate-200">{audit.scoreDisplayMode}</td>
                <td className="py-2 pr-4 text-slate-200 text-xs">
                  {audit.categoryRefs.length
                    ? audit.categoryRefs.map((ref) => `${ref.categoryId}:${ref.group || 'ungrouped'}(${ref.weight})`).join(', ')
                    : 'n/a'}
                </td>
                <td className="py-2 pr-4 text-slate-200">{audit.occurrences}</td>
                <td className="py-2 pr-4 text-rose-300">{audit.failed}</td>
                <td className="py-2 pr-4 text-slate-200">{audit.itemsTotal}</td>
                <td className="py-2 pr-4 text-slate-200">{Number.isFinite(audit.avgScore) ? formatScore(audit.avgScore) : 'n/a'}</td>
                <td className="py-2 pr-4 text-slate-200">{formatNumber(audit.savingsFcpMs, 0)}</td>
                <td className="py-2 pr-4 text-slate-200">{formatNumber(audit.savingsLcpMs, 0)}</td>
                <td className="py-2 pr-4 text-xs">
                  <Link
                    href={`/run/${encodeURIComponent(workspace.runFolder)}/audit/${encodeURIComponent(audit.id)}`}
                    className="rounded-lg border border-cyan-300/30 bg-cyan-400/10 px-2 py-1 text-cyan-100 hover:bg-cyan-400/20"
                  >
                    Deep dive
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
