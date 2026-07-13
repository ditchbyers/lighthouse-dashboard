import { promises as fs } from 'fs';
import path from 'path';

const RESULTS_ROOT = path.resolve(process.cwd(), '../api/results/lighthouse');
const jsonCache = new Map();

const NUMERIC_HEADERS = new Set([
  'port',
  'iteration',
  'performance_score',
  'first_contentful_paint_ms',
  'largest_contentful_paint_ms',
  'cumulative_layout_shift',
  'total_blocking_time_ms',
  'speed_index_ms',
  'interactive_ms',
  'server_response_time_ms',
]);

function parseCsvLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];

    if (character === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (character === ',' && !inQuotes) {
      values.push(current);
      current = '';
      continue;
    }

    current += character;
  }

  values.push(current);
  return values;
}

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function percentile(sortedValues, fraction) {
  if (sortedValues.length === 0) return Number.NaN;
  if (sortedValues.length === 1) return sortedValues[0];

  const position = (sortedValues.length - 1) * fraction;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);

  if (lower === upper) {
    return sortedValues[lower];
  }

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

function parseSummaryCsv(csvText) {
  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length <= 1) {
    return [];
  }

  const headers = parseCsvLine(lines[0]);

  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    const record = {};

    headers.forEach((header, index) => {
      const rawValue = values[index] ?? '';
      record[header] = NUMERIC_HEADERS.has(header) ? toNumber(rawValue) : rawValue;
    });

    return {
      runId: String(record.run_id ?? ''),
      runFolder: String(record.run_id ?? ''),
      timestamp: String(record.timestamp ?? ''),
      framework: String(record.framework ?? ''),
      version: String(record.version ?? ''),
      port: Number(record.port ?? Number.NaN),
      route: String(record.route ?? ''),
      url: String(record.url ?? ''),
      preset: String(record.preset ?? ''),
      iteration: Number(record.iteration ?? Number.NaN),
      performanceScore: Number(record.performance_score ?? Number.NaN),
      firstContentfulPaintMs: Number(record.first_contentful_paint_ms ?? Number.NaN),
      largestContentfulPaintMs: Number(record.largest_contentful_paint_ms ?? Number.NaN),
      cumulativeLayoutShift: Number(record.cumulative_layout_shift ?? Number.NaN),
      totalBlockingTimeMs: Number(record.total_blocking_time_ms ?? Number.NaN),
      speedIndexMs: Number(record.speed_index_ms ?? Number.NaN),
      interactiveMs: Number(record.interactive_ms ?? Number.NaN),
      serverResponseTimeMs: Number(record.server_response_time_ms ?? Number.NaN),
      jsonReportPath: String(record.json_report ?? ''),
      htmlReportPath: String(record.html_report ?? ''),
      csvReportPath: String(record.csv_report ?? ''),
      jsonReportRelativePath: '',
      htmlReportRelativePath: '',
      csvReportRelativePath: '',
      categoryPerformance: Number.NaN,
      categoryAccessibility: Number.NaN,
      categoryBestPractices: Number.NaN,
      categorySeo: Number.NaN,
      categoryAgenticBrowsing: Number.NaN,
      auditTotalCount: 0,
      passedAudits: 0,
      failedAudits: 0,
      notApplicableAudits: 0,
      informativeAudits: 0,
      manualAudits: 0,
      insightAuditCount: 0,
      diagnosticsItemCount: 0,
      runWarningCount: 0,
      lighthouseVersion: '',
    };
  });
}

function toRelativeArtifactPath(absolutePath) {
  return path.relative(RESULTS_ROOT, absolutePath).replaceAll('\\', '/');
}

function normalizeAbsoluteArtifactPath(candidatePath) {
  if (!candidatePath) return '';
  if (path.isAbsolute(candidatePath)) return candidatePath;
  return path.resolve(RESULTS_ROOT, candidatePath);
}

function scoreValue(categories, key) {
  const category = categories?.[key];
  if (!category) return Number.NaN;
  const score = category.score;
  return Number.isFinite(score) ? score : Number.NaN;
}

function extractAuditStats(audits) {
  const values = Object.values(audits ?? {});
  let passed = 0;
  let failed = 0;
  let notApplicable = 0;
  let informative = 0;
  let manual = 0;
  let insights = 0;

  for (const audit of values) {
    const mode = audit?.scoreDisplayMode;
    const score = audit?.score;
    const id = String(audit?.id ?? '');

    if (id.endsWith('-insight')) insights += 1;

    if (mode === 'notApplicable') {
      notApplicable += 1;
      continue;
    }

    if (mode === 'informative') {
      informative += 1;
      continue;
    }

    if (mode === 'manual') {
      manual += 1;
      continue;
    }

    if (Number.isFinite(score)) {
      if (score >= 0.9) {
        passed += 1;
      } else {
        failed += 1;
      }
    }
  }

  return {
    auditTotalCount: values.length,
    passedAudits: passed,
    failedAudits: failed,
    notApplicableAudits: notApplicable,
    informativeAudits: informative,
    manualAudits: manual,
    insightAuditCount: insights,
  };
}

async function readJsonDetails(jsonPath) {
  if (!jsonPath) {
    return {
      categoryPerformance: Number.NaN,
      categoryAccessibility: Number.NaN,
      categoryBestPractices: Number.NaN,
      categorySeo: Number.NaN,
      categoryAgenticBrowsing: Number.NaN,
      auditTotalCount: 0,
      passedAudits: 0,
      failedAudits: 0,
      notApplicableAudits: 0,
      informativeAudits: 0,
      manualAudits: 0,
      insightAuditCount: 0,
      diagnosticsItemCount: 0,
      runWarningCount: 0,
      lighthouseVersion: '',
      fetchTime: '',
    };
  }

  if (jsonCache.has(jsonPath)) {
    return jsonCache.get(jsonPath);
  }

  let parsed = null;
  try {
    const text = await fs.readFile(jsonPath, 'utf8');
    parsed = JSON.parse(text);
  } catch {
    const empty = {
      categoryPerformance: Number.NaN,
      categoryAccessibility: Number.NaN,
      categoryBestPractices: Number.NaN,
      categorySeo: Number.NaN,
      categoryAgenticBrowsing: Number.NaN,
      auditTotalCount: 0,
      passedAudits: 0,
      failedAudits: 0,
      notApplicableAudits: 0,
      informativeAudits: 0,
      manualAudits: 0,
      insightAuditCount: 0,
      diagnosticsItemCount: 0,
      runWarningCount: 0,
      lighthouseVersion: '',
      fetchTime: '',
    };
    jsonCache.set(jsonPath, empty);
    return empty;
  }

  const lhr = parsed?.lhr ?? parsed;
  const categories = lhr?.categories ?? {};
  const audits = lhr?.audits ?? {};
  const diagnosticsItems = audits?.diagnostics?.details?.items ?? [];

  const details = {
    categoryPerformance: scoreValue(categories, 'performance'),
    categoryAccessibility: scoreValue(categories, 'accessibility'),
    categoryBestPractices: scoreValue(categories, 'best-practices'),
    categorySeo: scoreValue(categories, 'seo'),
    categoryAgenticBrowsing: scoreValue(categories, 'agentic-browsing'),
    diagnosticsItemCount: Array.isArray(diagnosticsItems) ? diagnosticsItems.length : 0,
    runWarningCount: Array.isArray(lhr?.runWarnings) ? lhr.runWarnings.length : 0,
    lighthouseVersion: String(lhr?.lighthouseVersion ?? ''),
    fetchTime: String(lhr?.fetchTime ?? ''),
    ...extractAuditStats(audits),
  };

  jsonCache.set(jsonPath, details);
  return details;
}

async function readSummaryFile(summaryPath) {
  const csvText = await fs.readFile(summaryPath, 'utf8');
  const runFolder = path.basename(path.dirname(summaryPath));

  const rows = parseSummaryCsv(csvText).map((row) => {
    const jsonAbsolutePath = normalizeAbsoluteArtifactPath(row.jsonReportPath);
    const htmlAbsolutePath = normalizeAbsoluteArtifactPath(row.htmlReportPath);
    const csvAbsolutePath = normalizeAbsoluteArtifactPath(row.csvReportPath);

    return {
      ...row,
      runFolder,
      runId: row.runId || runFolder,
      jsonReportPath: jsonAbsolutePath,
      htmlReportPath: htmlAbsolutePath,
      csvReportPath: csvAbsolutePath,
      jsonReportRelativePath: jsonAbsolutePath ? toRelativeArtifactPath(jsonAbsolutePath) : '',
      htmlReportRelativePath: htmlAbsolutePath ? toRelativeArtifactPath(htmlAbsolutePath) : '',
      csvReportRelativePath: csvAbsolutePath ? toRelativeArtifactPath(csvAbsolutePath) : '',
    };
  });

  return Promise.all(
    rows.map(async (row) => {
      const details = await readJsonDetails(row.jsonReportPath);
      return {
        ...row,
        ...details,
        timestamp: details.fetchTime || row.timestamp,
      };
    })
  );
}

async function readRuns(root) {
  const entries = await fs.readdir(root, { withFileTypes: true });
  const folders = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((left, right) => right.localeCompare(left));

  const runs = [];

  for (const runFolder of folders) {
    const summaryPath = path.join(root, runFolder, 'summary.csv');
    try {
      await fs.access(summaryPath);
      const rows = await readSummaryFile(summaryPath);
      const iterations = rows
        .map((row) => Number(row.iteration))
        .filter((value) => Number.isFinite(value))
        .sort((left, right) => left - right);
      const timestamps = rows
        .map((row) => Date.parse(row.timestamp))
        .filter((value) => Number.isFinite(value))
        .sort((left, right) => left - right);

      runs.push({
        runFolder,
        summaryPath,
        rowCount: rows.length,
        dateLabel: runFolder.slice(0, 10),
        frameworks: [...new Set(rows.map((row) => `${row.framework}-${row.version}`))].sort(),
        versions: [...new Set(rows.map((row) => row.version))].sort(),
        presets: [...new Set(rows.map((row) => row.preset))].sort(),
        routes: [...new Set(rows.map((row) => row.route))].sort(),
        iterationMin: iterations[0] ?? null,
        iterationMax: iterations[iterations.length - 1] ?? null,
        firstTimestamp: timestamps[0] ? new Date(timestamps[0]).toISOString() : '',
        lastTimestamp: timestamps[timestamps.length - 1] ? new Date(timestamps[timestamps.length - 1]).toISOString() : '',
      });
    } catch {
      continue;
    }
  }

  return runs;
}

export async function loadLighthouseDataset() {
  const runs = await readRuns(RESULTS_ROOT);
  const rows = [];

  for (const run of runs) {
    const runRows = await readSummaryFile(run.summaryPath);
    rows.push(...runRows);
  }

  return {
    rows,
    runs,
    root: RESULTS_ROOT,
    latestRunFolder: runs[0]?.runFolder,
  };
}

export function buildFilterState(dataset) {
  return {
    runFolders: dataset.runs.map((run) => run.runFolder),
    frameworks: [...new Set(dataset.rows.map((row) => `${row.framework}-${row.version}`))].sort(),
    presets: [...new Set(dataset.rows.map((row) => row.preset))].sort(),
    routes: [...new Set(dataset.rows.map((row) => row.route))].sort(),
    iterations: [...new Set(dataset.rows.map((row) => row.iteration))].sort((left, right) => left - right),
  };
}

function groupBy(items, keyResolver) {
  const groups = new Map();
  for (const item of items) {
    const key = keyResolver(item);
    const collection = groups.get(key) ?? [];
    collection.push(item);
    groups.set(key, collection);
  }
  return groups;
}

export function summarizeRows(rows) {
  const groupedByFramework = groupBy(rows, (row) => `${row.framework}|${row.version}|${row.preset}`);
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

  const groupedByPlatform = groupBy(rows, (row) => row.preset);
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

  const groupedByRoute = groupBy(rows, (row) => `${row.route}|${row.preset}`);
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

export function resolveArtifactUrl(relativePath) {
  return `/api/reports?file=${encodeURIComponent(relativePath)}`;
}

export function getResultsRoot() {
  return RESULTS_ROOT;
}
