import { useState, useRef } from 'react';
import { Image, Youtube, X, Loader2 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface CreatePostCardProps {
  onPostCreated: () => void;
}

export function CreatePostCard({ onPostCreated }: CreatePostCardProps) {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [content, setContent] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [showYoutubeInput, setShowYoutubeInput] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!user) return null;

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast({ title: 'Image must be less than 5MB', variant: 'destructive' });
        return;
      }
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async () => {
    if (!content.trim() && !imageFile && !youtubeUrl) {
      toast({ title: 'Please add some content', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      let imageUrl = null;

      // Upload image if selected
      if (imageFile) {
        const fileExt = imageFile.name.split('.').pop();
        const fileName = `${user.id}/${Date.now()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('posts')
          .upload(fileName, imageFile);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from('posts')
          .getPublicUrl(fileName);

        imageUrl = urlData.publicUrl;
      }

      // Create post
      const { error } = await supabase.from('posts').insert({
        user_id: user.id,
        content: content.trim() || null,
        image_url: imageUrl,
        youtube_url: youtubeUrl || null,
      });

      if (error) throw error;

      // Reset form
      setContent('');
      setImageFile(null);
      setImagePreview(null);
      setYoutubeUrl('');
      setShowYoutubeInput(false);
      
      toast({ title: 'Post created!' });
      onPostCreated();
    } catch (error: any) {
      toast({ title: 'Error creating post', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="shadow-soft border-0">
      <CardContent className="pt-4">
        <div className="flex gap-3">
          <Avatar className="h-11 w-11 shrink-0">
            <AvatarImage src={profile?.avatar_url || ''} />
            <AvatarFallback className="gradient-primary text-white">
              {profile?.full_name?.charAt(0) || 'U'}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 space-y-3">
            <Textarea
              placeholder="Share your business idea, success story, or thoughts..."
              className="min-h-[100px] resize-none border-0 bg-muted/50 focus-visible:ring-1"
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />

            {/* Image Preview */}
            {imagePreview && (
              <div className="relative inline-block">
                <img
                  src={imagePreview}
                  alt="Preview"
                  className="max-h-48 rounded-xl object-cover"
                />
                <Button
                  variant="secondary"
                  size="icon"
                  className="absolute top-2 right-2 h-8 w-8"
                  onClick={removeImage}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}

            {/* YouTube Input */}
            {showYoutubeInput && (
              <div className="flex gap-2">
                <Input
                  placeholder="Paste YouTube URL..."
                  value={youtubeUrl}
                  onChange={(e) => setYoutubeUrl(e.target.value)}
                  className="flex-1"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setShowYoutubeInput(false);
                    setYoutubeUrl('');
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-between pt-2 border-t">
              <div className="flex gap-1">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageSelect}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-2 text-muted-foreground"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Image className="h-5 w-5" />
                  <span className="hidden sm:inline">Image</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-2 text-muted-foreground"
                  onClick={() => setShowYoutubeInput(true)}
                >
                  <Youtube className="h-5 w-5" />
                  <span className="hidden sm:inline">YouTube</span>
                </Button>
              </div>

              <Button
                className="gradient-primary text-white"
                onClick={handleSubmit}
                disabled={loading || (!content.trim() && !imageFile && !youtubeUrl)}
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Post
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
