import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Building2, Users, ChevronRight, UserPlus, UserMinus } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface SuggestedBusiness {
  id: string;
  name: string;
  category: string;
  logo_url: string | null;
  is_following: boolean;
}

interface SuggestedCommunity {
  id: string;
  name: string;
  member_count: number;
  is_member: boolean;
}

const CATEGORIES: Record<string, string> = {
  food: '🍔',
  tech: '💻',
  handmade: '🎨',
  services: '🛠️',
  agriculture: '🌾',
  retail: '🛍️',
  education: '📚',
  health: '💊',
  finance: '💰',
  other: '📦',
};

export function DiscoverSidebar() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [businesses, setBusinesses] = useState<SuggestedBusiness[]>([]);
  const [communities, setCommunities] = useState<SuggestedCommunity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [user]);

  const fetchData = async () => {
    try {
      // Fetch businesses
      const { data: businessData } = await supabase
        .from('businesses')
        .select('id, name, category, logo_url')
        .limit(4);

      // Check follow status
      const enrichedBusinesses = await Promise.all(
        (businessData || []).map(async (business) => {
          let is_following = false;
          if (user) {
            const { data: followCheck } = await supabase
              .from('business_follows')
              .select('id')
              .eq('business_id', business.id)
              .eq('user_id', user.id)
              .single();
            is_following = !!followCheck;
          }
          return { ...business, is_following };
        })
      );
      setBusinesses(enrichedBusinesses);

      // Fetch communities
      const { data: communityData } = await supabase
        .from('communities')
        .select('id, name')
        .limit(4);

      const enrichedCommunities = await Promise.all(
        (communityData || []).map(async (community) => {
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
          return { ...community, member_count: count || 0, is_member };
        })
      );
      setCommunities(enrichedCommunities);
    } catch (error) {
      console.error('Error fetching sidebar data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFollowBusiness = async (businessId: string, isFollowing: boolean) => {
    if (!user) {
      navigate('/auth');
      return;
    }

    try {
      if (isFollowing) {
        await supabase
          .from('business_follows')
          .delete()
          .eq('business_id', businessId)
          .eq('user_id', user.id);
      } else {
        await supabase
          .from('business_follows')
          .insert({ business_id: businessId, user_id: user.id });
      }
      fetchData();
    } catch (error) {
      console.error('Error toggling follow:', error);
    }
  };

  const handleJoinCommunity = async (communityId: string, isMember: boolean) => {
    if (!user) {
      navigate('/auth');
      return;
    }

    try {
      if (isMember) {
        await supabase
          .from('community_members')
          .delete()
          .eq('community_id', communityId)
          .eq('user_id', user.id);
        toast({ title: 'Left community' });
      } else {
        await supabase
          .from('community_members')
          .insert({ community_id: communityId, user_id: user.id, role: 'member' });
        toast({ title: 'Joined community!' });
      }
      fetchData();
    } catch (error) {
      console.error('Error toggling membership:', error);
    }
  };

  if (loading) {
    return <div className="space-y-4 animate-pulse">
      <div className="h-48 bg-muted rounded-xl" />
      <div className="h-48 bg-muted rounded-xl" />
    </div>;
  }

  return (
    <div className="space-y-4">
      {/* Suggested Businesses */}
      <Card className="sticky top-20 shadow-soft border-0">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Building2 className="h-4 w-4 text-primary" />
            Discover Businesses
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {businesses.length > 0 ? (
            <>
              {businesses.map((business) => (
                <div key={business.id} className="flex items-center gap-2">
                  <Link to={`/business/${business.id}`} className="flex items-center gap-2 flex-1 min-w-0">
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={business.logo_url || ''} />
                      <AvatarFallback className="gradient-secondary text-white text-sm">
                        {business.name.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate hover:text-primary">
                        {business.name}
                      </p>
                      <Badge variant="secondary" className="text-xs scale-90 origin-left">
                        {CATEGORIES[business.category] || '📦'}
                      </Badge>
                    </div>
                  </Link>
                  <Button
                    size="sm"
                    variant={business.is_following ? "ghost" : "outline"}
                    className="h-7 px-2 text-xs"
                    onClick={() => handleFollowBusiness(business.id, business.is_following)}
                  >
                    {business.is_following ? <UserMinus className="h-3 w-3" /> : <UserPlus className="h-3 w-3" />}
                  </Button>
                </div>
              ))}
              <Link
                to="/explore?tab=businesses"
                className="flex items-center justify-center gap-1 text-xs text-primary hover:underline pt-1"
              >
                View all <ChevronRight className="h-3 w-3" />
              </Link>
            </>
          ) : (
            <div className="text-center py-3">
              <p className="text-xs text-muted-foreground">No businesses yet</p>
              <Link to="/my-businesses" className="text-xs text-primary hover:underline">
                Create one
              </Link>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Suggested Communities */}
      <Card className="shadow-soft border-0">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4 text-primary" />
            Join Communities
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {communities.length > 0 ? (
            <>
              {communities.map((community) => (
                <div key={community.id} className="flex items-center gap-2">
                  <Link to={`/communities/${community.id}`} className="flex items-center gap-2 flex-1 min-w-0">
                    <div className="h-9 w-9 rounded-lg gradient-primary flex items-center justify-center">
                      <span className="text-white text-sm font-medium">
                        {community.name.charAt(0)}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate hover:text-primary">
                        {community.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {community.member_count} members
                      </p>
                    </div>
                  </Link>
                  <Button
                    size="sm"
                    variant={community.is_member ? "ghost" : "outline"}
                    className="h-7 px-2 text-xs"
                    onClick={() => handleJoinCommunity(community.id, community.is_member)}
                  >
                    {community.is_member ? <UserMinus className="h-3 w-3" /> : <UserPlus className="h-3 w-3" />}
                  </Button>
                </div>
              ))}
              <Link
                to="/communities"
                className="flex items-center justify-center gap-1 text-xs text-primary hover:underline pt-1"
              >
                View all <ChevronRight className="h-3 w-3" />
              </Link>
            </>
          ) : (
            <div className="text-center py-3">
              <p className="text-xs text-muted-foreground">No communities yet</p>
              <Link to="/communities" className="text-xs text-primary hover:underline">
                Create one
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
