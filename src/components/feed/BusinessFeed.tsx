import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { MapPin, Users, UserPlus, UserMinus, Building2 } from 'lucide-react';

interface Business {
  id: string;
  name: string;
  description: string | null;
  category: string;
  logo_url: string | null;
  location: string | null;
  follower_count: number;
  is_following: boolean;
}

const CATEGORIES: Record<string, { label: string; icon: string }> = {
  food: { label: 'Food & Beverages', icon: '🍔' },
  tech: { label: 'Technology', icon: '💻' },
  handmade: { label: 'Handmade', icon: '🎨' },
  services: { label: 'Services', icon: '🛠️' },
  agriculture: { label: 'Agriculture', icon: '🌾' },
  retail: { label: 'Retail', icon: '🛍️' },
  education: { label: 'Education', icon: '📚' },
  health: { label: 'Health', icon: '💊' },
  finance: { label: 'Finance', icon: '💰' },
  other: { label: 'Other', icon: '📦' },
};

export function BusinessFeed() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBusinesses();
  }, [user]);

  const fetchBusinesses = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('businesses')
        .select('id, name, description, category, logo_url, location')
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;

      // Enrich with follower counts and following status
      const enrichedBusinesses = await Promise.all(
        (data || []).map(async (business) => {
          const { count } = await supabase
            .from('business_follows')
            .select('*', { count: 'exact', head: true })
            .eq('business_id', business.id);

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

          return {
            ...business,
            follower_count: count || 0,
            is_following,
          };
        })
      );

      setBusinesses(enrichedBusinesses);
    } catch (error) {
      console.error('Error fetching businesses:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFollow = async (businessId: string, isFollowing: boolean) => {
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
        toast({ title: 'Unfollowed business' });
      } else {
        await supabase
          .from('business_follows')
          .insert({ business_id: businessId, user_id: user.id });
        toast({ title: 'Following business!' });
      }
      fetchBusinesses();
    } catch (error) {
      console.error('Error toggling follow:', error);
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

  if (businesses.length === 0) {
    return (
      <Card className="border-0 shadow-soft">
        <CardContent className="py-12 text-center">
          <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground mb-4">No business profiles yet</p>
          <Button 
            className="gradient-primary text-white"
            onClick={() => navigate('/my-businesses')}
          >
            Create Your Business
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {businesses.map((business) => {
        const category = CATEGORIES[business.category] || CATEGORIES.other;
        return (
          <Card 
            key={business.id} 
            className="border-0 shadow-soft overflow-hidden card-hover"
          >
            <CardContent className="p-5">
              <div className="flex items-start gap-4">
                <Avatar 
                  className="h-16 w-16 cursor-pointer"
                  onClick={() => navigate(`/business/${business.id}`)}
                >
                  <AvatarImage src={business.logo_url || ''} />
                  <AvatarFallback className="gradient-secondary text-white text-xl">
                    {business.name.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div 
                      className="cursor-pointer flex-1"
                      onClick={() => navigate(`/business/${business.id}`)}
                    >
                      <h3 className="font-semibold text-lg text-foreground truncate hover:text-primary transition-colors">
                        {business.name}
                      </h3>
                      <Badge variant="secondary" className="mt-1">
                        {category.icon} {category.label}
                      </Badge>
                    </div>
                    
                    <Button
                      size="sm"
                      variant={business.is_following ? "outline" : "default"}
                      className={!business.is_following ? "gradient-primary text-white" : ""}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleFollow(business.id, business.is_following);
                      }}
                    >
                      {business.is_following ? (
                        <>
                          <UserMinus className="mr-1 h-3 w-3" />
                          Following
                        </>
                      ) : (
                        <>
                          <UserPlus className="mr-1 h-3 w-3" />
                          Follow
                        </>
                      )}
                    </Button>
                  </div>
                  
                  {business.description && (
                    <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                      {business.description}
                    </p>
                  )}
                  
                  <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
                    {business.location && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" />
                        {business.location}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" />
                      {business.follower_count} followers
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
