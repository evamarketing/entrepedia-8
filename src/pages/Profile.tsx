import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { PostCard } from '@/components/feed/PostCard';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { VerificationBadge } from '@/components/ui/verification-badge';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { 
  MapPin, 
  Calendar, 
  MessageCircle, 
  UserPlus, 
  UserMinus,
  Settings,
  Link as LinkIcon,
  CheckCircle
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface ProfileData {
  id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  bio: string | null;
  location: string | null;
  created_at: string | null;
  is_online: boolean | null;
  is_verified?: boolean;
}

interface Post {
  id: string;
  content: string | null;
  image_url: string | null;
  youtube_url: string | null;
  instagram_url: string | null;
  created_at: string;
  user_id: string;
  business_id: string | null;
  profiles: {
    id: string;
    full_name: string | null;
    username: string | null;
    avatar_url: string | null;
    is_verified?: boolean;
  } | null;
  businesses: {
    id: string;
    name: string;
    logo_url: string | null;
  } | null;
  post_likes: { user_id: string }[];
  comments: { id: string }[];
}

export default function Profile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, profile: currentUserProfile } = useAuth();
  const { toast } = useToast();
  
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [followers, setFollowers] = useState<ProfileData[]>([]);
  const [following, setFollowing] = useState<ProfileData[]>([]);
  const [skills, setSkills] = useState<string[]>([]);
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [followLoading, setFollowLoading] = useState(false);

  // Determine which profile to show
  const profileId = id || user?.id;
  const isOwnProfile = user?.id === profileId;

  useEffect(() => {
    if (profileId) {
      fetchProfileData();
    } else {
      navigate('/auth');
    }
  }, [profileId, user]);

  const fetchProfileData = async () => {
    if (!profileId) return;
    
    setLoading(true);
    try {
      // Fetch profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', profileId)
        .single();

      if (profileError) throw profileError;
      setProfileData(profile);

      // Fetch posts
      const { data: postsData } = await supabase
        .from('posts')
        .select(`
          *,
          profiles:user_id (id, full_name, username, avatar_url),
          businesses:business_id (id, name, logo_url),
          post_likes (user_id),
          comments (id)
        `)
        .eq('user_id', profileId)
        .order('created_at', { ascending: false });

      setPosts(postsData || []);

      // Fetch followers
      const { data: followersData } = await supabase
        .from('follows')
        .select('follower_id')
        .eq('following_id', profileId);

      if (followersData && followersData.length > 0) {
        const followerIds = followersData.map(f => f.follower_id).filter(Boolean) as string[];
        const { data: followerProfiles } = await supabase
          .from('profiles')
          .select('id, full_name, username, avatar_url, bio, location, created_at, is_online')
          .in('id', followerIds);
        setFollowers(followerProfiles || []);
      } else {
        setFollowers([]);
      }

      // Fetch following
      const { data: followingData } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', profileId);

      if (followingData && followingData.length > 0) {
        const followingIds = followingData.map(f => f.following_id).filter(Boolean) as string[];
        const { data: followingProfiles } = await supabase
          .from('profiles')
          .select('id, full_name, username, avatar_url, bio, location, created_at, is_online')
          .in('id', followingIds);
        setFollowing(followingProfiles || []);
      } else {
        setFollowing([]);
      }

      // Fetch skills
      const { data: skillsData } = await supabase
        .from('user_skills')
        .select('skill_name')
        .eq('user_id', profileId);

      setSkills(skillsData?.map(s => s.skill_name) || []);

      // Check if current user is following this profile
      if (user && user.id !== profileId) {
        const { data: followCheck } = await supabase
          .from('follows')
          .select('id')
          .eq('follower_id', user.id)
          .eq('following_id', profileId)
          .single();

        setIsFollowing(!!followCheck);
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
      toast({ title: 'Error loading profile', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleFollow = async () => {
    if (!user || !profileId) {
      navigate('/auth');
      return;
    }

    setFollowLoading(true);
    try {
      if (isFollowing) {
        await supabase
          .from('follows')
          .delete()
          .eq('follower_id', user.id)
          .eq('following_id', profileId);
        setIsFollowing(false);
        setFollowers(prev => prev.filter(f => f.id !== user.id));
      } else {
        await supabase
          .from('follows')
          .insert({ follower_id: user.id, following_id: profileId });
        setIsFollowing(true);
        if (currentUserProfile) {
          setFollowers(prev => [...prev, currentUserProfile as ProfileData]);
        }
      }
    } catch (error) {
      console.error('Error toggling follow:', error);
    } finally {
      setFollowLoading(false);
    }
  };

  const handleMessage = async () => {
    if (!user || !profileId) {
      navigate('/auth');
      return;
    }

    try {
      const { data: conversationId } = await supabase
        .rpc('get_or_create_conversation', { other_user_id: profileId });

      if (conversationId) {
        navigate(`/messages/${conversationId}`);
      }
    } catch (error) {
      console.error('Error starting conversation:', error);
    }
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
          <Skeleton className="h-48 w-full rounded-xl" />
          <Skeleton className="h-96 w-full rounded-xl" />
        </div>
      </MainLayout>
    );
  }

  if (!profileData) {
    return (
      <MainLayout>
        <div className="max-w-4xl mx-auto px-4 py-12 text-center">
          <h1 className="text-2xl font-bold text-foreground mb-4">Profile not found</h1>
          <Button onClick={() => navigate('/')}>Go Home</Button>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Profile Header */}
        <Card className="overflow-hidden border-0 shadow-soft">
          <div className="h-32 gradient-primary" />
          <CardContent className="relative pt-0 pb-6">
            <div className="flex flex-col sm:flex-row sm:items-end gap-4 -mt-16">
              <Avatar className="h-32 w-32 ring-4 ring-background shadow-lg">
                <AvatarImage src={profileData.avatar_url || ''} alt={profileData.full_name || ''} />
                <AvatarFallback className="text-3xl gradient-primary text-white">
                  {profileData.full_name?.charAt(0) || 'U'}
                </AvatarFallback>
              </Avatar>
              
              <div className="flex-1 sm:pb-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h1 className="text-2xl font-bold text-foreground flex items-center">
                      {profileData.full_name || 'Anonymous'}
                      <VerificationBadge 
                        isVerified={!!profileData.is_verified} 
                        size="md" 
                        showNotVerified={false}
                      />
                    </h1>
                    <p className="text-muted-foreground">
                      @{profileData.username || 'user'}
                    </p>
                  </div>
                  
                  <div className="flex gap-2">
                    {isOwnProfile ? (
                      <Button variant="outline" onClick={() => navigate('/settings')}>
                        <Settings className="mr-2 h-4 w-4" />
                        Edit Profile
                      </Button>
                    ) : (
                      <>
                        <Button
                          variant={isFollowing ? "outline" : "default"}
                          onClick={handleFollow}
                          disabled={followLoading}
                          className={!isFollowing ? "gradient-primary text-white" : ""}
                        >
                          {isFollowing ? (
                            <>
                              <UserMinus className="mr-2 h-4 w-4" />
                              Unfollow
                            </>
                          ) : (
                            <>
                              <UserPlus className="mr-2 h-4 w-4" />
                              Follow
                            </>
                          )}
                        </Button>
                        <Button variant="outline" onClick={handleMessage}>
                          <MessageCircle className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Bio & Info */}
            <div className="mt-6 space-y-4">
              {profileData.bio && (
                <p className="text-foreground">{profileData.bio}</p>
              )}
              
              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                {profileData.location && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-4 w-4" />
                    {profileData.location}
                  </span>
                )}
                {profileData.created_at && (
                  <span className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    Joined {formatDistanceToNow(new Date(profileData.created_at), { addSuffix: true })}
                  </span>
                )}
              </div>

              {skills.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {skills.map((skill) => (
                    <Badge key={skill} variant="secondary">
                      {skill}
                    </Badge>
                  ))}
                </div>
              )}

              {/* Stats */}
              <div className="flex gap-6 pt-2">
                <div className="text-center">
                  <p className="text-xl font-bold text-foreground">{posts.length}</p>
                  <p className="text-sm text-muted-foreground">Posts</p>
                </div>
                <div className="text-center">
                  <p className="text-xl font-bold text-foreground">{followers.length}</p>
                  <p className="text-sm text-muted-foreground">Followers</p>
                </div>
                <div className="text-center">
                  <p className="text-xl font-bold text-foreground">{following.length}</p>
                  <p className="text-sm text-muted-foreground">Following</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="posts" className="w-full">
          <TabsList className="w-full grid grid-cols-3">
            <TabsTrigger value="posts">Posts</TabsTrigger>
            <TabsTrigger value="followers">Followers</TabsTrigger>
            <TabsTrigger value="following">Following</TabsTrigger>
          </TabsList>

          <TabsContent value="posts" className="mt-4 space-y-4">
            {posts.length > 0 ? (
              posts.map((post) => (
                <PostCard key={post.id} post={post} onUpdate={fetchProfileData} />
              ))
            ) : (
              <Card className="border-0 shadow-soft">
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground">No posts yet</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="followers" className="mt-4">
            <div className="grid gap-4 sm:grid-cols-2">
              {followers.length > 0 ? (
                followers.map((follower) => (
                  <UserCard key={follower.id} user={follower} />
                ))
              ) : (
                <Card className="border-0 shadow-soft sm:col-span-2">
                  <CardContent className="py-12 text-center">
                    <p className="text-muted-foreground">No followers yet</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          <TabsContent value="following" className="mt-4">
            <div className="grid gap-4 sm:grid-cols-2">
              {following.length > 0 ? (
                following.map((followee) => (
                  <UserCard key={followee.id} user={followee} />
                ))
              ) : (
                <Card className="border-0 shadow-soft sm:col-span-2">
                  <CardContent className="py-12 text-center">
                    <p className="text-muted-foreground">Not following anyone yet</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}

function UserCard({ user }: { user: ProfileData }) {
  const navigate = useNavigate();
  
  return (
    <Card 
      className="border-0 shadow-soft cursor-pointer card-hover"
      onClick={() => navigate(`/user/${user.id}`)}
    >
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <Avatar className="h-12 w-12">
            <AvatarImage src={user.avatar_url || ''} />
            <AvatarFallback className="gradient-primary text-white">
              {user.full_name?.charAt(0) || 'U'}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-foreground truncate flex items-center">
              {user.full_name || 'Anonymous'}
              <VerificationBadge isVerified={!!user.is_verified} size="sm" />
            </p>
            <p className="text-sm text-muted-foreground truncate">
              @{user.username || 'user'}
            </p>
          </div>
          {user.is_online && (
            <div className="w-2 h-2 rounded-full bg-green-500" />
          )}
        </div>
      </CardContent>
    </Card>
  );
}
