import Link from 'next/link';
import { loadLighthouseDataset } from '../../lib/lighthouse-data';
import { formatDateTime, formatRunFolderDateTime } from '../../lib/date-time';

export const dynamic = 'force-dynamic';

export default async function RunsPage() {
  const dataset = await loadLighthouseDataset();

  return (
    <div className="space-y-6 min-w-0">
      <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <p className="text-xs uppercase tracking-[0.3em] text-cyan-200/70">Run Catalog</p>
        <h1 className="mt-2 text-3xl font-semibold text-white">Benchmark Run Index</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
          Browse all available benchmark runs. Open one run for deep-dive analysis or open the dashboard with any run preselected.
        </p>
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/5 p-5 overflow-x-auto">
        <table className="min-w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-white/10 text-left text-slate-300">
              <th className="py-2 pr-4">Run Folder</th>
              <th className="py-2 pr-4">Rows</th>
              <th className="py-2 pr-4">Frameworks</th>
              <th className="py-2 pr-4">Presets</th>
              <th className="py-2 pr-4">Routes</th>
              <th className="py-2 pr-4">Iteration Range</th>
              <th className="py-2 pr-4">Time Span</th>
              <th className="py-2 pr-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {dataset.runs.map((run) => (
              <tr key={run.runFolder} className="border-b border-white/5 align-top">
                <td className="py-2 pr-4 text-cyan-100">{formatRunFolderDateTime(run.runFolder)}</td>
                <td className="py-2 pr-4 text-slate-200">{run.rowCount}</td>
                <td className="py-2 pr-4 text-slate-200">{run.frameworks.length}</td>
                <td className="py-2 pr-4 text-slate-200">{run.presets.join(', ')}</td>
                <td className="py-2 pr-4 text-slate-200">{run.routes.length}</td>
                <td className="py-2 pr-4 text-slate-200">
                  {run.iterationMin ?? 'n/a'} - {run.iterationMax ?? 'n/a'}
                </td>
                <td className="py-2 pr-4 text-slate-200">
                  {formatDateTime(run.firstTimestamp)} - {formatDateTime(run.lastTimestamp)}
                </td>
                <td className="py-2 pr-4">
                  <div className="flex flex-wrap gap-2">
                    <Link href={`/run/${encodeURIComponent(run.runFolder)}`} className="rounded-lg border border-cyan-300/30 bg-cyan-400/10 px-2 py-1 text-xs text-cyan-100 hover:bg-cyan-400/20">
                      Single-run view
                    </Link>
                    <Link href={`/?runs=${encodeURIComponent(run.runFolder)}`} className="rounded-lg border border-white/20 bg-white/5 px-2 py-1 text-xs text-slate-100 hover:border-cyan-300/40 hover:bg-cyan-400/10">
                      Open in dashboard
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
