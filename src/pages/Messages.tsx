import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Send, MessageCircle, ArrowLeft, Circle, Plus, Search, UserPlus } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

interface Conversation {
  id: string;
  participant_one: string | null;
  participant_two: string | null;
  last_message_at: string | null;
  other_user: {
    id: string;
    full_name: string | null;
    username: string | null;
    avatar_url: string | null;
    is_online: boolean | null;
  } | null;
  last_message?: string;
  unread_count?: number;
}

interface Message {
  id: string;
  content: string;
  sender_id: string | null;
  created_at: string | null;
  is_read: boolean | null;
}

interface FollowedUser {
  id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  is_online: boolean | null;
}

export default function Messages() {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  // New chat dialog state
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [followedUsers, setFollowedUsers] = useState<FollowedUser[]>([]);
  const [followedLoading, setFollowedLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
    fetchConversations();
  }, [user]);

  useEffect(() => {
    if (conversationId && conversations.length > 0) {
      loadConversation(conversationId);
    }
  }, [conversationId, conversations]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Real-time subscription
  useEffect(() => {
    if (!selectedConversation) return;

    const channel = supabase
      .channel(`messages:${selectedConversation.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${selectedConversation.id}`,
        },
        (payload) => {
          const newMsg = payload.new as Message;
          setMessages((prev) => [...prev, newMsg]);
          
          // Mark as read if not sender
          if (newMsg.sender_id !== user?.id) {
            markAsRead(newMsg.id);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedConversation, user]);

  // Fetch people you follow when opening the New Chat dialog
  const fetchFollowedUsers = useCallback(async () => {
    if (!user) return;
    
    setFollowedLoading(true);
    try {
      // Get list of users this person follows
      const { data: followData, error: followError } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', user.id);

      if (followError) throw followError;

      if (!followData || followData.length === 0) {
        setFollowedUsers([]);
        return;
      }

      const followingIds = followData.map(f => f.following_id).filter(Boolean) as string[];

      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('id, full_name, username, avatar_url, is_online')
        .in('id', followingIds);

      if (profileError) throw profileError;

      setFollowedUsers(profiles || []);
    } catch (error) {
      console.error('Error fetching followed users:', error);
      toast({ title: 'Error loading contacts', variant: 'destructive' });
    } finally {
      setFollowedLoading(false);
    }
  }, [user, toast]);

  useEffect(() => {
    if (newChatOpen) {
      fetchFollowedUsers();
    }
  }, [newChatOpen, fetchFollowedUsers]);

  const fetchConversations = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('conversations')
        .select('*')
        .or(`participant_one.eq.${user.id},participant_two.eq.${user.id}`)
        .order('last_message_at', { ascending: false });

      if (error) throw error;

      // Enrich with other user data
      const enrichedConversations = await Promise.all(
        (data || []).map(async (conv) => {
          const otherUserId = conv.participant_one === user.id 
            ? conv.participant_two 
            : conv.participant_one;

          if (!otherUserId) return { ...conv, other_user: null };

          const { data: userData } = await supabase
            .from('profiles')
            .select('id, full_name, username, avatar_url, is_online')
            .eq('id', otherUserId)
            .single();

          // Get last message
          const { data: lastMsg } = await supabase
            .from('messages')
            .select('content')
            .eq('conversation_id', conv.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

          // Get unread count
          const { count } = await supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('conversation_id', conv.id)
            .eq('is_read', false)
            .neq('sender_id', user.id);

          return {
            ...conv,
            other_user: userData,
            last_message: lastMsg?.content,
            unread_count: count || 0,
          };
        })
      );

      setConversations(enrichedConversations);
    } catch (error) {
      console.error('Error fetching conversations:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadConversation = async (convId: string) => {
    const conv = conversations.find(c => c.id === convId);
    if (conv) {
      setSelectedConversation(conv);
      await fetchMessages(convId);
    }
  };

  const fetchMessages = async (convId: string) => {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', convId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages(data || []);

      // Mark messages as read
      if (user) {
        await supabase
          .from('messages')
          .update({ is_read: true })
          .eq('conversation_id', convId)
          .neq('sender_id', user.id)
          .eq('is_read', false);
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  };

  const markAsRead = async (messageId: string) => {
    await supabase
      .from('messages')
      .update({ is_read: true })
      .eq('id', messageId);
  };

  const handleSend = async () => {
    if (!user || !selectedConversation || !newMessage.trim()) return;

    setSending(true);
    try {
      const { error } = await supabase
        .from('messages')
        .insert({
          conversation_id: selectedConversation.id,
          sender_id: user.id,
          content: newMessage.trim(),
        });

      if (error) throw error;

      // Update conversation last_message_at
      await supabase
        .from('conversations')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', selectedConversation.id);

      setNewMessage('');
    } catch (error: unknown) {
      toast({ title: 'Error sending message', variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const selectConversation = (conv: Conversation) => {
    setSelectedConversation(conv);
    navigate(`/messages/${conv.id}`);
  };

  // Start a new conversation with a followed user
  const startNewChat = async (otherUserId: string) => {
    if (!user) return;

    try {
      const { data: conversationId, error } = await supabase
        .rpc('get_or_create_conversation', { other_user_id: otherUserId });

      if (error) throw error;

      if (conversationId) {
        setNewChatOpen(false);
        await fetchConversations();
        navigate(`/messages/${conversationId}`);
      }
    } catch (error) {
      console.error('Error starting conversation:', error);
      toast({ title: 'Error starting chat', variant: 'destructive' });
    }
  };

  // Filter followed users based on search
  const filteredFollowedUsers = followedUsers.filter(u => {
    const term = searchTerm.toLowerCase();
    return (
      u.full_name?.toLowerCase().includes(term) ||
      u.username?.toLowerCase().includes(term)
    );
  });

  if (loading) {
    return (
      <MainLayout>
        <div className="max-w-4xl mx-auto px-4 py-6">
          <Skeleton className="h-[600px] w-full rounded-xl" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="max-w-4xl mx-auto px-4 py-6">
        <Card className="border-0 shadow-soft overflow-hidden">
          <div className="grid md:grid-cols-3 h-[600px]">
            {/* Conversations List */}
            <div className={cn(
              "border-r border-border",
              selectedConversation && "hidden md:block"
            )}>
              <CardHeader className="py-4 border-b flex flex-row items-center justify-between">
                <CardTitle className="text-lg">Messages</CardTitle>
                <Dialog open={newChatOpen} onOpenChange={setNewChatOpen}>
                  <DialogTrigger asChild>
                    <Button size="icon" variant="ghost" aria-label="New chat">
                      <Plus className="h-5 w-5" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle>Start a New Chat</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-2">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Search people you follow..."
                          className="pl-10"
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                        />
                      </div>
                      <ScrollArea className="h-[300px]">
                        {followedLoading ? (
                          <div className="space-y-3 p-2">
                            {Array.from({ length: 4 }).map((_, i) => (
                              <Skeleton key={i} className="h-14 w-full rounded-lg" />
                            ))}
                          </div>
                        ) : filteredFollowedUsers.length === 0 ? (
                          <div className="p-8 text-center">
                            <UserPlus className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                            <p className="text-muted-foreground text-sm">
                              {followedUsers.length === 0
                                ? "You're not following anyone yet."
                                : "No matches found."}
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-1">
                            {filteredFollowedUsers.map((u) => (
                              <div
                                key={u.id}
                                className="flex items-center gap-3 p-3 rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
                                onClick={() => startNewChat(u.id)}
                              >
                                <div className="relative">
                                  <Avatar className="h-10 w-10">
                                    <AvatarImage src={u.avatar_url || ''} />
                                    <AvatarFallback className="gradient-primary text-white">
                                      {u.full_name?.charAt(0) || 'U'}
                                    </AvatarFallback>
                                  </Avatar>
                                  {u.is_online && (
                                    <Circle className="absolute bottom-0 right-0 h-2.5 w-2.5 fill-green-500 text-green-500" />
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-foreground truncate">
                                    {u.full_name || 'Unknown'}
                                  </p>
                                  {u.username && (
                                    <p className="text-xs text-muted-foreground truncate">
                                      @{u.username}
                                    </p>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </ScrollArea>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <ScrollArea className="h-[calc(600px-60px)]">
                {conversations.length > 0 ? (
                  conversations.map((conv) => (
                    <div
                      key={conv.id}
                      className={cn(
                        "flex items-center gap-3 p-4 cursor-pointer hover:bg-muted/50 transition-colors border-b",
                        selectedConversation?.id === conv.id && "bg-muted/50"
                      )}
                      onClick={() => selectConversation(conv)}
                    >
                      <div className="relative">
                        <Avatar className="h-12 w-12">
                          <AvatarImage src={conv.other_user?.avatar_url || ''} />
                          <AvatarFallback className="gradient-primary text-white">
                            {conv.other_user?.full_name?.charAt(0) || 'U'}
                          </AvatarFallback>
                        </Avatar>
                        {conv.other_user?.is_online && (
                          <Circle className="absolute bottom-0 right-0 h-3 w-3 fill-green-500 text-green-500" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="font-semibold text-foreground truncate">
                            {conv.other_user?.full_name || 'Unknown'}
                          </p>
                          {conv.unread_count && conv.unread_count > 0 && (
                            <span className="bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded-full">
                              {conv.unread_count}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground truncate">
                          {conv.last_message || 'No messages yet'}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-8 text-center">
                    <MessageCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground mb-3">No conversations yet</p>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setNewChatOpen(true)}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Start a Chat
                    </Button>
                  </div>
                )}
              </ScrollArea>
            </div>

            {/* Chat Area */}
            <div className={cn(
              "md:col-span-2 flex flex-col",
              !selectedConversation && "hidden md:flex"
            )}>
              {selectedConversation ? (
                <>
                  {/* Chat Header */}
                  <div className="flex items-center gap-3 p-4 border-b">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="md:hidden"
                      onClick={() => {
                        setSelectedConversation(null);
                        navigate('/messages');
                      }}
                    >
                      <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={selectedConversation.other_user?.avatar_url || ''} />
                      <AvatarFallback className="gradient-primary text-white">
                        {selectedConversation.other_user?.full_name?.charAt(0) || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-semibold text-foreground">
                        {selectedConversation.other_user?.full_name || 'Unknown'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {selectedConversation.other_user?.is_online ? 'Online' : 'Offline'}
                      </p>
                    </div>
                  </div>

                  {/* Messages */}
                  <ScrollArea className="flex-1 p-4">
                    <div className="space-y-4">
                      {messages.map((msg) => (
                        <div
                          key={msg.id}
                          className={cn(
                            "flex",
                            msg.sender_id === user?.id ? "justify-end" : "justify-start"
                          )}
                        >
                          <div
                            className={cn(
                              "max-w-[70%] rounded-2xl px-4 py-2",
                              msg.sender_id === user?.id
                                ? "gradient-primary text-white rounded-br-md"
                                : "bg-muted text-foreground rounded-bl-md"
                            )}
                          >
                            <p>{msg.content}</p>
                            <p className={cn(
                              "text-xs mt-1",
                              msg.sender_id === user?.id ? "text-white/70" : "text-muted-foreground"
                            )}>
                              {msg.created_at && formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}
                            </p>
                          </div>
                        </div>
                      ))}
                      <div ref={messagesEndRef} />
                    </div>
                  </ScrollArea>

                  {/* Input */}
                  <div className="p-4 border-t">
                    <form 
                      onSubmit={(e) => { e.preventDefault(); handleSend(); }}
                      className="flex gap-2"
                    >
                      <Input
                        placeholder="Type a message..."
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        disabled={sending}
                      />
                      <Button 
                        type="submit" 
                        size="icon" 
                        className="gradient-primary text-white"
                        disabled={sending || !newMessage.trim()}
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                    </form>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center">
                    <MessageCircle className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground mb-4">Select a conversation to start chatting</p>
                    <Button
                      variant="secondary"
                      onClick={() => setNewChatOpen(true)}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Start a New Chat
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </Card>
      </div>
    </MainLayout>
  );
}
