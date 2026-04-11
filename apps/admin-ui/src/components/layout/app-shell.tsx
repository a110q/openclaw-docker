import { Sidebar } from './sidebar';
import { Topbar } from './topbar';
import { findNavItem } from '@/lib/navigation';
import { syncProjectStateSnapshot } from '@/lib/server/project-state';

export async function AppShell({
  currentPath,
  title,
  description,
  badge,
  children
}: {
  currentPath: string;
  title: string;
  description?: string;
  badge?: string;
  children: React.ReactNode;
}) {
  const navItem = findNavItem(currentPath);

  await syncProjectStateSnapshot({
    currentPath,
    title,
    description,
    badge,
    sectionLabel: navItem?.label || title
  }).catch(() => undefined);

  return (
    <div className="min-h-screen text-slate-900">
      <div className="mx-auto grid min-h-screen max-w-[1600px] gap-4 px-3 py-4 lg:grid-cols-[236px_minmax(0,1fr)] xl:px-4">
        <Sidebar currentPath={currentPath} />
        <div className="min-w-0 space-y-4">
          <Topbar title={title} description={description} badge={badge} sectionLabel={navItem?.subtitle || navItem?.label} />
          <main className="space-y-4 pb-10">{children}</main>
        </div>
      </div>
    </div>
  );
}
