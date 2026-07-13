import { buildFilterState, loadLighthouseDataset } from '../lib/lighthouse-data';
import { getSelectionFromSearchParams } from '../lib/filter-state';
import LighthouseExplorer from './components/LighthouseExplorer';
import { FrameworkComparison, SourceNotice, TrendChart } from './components/LighthouseCharts';

export const dynamic = 'force-dynamic';

export default async function Page({ searchParams }) {
  const resolvedSearchParams = await searchParams;
  const dataset = await loadLighthouseDataset();
  const filters = buildFilterState(dataset);
  const initialSelection = getSelectionFromSearchParams(filters, resolvedSearchParams ?? {});

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <SourceNotice source={dataset.source} sourceLabel={dataset.sourceLabel} />
      <div className="grid gap-6 xl:grid-cols-2">
        <FrameworkComparison rows={dataset.rows} title="Framework performance benchmark" />
        <TrendChart rows={dataset.rows} title="Run-over-run performance" />
      </div>
      <LighthouseExplorer dataset={dataset} filters={filters} initialSelection={initialSelection} />
    </div>
  );
}
