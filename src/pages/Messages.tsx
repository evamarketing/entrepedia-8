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
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { 
  getConversations, 
  getMessages, 
  sendMessage, 
  getOrCreateConversation, 
  deleteConversation, 
  deleteMessage,
  markMessagesAsRead,
  type Conversation,
  type Message
} from '@/hooks/useMessaging';
import { Send, MessageCircle, ArrowLeft, Circle, Plus, Search, UserPlus, MoreVertical, Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

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
  const { user, signOut } = useAuth();
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
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [conversationToDelete, setConversationToDelete] = useState<string | null>(null);
  const [messageToDelete, setMessageToDelete] = useState<string | null>(null);
  const [deleteMessageDialogOpen, setDeleteMessageDialogOpen] = useState(false);

  const isSessionError = (err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err);
    return msg.includes('Invalid or expired session') || msg.includes('No session token');
  };

  const handleSessionExpired = useCallback(async () => {
    toast({
      title: 'Session expired',
      description: 'Please sign in again.',
      variant: 'destructive',
    });
    await signOut();
    navigate('/auth', { replace: true });
  }, [navigate, signOut, toast]);

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
          if (newMsg.sender_id !== user?.id && selectedConversation) {
            markAsRead(selectedConversation.id);
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
    const { data, error } = await getConversations();

    if (error) {
      setLoading(false);
      if (isSessionError(error)) {
        await handleSessionExpired();
        return;
      }
      console.error('Error fetching conversations:', error);
      toast({ title: 'Error loading conversations', variant: 'destructive' });
      return;
    }

    setConversations(data?.conversations || []);
    setLoading(false);
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
      const { data, error } = await getMessages(convId);

      if (error) throw error;
      setMessages(data?.messages || []);
    } catch (error) {
      if (isSessionError(error)) {
        await handleSessionExpired();
        return;
      }
      console.error('Error fetching messages:', error);
    }
  };

  const markAsRead = async (convId: string) => {
    await markMessagesAsRead(convId);
  };

  const handleSend = async () => {
    if (!user || !selectedConversation || !newMessage.trim()) return;

    setSending(true);
    try {
      const { data, error } = await sendMessage(selectedConversation.id, newMessage.trim());

      if (error) throw error;

      // Add the new message to local state immediately for better UX
      if (data?.message) {
        setMessages((prev) => [...prev, data.message]);
      }

      setNewMessage('');
    } catch (error: unknown) {
      if (isSessionError(error)) {
        await handleSessionExpired();
        return;
      }
      console.error('Error sending message:', error);
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
      const { data, error } = await getOrCreateConversation(otherUserId);

      if (error) throw error;

      if (data?.conversation_id) {
        setNewChatOpen(false);
        await fetchConversations();
        navigate(`/messages/${data.conversation_id}`);
      }
    } catch (error) {
      if (isSessionError(error)) {
        await handleSessionExpired();
        return;
      }
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

  // Delete conversation
  const handleDeleteConversation = async () => {
    if (!conversationToDelete) return;

    try {
      const { error } = await deleteConversation(conversationToDelete);

      if (error) throw error;

      // Update local state
      setConversations(prev => prev.filter(c => c.id !== conversationToDelete));
      
      // If this was the selected conversation, clear it
      if (selectedConversation?.id === conversationToDelete) {
        setSelectedConversation(null);
        setMessages([]);
        navigate('/messages');
      }

      toast({ title: 'Chat deleted successfully' });
    } catch (error) {
      console.error('Error deleting conversation:', error);
      toast({ title: 'Error deleting chat', variant: 'destructive' });
    } finally {
      setDeleteDialogOpen(false);
      setConversationToDelete(null);
    }
  };

  const openDeleteDialog = (e: React.MouseEvent, convId: string) => {
    e.stopPropagation();
    setConversationToDelete(convId);
    setDeleteDialogOpen(true);
  };

  // Delete individual message
  const handleDeleteMessage = async () => {
    if (!messageToDelete) return;

    try {
      const { error } = await deleteMessage(messageToDelete);

      if (error) throw error;

      // Update local state
      setMessages(prev => prev.filter(m => m.id !== messageToDelete));
      
      // Refresh conversations to update last_message
      fetchConversations();

      toast({ title: 'Message deleted' });
    } catch (error) {
      console.error('Error deleting message:', error);
      toast({ title: 'Error deleting message', variant: 'destructive' });
    } finally {
      setDeleteMessageDialogOpen(false);
      setMessageToDelete(null);
    }
  };

  const openDeleteMessageDialog = (msgId: string) => {
    setMessageToDelete(msgId);
    setDeleteMessageDialogOpen(true);
  };

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
                      <DialogDescription>Select someone from your following list to start a conversation.</DialogDescription>
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
                                  {u.username && !/^\d+$/.test(u.username) && (
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
                        "flex items-center gap-3 p-4 cursor-pointer hover:bg-muted/50 transition-colors border-b group",
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
                          <div className="flex items-center gap-1">
                            {conv.unread_count && conv.unread_count > 0 && (
                              <span className="bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded-full">
                                {conv.unread_count}
                              </span>
                            )}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onClick={(e) => openDeleteDialog(e, conv.id)}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete Chat
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
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
                      {messages.map((msg) => {
                        const isOwnMessage = msg.sender_id === user?.id;
                        return (
                          <div
                            key={msg.id}
                            className={cn(
                              "flex group",
                              isOwnMessage ? "justify-end" : "justify-start"
                            )}
                          >
                            <div className={cn(
                              "flex items-center gap-1",
                              isOwnMessage ? "flex-row" : "flex-row-reverse"
                            )}>
                              {/* Delete button - only for own messages */}
                              {isOwnMessage && (
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                      <MoreVertical className="h-3 w-3" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem
                                      className="text-destructive focus:text-destructive"
                                      onClick={() => openDeleteMessageDialog(msg.id)}
                                    >
                                      <Trash2 className="h-4 w-4 mr-2" />
                                      Delete Message
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              )}
                              <div
                                className={cn(
                                  "max-w-[70%] rounded-2xl px-4 py-2",
                                  isOwnMessage
                                    ? "gradient-primary text-white rounded-br-md"
                                    : "bg-muted text-foreground rounded-bl-md"
                                )}
                              >
                                <p>{msg.content}</p>
                                <p className={cn(
                                  "text-xs mt-1",
                                  isOwnMessage ? "text-white/70" : "text-muted-foreground"
                                )}>
                                  {msg.created_at && formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
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

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this chat?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete all messages in this conversation. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteConversation}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Delete Message Confirmation Dialog */}
        <AlertDialog open={deleteMessageDialogOpen} onOpenChange={setDeleteMessageDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this message?</AlertDialogTitle>
              <AlertDialogDescription>
                This message will be permanently deleted. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteMessage}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </MainLayout>
  );
}
