const FRAMEWORKS = [
  { framework: 'nextjs', version: '16.0', bias: 0.035 },
  { framework: 'nuxt', version: '4.0', bias: 0.015 },
  { framework: 'sveltekit', version: '2.8', bias: 0.055 },
  { framework: 'astro', version: '5.0', bias: 0.075 },
];

const ROUTES = [
  { route: '/', weight: 0 },
  { route: '/products', weight: 0.045 },
  { route: '/dashboard', weight: 0.08 },
];

const PRESETS = [
  { preset: 'desktop', timeFactor: 0.72, scoreBias: 0.035 },
  { preset: 'mobile', timeFactor: 1.18, scoreBias: -0.025 },
];

const RUNS = ['2026-07-12T09-30-00', '2026-07-13T09-30-00', '2026-07-14T09-30-00'];

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function round(value, digits = 0) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function buildRow({ runFolder, runIndex, frameworkData, frameworkIndex, routeData, routeIndex, presetData, iteration }) {
  const variation = (((frameworkIndex + 1) * 13 + routeIndex * 7 + iteration * 5 + runIndex * 3) % 17) - 8;
  const trend = runIndex * 0.012;
  const performanceScore = clamp(0.86 + frameworkData.bias + presetData.scoreBias - routeData.weight + trend - Math.abs(variation) * 0.0025, 0.55, 0.99);
  const baseTime = (560 + routeIndex * 280 - frameworkData.bias * 1600 - runIndex * 28 + variation * 9) * presetData.timeFactor;
  const timestamp = new Date(Date.UTC(2026, 6, 12 + runIndex, 9, 30 + iteration * 2, frameworkIndex * 5)).toISOString();
  const artifactBase = `${runFolder}/${frameworkData.framework}-${frameworkData.version}/${presetData.preset}${routeData.route === '/' ? '-home' : routeData.route.replaceAll('/', '-')}-${iteration}`;

  return {
    runId: runFolder,
    runFolder,
    timestamp,
    framework: frameworkData.framework,
    version: frameworkData.version,
    port: 3000 + frameworkIndex,
    route: routeData.route,
    url: `http://localhost:${3000 + frameworkIndex}${routeData.route}`,
    preset: presetData.preset,
    iteration,
    performanceScore: round(performanceScore, 3),
    firstContentfulPaintMs: round(baseTime * 0.72),
    largestContentfulPaintMs: round(baseTime * 1.62),
    cumulativeLayoutShift: round(Math.max(0, 0.012 + routeIndex * 0.018 + variation * 0.0015), 3),
    totalBlockingTimeMs: round(Math.max(0, baseTime * 0.12 + routeIndex * 24 + variation * 2)),
    speedIndexMs: round(baseTime * 1.28),
    interactiveMs: round(baseTime * 1.76),
    serverResponseTimeMs: round(baseTime * 0.16),
    mainThreadWorkMs: round(baseTime * 0.46 + routeIndex * 35),
    totalByteWeight: round(165000 + routeIndex * 142000 + frameworkIndex * 17000 + variation * 1100),
    resourceCount: 18 + routeIndex * 9 + frameworkIndex * 2,
    categoryPerformance: round(performanceScore, 3),
    categoryAccessibility: round(clamp(0.9 + frameworkData.bias + trend - routeIndex * 0.012, 0, 1), 3),
    categoryBestPractices: round(clamp(0.88 + frameworkData.bias + trend - routeIndex * 0.008, 0, 1), 3),
    categorySeo: round(clamp(0.93 + trend - routeIndex * 0.014, 0, 1), 3),
    categoryAgenticBrowsing: Number.NaN,
    auditTotalCount: 162,
    passedAudits: Math.round(132 + performanceScore * 18),
    failedAudits: Math.max(2, Math.round(19 - performanceScore * 14 + routeIndex * 2)),
    notApplicableAudits: 11,
    informativeAudits: 8,
    manualAudits: 4,
    insightAuditCount: 12,
    diagnosticsItemCount: 7 + routeIndex * 3,
    runWarningCount: routeIndex === 2 && iteration === 3 ? 1 : 0,
    lighthouseVersion: '13.0.1',
    jsonReportPath: '',
    htmlReportPath: '',
    csvReportPath: '',
    jsonReportRelativePath: `${artifactBase}.json`,
    htmlReportRelativePath: `${artifactBase}.html`,
    csvReportRelativePath: `${artifactBase}.csv`,
  };
}

export function createMockLighthouseDataset() {
  const rows = [];

  RUNS.forEach((runFolder, runIndex) => {
    FRAMEWORKS.forEach((frameworkData, frameworkIndex) => {
      ROUTES.forEach((routeData, routeIndex) => {
        PRESETS.forEach((presetData) => {
          for (let iteration = 1; iteration <= 5; iteration += 1) {
            rows.push(buildRow({ runFolder, runIndex, frameworkData, frameworkIndex, routeData, routeIndex, presetData, iteration }));
          }
        });
      });
    });
  });

  const runs = RUNS.slice().reverse().map((runFolder) => {
    const runRows = rows.filter((row) => row.runFolder === runFolder);
    return {
      runFolder,
      summaryPath: '',
      rowCount: runRows.length,
      dateLabel: runFolder.slice(0, 10),
      frameworks: [...new Set(runRows.map((row) => `${row.framework}-${row.version}`))].sort(),
      versions: [...new Set(runRows.map((row) => row.version))].sort(),
      presets: [...new Set(runRows.map((row) => row.preset))].sort(),
      routes: [...new Set(runRows.map((row) => row.route))].sort(),
      iterationMin: 1,
      iterationMax: 5,
      firstTimestamp: runRows[0]?.timestamp ?? '',
      lastTimestamp: runRows.at(-1)?.timestamp ?? '',
    };
  });

  return {
    rows: rows.sort((left, right) => right.runFolder.localeCompare(left.runFolder)),
    runs,
    root: 'bundled://lighthouse-mock',
    latestRunFolder: runs[0]?.runFolder,
    source: 'mock',
    sourceLabel: 'Bundled deterministic demo data',
  };
}
