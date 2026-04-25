import Link from 'next/link';
import { useRouter } from 'next/router';
import { LayoutDashboard, BarChart3, FileText, Settings, Sparkles } from 'lucide-react';
import clsx from 'clsx';

const navItems = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Analysis', href: '/analysis', icon: BarChart3 },
  { name: 'Reports', href: '/reports', icon: FileText },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export function Sidebar() {
  const router = useRouter();

  return (
    <div className="w-64 border-r border-slate-200 bg-white h-screen flex flex-col fixed left-0 top-0 z-20 shadow-sm">
      <div className="h-16 flex items-center px-6 border-b border-slate-100">
        <Sparkles className="w-5 h-5 text-indigo-600 mr-2" />
        <span className="font-bold text-lg text-gray-900 tracking-tight">StoreSense AI</span>
      </div>
      
      <div className="px-4 py-4">
        <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2 pl-2">Menu</div>
        <nav className="flex-1 space-y-1">
          {navItems.map((item) => {
            const isActive = router.pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={clsx(
                  'flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-gray-500 hover:text-gray-900 hover:bg-slate-50'
                )}
              >
                <item.icon className={clsx("w-4 h-4 mr-3", isActive ? "text-indigo-600" : "text-gray-400")} />
                {item.name}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="mt-auto p-4 border-t border-slate-100">
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
          <p className="text-xs font-bold text-gray-900 mb-1">AI Store Optimizer</p>
          <p className="text-[10px] text-gray-500 font-medium">v1.0.0 Pro Edition</p>
        </div>
      </div>
    </div>
  );
}
