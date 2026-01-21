import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { 
  Users, 
  UserPlus, 
  UserMinus, 
  Crown,
  Send,
  MessageSquare,
  Trash2
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface Community {
  id: string;
  name: string;
  description: string | null;
  cover_image_url: string | null;
  created_by: string | null;
}

interface Member {
  id: string;
  user_id: string;
  role: string | null;
  profiles: {
    id: string;
    full_name: string | null;
    username: string | null;
    avatar_url: string | null;
  } | null;
}

interface Discussion {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  profiles: {
    id: string;
    full_name: string | null;
    username: string | null;
    avatar_url: string | null;
  } | null;
}

export default function CommunityDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { toast } = useToast();
  
  const [community, setCommunity] = useState<Community | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [discussions, setDiscussions] = useState<Discussion[]>([]);
  const [isMember, setIsMember] = useState(false);
  const [isCreator, setIsCreator] = useState(false);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (id) {
      fetchCommunityData();
    }
  }, [id, user]);

  const fetchCommunityData = async () => {
    if (!id) return;
    
    setLoading(true);
    try {
      // Fetch community
      const { data: communityData, error } = await supabase
        .from('communities')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      if (!communityData) {
        setLoading(false);
        return;
      }
      
      setCommunity(communityData);
      setIsCreator(communityData.created_by === user?.id);

      // Fetch members with profiles
      const { data: membersData } = await supabase
        .from('community_members')
        .select(`
          id,
          user_id,
          role,
          profiles:user_id (id, full_name, username, avatar_url)
        `)
        .eq('community_id', id);

      setMembers(membersData || []);

      // Check if user is a member
      if (user) {
        const isMemberCheck = (membersData || []).some(m => m.user_id === user.id);
        setIsMember(isMemberCheck);
      }

      // Fetch discussions from community_discussions table
      const { data: discussionsData } = await supabase
        .from('community_discussions')
        .select(`
          id,
          content,
          created_at,
          user_id
        `)
        .eq('community_id', id)
        .order('created_at', { ascending: false })
        .limit(50);

      // Fetch profiles for discussions separately
      if (discussionsData && discussionsData.length > 0) {
        const userIds = [...new Set(discussionsData.map(d => d.user_id))];
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, full_name, username, avatar_url')
          .in('id', userIds);

        const profilesMap = new Map(profilesData?.map(p => [p.id, p]) || []);
        
        const discussionsWithProfiles = discussionsData.map(d => ({
          ...d,
          profiles: profilesMap.get(d.user_id) || null
        }));
        
        setDiscussions(discussionsWithProfiles);
      } else {
        setDiscussions([]);
      }
    } catch (error) {
      console.error('Error fetching community:', error);
      toast({ title: 'Error loading community', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!user || !id || !newMessage.trim()) {
      if (!user) navigate('/auth');
      return;
    }

    if (!isMember) {
      toast({ title: 'Join the community to participate in discussions', variant: 'destructive' });
      return;
    }

    setSending(true);
    try {
      const { error } = await supabase
        .from('community_discussions')
        .insert({
          community_id: id,
          user_id: user.id,
          content: newMessage.trim(),
        });

      if (error) throw error;
      
      setNewMessage('');
      toast({ title: 'Message posted!' });
      fetchCommunityData();
    } catch (error: any) {
      console.error('Error posting message:', error);
      toast({ title: 'Error posting message', description: error.message, variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  const handleDeleteDiscussion = async (discussionId: string) => {
    if (!user) return;
    
    try {
      const { error } = await supabase
        .from('community_discussions')
        .delete()
        .eq('id', discussionId)
        .eq('user_id', user.id);

      if (error) throw error;
      
      toast({ title: 'Message deleted' });
      fetchCommunityData();
    } catch (error: any) {
      console.error('Error deleting discussion:', error);
      toast({ title: 'Error deleting message', variant: 'destructive' });
    }
  };

  const handleJoin = async () => {
    if (!user || !id) {
      navigate('/auth');
      return;
    }

    try {
      await supabase
        .from('community_members')
        .insert({
          community_id: id,
          user_id: user.id,
          role: 'member',
        });

      toast({ title: 'Joined community!' });
      setIsMember(true);
      fetchCommunityData();
    } catch (error: any) {
      toast({ title: 'Error joining community', description: error.message, variant: 'destructive' });
    }
  };

  const handleLeave = async () => {
    if (!user || !id) return;

    try {
      await supabase
        .from('community_members')
        .delete()
        .eq('community_id', id)
        .eq('user_id', user.id);

      toast({ title: 'Left community' });
      setIsMember(false);
      fetchCommunityData();
    } catch (error: any) {
      toast({ title: 'Error leaving community', description: error.message, variant: 'destructive' });
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

  if (!community) {
    return (
      <MainLayout>
        <div className="max-w-4xl mx-auto px-4 py-12 text-center">
          <h1 className="text-2xl font-bold text-foreground mb-4">Community not found</h1>
          <Button onClick={() => navigate('/communities')}>Browse Communities</Button>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Community Header */}
        <Card className="overflow-hidden border-0 shadow-soft">
          <div 
            className="h-40 gradient-secondary bg-cover bg-center"
            style={community.cover_image_url ? { backgroundImage: `url(${community.cover_image_url})` } : {}}
          />
          
          <CardContent className="relative pt-0 pb-6">
            <div className="flex flex-col sm:flex-row sm:items-end gap-4 -mt-12">
              <Avatar className="h-24 w-24 ring-4 ring-background shadow-lg">
                <AvatarFallback className="text-2xl gradient-primary text-white">
                  {community.name.charAt(0)}
                </AvatarFallback>
              </Avatar>
              
              <div className="flex-1 sm:pb-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h1 className="text-2xl font-bold text-foreground">{community.name}</h1>
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Users className="h-4 w-4" />
                      {members.length} members
                    </span>
                  </div>
                  
                  {!isCreator && (
                    <Button
                      variant={isMember ? "outline" : "default"}
                      className={!isMember ? "gradient-primary text-white" : ""}
                      onClick={isMember ? handleLeave : handleJoin}
                    >
                      {isMember ? (
                        <>
                          <UserMinus className="mr-2 h-4 w-4" />
                          Leave
                        </>
                      ) : (
                        <>
                          <UserPlus className="mr-2 h-4 w-4" />
                          Join
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {community.description && (
              <p className="mt-4 text-foreground">{community.description}</p>
            )}
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="members" className="w-full">
          <TabsList className="grid grid-cols-2 w-full max-w-md">
            <TabsTrigger value="members">
              <Users className="h-4 w-4 mr-1" />
              Members
            </TabsTrigger>
            <TabsTrigger value="discussions">
              <MessageSquare className="h-4 w-4 mr-1" />
              Discussions
            </TabsTrigger>
          </TabsList>

          <TabsContent value="members" className="mt-4">
            <div className="grid gap-3 sm:grid-cols-2">
              {members.map((member) => (
                <Card 
                  key={member.id}
                  className="border-0 shadow-soft cursor-pointer card-hover"
                  onClick={() => navigate(`/user/${member.user_id}`)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={member.profiles?.avatar_url || ''} />
                        <AvatarFallback className="gradient-primary text-white">
                          {member.profiles?.full_name?.charAt(0) || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-foreground truncate">
                            {member.profiles?.full_name || 'Anonymous'}
                          </p>
                          {member.role === 'admin' && (
                            <Crown className="h-4 w-4 text-amber-500" />
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground truncate">
                          @{member.profiles?.username || 'user'}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="discussions" className="mt-4 space-y-4">
            {/* New Message Input */}
            {isMember ? (
              <Card className="border-0 shadow-soft">
                <CardContent className="p-4">
                  <div className="flex gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={profile?.avatar_url || ''} />
                      <AvatarFallback className="gradient-primary text-white">
                        {profile?.full_name?.charAt(0) || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 flex gap-2">
                      <Textarea
                        placeholder="Start a discussion..."
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        className="min-h-[60px] resize-none flex-1"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSendMessage();
                          }
                        }}
                      />
                      <Button 
                        onClick={handleSendMessage} 
                        disabled={sending || !newMessage.trim()}
                        className="gradient-primary text-white self-end"
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-0 shadow-soft">
                <CardContent className="p-4 text-center">
                  <p className="text-muted-foreground">
                    <Button variant="link" className="p-0" onClick={handleJoin}>
                      Join the community
                    </Button>{' '}
                    to participate in discussions
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Discussions List */}
            {discussions.length > 0 ? (
              <div className="space-y-3">
                {discussions.map((discussion) => (
                  <Card key={discussion.id} className="border-0 shadow-soft">
                    <CardContent className="p-4">
                      <div className="flex gap-3">
                        <Avatar 
                          className="h-10 w-10 cursor-pointer"
                          onClick={() => navigate(`/user/${discussion.user_id}`)}
                        >
                          <AvatarImage src={discussion.profiles?.avatar_url || ''} />
                          <AvatarFallback className="gradient-primary text-white">
                            {discussion.profiles?.full_name?.charAt(0) || 'U'}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span 
                                className="font-semibold text-foreground cursor-pointer hover:underline"
                                onClick={() => navigate(`/user/${discussion.user_id}`)}
                              >
                                {discussion.profiles?.username || discussion.profiles?.full_name || 'Anonymous'}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                ({discussion.user_id.slice(0, 8)}...)
                              </span>
                              <span className="text-xs text-muted-foreground">
                                · {formatDistanceToNow(new Date(discussion.created_at), { addSuffix: true })}
                              </span>
                            </div>
                            {user?.id === discussion.user_id && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                onClick={() => handleDeleteDiscussion(discussion.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                          <p className="text-foreground whitespace-pre-wrap break-words">
                            {discussion.content}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="border-0 shadow-soft">
                <CardContent className="py-12 text-center">
                  <MessageSquare className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-xl font-semibold text-foreground mb-2">
                    No discussions yet
                  </h3>
                  <p className="text-muted-foreground">
                    {isMember ? 'Be the first to start a discussion!' : 'Join the community to start a discussion'}
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
