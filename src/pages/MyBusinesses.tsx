import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Plus, Building2, MapPin, Users, Edit, Trash2 } from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type BusinessCategory = Database['public']['Enums']['business_category'];

interface Business {
  id: string;
  name: string;
  description: string | null;
  category: BusinessCategory;
  logo_url: string | null;
  location: string | null;
  follower_count?: number;
}

const CATEGORIES: { value: BusinessCategory; label: string; icon: string }[] = [
  { value: 'food', label: 'Food & Beverages', icon: '🍔' },
  { value: 'tech', label: 'Technology', icon: '💻' },
  { value: 'handmade', label: 'Handmade', icon: '🎨' },
  { value: 'services', label: 'Services', icon: '🛠️' },
  { value: 'agriculture', label: 'Agriculture', icon: '🌾' },
  { value: 'retail', label: 'Retail', icon: '🛍️' },
  { value: 'education', label: 'Education', icon: '📚' },
  { value: 'health', label: 'Health', icon: '💊' },
  { value: 'finance', label: 'Finance', icon: '💰' },
  { value: 'other', label: 'Other', icon: '📦' },
];

export default function MyBusinesses() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingBusiness, setEditingBusiness] = useState<Business | null>(null);
  const [saving, setSaving] = useState(false);
  
  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<BusinessCategory>('other');
  const [location, setLocation] = useState('');

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
    fetchBusinesses();
  }, [user]);

  const fetchBusinesses = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('businesses')
        .select('id, name, description, category, logo_url, location')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get follower counts
      const businessesWithCounts = await Promise.all(
        (data || []).map(async (business) => {
          const { count } = await supabase
            .from('business_follows')
            .select('*', { count: 'exact', head: true })
            .eq('business_id', business.id);
          return { ...business, follower_count: count || 0 };
        })
      );

      setBusinesses(businessesWithCounts);
    } catch (error) {
      console.error('Error fetching businesses:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBusiness = async () => {
    if (!user || !name.trim()) {
      toast({ title: 'Please enter a business name', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('businesses')
        .insert({
          name: name.trim(),
          description: description.trim() || null,
          category,
          location: location.trim() || null,
          owner_id: user.id,
        });

      if (error) throw error;

      toast({ title: 'Business created successfully!' });
      setDialogOpen(false);
      resetForm();
      fetchBusinesses();
    } catch (error: any) {
      toast({ title: 'Error creating business', description: error.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteBusiness = async (businessId: string) => {
    if (!confirm('Are you sure you want to delete this business?')) return;

    try {
      const { error } = await supabase
        .from('businesses')
        .delete()
        .eq('id', businessId);

      if (error) throw error;

      toast({ title: 'Business deleted' });
      fetchBusinesses();
    } catch (error: any) {
      toast({ title: 'Error deleting business', description: error.message, variant: 'destructive' });
    }
  };

  const handleEditBusiness = (business: Business) => {
    setEditingBusiness(business);
    setName(business.name);
    setDescription(business.description || '');
    setCategory(business.category);
    setLocation(business.location || '');
    setEditDialogOpen(true);
  };

  const handleUpdateBusiness = async () => {
    if (!user || !editingBusiness || !name.trim()) {
      toast({ title: 'Please enter a business name', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('businesses')
        .update({
          name: name.trim(),
          description: description.trim() || null,
          category,
          location: location.trim() || null,
        })
        .eq('id', editingBusiness.id);

      if (error) throw error;

      toast({ title: 'Business updated successfully!' });
      setEditDialogOpen(false);
      setEditingBusiness(null);
      resetForm();
      fetchBusinesses();
    } catch (error: any) {
      toast({ title: 'Error updating business', description: error.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setName('');
    setDescription('');
    setCategory('other');
    setLocation('');
  };

  const getCategoryInfo = (cat: string) => {
    return CATEGORIES.find(c => c.value === cat) || CATEGORIES[9];
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
          <Skeleton className="h-12 w-48" />
          <div className="grid gap-4 sm:grid-cols-2">
            {Array(4).fill(0).map((_, i) => (
              <Skeleton key={i} className="h-40 w-full rounded-xl" />
            ))}
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">My Businesses</h1>
            <p className="text-muted-foreground">Manage your business profiles</p>
          </div>
          
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gradient-primary text-white">
                <Plus className="mr-2 h-4 w-4" />
                New Business
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Create New Business</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Business Name *</Label>
                  <Input
                    id="name"
                    placeholder="Enter business name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    placeholder="Describe your business..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Select value={category} onValueChange={(val) => setCategory(val as BusinessCategory)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((cat) => (
                        <SelectItem key={cat.value} value={cat.value}>
                          {cat.icon} {cat.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="location">Location</Label>
                  <Input
                    id="location"
                    placeholder="e.g., Kerala, India"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                  />
                </div>
                
                <Button 
                  onClick={handleCreateBusiness} 
                  className="w-full gradient-primary text-white"
                  disabled={saving}
                >
                  {saving ? 'Creating...' : 'Create Business'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Businesses Grid */}
        {businesses.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {businesses.map((business) => {
              const catInfo = getCategoryInfo(business.category);
              return (
                <Card 
                  key={business.id} 
                  className="border-0 shadow-soft cursor-pointer card-hover group relative"
                  onClick={() => navigate(`/business/${business.id}`)}
                >
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <Avatar className="h-16 w-16">
                        <AvatarImage src={business.logo_url || ''} />
                        <AvatarFallback className="gradient-secondary text-white text-xl">
                          {business.name.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-lg text-foreground truncate">
                          {business.name}
                        </h3>
                        <Badge variant="secondary" className="mt-1">
                          {catInfo.icon} {catInfo.label}
                        </Badge>
                        
                        <div className="flex flex-wrap gap-3 mt-3 text-sm text-muted-foreground">
                          {business.location && (
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {business.location}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {business.follower_count} followers
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Action buttons */}
                    <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                      <Button
                        size="icon"
                        variant="secondary"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditBusiness(business);
                        }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteBusiness(business.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card className="border-0 shadow-soft">
            <CardContent className="py-16 text-center">
              <Building2 className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-xl font-semibold text-foreground mb-2">No businesses yet</h3>
              <p className="text-muted-foreground mb-6">
                Create your first business to start sharing your entrepreneurial journey
              </p>
              <Button 
                className="gradient-primary text-white"
                onClick={() => setDialogOpen(true)}
              >
                <Plus className="mr-2 h-4 w-4" />
                Create Your First Business
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Edit Business Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={(open) => {
          setEditDialogOpen(open);
          if (!open) {
            setEditingBusiness(null);
            resetForm();
          }
        }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Edit Business</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Business Name *</Label>
                <Input
                  id="edit-name"
                  placeholder="Enter business name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="edit-description">Description</Label>
                <Textarea
                  id="edit-description"
                  placeholder="Describe your business..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="edit-category">Category</Label>
                <Select value={category} onValueChange={(val) => setCategory(val as BusinessCategory)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.icon} {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="edit-location">Location</Label>
                <Input
                  id="edit-location"
                  placeholder="e.g., Kerala, India"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                />
              </div>
              
              <Button 
                onClick={handleUpdateBusiness} 
                className="w-full gradient-primary text-white"
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
