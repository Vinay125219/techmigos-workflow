import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { LayoutGrid, List } from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { ProjectCard } from '@/components/projects/ProjectCard';
import { CreateProjectModal } from '@/components/projects/CreateProjectModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ProjectCardSkeleton } from '@/components/ui/card-skeletons';
import { useProjects } from '@/hooks/useProjects';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspaceContext } from '@/contexts/WorkspaceContext';
import { cn } from '@/lib/utils';

const Projects = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { activeWorkspaceId } = useWorkspaceContext();
  const { isAuthenticated, isManager } = useAuth();
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const { projects, loading, hasMore, totalCount } = useProjects({
    workspaceId: activeWorkspaceId,
    page,
    pageSize,
    search: searchQuery || undefined,
    status: statusFilter === 'all' ? undefined : statusFilter,
    category: categoryFilter === 'all' ? undefined : categoryFilter,
  });

  // Handle highlight from notification click
  useEffect(() => {
    const highlightId = searchParams.get('highlight');
    if (highlightId && !loading) {
      setTimeout(() => {
        const element = document.querySelector(`[data-entity-id="${highlightId}"]`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          element.classList.add('highlight-glow');
          setTimeout(() => {
            element.classList.remove('highlight-glow');
          }, 3000);
        }
        const params = new URLSearchParams(searchParams.toString());
        params.delete('highlight');
        router.replace(`?${params.toString()}`, { scroll: false });
      }, 500);
    }
  }, [searchParams, loading, router]);

  const categories = [...new Set(projects.map(p => p.category).filter(Boolean))] as string[];

  const filteredProjects = projects;

  const stats = {
    total: totalCount || projects.length,
    active: projects.filter(p => p.status === 'active').length,
    completed: projects.filter(p => p.status === 'completed').length,
    planned: projects.filter(p => p.status === 'planned').length,
  };

  useEffect(() => {
    setPage(1);
  }, [searchQuery, statusFilter, categoryFilter, activeWorkspaceId]);

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">Projects</h1>
            <p className="text-muted-foreground">Browse and explore all company projects.</p>
          </div>
          {isManager && <CreateProjectModal />}
        </div>

        <div className="flex flex-wrap gap-3 mb-6">
          <Badge variant="secondary" className="px-4 py-2"><span className="font-bold mr-1">{stats.total}</span> Total</Badge>
          <Badge className="px-4 py-2 bg-accent text-accent-foreground"><span className="font-bold mr-1">{stats.active}</span> Active</Badge>
          <Badge className="px-4 py-2 bg-success text-success-foreground"><span className="font-bold mr-1">{stats.completed}</span> Completed</Badge>
          <Badge variant="outline" className="px-4 py-2"><span className="font-bold mr-1">{stats.planned}</span> Planned</Badge>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <Input placeholder="Search projects..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="sm:max-w-xs" />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px]"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="planned">Planned</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="on-hold">On Hold</SelectItem>
            </SelectContent>
          </Select>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Category" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map((cat) => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="flex gap-1 ml-auto">
            <Button variant={viewMode === 'grid' ? 'default' : 'outline'} size="icon" onClick={() => setViewMode('grid')}><LayoutGrid className="w-4 h-4" /></Button>
            <Button variant={viewMode === 'list' ? 'default' : 'outline'} size="icon" onClick={() => setViewMode('list')}><List className="w-4 h-4" /></Button>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <ProjectCardSkeleton key={i} />
            ))}
          </div>
        ) : filteredProjects.length > 0 ? (
          <>
            <div className={cn(viewMode === 'grid' ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" : "space-y-3")}>
              {filteredProjects.map((project) => (
                <ProjectCard key={project.id} project={project} variant={viewMode} onViewTasks={(projectId) => router.push(`/tasks?project=${projectId}`)} />
              ))}
            </div>
            <div className="mt-6 flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Page {page} · Showing {projects.length} of {totalCount || projects.length}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((prev) => Math.max(1, prev - 1))}>
                  Previous
                </Button>
                <Button variant="outline" size="sm" disabled={!hasMore} onClick={() => setPage((prev) => prev + 1)}>
                  Next
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="text-center py-16"><p className="text-muted-foreground">No projects found.</p></div>
        )}
      </div>
    </Layout>
  );
};

export default Projects;
