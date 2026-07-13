export default function WikiMethodologyPage() {
  return (
    <div className="space-y-6 min-w-0">
      <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <h1 className="text-3xl font-semibold text-white">Methodology</h1>
        <p className="mt-3 text-sm text-slate-300 max-w-4xl">
          This dashboard is designed for reproducible benchmark evaluation and comparison across framework variants. The methodology is intentionally transparent: the dashboard reads the raw reports, normalizes their structure, computes summary metrics, and then exposes both the compact statistics and the original evidence so conclusions can be checked rather than trusted blindly.
        </p>
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <h2 className="text-xl font-semibold text-white">Data provenance</h2>
        <p className="mt-3 text-sm leading-6 text-slate-300">
          Each run folder provides a summary CSV with one row per benchmark execution. The dashboard treats that file as the index of observed measurements. Raw JSON reports are then parsed to enrich the rows with category scores, audit counts, diagnostics, warnings, and metadata such as Lighthouse version and fetch time. This means every chart and table is backed by two layers of evidence: a compact summary layer and a detailed report layer.
        </p>
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <h2 className="text-xl font-semibold text-white">Scope modes</h2>
        <p className="mt-3 text-sm leading-6 text-slate-300">
          The dashboard supports all-runs mode, multi-run mode, and single-run mode. All-runs mode is useful when you want an overview of the complete benchmark history. Multi-run mode is appropriate for targeted comparisons, for example when contrasting two framework versions or two benchmarking days. Single-run mode locks one run folder and is the preferred mode for audit-level investigation because it keeps the evidence set fixed while you drill into metrics, plots, and raw artifacts.
        </p>
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <h2 className="text-xl font-semibold text-white">Reproducibility notes</h2>
        <p className="mt-3 text-sm leading-6 text-slate-300">
          To reproduce a result, compare like-for-like route and platform presets, report the number of iterations, and include the statistical context rather than a single point value. The exported CSV and PNG artifacts are intended for appendices, review comments, and transparent reporting. They make it possible to trace a figure back to the exact data rows that produced it.
        </p>
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <h2 className="text-xl font-semibold text-white">Recommended reporting structure</h2>
        <p className="mt-3 text-sm leading-6 text-slate-300">
          For a university project, the cleanest reporting structure is: describe the benchmark setup, explain the metrics and statistics, present the cross-framework comparisons, then discuss the audit-level findings and their limitations. This dashboard mirrors that order so readers can move from overview to evidence to interpretation without leaving the application.
        </p>
      </section>
    </div>
  );
}
