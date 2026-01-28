import { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Lightbulb, ThumbsUp, ThumbsDown, Plus, Sparkles, Filter, TrendingUp, CheckCircle2, Clock, XCircle } from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useIdeas } from '@/hooks/useIdeas';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { IdeaDetailModal } from '@/components/ideas/IdeaDetailModal';
import type { Idea } from '@/types/database';

const Ideas = () => {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { ideas, loading, createIdea, voteIdea, updateIdeaStatus } = useIdeas();
  const { isAuthenticated, isManager } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedIdea, setSelectedIdea] = useState<Idea | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'votes'>('votes');

  // Stats
  const stats = useMemo(() => ({
    total: ideas.length,
    open: ideas.filter(i => i.status === 'open').length,
    underReview: ideas.filter(i => i.status === 'under-review').length,
    approved: ideas.filter(i => i.status === 'approved').length,
    implemented: ideas.filter(i => i.status === 'implemented').length,
  }), [ideas]);

  // Filtered and sorted ideas
  const filteredIdeas = useMemo(() => {
    let result = [...ideas];

    if (statusFilter !== 'all') {
      result = result.filter(i => i.status === statusFilter);
    }

    if (sortBy === 'votes') {
      result.sort((a, b) => (b.votes || 0) - (a.votes || 0));
    } else {
      result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }

    return result;
  }, [ideas, statusFilter, sortBy]);

  // Handle highlight from notification/activity click
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

  const handleSubmit = async () => {
    if (!title.trim() || !description.trim()) {
      toast({ title: 'Error', description: 'Please fill in all fields', variant: 'destructive' });
      return;
    }
    const { error } = await createIdea({ title, description, category: category || 'general' });
    if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
    else {
      toast({ title: 'Success', description: 'Idea submitted!' });
      setDialogOpen(false);
      setTitle('');
      setDescription('');
      setCategory('');
    }
  };

  const handleVote = async (e: React.MouseEvent, ideaId: string, type: 'up' | 'down') => {
    e.stopPropagation();
    if (!isAuthenticated) { toast({ title: 'Sign in required', variant: 'destructive' }); return; }
    await voteIdea(ideaId, type);
  };

  const handleStatusChange = async (e: React.MouseEvent, ideaId: string, status: Idea['status']) => {
    e.stopPropagation();
    await updateIdeaStatus(ideaId, status);
    toast({ title: 'Status Updated', description: `Idea marked as ${status.replace('-', ' ')}` });
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      open: 'bg-secondary text-secondary-foreground',
      'under-review': 'bg-warning text-warning-foreground',
      approved: 'bg-success text-success-foreground',
      rejected: 'bg-destructive text-destructive-foreground',
      implemented: 'bg-accent text-accent-foreground'
    };
    return colors[status] || 'bg-secondary';
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved': return <CheckCircle2 className="w-3 h-3" />;
      case 'under-review': return <Clock className="w-3 h-3" />;
      case 'rejected': return <XCircle className="w-3 h-3" />;
      case 'implemented': return <Sparkles className="w-3 h-3" />;
      default: return null;
    }
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold mb-2">Ideas & Innovation</h1>
            <p className="text-muted-foreground">Submit ideas, vote on suggestions, and help shape the future.</p>
          </div>
          {isAuthenticated && (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button size="lg">
                  <Plus className="w-4 h-4 mr-2" />Submit Idea
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Submit a New Idea</DialogTitle></DialogHeader>
                <div className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label>Title</Label>
                    <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Your idea title" />
                  </div>
                  <div className="space-y-2">
                    <Label>Category</Label>
                    <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g., Feature, Process, Tool" />
                  </div>
                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe your idea in detail..." rows={4} />
                  </div>
                  <Button onClick={handleSubmit} className="w-full">Submit Idea</Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {/* Stats Bar */}
        <div className="flex flex-wrap gap-3 mb-6">
          <button
            onClick={() => setStatusFilter('all')}
            className={cn(
              "px-4 py-2 rounded-full text-sm font-medium transition-all hover:scale-105",
              statusFilter === 'all' ? "bg-muted ring-2 ring-foreground/20 shadow-lg" : "bg-muted/50 hover:bg-muted"
            )}
          >
            <span className="font-bold mr-1">{stats.total}</span> All
          </button>
          <button
            onClick={() => setStatusFilter('open')}
            className={cn(
              "px-4 py-2 rounded-full text-sm font-medium transition-all hover:scale-105",
              statusFilter === 'open' ? "bg-secondary ring-2 ring-accent shadow-lg" : "bg-secondary/50 hover:bg-secondary"
            )}
          >
            <span className="font-bold mr-1">{stats.open}</span> Open
          </button>
          <button
            onClick={() => setStatusFilter('under-review')}
            className={cn(
              "px-4 py-2 rounded-full text-sm font-medium transition-all hover:scale-105",
              statusFilter === 'under-review' ? "bg-warning text-warning-foreground ring-2 ring-warning shadow-lg" : "bg-warning/70 text-warning-foreground hover:bg-warning"
            )}
          >
            <span className="font-bold mr-1">{stats.underReview}</span> Under Review
          </button>
          <button
            onClick={() => setStatusFilter('approved')}
            className={cn(
              "px-4 py-2 rounded-full text-sm font-medium transition-all hover:scale-105",
              statusFilter === 'approved' ? "bg-success text-success-foreground ring-2 ring-success shadow-lg" : "bg-success/70 text-success-foreground hover:bg-success"
            )}
          >
            <span className="font-bold mr-1">{stats.approved}</span> Approved
          </button>
          <button
            onClick={() => setStatusFilter('implemented')}
            className={cn(
              "px-4 py-2 rounded-full text-sm font-medium transition-all hover:scale-105",
              statusFilter === 'implemented' ? "bg-accent text-accent-foreground ring-2 ring-accent shadow-lg" : "bg-accent/70 text-accent-foreground hover:bg-accent"
            )}
          >
            <span className="font-bold mr-1">{stats.implemented}</span> Implemented
          </button>
        </div>

        {/* Sort Controls */}
        <div className="flex items-center gap-4 mb-6">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Sort by:</span>
          </div>
          <div className="flex gap-2">
            <Button
              variant={sortBy === 'votes' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSortBy('votes')}
            >
              <TrendingUp className="w-3 h-3 mr-1" /> Most Voted
            </Button>
            <Button
              variant={sortBy === 'newest' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSortBy('newest')}
            >
              <Clock className="w-3 h-3 mr-1" /> Newest
            </Button>
          </div>
          <span className="text-sm text-muted-foreground ml-auto">
            Showing {filteredIdeas.length} of {ideas.length} ideas
          </span>
        </div>

        {/* Ideas Grid */}
        {loading ? (
          <div className="text-center py-16"><p className="text-muted-foreground">Loading ideas...</p></div>
        ) : filteredIdeas.length === 0 ? (
          <div className="text-center py-16 border-2 border-dashed rounded-lg">
            <Lightbulb className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground mb-4">
              {statusFilter === 'all' ? 'No ideas yet. Be the first to submit one!' : `No ${statusFilter.replace('-', ' ')} ideas`}
            </p>
            {isAuthenticated && statusFilter === 'all' && (
              <Button onClick={() => setDialogOpen(true)}>Submit an Idea</Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredIdeas.map((idea, index) => (
              <Card
                key={idea.id}
                data-entity-id={idea.id}
                className="card-hover cursor-pointer transition-all relative overflow-hidden"
                onClick={() => setSelectedIdea(idea)}
              >
                {/* Rank badge for top 3 when sorting by votes */}
                {sortBy === 'votes' && index < 3 && (
                  <div className={cn(
                    "absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white",
                    index === 0 ? "bg-yellow-500" : index === 1 ? "bg-gray-400" : "bg-amber-600"
                  )}>
                    {index + 1}
                  </div>
                )}

                <CardContent className="p-5">
                  <div className="flex items-start gap-3">
                    {/* Vote Section */}
                    <div className="flex flex-col items-center gap-0.5 bg-muted/50 rounded-lg p-1.5">
                      <Button
                        variant="ghost"
                        size="sm"
                        className={cn("h-7 w-7 p-0", idea.user_vote === 'up' && "text-success bg-success/20")}
                        onClick={(e) => handleVote(e, idea.id, 'up')}
                      >
                        <ThumbsUp className="w-3.5 h-3.5" />
                      </Button>
                      <span className="font-bold text-sm">{idea.votes || 0}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className={cn("h-7 w-7 p-0", idea.user_vote === 'down' && "text-destructive bg-destructive/20")}
                        onClick={(e) => handleVote(e, idea.id, 'down')}
                      >
                        <ThumbsDown className="w-3.5 h-3.5" />
                      </Button>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold mb-1 line-clamp-1">{idea.title}</h3>
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        <Badge variant="outline" className="text-xs">{idea.category || 'General'}</Badge>
                        <Badge className={cn("text-xs capitalize flex items-center gap-1", getStatusColor(idea.status))}>
                          {getStatusIcon(idea.status)}
                          {idea.status.replace('-', ' ')}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-2">{idea.description}</p>
                      <p className="text-xs text-muted-foreground">
                        by {idea.creator?.full_name || 'Anonymous'} • {formatDistanceToNow(new Date(idea.created_at), { addSuffix: true })}
                      </p>

                      {/* Manager Actions */}
                      {isManager && idea.status === 'open' && (
                        <div className="flex gap-2 mt-3 pt-3 border-t">
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1 text-xs h-7"
                            onClick={(e) => handleStatusChange(e, idea.id, 'under-review')}
                          >
                            <Clock className="w-3 h-3 mr-1" /> Review
                          </Button>
                          <Button
                            size="sm"
                            variant="default"
                            className="flex-1 text-xs h-7 bg-success hover:bg-success/90"
                            onClick={(e) => handleStatusChange(e, idea.id, 'approved')}
                          >
                            <CheckCircle2 className="w-3 h-3 mr-1" /> Approve
                          </Button>
                        </div>
                      )}
                      {isManager && idea.status === 'under-review' && (
                        <div className="flex gap-2 mt-3 pt-3 border-t">
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1 text-xs h-7 text-destructive hover:bg-destructive/10"
                            onClick={(e) => handleStatusChange(e, idea.id, 'rejected')}
                          >
                            <XCircle className="w-3 h-3 mr-1" /> Reject
                          </Button>
                          <Button
                            size="sm"
                            variant="default"
                            className="flex-1 text-xs h-7 bg-success hover:bg-success/90"
                            onClick={(e) => handleStatusChange(e, idea.id, 'approved')}
                          >
                            <CheckCircle2 className="w-3 h-3 mr-1" /> Approve
                          </Button>
                        </div>
                      )}
                      {isManager && idea.status === 'approved' && (
                        <div className="mt-3 pt-3 border-t">
                          <Button
                            size="sm"
                            variant="default"
                            className="w-full text-xs h-7"
                            onClick={(e) => handleStatusChange(e, idea.id, 'implemented')}
                          >
                            <Sparkles className="w-3 h-3 mr-1" /> Mark Implemented
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <IdeaDetailModal
        idea={selectedIdea}
        open={!!selectedIdea}
        onOpenChange={(open) => !open && setSelectedIdea(null)}
      />
    </Layout>
  );
};

export default Ideas;
