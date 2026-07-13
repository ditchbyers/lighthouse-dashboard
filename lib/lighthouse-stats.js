function percentile(sortedValues, fraction) {
  if (sortedValues.length === 0) return Number.NaN;
  if (sortedValues.length === 1) return sortedValues[0];

  const position = (sortedValues.length - 1) * fraction;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);

  if (lower === upper) return sortedValues[lower];
  const weight = position - lower;
  return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
}

function summarize(metric, values) {
  const sorted = [...values].sort((left, right) => left - right);
  const n = sorted.length;
  const mean = sorted.reduce((sum, value) => sum + value, 0) / n;
  const stdDev = n > 1 ? Math.sqrt(sorted.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (n - 1)) : 0;

  return {
    metric,
    n,
    mean,
    median: percentile(sorted, 0.5),
    stdDev,
    min: sorted[0],
    max: sorted[n - 1],
    p90: percentile(sorted, 0.9),
    p95: percentile(sorted, 0.95),
    iqr: percentile(sorted, 0.75) - percentile(sorted, 0.25),
  };
}

function aggregateBy(items, keyResolver) {
  const groups = new Map();
  for (const item of items) {
    const key = keyResolver(item);
    const group = groups.get(key) ?? [];
    group.push(item);
    groups.set(key, group);
  }
  return groups;
}

export function summarizeRows(rows) {
  const groupedByFramework = aggregateBy(rows, (row) => `${row.framework}|${row.version}|${row.preset}`);
  const performanceByGroup = [...groupedByFramework.entries()].map(([key, group]) => {
    const [framework, version, preset] = key.split('|');
    return {
      key,
      framework,
      version,
      preset,
      n: group.length,
      medianPerformanceScore: summarize('performanceScore', group.map((row) => row.performanceScore)).median,
      medianFcpMs: summarize('firstContentfulPaintMs', group.map((row) => row.firstContentfulPaintMs)).median,
      medianLcpMs: summarize('largestContentfulPaintMs', group.map((row) => row.largestContentfulPaintMs)).median,
      medianTbtMs: summarize('totalBlockingTimeMs', group.map((row) => row.totalBlockingTimeMs)).median,
      medianCls: summarize('cumulativeLayoutShift', group.map((row) => row.cumulativeLayoutShift)).median,
    };
  });

  const groupedByPlatform = aggregateBy(rows, (row) => row.preset);
  const platformMetrics = [...groupedByPlatform.entries()].map(([preset, group]) => ({
    preset,
    summaries: [
      summarize('performanceScore', group.map((row) => row.performanceScore)),
      summarize('firstContentfulPaintMs', group.map((row) => row.firstContentfulPaintMs)),
      summarize('largestContentfulPaintMs', group.map((row) => row.largestContentfulPaintMs)),
      summarize('totalBlockingTimeMs', group.map((row) => row.totalBlockingTimeMs)),
      summarize('speedIndexMs', group.map((row) => row.speedIndexMs)),
      summarize('interactiveMs', group.map((row) => row.interactiveMs)),
      summarize('serverResponseTimeMs', group.map((row) => row.serverResponseTimeMs)),
      summarize('cumulativeLayoutShift', group.map((row) => row.cumulativeLayoutShift)),
    ],
  }));

  const groupedByRoute = aggregateBy(rows, (row) => `${row.route}|${row.preset}`);
  const routeMetrics = [...groupedByRoute.entries()].map(([key, group]) => {
    const [route, preset] = key.split('|');
    return {
      route,
      preset,
      n: group.length,
      medianPerformanceScore: summarize('performanceScore', group.map((row) => row.performanceScore)).median,
      medianLcpMs: summarize('largestContentfulPaintMs', group.map((row) => row.largestContentfulPaintMs)).median,
      medianTbtMs: summarize('totalBlockingTimeMs', group.map((row) => row.totalBlockingTimeMs)).median,
    };
  });

  const iterationSeries = rows
    .map((row) => ({
      runFolder: row.runFolder,
      framework: row.framework,
      version: row.version,
      preset: row.preset,
      route: row.route,
      iteration: row.iteration,
      performanceScore: row.performanceScore,
      fcpMs: row.firstContentfulPaintMs,
      lcpMs: row.largestContentfulPaintMs,
      tbtMs: row.totalBlockingTimeMs,
    }))
    .sort((left, right) => left.iteration - right.iteration);

  return {
    performanceByGroup,
    platformMetrics,
    routeMetrics,
    iterationSeries,
  };
}
