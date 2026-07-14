'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { buildSearchParamsFromSelection } from '../../lib/filter-state';
import { formatDateTime, formatRunFolderDateTime } from '../../lib/date-time';

const Plot = dynamic(() => import('react-plotly.js'), { ssr: false });

async function downloadPlotImage(graph, filename) {
  if (!graph) return;
  const module = await import('plotly.js-dist-min');
  const plotly = module.default ?? module;
  await plotly.downloadImage(graph, { format: 'png', filename });
}

const FILTER_CARD = 'rounded-2xl border border-white/10 bg-white/5 p-4 shadow-[0_20px_80px_rgba(0,0,0,0.2)]';

const METRIC_LABELS = {
  performanceScore: 'Performance score',
  firstContentfulPaintMs: 'FCP (ms)',
  largestContentfulPaintMs: 'LCP (ms)',
  totalBlockingTimeMs: 'TBT (ms)',
  speedIndexMs: 'Speed index (ms)',
  cumulativeLayoutShift: 'CLS',
  categoryAccessibility: 'Accessibility score',
  categoryBestPractices: 'Best practices score',
  categorySeo: 'SEO score',
  insightAuditCount: 'Insight audits',
  diagnosticsItemCount: 'Diagnostics items',
  failedAudits: 'Failed audits',
};

const PRIMARY_METRICS = [
  'performanceScore',
  'firstContentfulPaintMs',
  'largestContentfulPaintMs',
  'totalBlockingTimeMs',
  'speedIndexMs',
  'cumulativeLayoutShift',
  'categoryAccessibility',
  'categoryBestPractices',
  'categorySeo',
  'failedAudits',
  'insightAuditCount',
  'diagnosticsItemCount',
];

const TREND_CHART_TYPES = ['line', 'scatter', 'bar', 'box', 'violin', 'histogram', 'heatmap'];
function formatNumber(value, digits = 2) {
  return Number.isFinite(value) ? value.toFixed(digits) : 'n/a';
}

function formatMetric(metric, value) {
  if (!Number.isFinite(value)) return 'n/a';
  if (
    metric === 'performanceScore'
    || metric === 'categoryAccessibility'
    || metric === 'categoryBestPractices'
    || metric === 'categorySeo'
    || metric === 'categoryAgenticBrowsing'
  ) {
    return `${(value * 100).toFixed(1)}%`;
  }
  if (metric === 'cumulativeLayoutShift') return value.toFixed(3);
  return value.toFixed(2);
}

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

function artifactHref(relativePath) {
  return `/api/reports?file=${encodeURIComponent(relativePath)}`;
}

function rowKey(row) {
  return `${row.runFolder}|${row.framework}|${row.version}|${row.preset}|${row.route}|${row.iteration}`;
}

function frameworkKey(row) {
  return `${row.framework}-${row.version}`;
}

function frameworkPresetKey(row) {
  return `${frameworkKey(row)}|${row.preset}`;
}

function displayRunFolder(value) {
  return formatRunFolderDateTime(value);
}

function displayFilterValue(kind, value) {
  if (kind === 'runFolder') return displayRunFolder(value);
  return value;
}

function uniqueValues(items) {
  return [...new Set(items)];
}

function hashString(value) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function seriesColor(row) {
  const framework = frameworkKey(row).toLowerCase();
  if (framework.includes('nextjs')) {
    return row.preset.toLowerCase().includes('mobile') ? '#7dd3fc' : '#1d4ed8';
  }

  const palette = ['#7dd3fc', '#60a5fa', '#38bdf8', '#3b82f6', '#2dd4bf', '#8b5cf6', '#f59e0b', '#f472b6'];
  const presetBias = row.preset.toLowerCase().includes('mobile') ? 0 : 3;
  return palette[(hashString(framework) + presetBias) % palette.length];
}

function seriesName(row) {
  return `${frameworkKey(row)} / ${row.preset}`;
}

function setAll(items) {
  return [...items];
}

function toggleItem(items, item) {
  return items.includes(item) ? items.filter((entry) => entry !== item) : [...items, item];
}

function exportRowsAsCsv(filename, rows) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const csvLines = [headers.join(',')];
  for (const row of rows) {
    const values = headers.map((header) => {
      const raw = row[header] ?? '';
      const value = String(raw);
      return /[",\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
    });
    csvLines.push(values.join(','));
  }

  const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function tokensFromPlotEvent(event) {
  if (!event?.points?.length) return [];

  const tokens = event.points.flatMap((point) => {
    if (typeof point.customdata === 'string' && point.customdata) return [point.customdata];
    if (Array.isArray(point.customdata)) {
      return point.customdata.filter((value) => typeof value === 'string' && value);
    }
    if (typeof point.label === 'string' && point.label) return [point.label];
    if (Number.isFinite(point.x)) return [String(point.x)];
    if (typeof point.x === 'string' && point.x) return [point.x];
    return [];
  });

  return uniqueValues(tokens);
}

function makeSeriesHover(row, metricLabel, metricValue) {
  return [
    `<b>${seriesName(row)}</b>`,
    `Run: ${displayRunFolder(row.runFolder)}`,
    `Route: ${row.route}`,
    `Iteration: ${row.iteration}`,
    `${metricLabel}: ${metricValue}`,
  ].join('<br>');
}

function ToggleList({ label, values, selected, onChange, disabled = false, kind = 'default', search = '', onSearchChange = null, searchPlaceholder = '' }) {
  const normalizedSearch = search.trim().toLowerCase();
  const visibleValues = normalizedSearch
    ? values.filter((value) => displayFilterValue(kind, value).toLowerCase().includes(normalizedSearch))
    : values;

  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-2">
        <h3 className="text-sm font-semibold text-white">{label}</h3>
        <div className="flex gap-2 text-xs">
          <button
            type="button"
            onClick={() => onChange(setAll(values))}
            disabled={disabled}
            className="rounded-md border border-white/10 px-2 py-1 text-slate-200 hover:border-cyan-300/40 hover:bg-cyan-400/10"
          >
            All
          </button>
          <button
            type="button"
            onClick={() => onChange([])}
            disabled={disabled}
            className="rounded-md border border-white/10 px-2 py-1 text-slate-200 hover:border-cyan-300/40 hover:bg-cyan-400/10"
          >
            None
          </button>
        </div>
      </div>
      {onSearchChange && (
        <input
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder={searchPlaceholder || `Search ${label.toLowerCase()}...`}
          className="mb-2 w-full rounded-xl border border-white/10 bg-slate-950/50 px-3 py-2 text-sm text-white placeholder:text-slate-500 outline-none focus:border-cyan-300/60"
        />
      )}
      <div className="max-h-72 overflow-auto rounded-xl border border-white/10 bg-slate-950/40 p-2 space-y-1">
        {visibleValues.map((value) => (
          <label key={value} className="flex items-start gap-2 rounded-lg px-2 py-1.5 text-sm text-slate-200 hover:bg-white/5">
            <input
              type="checkbox"
              checked={selected.includes(value)}
              onChange={() => onChange(toggleItem(selected, value))}
              disabled={disabled}
              className="mt-1 accent-cyan-400"
            />
            <span className="break-all">{displayFilterValue(kind, value)}</span>
          </label>
        ))}
        {!visibleValues.length && <p className="px-2 py-2 text-xs text-slate-400">No values match the current search.</p>}
      </div>
    </div>
  );
}

function SummaryCard({ title, value, detail }) {
  return (
    <article className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <p className="text-xs uppercase tracking-[0.25em] text-slate-400">{title}</p>
      <p className="mt-2 text-3xl font-semibold text-white">{value}</p>
      <p className="mt-1 text-xs text-slate-300">{detail}</p>
    </article>
  );
}

function DataTable({ title, rows, columns, fileName }) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    setPage(1);
  }, [rows, fileName, title]);

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const startIndex = (currentPage - 1) * pageSize;
  const visibleRows = rows.slice(startIndex, startIndex + pageSize);

  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-4 overflow-x-auto">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h3 className="text-base font-semibold text-white">{title}</h3>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={pageSize}
            onChange={(event) => setPageSize(Number(event.target.value))}
            className="rounded-lg border border-white/10 bg-slate-950/60 px-2 py-1.5 text-xs text-slate-100"
          >
            {[10, 25, 50, 100].map((size) => (
              <option key={size} value={size}>{size} / page</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => exportRowsAsCsv(fileName, rows)}
            className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-100 hover:border-cyan-300/40 hover:bg-cyan-400/10"
          >
            Export table CSV
          </button>
        </div>
      </div>
      <table className="min-w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-white/10 text-left text-slate-300">
            {columns.map((column) => (
              <th key={column.key} className="py-2 pr-4">{column.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visibleRows.map((row, index) => (
            <tr key={index} className="border-b border-white/5 align-top">
              {columns.map((column) => (
                <td key={column.key} className="py-2 pr-4 text-slate-200">
                  {column.render ? column.render(row[column.key], row) : String(row[column.key] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-300">
        <p>
          Showing {rows.length ? startIndex + 1 : 0}-{Math.min(startIndex + pageSize, rows.length)} of {rows.length}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            disabled={currentPage === 1}
            className="rounded-lg border border-white/10 px-3 py-1.5 text-slate-100 disabled:opacity-40"
          >
            Prev
          </button>
          <span className="rounded-lg border border-white/10 px-3 py-1.5 text-slate-200">
            Page {currentPage} / {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
            disabled={currentPage === totalPages}
            className="rounded-lg border border-white/10 px-3 py-1.5 text-slate-100 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>
    </section>
  );
}

export default function LighthouseExplorer({ dataset, filters, initialSelection, lockedRunFolder = '' }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const minIteration = filters.iterations[0] ?? 1;
  const maxIteration = filters.iterations[filters.iterations.length - 1] ?? minIteration;

  const [selectedRunFolders, setSelectedRunFolders] = useState(() => {
    if (lockedRunFolder) return [lockedRunFolder];
    if (initialSelection?.selectedRunFolders?.length) return initialSelection.selectedRunFolders;
    return setAll(filters.runFolders);
  });
  const [selectedFrameworks, setSelectedFrameworks] = useState(initialSelection?.selectedFrameworks?.length ? initialSelection.selectedFrameworks : setAll(filters.frameworks));
  const [selectedPresets, setSelectedPresets] = useState(initialSelection?.selectedPresets?.length ? initialSelection.selectedPresets : setAll(filters.presets));
  const [selectedRoutes, setSelectedRoutes] = useState(initialSelection?.selectedRoutes?.length ? initialSelection.selectedRoutes : setAll(filters.routes));
  const [iterationMin] = useState(() => Math.max(minIteration, Math.min(maxIteration, initialSelection?.iterationMin ?? minIteration)));
  const [iterationMax] = useState(() => Math.max(minIteration, Math.min(maxIteration, initialSelection?.iterationMax ?? maxIteration)));
  const [routeSearch, setRouteSearch] = useState(initialSelection?.routeSearch ?? '');
  const [trendMetric, setTrendMetric] = useState(initialSelection?.trendMetric ?? 'largestContentfulPaintMs');
  const [trendChartType, setTrendChartType] = useState(initialSelection?.trendChartType ?? 'line');
  const [trendBasis, setTrendBasis] = useState('iteration');
  const [diagnosticHeatMetric, setDiagnosticHeatMetric] = useState('failedAudits');
  const [selectedTrendKeys, setSelectedTrendKeys] = useState([]);
  const [runFolderFilterSearch, setRunFolderFilterSearch] = useState('');
  const [frameworkFilterSearch, setFrameworkFilterSearch] = useState('');
  const [platformFilterSearch, setPlatformFilterSearch] = useState('');
  const [routeFilterSearch, setRouteFilterSearch] = useState('');

  const trendGraphRef = useRef(null);
  const diagnosticHeatGraphRef = useRef(null);

  useEffect(() => {
    if (!lockedRunFolder) return;
    setSelectedRunFolders((current) => (current.length === 1 && current[0] === lockedRunFolder ? current : [lockedRunFolder]));
  }, [lockedRunFolder]);

  const currentQuery = searchParams.toString();

  useEffect(() => {
    const nextParams = buildSearchParamsFromSelection(
      {
        selectedRunFolders,
        selectedFrameworks,
        selectedPresets,
        selectedRoutes,
        iterationMin,
        iterationMax,
        routeSearch,
        runFolderFilterSearch,
        frameworkFilterSearch,
        platformFilterSearch,
        routeFilterSearch,
        trendMetric,
        trendChartType,
      },
      filters,
      { lockedRunFolder }
    );

    const nextQuery = nextParams.toString();
    if (nextQuery === currentQuery) return;

    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
  }, [
    currentQuery,
    filters,
    iterationMax,
    iterationMin,
    lockedRunFolder,
    pathname,
    routeSearch,
    router,
    runFolderFilterSearch,
    frameworkFilterSearch,
    platformFilterSearch,
    routeFilterSearch,
    selectedFrameworks,
    selectedPresets,
    selectedRoutes,
    selectedRunFolders,
    trendChartType,
    trendMetric,
  ]);

  const filteredRows = useMemo(() => {
    const rows = dataset.rows.filter((row) => (
      selectedRunFolders.includes(row.runFolder)
      && selectedFrameworks.includes(`${row.framework}-${row.version}`)
      && selectedPresets.includes(row.preset)
      && selectedRoutes.includes(row.route)
    ));

    if (!routeSearch.trim()) return rows;
    const query = routeSearch.trim().toLowerCase();
    return rows.filter((row) => `${row.route} ${row.framework} ${row.version} ${row.runFolder}`.toLowerCase().includes(query));
  }, [dataset.rows, routeSearch, selectedFrameworks, selectedPresets, selectedRoutes, selectedRunFolders]);

  const iterationSeries = useMemo(() => {
    const grouped = aggregateBy(filteredRows, (row) => `${frameworkKey(row)}|${row.preset}`);

    return [...grouped.entries()].map(([key, rows]) => ({
      key,
      name: seriesName(rows[0]),
      color: seriesColor(rows[0]),
      rows: [...rows].sort((left, right) => {
        if (trendBasis === 'run') {
          const leftRun = displayRunFolder(left.runFolder);
          const rightRun = displayRunFolder(right.runFolder);
          if (leftRun === rightRun) return left.iteration - right.iteration;
          return leftRun.localeCompare(rightRun);
        }
        return left.iteration - right.iteration;
      }),
    }));
  }, [filteredRows, trendBasis]);

  const trendPlotData = useMemo(() => {
    if (!iterationSeries.length) return [];

    if (trendChartType === 'heatmap') {
      const xValues = trendBasis === 'run'
        ? uniqueValues(filteredRows.map((row) => displayRunFolder(row.runFolder))).sort((left, right) => left.localeCompare(right))
        : uniqueValues(filteredRows.map((row) => row.iteration)).sort((left, right) => left - right);

      const yValues = iterationSeries.map((series) => series.name);
      const z = iterationSeries.map((series) => {
        return xValues.map((xValue) => {
          const matched = series.rows.filter((row) => {
            if (trendBasis === 'run') return displayRunFolder(row.runFolder) === xValue;
            return row.iteration === xValue;
          });
          if (!matched.length) return Number.NaN;
          const values = matched.map((row) => Number(row[trendMetric])).filter((value) => Number.isFinite(value));
          if (!values.length) return Number.NaN;
          return values.reduce((sum, value) => sum + value, 0) / values.length;
        });
      });

      const customdata = iterationSeries.map((series) => xValues.map(() => `grp:${series.key}`));

      return [{
        type: 'heatmap',
        x: xValues,
        y: yValues,
        z,
        customdata,
        colorscale: 'Viridis',
        hovertemplate: `${trendBasis === 'run' ? 'Run' : 'Iteration'}: %{x}<br>Series: %{y}<br>${METRIC_LABELS[trendMetric] ?? trendMetric}: %{z:.3f}<extra></extra>`,
      }];
    }

    return iterationSeries.map((series) => {
      const validRows = series.rows.filter((row) => Number.isFinite(Number(row[trendMetric])));
      const x = validRows.map((row) => (trendBasis === 'run' ? displayRunFolder(row.runFolder) : row.iteration));
      const y = validRows.map((row) => Number(row[trendMetric]));
      const hovertext = validRows.map((row, index) => makeSeriesHover(row, METRIC_LABELS[trendMetric] ?? trendMetric, formatMetric(trendMetric, Number(row[trendMetric]))));
      const customdata = validRows.map((row) => `row:${rowKey(row)}`);

      if (trendChartType === 'box') {
        return {
          type: 'box',
          name: series.name,
          x,
          y,
          customdata,
          boxpoints: 'all',
          jitter: 0.2,
          marker: { size: 6, color: series.color, opacity: 0.8 },
          hovertext,
          hovertemplate: '%{hovertext}<extra></extra>',
          hoverlabel: { bgcolor: 'rgba(15,23,42,0.97)', bordercolor: series.color, font: { color: '#e2e8f0' } },
        };
      }

      if (trendChartType === 'violin') {
        return {
          type: 'violin',
          name: series.name,
          x,
          y,
          customdata,
          points: 'all',
          jitter: 0.2,
          marker: { size: 6, color: series.color, opacity: 0.8 },
          line: { color: series.color },
          hovertext,
          hovertemplate: '%{hovertext}<extra></extra>',
          hoverlabel: { bgcolor: 'rgba(15,23,42,0.97)', bordercolor: series.color, font: { color: '#e2e8f0' } },
        };
      }

      if (trendChartType === 'histogram') {
        return {
          type: 'histogram',
          name: series.name,
          x: y,
          customdata,
          marker: { color: series.color, opacity: 0.75 },
          hovertext,
          hovertemplate: '%{hovertext}<extra></extra>',
          hoverlabel: { bgcolor: 'rgba(15,23,42,0.97)', bordercolor: series.color, font: { color: '#e2e8f0' } },
        };
      }

      if (trendChartType === 'bar') {
        return {
          type: 'bar',
          name: series.name,
          x,
          y,
          customdata,
          marker: { color: series.color, opacity: 0.85 },
          hovertext,
          hovertemplate: '%{hovertext}<extra></extra>',
          hoverlabel: { bgcolor: 'rgba(15,23,42,0.97)', bordercolor: series.color, font: { color: '#e2e8f0' } },
        };
      }

      if (trendChartType === 'scatter') {
        return {
          type: 'scatter',
          name: series.name,
          mode: 'markers',
          x,
          y,
          customdata: validRows.map((row) => `row:${rowKey(row)}`),
          marker: { size: 9, color: series.color, opacity: 0.85 },
          hovertext,
          hovertemplate: '%{hovertext}<extra></extra>',
          hoverlabel: { bgcolor: 'rgba(15,23,42,0.97)', bordercolor: series.color, font: { color: '#e2e8f0' } },
        };
      }

      return {
        type: 'scatter',
        name: series.name,
        mode: 'lines+markers',
        x,
        y,
        customdata: validRows.map((row) => `row:${rowKey(row)}`),
        marker: { size: 8, color: series.color, opacity: 0.9 },
        line: { color: series.color, width: 2 },
        hovertext,
        hovertemplate: '%{hovertext}<extra></extra>',
        hoverlabel: { bgcolor: 'rgba(15,23,42,0.97)', bordercolor: series.color, font: { color: '#e2e8f0' } },
      };
    });
  }, [filteredRows, iterationSeries, trendBasis, trendChartType, trendMetric]);

  const selectedRowsTrend = useMemo(() => {
    if (!selectedTrendKeys.length) return filteredRows;

    const rowTokens = new Set(selectedTrendKeys.filter((token) => token.startsWith('row:')).map((token) => token.slice(4)));
    const groupTokens = new Set(selectedTrendKeys.filter((token) => token.startsWith('grp:')).map((token) => token.slice(4)));
    if (rowTokens.size) {
      const rowMatches = filteredRows.filter((row) => rowTokens.has(rowKey(row)));
      return rowMatches.length ? rowMatches : filteredRows;
    }

    if (groupTokens.size) {
      const groupMatches = filteredRows.filter((row) => groupTokens.has(frameworkPresetKey(row)));
      return groupMatches.length ? groupMatches : filteredRows;
    }

    const iterationTokens = new Set(
      selectedTrendKeys
        .map((token) => Number(token))
        .filter((value) => Number.isFinite(value))
    );
    const runTokens = new Set(selectedTrendKeys.filter((token) => Number.isNaN(Number(token))));

    const matches = filteredRows.filter((row) => (
      iterationTokens.has(row.iteration)
      || runTokens.has(displayRunFolder(row.runFolder))
    ));

    return matches.length ? matches : filteredRows;
  }, [filteredRows, selectedTrendKeys]);

  const routesToDisplay = useMemo(() => {
    if (!routeSearch.trim()) return filters.routes;
    const query = routeSearch.trim().toLowerCase();
    return filters.routes.filter((route) => route.toLowerCase().includes(query));
  }, [filters.routes, routeSearch]);

  const platformSummaryRows = useMemo(() => {
    const metrics = [
      'performanceScore',
      'firstContentfulPaintMs',
      'largestContentfulPaintMs',
      'totalBlockingTimeMs',
      'speedIndexMs',
      'cumulativeLayoutShift',
      'categoryAccessibility',
      'categoryBestPractices',
      'categorySeo',
      'failedAudits',
      'insightAuditCount',
      'diagnosticsItemCount',
    ];

    const grouped = aggregateBy(dataset.rows, (row) => `${frameworkKey(row)}|${row.route}|${row.preset}`);
    const summaries = [];

    for (const [key, rows] of grouped.entries()) {
      const [framework, route, preset] = key.split('|');

      for (const metric of metrics) {
        const values = rows
          .map((row) => Number(row[metric]))
          .filter((value) => Number.isFinite(value));

        if (!values.length) continue;

        const summary = summarize(metric, values);
        summaries.push({
          framework,
          route,
          preset,
          metric: METRIC_LABELS[metric] ?? metric,
          n: summary.n,
          mean: formatMetric(metric, summary.mean),
          median: formatMetric(metric, summary.median),
          stdDev: formatNumber(summary.stdDev),
          iqr: formatMetric(metric, summary.iqr),
          p90: formatMetric(metric, summary.p90),
          p95: formatMetric(metric, summary.p95),
        });
      }
    }

    return summaries.sort((left, right) => {
      if (left.framework !== right.framework) return left.framework.localeCompare(right.framework);
      if (left.route !== right.route) return left.route.localeCompare(right.route);
      if (left.preset !== right.preset) return left.preset.localeCompare(right.preset);
      return left.metric.localeCompare(right.metric);
    });
  }, [dataset.rows]);

  const overviewRows = useMemo(() => {
    return filteredRows.map((row) => ({
      runFolderRaw: row.runFolder,
      runFolder: displayRunFolder(row.runFolder),
      timestamp: formatDateTime(row.timestamp),
      framework: `${row.framework}-${row.version}`,
      preset: row.preset,
      route: row.route,
      iteration: row.iteration,
      performanceScore: formatMetric('performanceScore', row.performanceScore),
      fcpMs: formatMetric('firstContentfulPaintMs', row.firstContentfulPaintMs),
      lcpMs: formatMetric('largestContentfulPaintMs', row.largestContentfulPaintMs),
      tbtMs: formatMetric('totalBlockingTimeMs', row.totalBlockingTimeMs),
      cls: formatMetric('cumulativeLayoutShift', row.cumulativeLayoutShift),
      accessibility: formatMetric('categoryAccessibility', row.categoryAccessibility),
      bestPractices: formatMetric('categoryBestPractices', row.categoryBestPractices),
      seo: formatMetric('categorySeo', row.categorySeo),
      failedAudits: row.failedAudits,
      insightAudits: row.insightAuditCount,
    }));
  }, [filteredRows]);

  const rawArtifactRows = useMemo(() => {
    return filteredRows.map((row) => ({
      runFolderRaw: row.runFolder,
      runFolder: displayRunFolder(row.runFolder),
      framework: `${row.framework}-${row.version}`,
      preset: row.preset,
      route: row.route,
      iteration: row.iteration,
      jsonReportRelativePath: row.jsonReportRelativePath,
      htmlReportRelativePath: row.htmlReportRelativePath,
      csvReportRelativePath: row.csvReportRelativePath,
    }));
  }, [filteredRows]);

  const diagnosticHeatmap = useMemo(() => {
    const allRows = dataset.rows;
    if (!allRows.length) return { x: [], y: [], z: [], hover: [] };

    const routePresetGroups = aggregateBy(allRows, (row) => `${row.route}|${row.preset}`);
    const bestByRoutePreset = new Map();
    for (const [groupKey, rows] of routePresetGroups.entries()) {
      const minFcp = Math.min(...rows.map((row) => Number(row.firstContentfulPaintMs)).filter((value) => Number.isFinite(value)));
      const minLcp = Math.min(...rows.map((row) => Number(row.largestContentfulPaintMs)).filter((value) => Number.isFinite(value)));
      const maxPerf = Math.max(...rows.map((row) => Number(row.performanceScore)).filter((value) => Number.isFinite(value)));
      bestByRoutePreset.set(groupKey, { minFcp, minLcp, maxPerf });
    }

    const groupByCell = aggregateBy(allRows, (row) => `${frameworkPresetKey(row)}|${row.route}`);
    const x = uniqueValues(allRows.map((row) => `${frameworkKey(row)} / ${row.preset}`)).sort((left, right) => left.localeCompare(right));
    const y = uniqueValues(allRows.map((row) => row.route)).sort((left, right) => left.localeCompare(right));

    const z = y.map((route) => x.map((frameworkPreset) => {
      const framework = frameworkPreset.split(' / ')[0];
      const preset = frameworkPreset.split(' / ')[1] ?? '';
      const key = `${framework}|${preset}|${route}`;
      const rows = groupByCell.get(key) ?? [];
      if (!rows.length) return Number.NaN;

      const values = rows.map((row) => {
        if (diagnosticHeatMetric === 'fcpImprovementMs') {
          const best = bestByRoutePreset.get(`${row.route}|${row.preset}`);
          if (!best || !Number.isFinite(best.minFcp)) return Number.NaN;
          return Number(row.firstContentfulPaintMs) - best.minFcp;
        }
        if (diagnosticHeatMetric === 'lcpImprovementMs') {
          const best = bestByRoutePreset.get(`${row.route}|${row.preset}`);
          if (!best || !Number.isFinite(best.minLcp)) return Number.NaN;
          return Number(row.largestContentfulPaintMs) - best.minLcp;
        }
        if (diagnosticHeatMetric === 'performanceGainPotential') {
          const best = bestByRoutePreset.get(`${row.route}|${row.preset}`);
          if (!best || !Number.isFinite(best.maxPerf)) return Number.NaN;
          return best.maxPerf - Number(row.performanceScore);
        }
        return Number(row[diagnosticHeatMetric]);
      }).filter((value) => Number.isFinite(value));

      if (!values.length) return Number.NaN;
      return values.reduce((sum, value) => sum + value, 0) / values.length;
    }));

    const hover = y.map((route) => x.map((frameworkPreset) => {
      const framework = frameworkPreset.split(' / ')[0];
      const preset = frameworkPreset.split(' / ')[1] ?? '';
      const key = `${framework}|${preset}|${route}`;
      const rows = groupByCell.get(key) ?? [];
      if (!rows.length) return 'No data';

      const avgFcp = rows.map((row) => Number(row.firstContentfulPaintMs)).filter((value) => Number.isFinite(value));
      const avgLcp = rows.map((row) => Number(row.largestContentfulPaintMs)).filter((value) => Number.isFinite(value));
      const avgPerf = rows.map((row) => Number(row.performanceScore)).filter((value) => Number.isFinite(value));
      const mean = (values) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : Number.NaN;

      return [
        `<b>${frameworkPreset}</b>`,
        `Route: ${route}`,
        `Samples: ${rows.length}`,
        `Avg failed: ${formatNumber(mean(rows.map((row) => Number(row.failedAudits)).filter((value) => Number.isFinite(value))), 2)}`,
        `Avg diagnostics items: ${formatNumber(mean(rows.map((row) => Number(row.diagnosticsItemCount)).filter((value) => Number.isFinite(value))), 2)}`,
        `Avg insights: ${formatNumber(mean(rows.map((row) => Number(row.insightAuditCount)).filter((value) => Number.isFinite(value))), 2)}`,
        `Avg FCP: ${formatNumber(mean(avgFcp), 2)} ms`,
        `Avg LCP: ${formatNumber(mean(avgLcp), 2)} ms`,
        `Avg performance: ${formatMetric('performanceScore', mean(avgPerf))}`,
      ].join('<br>');
    }));

    return { x, y, z, hover };
  }, [dataset.rows, diagnosticHeatMetric]);

  const selectedIterationCount = new Set(filteredRows.map((row) => row.iteration)).size;

  const basePlotConfig = {
    responsive: true,
    displaylogo: false,
    modeBarButtonsToRemove: ['zoom2d', 'pan2d', 'autoScale2d'],
    modeBarButtonsToAdd: ['select2d', 'lasso2d'],
    doubleClick: 'reset+autosize',
  };

  const iterationActionColumns = [
    { key: 'runFolder', label: 'Run' },
    { key: 'framework', label: 'Framework' },
    { key: 'preset', label: 'Platform' },
    { key: 'route', label: 'Route' },
    { key: 'iteration', label: 'Iteration' },
    { key: 'metricValue', label: METRIC_LABELS[trendMetric] ?? trendMetric },
    { key: 'performanceScore', label: 'Performance' },
    {
      key: 'action',
      label: 'Action',
      render: (_, row) => (
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/run/${encodeURIComponent(row.runFolderRaw)}`}
            className="rounded-lg border border-cyan-300/30 bg-cyan-400/10 px-2 py-1 text-xs text-cyan-100 hover:bg-cyan-400/20"
          >
            Run
          </Link>
          <Link
            href={`/?runs=${encodeURIComponent(row.runFolderRaw)}`}
            className="rounded-lg border border-white/20 bg-white/5 px-2 py-1 text-xs text-slate-100 hover:border-cyan-300/40 hover:bg-cyan-400/10"
          >
            Iteration
          </Link>
        </div>
      ),
    },
  ];

  const overviewActionColumns = [
    { key: 'runFolder', label: 'Run' },
    { key: 'timestamp', label: 'Timestamp' },
    { key: 'framework', label: 'Framework' },
    { key: 'preset', label: 'Platform' },
    { key: 'route', label: 'Route' },
    { key: 'iteration', label: 'Iteration' },
    { key: 'performanceScore', label: 'Performance' },
    { key: 'fcpMs', label: 'FCP' },
    { key: 'lcpMs', label: 'LCP' },
    { key: 'tbtMs', label: 'TBT' },
    { key: 'cls', label: 'CLS' },
    { key: 'accessibility', label: 'Accessibility' },
    { key: 'bestPractices', label: 'Best Practices' },
    { key: 'seo', label: 'SEO' },
    { key: 'failedAudits', label: 'Failed Audits' },
    { key: 'insightAudits', label: 'Insights' },
    {
      key: 'action',
      label: 'Action',
      render: (_, row) => (
        <Link
          href={`/run/${encodeURIComponent(row.runFolderRaw)}`}
          className="rounded-lg border border-cyan-300/30 bg-cyan-400/10 px-2 py-1 text-xs text-cyan-100 hover:bg-cyan-400/20"
        >
          Deep dive
        </Link>
      ),
    },
  ];

  return (
    <div className="min-w-0 w-full space-y-6">
      <section className={FILTER_CARD} id="filters">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-white">Filter Workspace</h2>
            <p className="mt-1 text-sm text-slate-300">Compact controls for run, framework, platform, route, and iteration drilldowns.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-lg border border-white/10 bg-slate-950/40 px-2 py-1 text-slate-200">Runs: {selectedRunFolders.length}</span>
            <span className="rounded-lg border border-white/10 bg-slate-950/40 px-2 py-1 text-slate-200">Frameworks: {selectedFrameworks.length}</span>
            <span className="rounded-lg border border-white/10 bg-slate-950/40 px-2 py-1 text-slate-200">Routes: {selectedRoutes.length}</span>
          </div>
        </div>

        {lockedRunFolder && (
          <p className="mt-3 rounded-lg border border-cyan-300/30 bg-cyan-400/10 px-2 py-1 text-xs text-cyan-100">
            Single-run mode is active for {lockedRunFolder}.
          </p>
        )}

        <div className="mt-4 space-y-4">
          <div className="grid gap-4 xl:grid-cols-4">
              <ToggleList
                label="Run date folders"
                kind="runFolder"
                search={runFolderFilterSearch}
                onSearchChange={setRunFolderFilterSearch}
                searchPlaceholder="Search date folders..."
                values={filters.runFolders}
                selected={selectedRunFolders}
                onChange={setSelectedRunFolders}
                disabled={Boolean(lockedRunFolder)}
              />
              <ToggleList
                label="Frameworks"
                search={frameworkFilterSearch}
                onSearchChange={setFrameworkFilterSearch}
                searchPlaceholder="Search frameworks..."
                values={filters.frameworks}
                selected={selectedFrameworks}
                onChange={setSelectedFrameworks}
              />
              <ToggleList
                label="Platforms"
                search={platformFilterSearch}
                onSearchChange={setPlatformFilterSearch}
                searchPlaceholder="Search platforms..."
                values={filters.presets}
                selected={selectedPresets}
                onChange={setSelectedPresets}
              />
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <h3 className="text-sm font-semibold text-white">Routes</h3>
                  <button
                    type="button"
                    onClick={() => setSelectedRoutes(setAll(filters.routes))}
                    className="rounded-md border border-white/10 px-2 py-1 text-xs text-slate-200 hover:border-cyan-300/40 hover:bg-cyan-400/10"
                  >
                    Reset
                  </button>
                </div>
                <input
                  value={routeFilterSearch}
                  onChange={(event) => setRouteFilterSearch(event.target.value)}
                  placeholder="Search routes..."
                  className="mb-2 w-full rounded-xl border border-white/10 bg-slate-950/50 px-3 py-2 text-sm text-white placeholder:text-slate-500 outline-none focus:border-cyan-300/60"
                />
                <div className="max-h-56 overflow-auto rounded-xl border border-white/10 bg-slate-950/40 p-2 space-y-1">
                  {routesToDisplay.filter((route) => route.toLowerCase().includes(routeFilterSearch.trim().toLowerCase()) || !routeFilterSearch.trim()).map((route) => (
                    <label key={route} className="flex items-start gap-2 rounded-lg px-2 py-1.5 text-sm text-slate-200 hover:bg-white/5">
                      <input
                        type="checkbox"
                        checked={selectedRoutes.includes(route)}
                        onChange={() => setSelectedRoutes(toggleItem(selectedRoutes, route))}
                        className="mt-1 accent-cyan-400"
                      />
                      <span className="break-all">{route}</span>
                    </label>
                  ))}
                </div>
              </div>
          </div>
        </div>
      </section>

      <div className="min-w-0 space-y-6">
        <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-[0_25px_80px_rgba(0,0,0,0.25)]" id="overview">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-cyan-200/70">Scientific Evaluation</p>
              <h1 className="mt-2 text-3xl font-semibold text-white">Lighthouse Results Explorer (Plotly)</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
                Detailed and summarized analysis from summary CSV + JSON report internals across all dated runs.
              </p>
            </div>
            <div className="rounded-2xl border border-cyan-300/20 bg-cyan-400/10 px-4 py-3 text-sm text-cyan-50">
              <p className="font-semibold">Selected rows</p>
              <p>{filteredRows.length} / {dataset.rows.length}</p>
              <p>{selectedIterationCount} iteration values in range</p>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SummaryCard title="Runs" value={String(new Set(filteredRows.map((row) => row.runFolder)).size)} detail="Date folders currently included" />
          <SummaryCard title="Frameworks" value={String(new Set(filteredRows.map((row) => `${row.framework}-${row.version}`)).size)} detail="Distinct framework variants" />
          <SummaryCard title="Platforms" value={String(new Set(filteredRows.map((row) => row.preset)).size)} detail="Mobile / desktop presets" />
          <SummaryCard title="Routes" value={String(new Set(filteredRows.map((row) => row.route)).size)} detail="Distinct tested routes" />
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/5 p-5" id="platforms">
          <h2 className="text-lg font-semibold text-white">Platform Summary Statistics (Static, All Data)</h2>
          <DataTable
            title="Statistical summary by framework, route, and platform"
            rows={platformSummaryRows}
            fileName="platform-statistics-static.csv"
            columns={[
              { key: 'framework', label: 'Framework' },
              { key: 'route', label: 'Route' },
              { key: 'preset', label: 'Platform' },
              { key: 'metric', label: 'Metric' },
              { key: 'n', label: 'n' },
              { key: 'mean', label: 'Mean' },
              { key: 'median', label: 'Median' },
              { key: 'stdDev', label: 'Std Dev' },
              { key: 'iqr', label: 'IQR' },
              { key: 'p90', label: 'p90' },
              { key: 'p95', label: 'p95' },
            ]}
          />
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/5 p-5" id="iterations">
          <div className="flex flex-wrap items-end justify-between gap-3 mb-3">
            <div>
              <h2 className="text-lg font-semibold text-white">Iteration Trend and Distribution</h2>
              <p className="mt-1 text-sm text-slate-300">Switch between iteration-based and run-based series to compare stability and campaign-level behavior.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <select value={trendBasis} onChange={(event) => setTrendBasis(event.target.value)} className="rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-slate-100">
                <option value="iteration">Iteration-based view</option>
                <option value="run">Run-based view</option>
              </select>
              <select value={trendMetric} onChange={(event) => setTrendMetric(event.target.value)} className="rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-slate-100">
                {PRIMARY_METRICS.map((metric) => (
                  <option key={metric} value={metric}>{METRIC_LABELS[metric] ?? metric}</option>
                ))}
              </select>
              <select value={trendChartType} onChange={(event) => setTrendChartType(event.target.value)} className="rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-slate-100">
                {TREND_CHART_TYPES.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => trendGraphRef.current && downloadPlotImage(trendGraphRef.current, `iteration-${trendChartType}`)}
                className="rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-100 hover:border-cyan-300/40 hover:bg-cyan-400/10"
              >
                Export graph PNG
              </button>
            </div>
          </div>

          <Plot
            data={trendPlotData}
            layout={{
              paper_bgcolor: 'rgba(0,0,0,0)',
              plot_bgcolor: 'rgba(15,23,42,0.35)',
              font: { color: '#dbeafe' },
              xaxis: {
                title: trendChartType === 'histogram'
                  ? (METRIC_LABELS[trendMetric] ?? trendMetric)
                  : (trendBasis === 'run' ? 'Run folder timestamp' : 'Iteration index'),
                automargin: true,
                tickangle: trendBasis === 'run' ? -25 : 0,
              },
              yaxis: { title: METRIC_LABELS[trendMetric] ?? trendMetric },
              margin: { t: 24, r: 20, l: 60, b: 60 },
              dragmode: 'select',
              clickmode: 'event+select',
              hovermode: 'closest',
              legend: { title: { text: 'Framework / platform' } },
            }}
            config={basePlotConfig}
            style={{ width: '100%', height: '420px' }}
            onInitialized={(_, graphDiv) => { trendGraphRef.current = graphDiv; }}
            onUpdate={(_, graphDiv) => { trendGraphRef.current = graphDiv; }}
            onSelected={(event) => {
              const keys = tokensFromPlotEvent(event);
              setSelectedTrendKeys(keys);
            }}
            onClick={(event) => {
              const keys = tokensFromPlotEvent(event);
              setSelectedTrendKeys(keys);
            }}
            onDeselect={() => setSelectedTrendKeys([])}
          />

          <DataTable
            title="Selected rows for iteration plot"
            rows={selectedRowsTrend.map((row) => ({
              runFolderRaw: row.runFolder,
              runFolder: displayRunFolder(row.runFolder),
              framework: `${row.framework}-${row.version}`,
              preset: row.preset,
              route: row.route,
              iteration: row.iteration,
              metricValue: formatMetric(trendMetric, Number(row[trendMetric])),
              performanceScore: formatMetric('performanceScore', row.performanceScore),
            }))}
            fileName="iteration-plot-selection.csv"
            columns={iterationActionColumns}
          />
        </section>


        <section className="rounded-3xl border border-white/10 bg-white/5 p-5" id="diagnostics-heatmap">
          <div className="flex flex-wrap items-end justify-between gap-3 mb-3">
            <div>
              <h2 className="text-lg font-semibold text-white">Audit Index Heatmap (All Runs)</h2>
              <p className="mt-1 text-sm text-slate-300">Cross-run heatmap over all frameworks, routes, and platforms to analyze where failures/items cluster and where performance can improve.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <select value={diagnosticHeatMetric} onChange={(event) => setDiagnosticHeatMetric(event.target.value)} className="rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-slate-100">
                <option value="failedAudits">Failed audits (avg)</option>
                <option value="diagnosticsItemCount">Diagnostics items (avg)</option>
                <option value="insightAuditCount">Insights (avg)</option>
                <option value="fcpImprovementMs">FCP improvement potential (ms)</option>
                <option value="lcpImprovementMs">LCP improvement potential (ms)</option>
                <option value="performanceGainPotential">Performance score gain potential</option>
              </select>
              <button
                type="button"
                onClick={() => diagnosticHeatGraphRef.current && downloadPlotImage(diagnosticHeatGraphRef.current, `audit-heatmap-${diagnosticHeatMetric}`)}
                className="rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-100 hover:border-cyan-300/40 hover:bg-cyan-400/10"
              >
                Export graph PNG
              </button>
            </div>
          </div>

          <Plot
            data={[{
              type: 'heatmap',
              x: diagnosticHeatmap.x,
              y: diagnosticHeatmap.y,
              z: diagnosticHeatmap.z,
              text: diagnosticHeatmap.hover,
              colorscale: 'Magma',
              hovertemplate: '%{text}<br>Value: %{z:.3f}<extra></extra>',
            }]}
            layout={{
              paper_bgcolor: 'rgba(0,0,0,0)',
              plot_bgcolor: 'rgba(15,23,42,0.35)',
              font: { color: '#dbeafe' },
              xaxis: { automargin: true, tickangle: -30, title: 'Framework / platform' },
              yaxis: { automargin: true, title: 'Route' },
              margin: { t: 24, r: 20, l: 140, b: 120 },
            }}
            config={{ ...basePlotConfig, modeBarButtonsToAdd: [] }}
            style={{ width: '100%', height: '560px' }}
            onInitialized={(_, graphDiv) => { diagnosticHeatGraphRef.current = graphDiv; }}
            onUpdate={(_, graphDiv) => { diagnosticHeatGraphRef.current = graphDiv; }}
          />
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/5 p-5" id="artifacts">
          <h2 className="text-lg font-semibold text-white">Detailed Rows and Raw Artifacts</h2>
          <DataTable
            title="All filtered rows"
            rows={overviewRows}
            fileName="lighthouse-filtered-rows.csv"
            columns={overviewActionColumns}
          />

          <DataTable
            title="Raw report links"
            rows={rawArtifactRows}
            fileName="raw-report-links.csv"
            columns={[
              { key: 'runFolder', label: 'Run' },
              { key: 'framework', label: 'Framework' },
              { key: 'preset', label: 'Platform' },
              { key: 'route', label: 'Route' },
              { key: 'iteration', label: 'Iteration' },
              {
                key: 'action',
                label: 'Action',
                render: (_, row) => (
                  <Link
                    href={`/run/${encodeURIComponent(row.runFolderRaw)}`}
                    className="rounded-lg border border-cyan-300/30 bg-cyan-400/10 px-2 py-1 text-xs text-cyan-100 hover:bg-cyan-400/20"
                  >
                    Deep dive
                  </Link>
                ),
              },
              {
                key: 'json',
                label: 'JSON',
                render: (_, row) => <a className="text-cyan-300 hover:text-cyan-100" href={artifactHref(row.jsonReportRelativePath)} target="_blank" rel="noreferrer">open</a>,
              },
              {
                key: 'html',
                label: 'HTML',
                render: (_, row) => <a className="text-cyan-300 hover:text-cyan-100" href={artifactHref(row.htmlReportRelativePath)} target="_blank" rel="noreferrer">open</a>,
              },
              {
                key: 'csv',
                label: 'CSV',
                render: (_, row) => <a className="text-cyan-300 hover:text-cyan-100" href={artifactHref(row.csvReportRelativePath)} target="_blank" rel="noreferrer">open</a>,
              },
            ]}
          />
        </section>
      </div>
    </div>
  );
}
