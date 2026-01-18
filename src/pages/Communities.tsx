import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Plus, Users, UserPlus, UserMinus, Crown, Edit, Trash2 } from 'lucide-react';

interface Community {
  id: string;
  name: string;
  description: string | null;
  cover_image_url: string | null;
  created_by: string | null;
  member_count: number;
  is_member: boolean;
  is_creator: boolean;
}

export default function Communities() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [communities, setCommunities] = useState<Community[]>([]);
  const [myCommunities, setMyCommunities] = useState<Community[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingCommunity, setEditingCommunity] = useState<Community | null>(null);
  const [saving, setSaving] = useState(false);
  
  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    fetchCommunities();
  }, [user]);

  const fetchCommunities = async () => {
    setLoading(true);
    try {
      // Fetch all communities
      const { data: communitiesData, error } = await supabase
        .from('communities')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get member counts and membership status
      const enrichedCommunities = await Promise.all(
        (communitiesData || []).map(async (community) => {
          const { count } = await supabase
            .from('community_members')
            .select('*', { count: 'exact', head: true })
            .eq('community_id', community.id);

          let is_member = false;
          if (user) {
            const { data: memberCheck } = await supabase
              .from('community_members')
              .select('id')
              .eq('community_id', community.id)
              .eq('user_id', user.id)
              .single();
            is_member = !!memberCheck;
          }

          return {
            ...community,
            member_count: count || 0,
            is_member,
            is_creator: community.created_by === user?.id,
          };
        })
      );

      setCommunities(enrichedCommunities);
      setMyCommunities(enrichedCommunities.filter(c => c.is_member || c.is_creator));
    } catch (error) {
      console.error('Error fetching communities:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCommunity = async () => {
    if (!user) {
      navigate('/auth');
      return;
    }

    if (!name.trim()) {
      toast({ title: 'Please enter a community name', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('communities')
        .insert({
          name: name.trim(),
          description: description.trim() || null,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      // Auto-join as admin
      await supabase
        .from('community_members')
        .insert({
          community_id: data.id,
          user_id: user.id,
          role: 'admin',
        });

      toast({ title: 'Community created successfully!' });
      setDialogOpen(false);
      setName('');
      setDescription('');
      fetchCommunities();
    } catch (error: any) {
      toast({ title: 'Error creating community', description: error.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleJoin = async (communityId: string) => {
    if (!user) {
      navigate('/auth');
      return;
    }

    try {
      await supabase
        .from('community_members')
        .insert({
          community_id: communityId,
          user_id: user.id,
          role: 'member',
        });

      toast({ title: 'Joined community!' });
      fetchCommunities();
    } catch (error: any) {
      toast({ title: 'Error joining community', description: error.message, variant: 'destructive' });
    }
  };

  const handleLeave = async (communityId: string) => {
    if (!user) return;

    try {
      await supabase
        .from('community_members')
        .delete()
        .eq('community_id', communityId)
        .eq('user_id', user.id);

      toast({ title: 'Left community' });
      fetchCommunities();
    } catch (error: any) {
      toast({ title: 'Error leaving community', description: error.message, variant: 'destructive' });
    }
  };

  const handleEditCommunity = (community: Community) => {
    setEditingCommunity(community);
    setName(community.name);
    setDescription(community.description || '');
    setEditDialogOpen(true);
  };

  const handleUpdateCommunity = async () => {
    if (!user || !editingCommunity || !name.trim()) {
      toast({ title: 'Please enter a community name', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('communities')
        .update({
          name: name.trim(),
          description: description.trim() || null,
        })
        .eq('id', editingCommunity.id);

      if (error) throw error;

      toast({ title: 'Community updated successfully!' });
      setEditDialogOpen(false);
      setEditingCommunity(null);
      setName('');
      setDescription('');
      fetchCommunities();
    } catch (error: any) {
      toast({ title: 'Error updating community', description: error.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCommunity = async (communityId: string) => {
    if (!confirm('Are you sure you want to delete this community? This action cannot be undone.')) return;

    try {
      const { error } = await supabase
        .from('communities')
        .delete()
        .eq('id', communityId);

      if (error) throw error;

      toast({ title: 'Community deleted' });
      fetchCommunities();
    } catch (error: any) {
      toast({ title: 'Error deleting community', description: error.message, variant: 'destructive' });
    }
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
          <Skeleton className="h-12 w-48" />
          <div className="grid gap-4 sm:grid-cols-2">
            {Array(4).fill(0).map((_, i) => (
              <Skeleton key={i} className="h-40 w-full rounded-xl" />
            ))}
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Communities</h1>
            <p className="text-muted-foreground">Connect with like-minded entrepreneurs</p>
          </div>
          
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gradient-primary text-white">
                <Plus className="mr-2 h-4 w-4" />
                Create Community
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Create New Community</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Community Name *</Label>
                  <Input
                    id="name"
                    placeholder="Enter community name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    placeholder="What is this community about?"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                  />
                </div>
                
                <Button 
                  onClick={handleCreateCommunity} 
                  className="w-full gradient-primary text-white"
                  disabled={saving}
                >
                  {saving ? 'Creating...' : 'Create Community'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="all" className="w-full">
          <TabsList className="grid grid-cols-2 w-full max-w-md">
            <TabsTrigger value="all">All Communities</TabsTrigger>
            <TabsTrigger value="my">My Communities</TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="mt-4">
            {communities.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {communities.map((community) => (
                  <CommunityCard
                    key={community.id}
                    community={community}
                    onJoin={() => handleJoin(community.id)}
                    onLeave={() => handleLeave(community.id)}
                    onEdit={() => handleEditCommunity(community)}
                    onDelete={() => handleDeleteCommunity(community.id)}
                    onClick={() => navigate(`/communities/${community.id}`)}
                  />
                ))}
              </div>
            ) : (
              <Card className="border-0 shadow-soft">
                <CardContent className="py-16 text-center">
                  <Users className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-xl font-semibold text-foreground mb-2">No communities yet</h3>
                  <p className="text-muted-foreground mb-6">
                    Be the first to create a community!
                  </p>
                  <Button 
                    className="gradient-primary text-white"
                    onClick={() => setDialogOpen(true)}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Create First Community
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="my" className="mt-4">
            {myCommunities.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {myCommunities.map((community) => (
                  <CommunityCard
                    key={community.id}
                    community={community}
                    onJoin={() => handleJoin(community.id)}
                    onLeave={() => handleLeave(community.id)}
                    onEdit={() => handleEditCommunity(community)}
                    onDelete={() => handleDeleteCommunity(community.id)}
                    onClick={() => navigate(`/communities/${community.id}`)}
                  />
                ))}
              </div>
            ) : (
              <Card className="border-0 shadow-soft">
                <CardContent className="py-16 text-center">
                  <Users className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-xl font-semibold text-foreground mb-2">
                    You haven't joined any communities yet
                  </h3>
                  <p className="text-muted-foreground">
                    Explore and join communities to connect with other entrepreneurs
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>

        {/* Edit Community Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={(open) => {
          setEditDialogOpen(open);
          if (!open) {
            setEditingCommunity(null);
            setName('');
            setDescription('');
          }
        }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Edit Community</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="edit-community-name">Community Name *</Label>
                <Input
                  id="edit-community-name"
                  placeholder="Enter community name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="edit-community-description">Description</Label>
                <Textarea
                  id="edit-community-description"
                  placeholder="What is this community about?"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                />
              </div>
              
              <Button 
                onClick={handleUpdateCommunity} 
                className="w-full gradient-primary text-white"
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}

function CommunityCard({
  community,
  onJoin,
  onLeave,
  onEdit,
  onDelete,
  onClick,
}: {
  community: Community;
  onJoin: () => void;
  onLeave: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onClick: () => void;
}) {
  return (
    <Card 
      className="border-0 shadow-soft cursor-pointer card-hover overflow-hidden group relative"
      onClick={onClick}
    >
      {/* Cover */}
      <div 
        className="h-24 gradient-secondary bg-cover bg-center"
        style={community.cover_image_url ? { backgroundImage: `url(${community.cover_image_url})` } : {}}
      />
      
      {/* Creator action buttons */}
      {community.is_creator && (
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
          <Button
            size="icon"
            variant="secondary"
            className="h-8 w-8"
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
          >
            <Edit className="h-3 w-3" />
          </Button>
          <Button
            size="icon"
            variant="destructive"
            className="h-8 w-8"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      )}
      
      <CardContent className="p-4 -mt-8 relative">
        <div className="flex items-end justify-between mb-3">
          <Avatar className="h-16 w-16 ring-4 ring-background shadow-lg">
            <AvatarFallback className="gradient-primary text-white text-xl">
              {community.name.charAt(0)}
            </AvatarFallback>
          </Avatar>
          
          {community.is_creator && (
            <div className="flex items-center gap-1 text-xs text-amber-600 bg-amber-100 dark:bg-amber-900/30 px-2 py-1 rounded-full">
              <Crown className="h-3 w-3" />
              Creator
            </div>
          )}
        </div>
        
        <h3 className="font-semibold text-lg text-foreground truncate">
          {community.name}
        </h3>
        
        {community.description && (
          <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
            {community.description}
          </p>
        )}
        
        <div className="flex items-center justify-between mt-4">
          <span className="flex items-center gap-1 text-sm text-muted-foreground">
            <Users className="h-4 w-4" />
            {community.member_count} members
          </span>
          
          {!community.is_creator && (
            <Button
              size="sm"
              variant={community.is_member ? "outline" : "default"}
              className={!community.is_member ? "gradient-primary text-white" : ""}
              onClick={(e) => {
                e.stopPropagation();
                community.is_member ? onLeave() : onJoin();
              }}
            >
              {community.is_member ? (
                <>
                  <UserMinus className="mr-1 h-3 w-3" />
                  Leave
                </>
              ) : (
                <>
                  <UserPlus className="mr-1 h-3 w-3" />
                  Join
                </>
              )}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
