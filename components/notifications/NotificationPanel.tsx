import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, Check, CheckCheck, Trash2, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useNotifications } from '@/hooks/useNotifications';
import { useNotificationPreferences } from '@/hooks/useNotificationPreferences';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';

export function NotificationPanel() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { notifications, unreadCount, markAsRead, markAllAsRead, deleteNotification, loading } = useNotifications();
  const { preferences, isMuted, isSnoozed, mute, snooze, updatePreferences } = useNotificationPreferences();
  const emailEnabled = Boolean(preferences?.email_enabled);

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'task_assigned':
      case 'new_assignment':
        return '📋';
      case 'task_completed':
        return '✅';
      case 'task_approved':
        return '✅';
      case 'task_rejected':
        return '⚠️';
      case 'task_submitted':
        return '📋';
      case 'project_update':
      case 'new_project':
        return '📁';
      case 'mention':
        return '💬';
      case 'deadline':
      case 'deadline_reminder':
        return '⏰';
      case 'task_taken':
        return '🎯';
      case 'new_task':
        return '✨';
      case 'new_idea':
      case 'idea_created':
        return '💡';
      default:
        return '🔔';
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'task_assigned':
      case 'new_assignment':
      case 'task_taken':
        return 'from-blue-500/20 to-cyan-500/20 border-blue-500/30';
      case 'task_completed':
      case 'task_approved':
        return 'from-green-500/20 to-emerald-500/20 border-green-500/30';
      case 'task_rejected':
        return 'from-red-500/20 to-rose-500/20 border-red-500/30';
      case 'task_submitted':
        return 'from-purple-500/20 to-pink-500/20 border-purple-500/30';
      case 'project_update':
      case 'new_project':
        return 'from-purple-500/20 to-pink-500/20 border-purple-500/30';
      case 'deadline':
      case 'deadline_reminder':
        return 'from-orange-500/20 to-red-500/20 border-orange-500/30';
      case 'new_task':
        return 'from-yellow-500/20 to-orange-500/20 border-yellow-500/30';
      case 'new_idea':
      case 'idea_created':
        return 'from-yellow-500/20 to-orange-500/20 border-yellow-500/30';
      default:
        return 'from-accent/20 to-info/20 border-accent/30';
    }
  };

  const handleNotificationClick = async (notification: typeof notifications[0]) => {
    // Mark as read
    if (!notification.read) {
      await markAsRead(notification.id);
    }

    // Navigate based on entity type
    if (notification.entity_type && notification.entity_id) {
      setOpen(false);

      const highlightId = notification.entity_id;

      switch (notification.entity_type) {
        case 'project':
          router.push(`/projects?highlight=${highlightId}`);
          break;
        case 'task':
          router.push(`/tasks?highlight=${highlightId}`);
          break;
        case 'idea':
          router.push(`/ideas?highlight=${highlightId}`);
          break;
        default:
          break;
      }

      // Trigger highlight after navigation
      setTimeout(() => {
        const element = document.querySelector(`[data-entity-id="${highlightId}"]`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          element.classList.add('highlight-glow');
          setTimeout(() => {
            element.classList.remove('highlight-glow');
          }, 3000);
        }
      }, 300);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative group hover:bg-accent/10 transition-all duration-300"
        >
          <Bell className="h-5 w-5 transition-transform group-hover:scale-110 group-hover:text-accent" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs animate-pulse bg-gradient-to-r from-rose-500 to-pink-500 border-0"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0 shadow-2xl border-0 bg-card/95 backdrop-blur-xl" align="end">
        <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-accent/10 to-info/10">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-r from-accent to-info flex items-center justify-center">
              <Bell className="h-4 w-4 text-white" />
            </div>
            <div>
              <h4 className="font-semibold">Notifications</h4>
              {unreadCount > 0 && (
                <p className="text-xs text-muted-foreground">{unreadCount} unread</p>
              )}
            </div>
          </div>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => markAllAsRead()}
              className="text-xs hover:bg-accent/20 transition-colors"
            >
              <CheckCheck className="h-4 w-4 mr-1" />
              Mark all read
            </Button>
          )}
        </div>
        <div className="px-4 py-3 border-b bg-muted/20 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span>Email notifications</span>
            <Switch
              checked={emailEnabled}
              onCheckedChange={(checked) => updatePreferences({
                email_enabled: checked,
                digest_enabled: checked ? Boolean(preferences?.digest_enabled) : false,
              })}
            />
          </div>
          <div className="flex items-center justify-between text-xs">
            <span>Digest email</span>
            <Switch
              checked={emailEnabled && Boolean(preferences?.digest_enabled)}
              disabled={!emailEnabled}
              onCheckedChange={(checked) => updatePreferences({
                email_enabled: checked ? true : emailEnabled,
                digest_enabled: checked,
              })}
            />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => mute(4)}>
              {isMuted ? 'Muted' : 'Mute 4h'}
            </Button>
            <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => snooze(2)}>
              {isSnoozed ? 'Snoozed' : 'Snooze 2h'}
            </Button>
          </div>
        </div>
        <ScrollArea className="h-[350px]">
          {loading ? (
            <div className="p-8 text-center">
              <div className="inline-block w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin"></div>
              <p className="text-muted-foreground mt-2 text-sm">Loading notifications...</p>
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-8 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-r from-secondary to-muted flex items-center justify-center">
                <Bell className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground font-medium">All caught up!</p>
              <p className="text-xs text-muted-foreground mt-1">No new notifications</p>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  className={cn(
                    "p-4 cursor-pointer transition-all duration-300 hover:bg-accent/5 group",
                    !notification.read && `bg-gradient-to-r ${getNotificationColor(notification.type)}`
                  )}
                >
                  <div className="flex gap-3">
                    <div className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center text-lg shrink-0 transition-transform group-hover:scale-110",
                      !notification.read
                        ? "bg-gradient-to-r from-accent/30 to-info/30"
                        : "bg-secondary"
                    )}>
                      {getNotificationIcon(notification.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={cn(
                          "text-sm line-clamp-1",
                          !notification.read ? "font-semibold" : "font-medium"
                        )}>
                          {notification.title}
                        </p>
                        {notification.entity_type && (
                          <ExternalLink className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-1" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                        {notification.message}
                      </p>
                      <p className="text-xs text-muted-foreground/70 mt-1.5">
                        {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                      </p>
                    </div>
                    <div className="flex flex-col gap-1 shrink-0">
                      {!notification.read && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 rounded-full hover:bg-green-500/20 hover:text-green-500 transition-colors"
                          onClick={(e) => { e.stopPropagation(); markAsRead(notification.id); }}
                          title="Mark as read"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 rounded-full hover:bg-destructive/20 hover:text-destructive transition-colors"
                        onClick={(e) => { e.stopPropagation(); deleteNotification(notification.id); }}
                        title="Delete notification"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
