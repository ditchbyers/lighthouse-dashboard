const METRICS = [
  ['Performance Score', 'A composite Lighthouse score in the range [0, 1]. It summarizes the speed-related audit model into a single number. Higher is better. In the dashboard it is shown as a percentage, but it should still be interpreted as a normalized score rather than a literal percentage of performance.'],
  ['FCP (First Contentful Paint)', 'The time in milliseconds until the browser renders the first text or image content. It captures how quickly a page gives the user visible feedback. Lower is better and usually correlates with better perceived responsiveness.'],
  ['LCP (Largest Contentful Paint)', 'The time in milliseconds until the largest visible content element is rendered. This is one of the most important user-centric loading metrics because it approximates when the main content becomes useful. Lower is better.'],
  ['TBT (Total Blocking Time)', 'The amount of main-thread time, in milliseconds, where long tasks block input responsiveness between First Contentful Paint and Time to Interactive. Lower is better and often indicates less JavaScript contention.'],
  ['Speed Index', 'A visual progress metric expressed in milliseconds. It estimates how fast the visible portion of the page is populated during load. Lower is better.'],
  ['CLS (Cumulative Layout Shift)', 'A unitless stability score that measures unexpected layout movement during load. Lower is better. Values close to zero indicate that the layout is stable and users are less likely to click the wrong element.'],
  ['Accessibility Score', 'A normalized score derived from Lighthouse accessibility audits. Higher is better, but a high score does not guarantee complete accessibility compliance; it only indicates fewer detected issues in the audited rule set.'],
  ['Best Practices Score', 'A normalized score that reflects implementation quality, security-related practices, and browser compatibility checks. Higher is better. It should be read as a diagnostic quality indicator rather than a formal security assessment.'],
  ['SEO Score', 'A normalized score that measures common search-engine discoverability checks. Higher is better. It is useful for comparing baseline technical SEO readiness across frameworks and routes.'],
  ['Failed Audits', 'Count of scored audits that did not pass their threshold. Lower is better. A higher count usually means more actionable optimization work remains.'],
  ['Insight Audits', 'Count of insight-oriented audits available in the Lighthouse report. These are not necessarily failures; they provide analytical context about resource usage, rendering strategy, or loading behavior.'],
  ['Diagnostics Items', 'Count of diagnostics detail items found in the Lighthouse JSON. These items help explain why a score or metric behaved the way it did, so they are important for root-cause analysis.'],
];

export default function WikiMetricsPage() {
  return (
    <div className="space-y-6 min-w-0">
      <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <h1 className="text-3xl font-semibold text-white">Metrics Reference</h1>
        <p className="mt-3 text-sm text-slate-300 max-w-4xl">
          The dashboard combines summary CSV fields with values extracted from raw Lighthouse JSON. That combination matters because the CSV gives a compact cross-run view, while the JSON reveals the audit context needed to explain why the numbers changed. Each metric below includes its unit, interpretation, and analytical role in the dashboard.
        </p>
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <h2 className="text-xl font-semibold text-white">How to interpret metrics in a thesis</h2>
        <p className="mt-3 text-sm leading-6 text-slate-300">
          When presenting results academically, avoid comparing only raw score values. Use the metric definition together with the route, platform, and iteration scope. For example, a framework with slightly worse performance score but much better CLS may provide a more stable user experience. The dashboard is designed to help identify that kind of trade-off, not just to rank a single number.
        </p>
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/5 p-5 overflow-x-auto">
        <table className="min-w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-white/10 text-left text-slate-300">
              <th className="py-2 pr-4">Metric</th>
              <th className="py-2 pr-4">Definition and interpretation</th>
            </tr>
          </thead>
          <tbody>
            {METRICS.map(([name, definition]) => (
              <tr key={name} className="border-b border-white/5">
                <td className="py-2 pr-4 text-white">{name}</td>
                <td className="py-2 pr-4 text-slate-200">{definition}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
