import { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { TopNavbar } from './TopNavbar';
import { useRouter } from 'next/router';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const router = useRouter();
  
  if (router.pathname === '/') {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-gray-900 font-sans selection:bg-indigo-100 selection:text-indigo-900">
      <Sidebar />
      <div className="pl-64 flex flex-col min-h-screen">
        <TopNavbar />
        <main className="flex-1 p-6 overflow-x-hidden">
          <div className="max-w-7xl mx-auto pb-12">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
