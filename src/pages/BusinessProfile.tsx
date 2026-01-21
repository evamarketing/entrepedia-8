import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { PostCard } from '@/components/feed/PostCard';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { 
  MapPin, 
  Globe,
  Instagram,
  Youtube,
  Users,
  Image as ImageIcon,
  Heart,
  HeartOff,
  ExternalLink,
  Plus,
  X,
  Loader2,
  Upload
} from 'lucide-react';

interface BusinessData {
  id: string;
  name: string;
  description: string | null;
  category: string;
  logo_url: string | null;
  cover_image_url: string | null;
  location: string | null;
  website_url: string | null;
  instagram_link: string | null;
  youtube_link: string | null;
  owner_id: string | null;
  created_at: string | null;
}

interface BusinessImage {
  id: string;
  image_url: string;
  caption: string | null;
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
  } | null;
  businesses: {
    id: string;
    name: string;
    logo_url: string | null;
  } | null;
  post_likes: { user_id: string }[];
  comments: { id: string }[];
}

const CATEGORY_INFO: Record<string, { label: string; icon: string }> = {
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

export default function BusinessProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  
  const [business, setBusiness] = useState<BusinessData | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [images, setImages] = useState<BusinessImage[]>([]);
  const [followerCount, setFollowerCount] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [followLoading, setFollowLoading] = useState(false);
  
  // Post creation states
  const [showPostForm, setShowPostForm] = useState(false);
  const [postContent, setPostContent] = useState('');
  const [postImageFile, setPostImageFile] = useState<File | null>(null);
  const [postImagePreview, setPostImagePreview] = useState<string | null>(null);
  const [postYoutubeUrl, setPostYoutubeUrl] = useState('');
  const [postLoading, setPostLoading] = useState(false);
  
  // Gallery upload states
  const [galleryLoading, setGalleryLoading] = useState(false);

  const isOwner = user?.id === business?.owner_id;

  useEffect(() => {
    if (id) {
      fetchBusinessData();
    }
  }, [id, user]);

  const fetchBusinessData = async () => {
    if (!id) return;
    
    setLoading(true);
    try {
      // Fetch business
      const { data: businessData, error: businessError } = await supabase
        .from('businesses')
        .select('*')
        .eq('id', id)
        .single();

      if (businessError) throw businessError;
      setBusiness(businessData);

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
        .eq('business_id', id)
        .order('created_at', { ascending: false });

      setPosts(postsData || []);

      // Fetch images
      const { data: imagesData } = await supabase
        .from('business_images')
        .select('*')
        .eq('business_id', id)
        .order('created_at', { ascending: false });

      setImages(imagesData || []);

      // Fetch follower count
      const { count } = await supabase
        .from('business_follows')
        .select('*', { count: 'exact', head: true })
        .eq('business_id', id);

      setFollowerCount(count || 0);

      // Check if following
      if (user) {
        const { data: followCheck } = await supabase
          .from('business_follows')
          .select('id')
          .eq('business_id', id)
          .eq('user_id', user.id)
          .single();

        setIsFollowing(!!followCheck);
      }
    } catch (error) {
      console.error('Error fetching business:', error);
      toast({ title: 'Error loading business', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleFollow = async () => {
    if (!user || !id) {
      navigate('/auth');
      return;
    }

    setFollowLoading(true);
    try {
      if (isFollowing) {
        await supabase
          .from('business_follows')
          .delete()
          .eq('business_id', id)
          .eq('user_id', user.id);
        setIsFollowing(false);
        setFollowerCount(prev => prev - 1);
      } else {
        await supabase
          .from('business_follows')
          .insert({ business_id: id, user_id: user.id });
        setIsFollowing(true);
        setFollowerCount(prev => prev + 1);
      }
    } catch (error) {
      console.error('Error toggling follow:', error);
    } finally {
      setFollowLoading(false);
    }
  };

  // Post creation handlers
  const handlePostImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast({ title: 'Image must be less than 5MB', variant: 'destructive' });
        return;
      }
      setPostImageFile(file);
      setPostImagePreview(URL.createObjectURL(file));
    }
  };

  const removePostImage = () => {
    setPostImageFile(null);
    setPostImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleCreatePost = async () => {
    if (!postContent.trim() && !postImageFile && !postYoutubeUrl) {
      toast({ title: 'Please add some content', variant: 'destructive' });
      return;
    }

    if (!user || !id) return;

    setPostLoading(true);
    try {
      let imageUrl = null;

      // Upload image if selected
      if (postImageFile) {
        const fileExt = postImageFile.name.split('.').pop();
        const fileName = `${id}/${Date.now()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('posts')
          .upload(fileName, postImageFile);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from('posts')
          .getPublicUrl(fileName);

        imageUrl = urlData.publicUrl;
      }

      // Create post via edge function
      const response = await supabase.functions.invoke('create-post', {
        body: {
          user_id: user.id,
          content: postContent.trim() || null,
          image_url: imageUrl,
          youtube_url: postYoutubeUrl || null,
          business_id: id,
        },
      });

      if (response.error) {
        throw new Error(response.error.message || 'Failed to create post');
      }

      if (response.data?.error) {
        throw new Error(response.data.error);
      }

      // Reset form
      setPostContent('');
      setPostImageFile(null);
      setPostImagePreview(null);
      setPostYoutubeUrl('');
      setShowPostForm(false);
      
      toast({ title: 'Post created!' });
      fetchBusinessData();
    } catch (error: any) {
      toast({ title: 'Error creating post', description: error.message, variant: 'destructive' });
    } finally {
      setPostLoading(false);
    }
  };

  // Gallery upload handler
  const handleGalleryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !id) return;

    if (file.size > 5 * 1024 * 1024) {
      toast({ title: 'Image must be less than 5MB', variant: 'destructive' });
      return;
    }

    setGalleryLoading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${id}/gallery/${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('posts')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('posts')
        .getPublicUrl(fileName);

      // Insert into business_images
      const { error: insertError } = await supabase
        .from('business_images')
        .insert({
          business_id: id,
          image_url: urlData.publicUrl,
        });

      if (insertError) throw insertError;

      toast({ title: 'Image uploaded!' });
      fetchBusinessData();
    } catch (error: any) {
      toast({ title: 'Error uploading image', description: error.message, variant: 'destructive' });
    } finally {
      setGalleryLoading(false);
      if (galleryInputRef.current) galleryInputRef.current.value = '';
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

  if (!business) {
    return (
      <MainLayout>
        <div className="max-w-4xl mx-auto px-4 py-12 text-center">
          <h1 className="text-2xl font-bold text-foreground mb-4">Business not found</h1>
          <Button onClick={() => navigate('/explore')}>Explore Businesses</Button>
        </div>
      </MainLayout>
    );
  }

  const categoryInfo = CATEGORY_INFO[business.category] || CATEGORY_INFO.other;

  return (
    <MainLayout>
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Business Header */}
        <Card className="overflow-hidden border-0 shadow-soft">
          {/* Cover Image */}
          <div 
            className="h-48 gradient-secondary bg-cover bg-center"
            style={business.cover_image_url ? { backgroundImage: `url(${business.cover_image_url})` } : {}}
          />
          
          <CardContent className="relative pt-0 pb-6">
            <div className="flex flex-col sm:flex-row sm:items-end gap-4 -mt-16">
              <Avatar className="h-32 w-32 ring-4 ring-background shadow-lg">
                <AvatarImage src={business.logo_url || ''} alt={business.name} />
                <AvatarFallback className="text-3xl gradient-secondary text-white">
                  {business.name.charAt(0)}
                </AvatarFallback>
              </Avatar>
              
              <div className="flex-1 sm:pb-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h1 className="text-2xl font-bold text-foreground">{business.name}</h1>
                    <Badge variant="secondary" className="mt-1">
                      {categoryInfo.icon} {categoryInfo.label}
                    </Badge>
                  </div>
                  
                  <div className="flex gap-2">
                    {isOwner ? (
                      <Button variant="outline" onClick={() => navigate(`/my-businesses/${id}/edit`)}>
                        Edit Business
                      </Button>
                    ) : (
                      <Button
                        variant={isFollowing ? "outline" : "default"}
                        onClick={handleFollow}
                        disabled={followLoading}
                        className={!isFollowing ? "gradient-primary text-white" : ""}
                      >
                        {isFollowing ? (
                          <>
                            <HeartOff className="mr-2 h-4 w-4" />
                            Unfollow
                          </>
                        ) : (
                          <>
                            <Heart className="mr-2 h-4 w-4" />
                            Follow
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Description & Info */}
            <div className="mt-6 space-y-4">
              {business.description && (
                <p className="text-foreground">{business.description}</p>
              )}
              
              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                {business.location && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-4 w-4" />
                    {business.location}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Users className="h-4 w-4" />
                  {followerCount} followers
                </span>
              </div>

              {/* Social Links */}
              <div className="flex gap-3">
                {business.website_url && (
                  <a 
                    href={business.website_url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-sm text-primary hover:underline"
                  >
                    <Globe className="h-4 w-4" />
                    Website
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
                {business.instagram_link && (
                  <a 
                    href={business.instagram_link} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-sm text-primary hover:underline"
                  >
                    <Instagram className="h-4 w-4" />
                    Instagram
                  </a>
                )}
                {business.youtube_link && (
                  <a 
                    href={business.youtube_link} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-sm text-primary hover:underline"
                  >
                    <Youtube className="h-4 w-4" />
                    YouTube
                  </a>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="posts" className="w-full">
          <TabsList className="w-full grid grid-cols-2">
            <TabsTrigger value="posts">Posts</TabsTrigger>
            <TabsTrigger value="gallery">
              <ImageIcon className="h-4 w-4 mr-1" />
              Gallery
            </TabsTrigger>
          </TabsList>

          <TabsContent value="posts" className="mt-4 space-y-4">
            {/* Create Post Section for Owners */}
            {isOwner && (
              <Card className="border-0 shadow-soft">
                <CardContent className="pt-4">
                  {!showPostForm ? (
                    <Button 
                      onClick={() => setShowPostForm(true)} 
                      className="w-full gradient-primary text-white"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Create Post
                    </Button>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-foreground">Create a Post</h3>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => {
                            setShowPostForm(false);
                            setPostContent('');
                            setPostImageFile(null);
                            setPostImagePreview(null);
                            setPostYoutubeUrl('');
                          }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                      
                      <Textarea
                        placeholder="Share an update about your business..."
                        className="min-h-[100px] resize-none"
                        value={postContent}
                        onChange={(e) => setPostContent(e.target.value)}
                      />

                      {/* Image Preview */}
                      {postImagePreview && (
                        <div className="relative inline-block">
                          <img
                            src={postImagePreview}
                            alt="Preview"
                            className="max-h-48 rounded-xl object-cover"
                          />
                          <Button
                            variant="secondary"
                            size="icon"
                            className="absolute top-2 right-2 h-8 w-8"
                            onClick={removePostImage}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      )}

                      {/* YouTube URL Input */}
                      <Input
                        placeholder="YouTube URL (optional)"
                        value={postYoutubeUrl}
                        onChange={(e) => setPostYoutubeUrl(e.target.value)}
                      />

                      <div className="flex items-center justify-between">
                        <div className="flex gap-2">
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handlePostImageSelect}
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => fileInputRef.current?.click()}
                          >
                            <ImageIcon className="h-4 w-4 mr-2" />
                            Add Image
                          </Button>
                        </div>
                        <Button
                          onClick={handleCreatePost}
                          disabled={postLoading || (!postContent.trim() && !postImageFile && !postYoutubeUrl)}
                          className="gradient-primary text-white"
                        >
                          {postLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          Post
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {posts.length > 0 ? (
              posts.map((post) => (
                <PostCard key={post.id} post={post} onUpdate={fetchBusinessData} />
              ))
            ) : (
              <Card className="border-0 shadow-soft">
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground">No posts yet</p>
                  {isOwner && (
                    <p className="text-sm text-muted-foreground mt-2">
                      Create your first post to share updates with your followers!
                    </p>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="gallery" className="mt-4">
            {/* Upload Button for Owners */}
            {isOwner && (
              <div className="mb-4">
                <input
                  ref={galleryInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleGalleryUpload}
                />
                <Button 
                  onClick={() => galleryInputRef.current?.click()}
                  disabled={galleryLoading}
                  className="gradient-primary text-white"
                >
                  {galleryLoading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4 mr-2" />
                  )}
                  Upload Image
                </Button>
              </div>
            )}

            {images.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {images.map((image) => (
                  <div key={image.id} className="aspect-square rounded-xl overflow-hidden">
                    <img 
                      src={image.image_url} 
                      alt={image.caption || 'Business image'}
                      className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                ))}
              </div>
            ) : (
              <Card className="border-0 shadow-soft">
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground">No images yet</p>
                  {isOwner && (
                    <p className="text-sm text-muted-foreground mt-2">
                      Upload images to showcase your business!
                    </p>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
