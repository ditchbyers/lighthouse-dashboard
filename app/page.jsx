import { buildFilterState, loadLighthouseDataset } from '../lib/lighthouse-data';
import { getSelectionFromSearchParams } from '../lib/filter-state';
import LighthouseExplorer from './components/LighthouseExplorer';

export const dynamic = 'force-dynamic';

export default async function Page({ searchParams }) {
  const resolvedSearchParams = await searchParams;
  const dataset = await loadLighthouseDataset();
  const filters = buildFilterState(dataset);
  const initialSelection = getSelectionFromSearchParams(filters, resolvedSearchParams ?? {});

  return <LighthouseExplorer dataset={dataset} filters={filters} initialSelection={initialSelection} />;
}
