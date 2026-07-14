import Link from 'next/link';
import { notFound } from 'next/navigation';
import { loadLighthouseDataset } from '../../../../../lib/lighthouse-data';
import { CategoryProfile, FrameworkComparison, SourceNotice } from '../../../../components/LighthouseCharts';

export const dynamic = 'force-dynamic';

function average(rows, field) {
  const values = rows.map((row) => Number(row[field])).filter(Number.isFinite);
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : Number.NaN;
}

function format(value, digits = 0) {
  return Number.isFinite(value) ? value.toFixed(digits) : 'n/a';
}

function MetricCard({ label, value, detail }) {
  return (
    <article className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <p className="text-xs uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-white">{value}</p>
      <p className="mt-1 text-xs text-slate-400">{detail}</p>
    </article>
  );
}

export default async function IterationPage({ params }) {
  const resolvedParams = await params;
  const runFolder = decodeURIComponent(resolvedParams.runFolder ?? '');
  const iteration = Number(resolvedParams.iteration);
  const dataset = await loadLighthouseDataset();
  const rows = dataset.rows.filter((row) => row.runFolder === runFolder && row.iteration === iteration);

  if (!rows.length || !Number.isInteger(iteration)) notFound();

  const frameworks = new Set(rows.map((row) => `${row.framework}-${row.version}`));
  const routes = new Set(rows.map((row) => row.route));
  const avgPerformance = average(rows, 'performanceScore') * 100;
  const avgLcp = average(rows, 'largestContentfulPaintMs');
  const avgTbt = average(rows, 'totalBlockingTimeMs');

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <p className="text-xs uppercase tracking-[0.28em] text-cyan-200/70">Run-scoped iteration</p>
        <h1 className="mt-2 text-3xl font-semibold text-white">Iteration {iteration}</h1>
        <p className="mt-2 text-sm text-slate-300">Framework, category, timing, and route signals for run {runFolder}.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href={`/run/${encodeURIComponent(runFolder)}`} className="rounded-lg border border-white/10 px-3 py-2 text-sm text-slate-100 hover:border-cyan-300/40 hover:bg-cyan-400/10">Back to run</Link>
          <Link href={`/?runs=${encodeURIComponent(runFolder)}&iterations=${iteration}`} className="rounded-lg border border-cyan-300/30 bg-cyan-400/10 px-3 py-2 text-sm text-cyan-100 hover:bg-cyan-400/20">Open in dashboard</Link>
        </div>
      </section>

      <SourceNotice source={dataset.source} sourceLabel={dataset.sourceLabel} />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Measurements" value={rows.length} detail={`${frameworks.size} frameworks · ${routes.size} routes`} />
        <MetricCard label="Performance" value={`${format(avgPerformance, 1)}%`} detail="Average Lighthouse score" />
        <MetricCard label="LCP" value={`${format(avgLcp)} ms`} detail="Average largest paint" />
        <MetricCard label="TBT" value={`${format(avgTbt)} ms`} detail="Average blocking time" />
        <MetricCard label="Transfer" value={`${format(average(rows, 'totalByteWeight') / 1024)} KB`} detail="Average page weight" />
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <FrameworkComparison rows={rows} title={`Framework comparison · iteration ${iteration}`} />
        <CategoryProfile rows={rows} title={`Category profile · iteration ${iteration}`} />
      </div>

      <section className="overflow-x-auto rounded-3xl border border-white/10 bg-white/5 p-5">
        <p className="text-xs uppercase tracking-[0.22em] text-cyan-200/70">Route breakdown</p>
        <h2 className="mt-1 text-lg font-semibold text-white">Individual measurements</h2>
        <table className="mt-4 min-w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-white/10 text-left text-slate-300">
              <th className="py-2 pr-4">Framework</th><th className="py-2 pr-4">Route</th><th className="py-2 pr-4">Preset</th><th className="py-2 pr-4">Score</th><th className="py-2 pr-4">FCP</th><th className="py-2 pr-4">LCP</th><th className="py-2 pr-4">TBT</th><th className="py-2 pr-4">CLS</th><th className="py-2 pr-4">Main thread</th><th className="py-2 pr-4">Transfer</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`${row.framework}-${row.version}-${row.route}-${row.preset}`} className="border-b border-white/5 text-slate-200">
                <td className="py-2 pr-4 text-white">{row.framework}-{row.version}</td><td className="py-2 pr-4">{row.route}</td><td className="py-2 pr-4">{row.preset}</td><td className="py-2 pr-4">{format(row.performanceScore * 100, 1)}%</td><td className="py-2 pr-4">{format(row.firstContentfulPaintMs)} ms</td><td className="py-2 pr-4">{format(row.largestContentfulPaintMs)} ms</td><td className="py-2 pr-4">{format(row.totalBlockingTimeMs)} ms</td><td className="py-2 pr-4">{format(row.cumulativeLayoutShift, 3)}</td><td className="py-2 pr-4">{format(row.mainThreadWorkMs)} ms</td><td className="py-2 pr-4">{format(row.totalByteWeight / 1024)} KB</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
