const STATS = [
  ['n', 'The number of observations included after applying the current filters. It is the first value to check when judging whether a comparison is meaningful. Small sample sizes can make any summary statistic unstable.'],
  ['Mean', 'The arithmetic average. It is simple and intuitive, but it is sensitive to skew and extreme values. For Lighthouse data this can be misleading when a few unusually slow iterations occur.'],
  ['Median', 'The middle observation after sorting. It is robust against outliers and is therefore a better central tendency measure for repeated Lighthouse measurements.'],
  ['Sample Standard Deviation', 'A spread measure computed with n - 1 in the denominator. It estimates how much the observations vary around the mean and is useful for discussing volatility.'],
  ['Q1', 'The 25th percentile. It marks the point below which one quarter of the observations fall. It is useful as the lower bound of the interquartile range.'],
  ['Q3', 'The 75th percentile. It marks the point below which three quarters of the observations fall. It is useful as the upper bound of the interquartile range.'],
  ['IQR', 'The interquartile range, defined as Q3 - Q1. It captures the central 50% of the data and is one of the best summary measures when values are noisy or contain outliers.'],
  ['p90', 'The 90th percentile. It is a tail-focused measure that helps identify the experience of the slower end of the distribution without being as extreme as the maximum.'],
  ['p95', 'The 95th percentile. It is a stricter tail metric than p90 and is useful when discussing near-worst-case behavior.'],
  ['Min/Max', 'The observed lower and upper extremes. These values can be informative but should be interpreted carefully because a single abnormal run can dominate the extremes.'],
];

export default function WikiStatisticsPage() {
  return (
    <div className="space-y-6 min-w-0">
      <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <h1 className="text-3xl font-semibold text-white">Statistical Values</h1>
        <p className="mt-3 text-sm text-slate-300 max-w-4xl">
          Repeated Lighthouse measurements are naturally noisy because rendering, CPU scheduling, caching, and network effects can vary across runs. The dashboard therefore emphasizes summary statistics that remain meaningful under small irregularities and allows the user to inspect the full distribution when more detail is needed.
        </p>
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <h2 className="text-xl font-semibold text-white">Why these statistics are used</h2>
        <p className="mt-3 text-sm leading-6 text-slate-300">
          In a university project, the goal is not only to report numbers but to justify why those numbers represent the underlying behavior. The median and IQR are preferred for ranking because they resist outliers. The mean and standard deviation remain useful for discussing average behavior and spread, but they should be paired with percentiles when the distribution is skewed. Tail metrics such as p90 and p95 are especially important when an evaluation focuses on worst-case user experience.
        </p>
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/5 p-5 overflow-x-auto">
        <table className="min-w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-white/10 text-left text-slate-300">
              <th className="py-2 pr-4">Term</th>
              <th className="py-2 pr-4">Explanation</th>
            </tr>
          </thead>
          <tbody>
            {STATS.map(([term, definition]) => (
              <tr key={term} className="border-b border-white/5">
                <td className="py-2 pr-4 text-white">{term}</td>
                <td className="py-2 pr-4 text-slate-200">{definition}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <h2 className="text-xl font-semibold text-white">Interpretation guidance</h2>
        <ul className="mt-3 space-y-2 text-sm text-slate-300">
          <li>Use median and IQR for cross-framework ranking under variable runtime noise.</li>
          <li>Use p90/p95 when evaluating worst-case user experience and tail regressions.</li>
          <li>Compare same platform preset and route before making framework conclusions.</li>
          <li>Prefer run-to-run trend analysis over single-run absolute values.</li>
        </ul>
      </section>
    </div>
  );
}
