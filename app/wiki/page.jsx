import Link from 'next/link';

export default function WikiHomePage() {
  return (
    <div className="space-y-6 min-w-0">
      <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <p className="text-xs uppercase tracking-[0.3em] text-cyan-200/70">Wiki</p>
        <h1 className="mt-2 text-3xl font-semibold text-white">Lighthouse Statistical Evaluation Handbook</h1>
        <p className="mt-3 text-sm leading-6 text-slate-300 max-w-4xl">
          This handbook documents the benchmark design, the meaning of each metric, the statistical treatment applied to repeated measurements, and the interpretation rules required for a scientifically defensible analysis.
          It is written for readers who need enough context to reproduce the experiment, understand the visualizations, and cite the dashboard in a university project or thesis.
        </p>
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <h2 className="text-xl font-semibold text-white">How to use this handbook</h2>
        <p className="mt-3 text-sm leading-6 text-slate-300">
          Start with the methodology page to understand how raw Lighthouse reports are collected and normalized. Then read the metrics and statistics pages to learn what each field means and why certain summary measures are preferred over raw single-point values. The framework page explains the benchmarking dimensions so tables and graphs can be interpreted correctly across runs, platforms, and iterations.
        </p>
        <div className="mt-4 flex flex-wrap gap-2 text-sm">
          {[
            { href: '/wiki/metrics', label: 'Metrics reference' },
            { href: '/wiki/statistics', label: 'Statistical values' },
            { href: '/wiki/frameworks', label: 'Framework terms' },
            { href: '/wiki/methodology', label: 'Methodology' },
          ].map((item) => (
            <Link key={item.href} href={item.href} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-slate-100 hover:border-cyan-300/50 hover:bg-cyan-400/10">
              {item.label}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
