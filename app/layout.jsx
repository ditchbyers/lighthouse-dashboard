import './globals.css';
import SidebarNav from './components/SidebarNav';
import { Geist, Geist_Mono } from 'next/font/google';

const geistSans = Geist({ subsets: ['latin'], variable: '--font-geist-sans' });
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono' });

export const metadata = {
  title: 'Lighthouse Evaluation Dashboard',
  description: 'Scientific evaluation dashboard for Lighthouse benchmark runs',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" data-scroll-behavior="smooth" className="bg-background">
      <body className={`${geistSans.variable} ${geistMono.variable} font-sans`}>
        <div className="min-h-screen overflow-x-hidden flex flex-col lg:flex-row">
          <aside className="lg:sticky lg:top-0 lg:h-screen lg:w-72 lg:shrink-0 border-b lg:border-b-0 lg:border-r border-white/10 bg-slate-950/70 backdrop-blur-xl p-5 overflow-x-hidden">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 mb-6">
              <p className="text-xs uppercase tracking-[0.3em] text-cyan-200/70">Lighthouse</p>
              <h1 className="mt-2 text-2xl font-semibold leading-tight">Scientific Evaluation Dashboard</h1>
              <p className="mt-2 text-sm text-slate-300">
                Navigation-first workflow for overview, run catalog, run diagnostics, and methodology docs.
              </p>
            </div>

            <nav className="text-sm">
              <p className="mb-3 text-xs uppercase tracking-[0.25em] text-slate-400">Navigation Path</p>
              <SidebarNav />
            </nav>
          </aside>

          <main className="min-w-0 flex-1 overflow-x-hidden p-5 lg:p-8">
            <div className="w-full min-w-0">{children}</div>
          </main>
        </div>
      </body>
    </html>
  );
}
