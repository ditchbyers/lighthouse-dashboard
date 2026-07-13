import { promises as fs } from 'fs';
import { loadLighthouseDataset } from './lighthouse-data';

const reportCache = new Map();

function toLhr(parsed) {
  return parsed?.lhr ?? parsed;
}

async function readReportFromPath(jsonPath) {
  if (!jsonPath) return null;
  if (reportCache.has(jsonPath)) return reportCache.get(jsonPath);

  try {
    const raw = await fs.readFile(jsonPath, 'utf8');
    const parsed = JSON.parse(raw);
    const lhr = toLhr(parsed);
    reportCache.set(jsonPath, lhr);
    return lhr;
  } catch {
    reportCache.set(jsonPath, null);
    return null;
  }
}

function scoreBucket(mode, score) {
  if (mode === 'notApplicable') return 'notApplicable';
  if (mode === 'manual') return 'manual';
  if (mode === 'informative') return 'informative';
  if (mode === 'error') return 'error';
  if (Number.isFinite(score)) return score >= 0.9 ? 'passed' : 'failed';
  return 'unknown';
}

function toMetricNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function toDetailsType(audit) {
  return String(audit?.details?.type ?? 'none');
}

function toItemCount(audit) {
  const items = audit?.details?.items;
  return Array.isArray(items) ? items.length : 0;
}

function toSavings(audit) {
  const fcp = toMetricNumber(audit?.metricSavings?.FCP);
  const lcp = toMetricNumber(audit?.metricSavings?.LCP);
  return {
    fcpMs: Number.isFinite(fcp) ? fcp : 0,
    lcpMs: Number.isFinite(lcp) ? lcp : 0,
  };
}

function formatFramework(row) {
  return `${row.framework}-${row.version}`;
}

export async function loadRunWorkspace(runFolder) {
  const dataset = await loadLighthouseDataset();
  const runRows = dataset.rows.filter((row) => row.runFolder === runFolder);

  if (!runRows.length) {
    return null;
  }

  const withReports = await Promise.all(
    runRows.map(async (row) => ({
      ...row,
      lhr: await readReportFromPath(row.jsonReportPath),
    }))
  );

  const validRows = withReports.filter((row) => row.lhr && row.lhr.audits);
  const firstLhr = validRows[0]?.lhr ?? null;

  const auditGroupById = new Map();
  const categoryAuditMap = new Map();
  for (const [categoryId, category] of Object.entries(firstLhr?.categories ?? {})) {
    for (const ref of category?.auditRefs ?? []) {
      if (!categoryAuditMap.has(ref.id)) categoryAuditMap.set(ref.id, []);
      categoryAuditMap.get(ref.id).push({
        categoryId,
        group: ref.group ?? '',
        weight: Number(ref.weight ?? 0),
      });
    }
  }

   for (const row of validRows) {
     for (const [auditId, audit] of Object.entries(row.lhr.audits ?? {})) {
       const mode = String(audit?.scoreDisplayMode ?? 'unknown');
       const bucket = scoreBucket(mode, Number(audit?.score));
       const numericValue = toMetricNumber(audit?.numericValue);
       const score = toMetricNumber(audit?.score);
       const detailsType = toDetailsType(audit);
       const itemCount = toItemCount(audit);
       const savings = toSavings(audit);

       if (!auditGroupById.has(auditId)) {
         auditGroupById.set(auditId, {
           id: auditId,
           title: String(audit?.title ?? auditId),
           description: String(audit?.description ?? ''),
           scoreDisplayMode: mode,
           occurrences: 0,
           detailsTypes: new Set(),
           itemsTotal: 0,
           passed: 0,
           failed: 0,
           notApplicable: 0,
           informative: 0,
           manual: 0,
           error: 0,
           unknown: 0,
           numericValues: [],
           scores: [],
           savingsFcpMs: 0,
          savingsLcpMs: 0,
          categoryRefs: categoryAuditMap.get(auditId) ?? [],
         });
       }

       const current = auditGroupById.get(auditId);
       current.occurrences += 1;
       current.detailsTypes.add(detailsType);
       current.itemsTotal += itemCount;
       current[bucket] += 1;
       current.savingsFcpMs += savings.fcpMs;
       current.savingsLcpMs += savings.lcpMs;

       if (Number.isFinite(numericValue)) current.numericValues.push(numericValue);
       if (Number.isFinite(score)) current.scores.push(score);
     }
   }

   const audits = [...auditGroupById.values()]
     .map((audit) => ({
       id: audit.id,
       title: audit.title,
       description: audit.description,
       scoreDisplayMode: audit.scoreDisplayMode,
       occurrences: audit.occurrences,
       detailsTypes: [...audit.detailsTypes].sort(),
       itemsTotal: audit.itemsTotal,
       passed: audit.passed,
       failed: audit.failed,
       notApplicable: audit.notApplicable,
       informative: audit.informative,
       manual: audit.manual,
       error: audit.error,
       unknown: audit.unknown,
       avgNumericValue: audit.numericValues.length
         ? audit.numericValues.reduce((sum, value) => sum + value, 0) / audit.numericValues.length
         : Number.NaN,
       avgScore: audit.scores.length
         ? audit.scores.reduce((sum, value) => sum + value, 0) / audit.scores.length
         : Number.NaN,
      savingsFcpMs: audit.savingsFcpMs,
      savingsLcpMs: audit.savingsLcpMs,
      categoryRefs: audit.categoryRefs,
     }))
     .sort((left, right) => right.failed - left.failed || right.occurrences - left.occurrences || left.id.localeCompare(right.id));

   const categoryStats = Object.entries(firstLhr?.categories ?? {}).map(([id, category]) => {
     const values = validRows
       .map((row) => toMetricNumber(row.lhr?.categories?.[id]?.score))
       .filter((value) => Number.isFinite(value));

     return {
       id,
       title: String(category?.title ?? id),
       scoreAvg: values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : Number.NaN,
       scoreMin: values.length ? Math.min(...values) : Number.NaN,
       scoreMax: values.length ? Math.max(...values) : Number.NaN,
     };
   });

   const runContext = {
     lighthouseVersion: String(firstLhr?.lighthouseVersion ?? ''),
     fetchTime: String(firstLhr?.fetchTime ?? ''),
     gatherMode: String(firstLhr?.gatherMode ?? ''),
     requestedUrl: String(firstLhr?.requestedUrl ?? ''),
     finalUrl: String(firstLhr?.finalUrl ?? ''),
     benchmarkIndex: Number(firstLhr?.environment?.benchmarkIndex ?? Number.NaN),
     formFactor: String(firstLhr?.configSettings?.formFactor ?? ''),
     throttlingMethod: String(firstLhr?.configSettings?.throttlingMethod ?? ''),
     userAgent: String(firstLhr?.userAgent ?? ''),
     runWarnings: Array.isArray(firstLhr?.runWarnings) ? firstLhr.runWarnings : [],
   };

   return {
     runFolder,
     rows: validRows,
     audits,
     categoryStats,
     runContext,
   };
}

export async function loadAuditDetail(runFolder, auditId) {
  const workspace = await loadRunWorkspace(runFolder);
  if (!workspace) return null;

  const occurrences = [];

  for (const row of workspace.rows) {
    const audit = row.lhr?.audits?.[auditId];
    if (!audit) continue;

    const numericValue = toMetricNumber(audit?.numericValue);
    const score = toMetricNumber(audit?.score);
    const details = audit?.details ?? null;
    const detailsType = toDetailsType(audit);
    const headings = Array.isArray(details?.headings) ? details.headings : [];
    const items = Array.isArray(details?.items) ? details.items : [];

    occurrences.push({
      key: `${formatFramework(row)}|${row.preset}|${row.route}|${row.iteration}`,
      framework: formatFramework(row),
      preset: row.preset,
      route: row.route,
      iteration: row.iteration,
      timestamp: row.timestamp,
      scoreDisplayMode: String(audit?.scoreDisplayMode ?? 'unknown'),
      score,
      numericValue,
      numericUnit: String(audit?.numericUnit ?? ''),
      displayValue: String(audit?.displayValue ?? ''),
      detailsType,
      itemCount: items.length,
      metricSavingsFcpMs: toSavings(audit).fcpMs,
      metricSavingsLcpMs: toSavings(audit).lcpMs,
      headings,
      items,
      audit,
      reportLinks: {
        json: row.jsonReportRelativePath,
        html: row.htmlReportRelativePath,
        csv: row.csvReportRelativePath,
      },
    });
  }

  if (!occurrences.length) {
    return {
      ...workspace,
      auditId,
      auditMeta: null,
      occurrences: [],
    };
  }

  const auditMeta = workspace.audits.find((entry) => entry.id === auditId) ?? null;

  return {
    ...workspace,
    auditId,
    auditMeta,
    occurrences,
  };
}
