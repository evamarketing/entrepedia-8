import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { PostCard } from '@/components/feed/PostCard';
import { CreatePostCard } from '@/components/feed/CreatePostCard';
import { BusinessFeed } from '@/components/feed/BusinessFeed';
import { CommunityFeed } from '@/components/feed/CommunityFeed';
import { DiscoverSidebar } from '@/components/feed/DiscoverSidebar';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Building2, Users, FileText, Plus } from 'lucide-react';

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
  } | null;
  businesses: {
    id: string;
    name: string;
    logo_url: string | null;
  } | null;
  post_likes: { user_id: string }[];
  comments: { id: string }[];
}

export default function Home() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('businesses');

  useEffect(() => {
    if (!authLoading && activeTab === 'posts') {
      fetchPosts();
    }
  }, [activeTab, user, authLoading]);

  const fetchPosts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('posts')
        .select(`
          *,
          profiles:user_id (id, full_name, username, avatar_url),
          businesses:business_id (id, name, logo_url),
          post_likes (user_id),
          comments (id)
        `)
        .order('created_at', { ascending: false })
        .limit(20);
      
      if (error) throw error;
      setPosts(data || []);
    } catch (error) {
      console.error('Error fetching posts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePostCreated = () => {
    fetchPosts();
  };

  // Show loading state while auth is loading
  if (authLoading) {
    return (
      <MainLayout>
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-center min-h-[50vh]">
            <Skeleton className="h-12 w-12 rounded-full" />
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Sidebar - Quick Actions */}
          <aside className="hidden lg:block lg:col-span-3">
            <Card className="shadow-soft border-0 sticky top-20">
              <CardContent className="p-4 space-y-3">
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-2">
                  Quick Actions
                </h3>
                <Button 
                  className="w-full justify-start gradient-primary text-white"
                  onClick={() => navigate('/my-businesses')}
                >
                  <Building2 className="mr-2 h-4 w-4" />
                  Create Business
                </Button>
                <Button 
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => navigate('/communities')}
                >
                  <Users className="mr-2 h-4 w-4" />
                  Create Community
                </Button>
                <Button 
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => navigate('/create')}
                >
                  <FileText className="mr-2 h-4 w-4" />
                  Create Post
                </Button>
              </CardContent>
            </Card>
          </aside>

          {/* Main Feed */}
          <div className="lg:col-span-6 space-y-6">
            {/* Mobile Quick Action */}
            <div className="flex gap-2 lg:hidden">
              <Button 
                className="flex-1 gradient-primary text-white"
                onClick={() => navigate('/my-businesses')}
              >
                <Plus className="mr-1 h-4 w-4" />
                Business
              </Button>
              <Button 
                variant="outline"
                className="flex-1"
                onClick={() => navigate('/communities')}
              >
                <Plus className="mr-1 h-4 w-4" />
                Community
              </Button>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="w-full grid grid-cols-3">
                <TabsTrigger value="businesses" className="gap-1">
                  <Building2 className="h-4 w-4" />
                  <span className="hidden sm:inline">Businesses</span>
                </TabsTrigger>
                <TabsTrigger value="communities" className="gap-1">
                  <Users className="h-4 w-4" />
                  <span className="hidden sm:inline">Communities</span>
                </TabsTrigger>
                <TabsTrigger value="posts" className="gap-1">
                  <FileText className="h-4 w-4" />
                  <span className="hidden sm:inline">Posts</span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="businesses" className="mt-4">
                <BusinessFeed />
              </TabsContent>

              <TabsContent value="communities" className="mt-4">
                <CommunityFeed />
              </TabsContent>

              <TabsContent value="posts" className="mt-4 space-y-4">
                {user && <CreatePostCard onPostCreated={handlePostCreated} />}
                
                {loading ? (
                  Array(3).fill(0).map((_, i) => (
                    <Skeleton key={i} className="h-96 w-full rounded-xl" />
                  ))
                ) : posts.length > 0 ? (
                  posts.map((post) => (
                    <PostCard key={post.id} post={post} onUpdate={fetchPosts} />
                  ))
                ) : (
                  <Card className="border-0 shadow-soft">
                    <CardContent className="py-12 text-center">
                      <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <p className="text-muted-foreground">No posts yet. Be the first to share!</p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
            </Tabs>
          </div>

          {/* Right Sidebar - Discover */}
          <aside className="hidden lg:block lg:col-span-3">
            <DiscoverSidebar />
          </aside>
        </div>
      </div>
    </MainLayout>
  );
}
