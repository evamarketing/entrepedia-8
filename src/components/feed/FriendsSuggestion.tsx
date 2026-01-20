import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { UserPlus, ChevronRight, MapPin, UserCheck, Compass } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface SuggestedFriend {
  id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  location: string | null;
  is_nearby: boolean;
}

export function FriendsSuggestion() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [friends, setFriends] = useState<SuggestedFriend[]>([]);
  const [loading, setLoading] = useState(true);
  const [followingStates, setFollowingStates] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (user) {
      fetchSuggestedFriends();
    } else {
      setLoading(false);
    }
  }, [user, profile]);

  const fetchSuggestedFriends = async () => {
    if (!user) return;
    
    try {
      // Get current follow list
      const { data: followData } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', user.id);

      const followingIds = new Set(followData?.map(f => f.following_id) || []);
      const states: Record<string, boolean> = {};
      followingIds.forEach(id => {
        if (id) states[id] = true;
      });
      setFollowingStates(states);

      let nearbyUsers: SuggestedFriend[] = [];
      let otherUsers: SuggestedFriend[] = [];

      // Fetch nearby users if location is set
      if (profile?.location) {
        const locationParts = profile.location.split(',').map(p => p.trim());
        const searchLocation = locationParts[0];

        const { data: nearbyData } = await supabase
          .from('profiles')
          .select('id, full_name, username, avatar_url, location')
          .neq('id', user.id)
          .ilike('location', `%${searchLocation}%`)
          .limit(3);

        nearbyUsers = (nearbyData || [])
          .filter(u => !followingIds.has(u.id))
          .map(u => ({ ...u, is_nearby: true }));
      }

      // Fetch other suggested users
      const { data: otherData } = await supabase
        .from('profiles')
        .select('id, full_name, username, avatar_url, location')
        .neq('id', user.id)
        .limit(10);

      otherUsers = (otherData || [])
        .filter(u => !followingIds.has(u.id) && !nearbyUsers.find(n => n.id === u.id))
        .slice(0, 5 - nearbyUsers.length)
        .map(u => ({ ...u, is_nearby: false }));

      setFriends([...nearbyUsers, ...otherUsers]);
    } catch (error) {
      console.error('Error fetching friends:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFollow = async (userId: string) => {
    if (!user) {
      navigate('/auth');
      return;
    }

    try {
      const stored = localStorage.getItem('samrambhak_auth');
      const sessionToken = stored ? JSON.parse(stored).session_token : null;

      const { data, error } = await supabase.functions.invoke('toggle-follow', {
        body: {
          user_id: user.id,
          following_id: userId,
          action: 'follow',
          session_token: sessionToken,
        },
      });

      if (error || data?.error) {
        throw new Error(data?.error || error?.message || 'Failed to follow');
      }

      setFollowingStates(prev => ({ ...prev, [userId]: true }));
      toast({ title: 'Following!' });
      
      // Remove from suggestions
      setFriends(prev => prev.filter(f => f.id !== userId));
    } catch (error) {
      console.error('Error following:', error);
      toast({ title: 'Failed to follow', variant: 'destructive' });
    }
  };

  if (!user || loading) return null;
  if (friends.length === 0) return null;

  const nearbyCount = friends.filter(f => f.is_nearby).length;

  return (
    <Card className="shadow-soft border-0">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <UserCheck className="h-4 w-4 text-primary" />
          Find Friends
          {nearbyCount > 0 && (
            <Badge variant="secondary" className="text-xs">
              <MapPin className="h-3 w-3 mr-1" />
              {nearbyCount} nearby
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {friends.map((friend) => (
          <div key={friend.id} className="flex items-center gap-2">
            <Link to={`/user/${friend.id}`} className="flex items-center gap-2 flex-1 min-w-0">
              <Avatar className="h-9 w-9">
                <AvatarImage src={friend.avatar_url || ''} />
                <AvatarFallback className="gradient-primary text-white text-sm">
                  {friend.full_name?.charAt(0) || 'U'}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate hover:text-primary">
                  {friend.full_name || 'Anonymous'}
                </p>
                <div className="flex items-center gap-1">
                  {friend.is_nearby && (
                    <Badge variant="outline" className="text-xs px-1 py-0 h-4">
                      <Compass className="h-2 w-2 mr-0.5" />
                      Nearby
                    </Badge>
                  )}
                  {friend.location && !friend.is_nearby && (
                    <span className="text-xs text-muted-foreground truncate">
                      {friend.location}
                    </span>
                  )}
                </div>
              </div>
            </Link>
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2 text-xs"
              onClick={() => handleFollow(friend.id)}
            >
              <UserPlus className="h-3 w-3" />
            </Button>
          </div>
        ))}
        <Link
          to="/friends"
          className="flex items-center justify-center gap-1 text-xs text-primary hover:underline pt-1"
        >
          View all friends <ChevronRight className="h-3 w-3" />
        </Link>
      </CardContent>
    </Card>
  );
}
