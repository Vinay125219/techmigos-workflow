import { useState } from 'react';
import { X, MessageSquare, ThumbsUp, ThumbsDown, Send, Trash2, User, Crown, CheckCircle, XCircle, Clock, Sparkles } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useDiscussions } from '@/hooks/useDiscussions';
import { useIdeas } from '@/hooks/useIdeas';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';
import type { Idea } from '@/types/database';
import { cn } from '@/lib/utils';

interface IdeaDetailModalProps {
    idea: Idea | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function IdeaDetailModal({ idea, open, onOpenChange }: IdeaDetailModalProps) {
    const { voteIdea, updateIdeaStatus } = useIdeas();
    const { discussions, addDiscussion, deleteDiscussion, loading: discussionsLoading } = useDiscussions('idea', idea?.id || '');
    const { user, isAuthenticated, isManager } = useAuth();
    const [newComment, setNewComment] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [updatingStatus, setUpdatingStatus] = useState(false);

    if (!idea) return null;

    const handleVote = async (type: 'up' | 'down') => {
        if (!isAuthenticated) {
            toast({ title: 'Sign in required', variant: 'destructive' });
            return;
        }
        await voteIdea(idea.id, type);
    };

    const handleSubmitComment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newComment.trim()) return;

        setSubmitting(true);
        const { error } = await addDiscussion(newComment.trim());
        setSubmitting(false);

        if (error) {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        } else {
            setNewComment('');
        }
    };

    const handleDeleteComment = async (discussionId: string) => {
        const { error } = await deleteDiscussion(discussionId);
        if (error) {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        }
    };

    const handleStatusChange = async (newStatus: Idea['status']) => {
        setUpdatingStatus(true);
        const { error } = await updateIdeaStatus(idea.id, newStatus);
        setUpdatingStatus(false);

        if (error) {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        } else {
            toast({ title: 'Success', description: `Idea status updated to ${newStatus}` });
        }
    };

    const getStatusColor = (status: string) => {
        const colors: Record<string, string> = {
            open: 'bg-secondary',
            'under-review': 'bg-warning',
            approved: 'bg-success',
            rejected: 'bg-destructive',
            implemented: 'bg-accent'
        };
        return colors[status] || 'bg-secondary';
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogDescription className="sr-only">
                        Idea details and discussion forum
                    </DialogDescription>
                    <div className="flex items-start gap-3">
                        <div className="flex-1">
                            <DialogTitle className="text-xl mb-2">{idea.title}</DialogTitle>
                            <div className="flex gap-2 items-center">
                                <Badge variant="outline" className="text-xs">{idea.category || 'General'}</Badge>
                                <Badge className={cn("text-xs capitalize", getStatusColor(idea.status))}>
                                    {idea.status.replace('-', ' ')}
                                </Badge>
                            </div>
                        </div>

                        {/* Voting */}
                        <div className="flex flex-col items-center  gap-1 bg-secondary/30 rounded-lg p-2">
                            <Button
                                variant="ghost"
                                size="sm"
                                className={cn("h-8 px-2", idea.user_vote === 'up' && "text-success")}
                                onClick={() => handleVote('up')}
                            >
                                <ThumbsUp className="w-4 h-4" />
                            </Button>
                            <span className="font-bold text-lg">{idea.votes}</span>
                            <Button
                                variant="ghost"
                                size="sm"
                                className={cn("h-8 px-2", idea.user_vote === 'down' && "text-destructive")}
                                onClick={() => handleVote('down')}
                            >
                                <ThumbsDown className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>
                </DialogHeader>

                <div className="space-y-6 pt-4">
                    {/* Description */}
                    <div>
                        <h4 className="text-sm font-medium mb-2">Description</h4>
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">{idea.description}</p>
                    </div>

                    {/* Metadata */}
                    <div className="flex items-center gap-4 text-sm text-muted-foreground border-t pt-4">
                        <div className="flex items-center gap-2">
                            <User className="w-4 h-4" />
                            <span>{idea.creator?.full_name || 'Anonymous'}</span>
                        </div>
                        <span>•</span>
                        <span>{formatDistanceToNow(new Date(idea.created_at), { addSuffix: true })}</span>
                    </div>

                    {/* Manager Actions - Only visible to Managers/Admins */}
                    {isManager && (
                        <div className="border-t pt-4">
                            <h4 className="text-sm font-medium flex items-center gap-2 mb-3">
                                <Crown className="w-4 h-4 text-warning" />
                                Manager Actions
                            </h4>
                            <div className="flex flex-wrap gap-2">
                                {idea.status !== 'under-review' && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleStatusChange('under-review')}
                                        disabled={updatingStatus}
                                    >
                                        <Clock className="w-4 h-4 mr-1" />
                                        Under Review
                                    </Button>
                                )}
                                {idea.status !== 'approved' && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="text-success hover:text-success"
                                        onClick={() => handleStatusChange('approved')}
                                        disabled={updatingStatus}
                                    >
                                        <CheckCircle className="w-4 h-4 mr-1" />
                                        Approve
                                    </Button>
                                )}
                                {idea.status !== 'rejected' && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="text-destructive hover:text-destructive"
                                        onClick={() => handleStatusChange('rejected')}
                                        disabled={updatingStatus}
                                    >
                                        <XCircle className="w-4 h-4 mr-1" />
                                        Reject
                                    </Button>
                                )}
                                {idea.status === 'approved' && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="text-accent hover:text-accent"
                                        onClick={() => handleStatusChange('implemented')}
                                        disabled={updatingStatus}
                                    >
                                        <Sparkles className="w-4 h-4 mr-1" />
                                        Mark Implemented
                                    </Button>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Discussions */}
                    <div className="border-t pt-4">
                        <h4 className="text-sm font-medium flex items-center gap-2 mb-4">
                            <MessageSquare className="w-4 h-4" />
                            Discussion ({discussions.length})
                        </h4>

                        {/* Comment Form */}
                        {isAuthenticated && (
                            <form onSubmit={handleSubmitComment} className="space-y-2 mb-4">
                                <Textarea
                                    placeholder="Share your thoughts on this idea..."
                                    value={newComment}
                                    onChange={(e) => setNewComment(e.target.value)}
                                    rows={2}
                                    className="resize-none"
                                />
                                <Button
                                    type="submit"
                                    size="sm"
                                    disabled={!newComment.trim() || submitting}
                                >
                                    <Send className="w-4 h-4 mr-1" />
                                    {submitting ? 'Sending...' : 'Comment'}
                                </Button>
                            </form>
                        )}

                        {/* Comments List */}
                        <div className="space-y-3">
                            {discussionsLoading ? (
                                <p className="text-sm text-muted-foreground text-center py-4">Loading discussions...</p>
                            ) : discussions.length === 0 ? (
                                <p className="text-sm text-muted-foreground text-center py-4">No comments yet. Start the discussion!</p>
                            ) : (
                                discussions.map((comment) => (
                                    <div key={comment.id} className="flex gap-3 p-3 rounded-lg bg-secondary/30">
                                        <Avatar className="w-8 h-8">
                                            <AvatarImage src={comment.user?.avatar_url || ''} />
                                            <AvatarFallback>
                                                {comment.user?.full_name?.charAt(0) || <User className="w-4 h-4" />}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between gap-2">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-medium text-sm">{comment.user?.full_name || 'Anonymous'}</span>
                                                    <span className="text-xs text-muted-foreground">
                                                        {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                                                    </span>
                                                </div>
                                                {comment.user_id === user?.id && (
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-6 w-6 text-destructive hover:text-destructive"
                                                        onClick={() => handleDeleteComment(comment.id)}
                                                    >
                                                        <Trash2 className="w-3 h-3" />
                                                    </Button>
                                                )}
                                            </div>
                                            <p className="text-sm mt-1 whitespace-pre-wrap">{comment.content}</p>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
