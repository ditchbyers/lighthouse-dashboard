'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
  {
    title: 'Explore',
    items: [
      { href: '/', label: 'Overview Dashboard' },
      { href: '/runs', label: 'Run Catalog' },
    ],
  },
  {
    title: 'Knowledge Base',
    items: [
      { href: '/wiki', label: 'Wiki Home' },
      { href: '/wiki/metrics', label: 'Metrics' },
      { href: '/wiki/statistics', label: 'Statistics' },
      { href: '/wiki/frameworks', label: 'Frameworks' },
      { href: '/wiki/methodology', label: 'Methodology' },
    ],
  },
];

function breadcrumbFromPath(pathname) {
  const segments = pathname.split('/').filter(Boolean);
  if (!segments.length) return 'Overview Dashboard';
  return segments
    .map((segment) => decodeURIComponent(segment).replace(/[-_]/g, ' '))
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' / ');
}

export default function SidebarNav() {
  const pathname = usePathname();

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-cyan-300/20 bg-cyan-400/10 px-3 py-2">
        <p className="text-[11px] uppercase tracking-[0.22em] text-cyan-100/75">Current Path</p>
        <p className="mt-1 text-sm font-medium text-cyan-50 break-all">{breadcrumbFromPath(pathname)}</p>
      </div>

      {NAV_ITEMS.map((group) => (
        <div key={group.title}>
          <p className="mb-2 text-[11px] uppercase tracking-[0.2em] text-slate-400">{group.title}</p>
          <ul className="space-y-2">
            {group.items.map((item) => {
              const active = pathname === item.href || (item.href !== '/' && pathname.startsWith(`${item.href}/`));
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={[
                      'block rounded-lg border px-3 py-2 transition',
                      active
                        ? 'border-cyan-300/60 bg-cyan-400/15 text-cyan-100'
                        : 'border-white/10 bg-white/5 text-slate-200 hover:border-cyan-300/50 hover:bg-cyan-400/10',
                    ].join(' ')}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
