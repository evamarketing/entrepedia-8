import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Users, UserPlus, UserMinus, Crown } from 'lucide-react';

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

export function CommunityFeed() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [communities, setCommunities] = useState<Community[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCommunities();
  }, [user]);

  const fetchCommunities = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('communities')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;

      // Enrich with member counts and membership status
      const enrichedCommunities = await Promise.all(
        (data || []).map(async (community) => {
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
    } catch (error) {
      console.error('Error fetching communities:', error);
    } finally {
      setLoading(false);
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

  if (loading) {
    return (
      <div className="space-y-4">
        {Array(3).fill(0).map((_, i) => (
          <Skeleton key={i} className="h-40 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (communities.length === 0) {
    return (
      <Card className="border-0 shadow-soft">
        <CardContent className="py-12 text-center">
          <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground mb-4">No communities yet</p>
          <Button 
            className="gradient-primary text-white"
            onClick={() => navigate('/communities')}
          >
            Create a Community
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {communities.map((community) => (
        <Card 
          key={community.id} 
          className="border-0 shadow-soft overflow-hidden card-hover"
        >
          {/* Cover image */}
          <div 
            className="h-20 gradient-secondary bg-cover bg-center cursor-pointer"
            style={community.cover_image_url ? { backgroundImage: `url(${community.cover_image_url})` } : {}}
            onClick={() => navigate(`/communities/${community.id}`)}
          />
          
          <CardContent className="p-5 -mt-8 relative">
            <div className="flex items-start gap-4">
              <Avatar 
                className="h-16 w-16 ring-4 ring-background shadow-lg cursor-pointer"
                onClick={() => navigate(`/communities/${community.id}`)}
              >
                <AvatarFallback className="gradient-primary text-white text-xl">
                  {community.name.charAt(0)}
                </AvatarFallback>
              </Avatar>
              
              <div className="flex-1 min-w-0 pt-8">
                <div className="flex items-start justify-between gap-2">
                  <div 
                    className="cursor-pointer flex-1"
                    onClick={() => navigate(`/communities/${community.id}`)}
                  >
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-lg text-foreground truncate hover:text-primary transition-colors">
                        {community.name}
                      </h3>
                      {community.is_creator && (
                        <div className="flex items-center gap-1 text-xs text-amber-600 bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 rounded-full">
                          <Crown className="h-3 w-3" />
                          Creator
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {!community.is_creator && (
                    <Button
                      size="sm"
                      variant={community.is_member ? "outline" : "default"}
                      className={!community.is_member ? "gradient-primary text-white" : ""}
                      onClick={(e) => {
                        e.stopPropagation();
                        community.is_member 
                          ? handleLeave(community.id) 
                          : handleJoin(community.id);
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
                
                {community.description && (
                  <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                    {community.description}
                  </p>
                )}
                
                <div className="flex items-center gap-1 mt-3 text-sm text-muted-foreground">
                  <Users className="h-3.5 w-3.5" />
                  {community.member_count} members
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
