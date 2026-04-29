import type { Metadata } from 'next';
import './globals.css';
import { Sidebar } from './components/sidebar';
import { ToastProvider } from './components/toast';

export const metadata: Metadata = {
  title: 'SignalKit',
  description: 'AI-powered intelligence pipeline',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ToastProvider>
          <Sidebar />
          <main className="min-h-screen bg-slate-50 lg:pl-56">
            <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
              {children}
            </div>
          </main>
        </ToastProvider>
      </body>
    </html>
  );
}
