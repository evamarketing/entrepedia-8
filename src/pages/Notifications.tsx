import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { Bell, RefreshCw } from "lucide-react";

import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

type NotificationRow = {
  id: string;
  user_id: string | null;
  type: string;
  title: string;
  body: string | null;
  data: unknown;
  is_read: boolean | null;
  created_at: string;
};

export default function Notifications() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<NotificationRow[]>([]);

  const userId = user?.id ?? null;

  const load = useCallback(async () => {
    if (!userId) return;

    setLoading(true);
    const { data, error } = await supabase
      .from("notifications")
      .select("id,user_id,type,title,body,data,is_read,created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      toast({
        title: "Couldn't load notifications",
        description: error.message,
        variant: "destructive",
      });
      setItems([]);
      setLoading(false);
      return;
    }

    setItems((data ?? []) as NotificationRow[]);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    if (!authLoading && !userId) {
      setLoading(false);
      setItems([]);
      return;
    }

    if (userId) load();
  }, [authLoading, userId, load]);

  const unreadCount = useMemo(() => items.filter((n) => !n.is_read).length, [items]);

  return (
    <MainLayout>
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        <header className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Notifications</h1>
            <p className="text-muted-foreground">
              {userId ? (unreadCount ? `${unreadCount} unread` : "You're all caught up") : "Sign in to see your notifications"}
            </p>
          </div>

          {userId ? (
            <Button variant="secondary" onClick={load} disabled={loading}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          ) : (
            <Button onClick={() => navigate("/auth")}>Sign in</Button>
          )}
        </header>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-xl" />
            ))}
          </div>
        ) : !userId ? (
          <Card className="border-0 shadow-soft">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center">
                  <Bell className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="space-y-1">
                  <p className="font-semibold text-foreground">You’re not signed in</p>
                  <p className="text-sm text-muted-foreground">Sign in to receive likes, comments, messages, and more.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : items.length === 0 ? (
          <Card className="border-0 shadow-soft">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center">
                  <Bell className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="space-y-1">
                  <p className="font-semibold text-foreground">No notifications yet</p>
                  <p className="text-sm text-muted-foreground">When something happens, it’ll show up here.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <section className="space-y-3" aria-label="Notification list">
            {items.map((n) => (
              <Card key={n.id} className="border-0 shadow-soft">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        {!n.is_read && <span className="h-2 w-2 rounded-full bg-primary" aria-label="Unread" />}
                        <p className="font-semibold text-foreground truncate">{n.title}</p>
                      </div>
                      {n.body && <p className="mt-1 text-sm text-muted-foreground">{n.body}</p>}
                    </div>

                    <p className="shrink-0 text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </section>
        )}
      </div>
    </MainLayout>
  );
}
