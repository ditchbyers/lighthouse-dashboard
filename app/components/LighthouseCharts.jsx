'use client';

import { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const COLORS = ['#38bdf8', '#2dd4bf', '#f59e0b', '#f43f5e'];

const METRICS = {
  performanceScore: { label: 'Performance', unit: '%', scale: 100, lowerIsBetter: false },
  largestContentfulPaintMs: { label: 'LCP', unit: 'ms', scale: 1, lowerIsBetter: true },
  totalBlockingTimeMs: { label: 'TBT', unit: 'ms', scale: 1, lowerIsBetter: true },
  cumulativeLayoutShift: { label: 'CLS', unit: '', scale: 1, lowerIsBetter: true },
  totalByteWeight: { label: 'Transfer', unit: 'KB', scale: 1 / 1024, lowerIsBetter: true },
};

function average(rows, field) {
  const values = rows.map((row) => Number(row[field])).filter(Number.isFinite);
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function frameworkName(row) {
  return `${row.framework}-${row.version}`;
}

function formatValue(value, metric) {
  const config = METRICS[metric];
  const digits = metric === 'cumulativeLayoutShift' ? 3 : metric === 'performanceScore' ? 1 : 0;
  return `${Number(value).toFixed(digits)}${config.unit}`;
}

function ChartTooltip({ active, payload, label, metric = 'performanceScore' }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 shadow-xl">
      <p className="mb-1 text-xs font-semibold text-white">{label}</p>
      {payload.map((item) => (
        <p key={item.dataKey} className="text-xs" style={{ color: item.color }}>
          {item.name}: {formatValue(item.value, metric)}
        </p>
      ))}
    </div>
  );
}

export function SourceNotice({ source, sourceLabel }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-cyan-300/20 bg-cyan-400/5 px-4 py-3 text-sm">
      <div>
        <p className="font-medium text-cyan-100">{source === 'mock' ? 'Demo dataset active' : 'Filesystem dataset active'}</p>
        <p className="text-xs text-slate-400">{sourceLabel}</p>
      </div>
      <span className="rounded-full border border-white/10 px-3 py-1 text-xs uppercase tracking-[0.18em] text-slate-300">Server rendered</span>
    </div>
  );
}

export function FrameworkComparison({ rows, title = 'Framework comparison' }) {
  const [metric, setMetric] = useState('performanceScore');
  const [preset, setPreset] = useState('all');
  const presets = useMemo(() => [...new Set(rows.map((row) => row.preset))].sort(), [rows]);
  const data = useMemo(() => {
    const filtered = preset === 'all' ? rows : rows.filter((row) => row.preset === preset);
    return [...new Set(filtered.map(frameworkName))].map((framework) => {
      const group = filtered.filter((row) => frameworkName(row) === framework);
      return {
        framework,
        value: average(group, metric) * METRICS[metric].scale,
      };
    }).sort((left, right) => METRICS[metric].lowerIsBetter ? left.value - right.value : right.value - left.value);
  }, [metric, preset, rows]);

  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-5" aria-labelledby="framework-chart-title">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-cyan-200/70">Cross-framework median signal</p>
          <h2 id="framework-chart-title" className="mt-1 text-lg font-semibold text-white">{title}</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <label className="flex flex-col gap-1 text-xs text-slate-400">
            Metric
            <select value={metric} onChange={(event) => setMetric(event.target.value)} className="rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white">
              {Object.entries(METRICS).map(([key, config]) => <option key={key} value={key}>{config.label}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-slate-400">
            Preset
            <select value={preset} onChange={(event) => setPreset(event.target.value)} className="rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white">
              <option value="all">All presets</option>
              {presets.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>
        </div>
      </div>
      <div className="mt-5 h-72 w-full" role="img" aria-label={`${METRICS[metric].label} comparison by framework`}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ left: 8, right: 12, top: 8, bottom: 24 }}>
            <CartesianGrid stroke="#334155" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="framework" stroke="#94a3b8" tick={{ fontSize: 11 }} angle={-12} textAnchor="end" height={52} />
            <YAxis stroke="#94a3b8" tick={{ fontSize: 11 }} domain={metric === 'performanceScore' ? [0, 100] : ['auto', 'auto']} />
            <Tooltip content={<ChartTooltip metric={metric} />} />
            <Bar dataKey="value" name={METRICS[metric].label} fill={COLORS[0]} radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

export function TrendChart({ rows, dimension = 'run', title = 'Performance trend' }) {
  const frameworks = useMemo(() => [...new Set(rows.map(frameworkName))].sort(), [rows]);
  const data = useMemo(() => {
    const keys = [...new Set(rows.map((row) => dimension === 'iteration' ? row.iteration : row.runFolder))]
      .sort((left, right) => dimension === 'iteration' ? left - right : String(left).localeCompare(String(right)));
    return keys.map((key) => {
      const point = { label: dimension === 'iteration' ? `Iteration ${key}` : String(key).slice(0, 10) };
      frameworks.forEach((framework) => {
        const group = rows.filter((row) => (dimension === 'iteration' ? row.iteration : row.runFolder) === key && frameworkName(row) === framework);
        point[framework] = average(group, 'performanceScore') * 100;
      });
      return point;
    });
  }, [dimension, frameworks, rows]);

  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-5" aria-labelledby="trend-chart-title">
      <p className="text-xs uppercase tracking-[0.22em] text-cyan-200/70">Regression watch</p>
      <h2 id="trend-chart-title" className="mt-1 text-lg font-semibold text-white">{title}</h2>
      <div className="mt-5 h-72 w-full" role="img" aria-label={`${title} by framework`}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ left: 0, right: 16, top: 8, bottom: 8 }}>
            <CartesianGrid stroke="#334155" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" stroke="#94a3b8" tick={{ fontSize: 11 }} />
            <YAxis stroke="#94a3b8" tick={{ fontSize: 11 }} domain={[50, 100]} unit="%" />
            <Tooltip content={<ChartTooltip metric="performanceScore" />} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {frameworks.map((framework, index) => (
              <Line key={framework} type="monotone" dataKey={framework} stroke={COLORS[index % COLORS.length]} strokeWidth={2} dot={{ r: 3 }} connectNulls />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

export function CategoryProfile({ rows, title = 'Category profile' }) {
  const data = [
    ['Performance', 'categoryPerformance'],
    ['Accessibility', 'categoryAccessibility'],
    ['Best practices', 'categoryBestPractices'],
    ['SEO', 'categorySeo'],
  ].map(([category, field]) => ({ category, score: average(rows, field) * 100 }));

  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-5">
      <p className="text-xs uppercase tracking-[0.22em] text-cyan-200/70">Lighthouse categories</p>
      <h2 className="mt-1 text-lg font-semibold text-white">{title}</h2>
      <div className="mt-5 h-72 w-full" role="img" aria-label={`${title} scores`}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ left: 12, right: 20 }}>
            <CartesianGrid stroke="#334155" strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" domain={[0, 100]} stroke="#94a3b8" unit="%" tick={{ fontSize: 11 }} />
            <YAxis type="category" dataKey="category" width={96} stroke="#94a3b8" tick={{ fontSize: 11 }} />
            <Tooltip content={<ChartTooltip metric="performanceScore" />} />
            <Bar dataKey="score" name="Score" fill={COLORS[1]} radius={[0, 6, 6, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
