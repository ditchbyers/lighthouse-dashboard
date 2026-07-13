import { promises as fs } from 'fs';
import path from 'path';
import { getResultsRoot } from '../../../lib/lighthouse-data';

function contentType(filePath) {
  if (filePath.endsWith('.html')) return 'text/html; charset=utf-8';
  if (filePath.endsWith('.json')) return 'application/json; charset=utf-8';
  if (filePath.endsWith('.csv')) return 'text/csv; charset=utf-8';
  return 'application/octet-stream';
}

export async function GET(request) {
  const file = request.nextUrl.searchParams.get('file');

  if (!file) {
    return new Response('Missing file parameter', { status: 400 });
  }

  const resultsRoot = getResultsRoot();
  const absolutePath = path.resolve(resultsRoot, file);
  const normalizedRoot = `${path.resolve(resultsRoot)}${path.sep}`;

  if (!absolutePath.startsWith(normalizedRoot)) {
    return new Response('Invalid file path', { status: 400 });
  }

  try {
    const data = await fs.readFile(absolutePath);
    return new Response(data, {
      headers: {
        'content-type': contentType(absolutePath),
        'content-disposition': `inline; filename="${path.basename(absolutePath)}"`,
      },
    });
  } catch {
    return new Response('File not found', { status: 404 });
  }
}
