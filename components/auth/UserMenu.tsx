import { LogOut, Settings, User, ChevronDown, Shield, LayoutDashboard, Sparkles, Crown } from 'lucide-react';
import { useRouter } from 'next/navigation';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { EditProfileModal } from '@/components/profile/EditProfileModal';

export function UserMenu() {
  const router = useRouter();
  const { profile, isAuthenticated, isAdmin, isManager, signOut, loading } = useAuth();

  if (loading) {
    return (
      <div className="w-8 h-8 rounded-full bg-secondary animate-pulse" />
    );
  }

  if (!isAuthenticated || !profile) {
    return (
      <Button
        onClick={() => router.push('/auth')}
        size="sm"
        className="bg-gradient-to-r from-accent to-info hover:from-accent/90 hover:to-info/90 text-white shadow-lg shadow-accent/25"
      >
        <Sparkles className="w-4 h-4 mr-2" />
        Sign In
      </Button>
    );
  }

  const initials = profile.full_name
    ?.split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'U';

  const handleSignOut = async () => {
    await signOut();
    router.push('/');
  };

  // Get display designation - only show if set, don't show 'member' as fallback
  const displayDesignation = profile.designation || profile.department || null;

  // Get role badge
  const getRoleBadge = () => {
    if (isAdmin) return <Badge className="bg-destructive/20 text-destructive text-xs"><Shield className="w-3 h-3 mr-1" />Admin</Badge>;
    if (isManager) return <Badge className="bg-accent/20 text-accent text-xs"><Crown className="w-3 h-3 mr-1" />Manager</Badge>;
    return null;
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="flex items-center gap-2 px-2 h-auto py-1 hover:bg-secondary/80">
          {/* Avatar - with gradient or photo */}
          <div className="relative shrink-0">
            {profile.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={profile.full_name || 'User'}
                className="w-9 h-9 rounded-full object-cover ring-2 ring-accent/30 avatar-smooth"
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-accent to-info flex items-center justify-center text-sm font-bold text-white shadow-lg shadow-accent/30">
                {initials}
              </div>
            )}
            {/* Online status */}
            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-success border-2 border-background" />
          </div>
          <div className="hidden md:block text-left">
            <div className="text-sm font-medium flex items-center gap-2">
              {profile.full_name}
              {getRoleBadge()}
            </div>
            {displayDesignation && (
              <div className="text-xs text-muted-foreground">{displayDesignation}</div>
            )}
          </div>
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="font-normal">
          <div className="flex items-center gap-3">
            {/* Avatar in dropdown */}
            {profile.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={profile.full_name || 'User'}
                className="w-12 h-12 rounded-full object-cover ring-2 ring-accent/30 avatar-smooth"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-accent to-info flex items-center justify-center text-lg font-bold text-white">
                {initials}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">{profile.full_name}</p>
              <p className="text-xs text-muted-foreground truncate">{profile.email}</p>
              <div className="mt-1">
                {getRoleBadge()}
              </div>
            </div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        <DropdownMenuItem
          onClick={() => router.push('/my-dashboard')}
          className="flex items-center gap-2 cursor-pointer"
        >
          <LayoutDashboard className="w-4 h-4" />
          My Dashboard
        </DropdownMenuItem>

        {isAdmin && (
          <DropdownMenuItem
            onClick={() => router.push('/admin')}
            className="flex items-center gap-2 cursor-pointer"
          >
            <Shield className="w-4 h-4" />
            Admin Panel
          </DropdownMenuItem>
        )}

        <DropdownMenuSeparator />

        <EditProfileModal />

        <DropdownMenuItem
          onClick={handleSignOut}
          className="flex items-center gap-2 text-destructive cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
