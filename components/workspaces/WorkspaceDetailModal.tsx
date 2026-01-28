import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useWorkspaceMembers } from '@/hooks/useWorkspaces';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { UserPlus, Trash2, Crown, Shield, User, Eye } from 'lucide-react';
import type { Workspace, WorkspaceRole } from '@/types/database';

interface WorkspaceDetailModalProps {
  workspace: Workspace | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function WorkspaceDetailModal({ workspace, open, onOpenChange }: WorkspaceDetailModalProps) {
  const { user } = useAuth();
  const { members, loading, addMember, updateMemberRole, removeMember } = useWorkspaceMembers(workspace?.id);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'member' | 'viewer'>('member');
  const [inviting, setInviting] = useState(false);

  const isOwner = workspace?.owner_id === user?.id;
  const currentUserMember = members.find(m => m.user_id === user?.id);
  const canManageMembers = isOwner || currentUserMember?.role === 'admin';

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;

    setInviting(true);
    const { error } = await addMember(inviteEmail.trim(), inviteRole);
    setInviting(false);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: 'Member added successfully!' });
      setInviteEmail('');
    }
  };

  const handleRoleChange = async (memberId: string, newRole: 'admin' | 'member' | 'viewer') => {
    const { error } = await updateMemberRole(memberId, newRole);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: 'Role updated successfully!' });
    }
  };

  const handleRemove = async (memberId: string) => {
    const { error } = await removeMember(memberId);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: 'Member removed successfully!' });
    }
  };

  const getRoleIcon = (role: WorkspaceRole) => {
    switch (role) {
      case 'owner': return <Crown className="w-4 h-4 text-yellow-500" />;
      case 'admin': return <Shield className="w-4 h-4 text-blue-500" />;
      case 'member': return <User className="w-4 h-4 text-green-500" />;
      case 'viewer': return <Eye className="w-4 h-4 text-gray-500" />;
    }
  };

  if (!workspace) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{workspace.name}</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="members" className="mt-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="members">Members</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="members" className="space-y-4">
            {canManageMembers && (
              <form onSubmit={handleInvite} className="flex gap-2">
                <Input
                  placeholder="Email address"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="flex-1"
                />
                <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as any)}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="member">Member</SelectItem>
                    <SelectItem value="viewer">Viewer</SelectItem>
                  </SelectContent>
                </Select>
                <Button type="submit" disabled={inviting}>
                  <UserPlus className="w-4 h-4 mr-1" />
                  Invite
                </Button>
              </form>
            )}

            <div className="space-y-2">
              {loading ? (
                <div className="text-center py-4 text-muted-foreground">Loading members...</div>
              ) : members.length === 0 ? (
                <div className="text-center py-4 text-muted-foreground">No members yet</div>
              ) : (
                members.map(member => (
                  <div key={member.id} className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={member.user?.avatar_url || ''} />
                        <AvatarFallback>{member.user?.full_name?.charAt(0) || '?'}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{member.user?.full_name || 'Unknown'}</p>
                        <p className="text-sm text-muted-foreground">{member.user?.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {getRoleIcon(member.role)}
                      {canManageMembers && member.role !== 'owner' ? (
                        <>
                          <Select 
                            value={member.role} 
                            onValueChange={(v) => handleRoleChange(member.id, v as any)}
                          >
                            <SelectTrigger className="w-28">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="admin">Admin</SelectItem>
                              <SelectItem value="member">Member</SelectItem>
                              <SelectItem value="viewer">Viewer</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleRemove(member.id)}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </>
                      ) : (
                        <Badge variant="outline" className="capitalize">{member.role}</Badge>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="settings" className="space-y-4">
            <div>
              <Label>Workspace Name</Label>
              <p className="text-lg font-medium">{workspace.name}</p>
            </div>
            <div>
              <Label>Description</Label>
              <p className="text-muted-foreground">{workspace.description || 'No description'}</p>
            </div>
            <div>
              <Label>Created</Label>
              <p className="text-muted-foreground">{new Date(workspace.created_at).toLocaleDateString()}</p>
            </div>
            <div>
              <Label>Statistics</Label>
              <div className="flex gap-4 mt-2">
                <Badge variant="secondary">{workspace.member_count || 0} members</Badge>
                <Badge variant="secondary">{workspace.project_count || 0} projects</Badge>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
