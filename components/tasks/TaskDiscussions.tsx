import { useState } from 'react';
import { MessageSquare, Send, Trash2, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useDiscussions } from '@/hooks/useDiscussions';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';

interface TaskDiscussionsProps {
  taskId: string;
}

export function TaskDiscussions({ taskId }: TaskDiscussionsProps) {
  const { discussions, addDiscussion, deleteDiscussion, loading } = useDiscussions('task', taskId);
  const { user, isAuthenticated } = useAuth();
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
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

  const handleDelete = async (discussionId: string) => {
    const { error } = await deleteDiscussion(discussionId);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-medium flex items-center gap-2">
        <MessageSquare className="w-4 h-4" />
        Discussion ({discussions.length})
      </h4>

      {/* Comment Form */}
      {isAuthenticated && (
        <form onSubmit={handleSubmit} className="space-y-2">
          <Textarea
            placeholder="Add a comment..."
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
        {loading ? (
          <p className="text-sm text-muted-foreground text-center py-4">Loading comments...</p>
        ) : discussions.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No comments yet. Be the first to comment!</p>
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
                  {(comment.user_id === user?.id) && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-destructive hover:text-destructive"
                      onClick={() => handleDelete(comment.id)}
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
  );
}
