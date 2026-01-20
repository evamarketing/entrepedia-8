import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Users, UserPlus, UserMinus, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { VerificationBadge } from '@/components/ui/verification-badge';

interface UserProfile {
  id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  is_verified: boolean | null;
}

interface FollowStatsProps {
  userId: string;
}

export function FollowStats({ userId }: FollowStatsProps) {
  const [followers, setFollowers] = useState<UserProfile[]>([]);
  const [following, setFollowing] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [unfollowingId, setUnfollowingId] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchFollowData = async () => {
    setLoading(true);
    try {
      // Fetch followers (people who follow me)
      const { data: followersData, error: followersError } = await supabase
        .from('follows')
        .select(`
          follower_id,
          profiles!follows_follower_id_fkey (
            id,
            full_name,
            username,
            avatar_url,
            is_verified
          )
        `)
        .eq('following_id', userId);

      if (followersError) throw followersError;

      // Fetch following (people I follow)
      const { data: followingData, error: followingError } = await supabase
        .from('follows')
        .select(`
          following_id,
          profiles!follows_following_id_fkey (
            id,
            full_name,
            username,
            avatar_url,
            is_verified
          )
        `)
        .eq('follower_id', userId);

      if (followingError) throw followingError;

      // Extract profiles from the nested data
      const followerProfiles = followersData
        ?.map(f => f.profiles as unknown as UserProfile)
        .filter(Boolean) || [];
      
      const followingProfiles = followingData
        ?.map(f => f.profiles as unknown as UserProfile)
        .filter(Boolean) || [];

      setFollowers(followerProfiles);
      setFollowing(followingProfiles);
    } catch (error: any) {
      console.error('Error fetching follow data:', error);
      toast({
        title: 'Error loading follow data',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userId) {
      fetchFollowData();
    }
  }, [userId]);

  const handleUnfollow = async (targetId: string) => {
    setUnfollowingId(targetId);
    try {
      const { error } = await supabase
        .from('follows')
        .delete()
        .eq('follower_id', userId)
        .eq('following_id', targetId);

      if (error) throw error;

      setFollowing(prev => prev.filter(f => f.id !== targetId));
      toast({ title: 'Unfollowed successfully' });
    } catch (error: any) {
      toast({
        title: 'Error unfollowing',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setUnfollowingId(null);
    }
  };

  const handleFollowBack = async (targetId: string) => {
    setUnfollowingId(targetId);
    try {
      const { error } = await supabase
        .from('follows')
        .insert({
          follower_id: userId,
          following_id: targetId,
        });

      if (error) throw error;

      // Find the user from followers and add to following
      const userToAdd = followers.find(f => f.id === targetId);
      if (userToAdd) {
        setFollowing(prev => [...prev, userToAdd]);
      }
      toast({ title: 'Followed back successfully!' });
    } catch (error: any) {
      toast({
        title: 'Error following',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setUnfollowingId(null);
    }
  };

  const isFollowing = (userId: string) => {
    return following.some(f => f.id === userId);
  };

  const UserCard = ({ user, showFollowBack = false, showUnfollow = false }: { 
    user: UserProfile; 
    showFollowBack?: boolean;
    showUnfollow?: boolean;
  }) => (
    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
      <Link to={`/profile/${user.id}`} className="flex items-center gap-3 flex-1 min-w-0">
        <Avatar className="h-10 w-10 flex-shrink-0">
          <AvatarImage src={user.avatar_url || ''} />
          <AvatarFallback className="gradient-primary text-white">
            {user.full_name?.charAt(0) || 'U'}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1">
            <p className="font-medium text-foreground truncate">
              {user.full_name || 'Anonymous'}
            </p>
            {user.is_verified && <VerificationBadge isVerified={true} size="sm" />}
          </div>
          {user.username && (
            <p className="text-sm text-muted-foreground truncate">@{user.username}</p>
          )}
        </div>
      </Link>
      <div className="flex-shrink-0 ml-2">
        {showUnfollow && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleUnfollow(user.id)}
            disabled={unfollowingId === user.id}
            className="text-destructive hover:text-destructive"
          >
            {unfollowingId === user.id ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <UserMinus className="h-4 w-4 mr-1" />
                Unfollow
              </>
            )}
          </Button>
        )}
        {showFollowBack && !isFollowing(user.id) && (
          <Button
            size="sm"
            onClick={() => handleFollowBack(user.id)}
            disabled={unfollowingId === user.id}
            className="gradient-primary text-white"
          >
            {unfollowingId === user.id ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <UserPlus className="h-4 w-4 mr-1" />
                Follow Back
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );

  return (
    <Card className="border-0 shadow-soft">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          <CardTitle>Following & Followers</CardTitle>
        </div>
        <CardDescription>
          Manage your connections
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="following" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="following" className="gap-2">
              Following
              <span className="text-xs bg-muted px-1.5 py-0.5 rounded-full">
                {following.length}
              </span>
            </TabsTrigger>
            <TabsTrigger value="followers" className="gap-2">
              Followers
              <span className="text-xs bg-muted px-1.5 py-0.5 rounded-full">
                {followers.length}
              </span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="following" className="space-y-2">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : following.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>You're not following anyone yet</p>
                <Link to="/friends" className="text-primary hover:underline text-sm">
                  Find friends to follow
                </Link>
              </div>
            ) : (
              following.map(user => (
                <UserCard key={user.id} user={user} showUnfollow />
              ))
            )}
          </TabsContent>

          <TabsContent value="followers" className="space-y-2">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : followers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>You don't have any followers yet</p>
                <p className="text-sm">Complete your profile to attract followers</p>
              </div>
            ) : (
              followers.map(user => (
                <UserCard key={user.id} user={user} showFollowBack />
              ))
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
