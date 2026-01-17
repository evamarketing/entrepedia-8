import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { MainLayout } from '@/components/layout/MainLayout';
import { CreatePostCard } from '@/components/feed/CreatePostCard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, Store, Users } from 'lucide-react';

export default function Create() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const handlePostCreated = () => {
    navigate('/');
  };

  if (!user) {
    return (
      <MainLayout>
        <div className="container max-w-2xl py-8">
          <Card>
            <CardHeader className="text-center">
              <CardTitle>Sign in to create</CardTitle>
              <CardDescription>
                You need to be signed in to create content
              </CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center">
              <Button onClick={() => navigate('/auth')}>Sign In</Button>
            </CardContent>
          </Card>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="container max-w-2xl py-8 space-y-6">
        <h1 className="text-2xl font-bold">Create</h1>

        {/* Priority: Business & Community */}
        <div className="grid gap-4 sm:grid-cols-2">
          <Card 
            className="cursor-pointer hover:bg-accent/50 transition-colors border-2 border-primary/20"
            onClick={() => navigate('/my-businesses')}
          >
            <CardHeader className="flex flex-row items-center gap-4 pb-2">
              <div className="p-3 bg-primary/10 rounded-lg">
                <Store className="h-8 w-8 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">Create Business</CardTitle>
                <CardDescription className="text-sm">
                  Publish your business profile or idea
                </CardDescription>
              </div>
            </CardHeader>
          </Card>

          <Card 
            className="cursor-pointer hover:bg-accent/50 transition-colors border-2 border-primary/20"
            onClick={() => navigate('/communities')}
          >
            <CardHeader className="flex flex-row items-center gap-4 pb-2">
              <div className="p-3 bg-primary/10 rounded-lg">
                <Users className="h-8 w-8 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">Create Community</CardTitle>
                <CardDescription className="text-sm">
                  Start a business idea community
                </CardDescription>
              </div>
            </CardHeader>
          </Card>
        </div>

        {/* Secondary: Create Post */}
        <div className="pt-4">
          <h2 className="text-lg font-semibold mb-4 text-muted-foreground">Or share an update</h2>
          <CreatePostCard onPostCreated={handlePostCreated} />
        </div>
      </div>
    </MainLayout>
  );
}
