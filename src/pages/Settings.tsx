import { useState, useRef, useEffect } from 'react';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Camera, Save, LogOut, Phone, CheckCircle, AlertTriangle, Circle, Mail, Eye, EyeOff, Shield, BadgeCheck, Loader2, Send, MapPin } from 'lucide-react';
import { PanchayathLocationPicker } from '@/components/settings/PanchayathLocationPicker';
import { FollowStats } from '@/components/settings/FollowStats';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';

// Field completion indicator component
const FieldStatus = ({ completed }: { completed: boolean }) => (
  completed ? (
    <CheckCircle className="h-4 w-4 text-green-500" />
  ) : (
    <Circle className="h-4 w-4 text-muted-foreground/50" />
  )
);

export default function Settings() {
  const navigate = useNavigate();
  const { user, profile, signOut, refreshProfile } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [username, setUsername] = useState(profile?.username || '');
  const [bio, setBio] = useState(profile?.bio || '');
  const [location, setLocation] = useState(profile?.location || '');
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Email verification state
  const [email, setEmail] = useState(profile?.email || '');
  const [sendingVerification, setSendingVerification] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);

  // Privacy settings state
  const [showEmail, setShowEmail] = useState(profile?.show_email ?? false);
  const [showMobile, setShowMobile] = useState(profile?.show_mobile ?? false);
  const [showLocation, setShowLocation] = useState(profile?.show_location ?? true);
  const [savingPrivacy, setSavingPrivacy] = useState(false);

  // Check for unsaved profile changes
  const hasUnsavedProfileChanges = profile && (
    fullName !== (profile.full_name || '') ||
    username !== (profile.username || '') ||
    bio !== (profile.bio || '') ||
    location !== (profile.location || '')
  );

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || '');
      setUsername(profile.username || '');
      setBio(profile.bio || '');
      setLocation(profile.location || '');
      setEmail(profile.email || '');
      setShowEmail(profile.show_email ?? false);
      setShowMobile(profile.show_mobile ?? false);
      setShowLocation(profile.show_location ?? true);
    }
  }, [profile]);

  if (!user) {
    navigate('/auth');
    return null;
  }

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast({ title: 'Image must be less than 5MB', variant: 'destructive' });
      return;
    }

    setUploadingAvatar(true);
    try {
      // Use edge function to upload avatar (bypasses RLS for custom auth)
      const formData = new FormData();
      formData.append('file', file);
      formData.append('user_id', user.id);

      const { data, error } = await supabase.functions.invoke('upload-avatar', {
        body: formData,
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      await refreshProfile();
      toast({ title: 'Avatar updated!' });
    } catch (error: any) {
      toast({ title: 'Error uploading avatar', description: error.message, variant: 'destructive' });
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updateSchema = z.object({
        full_name: z.string().trim().max(100).nullable(),
        username: z.string().trim().max(50).nullable(),
        bio: z.string().trim().max(500).nullable(),
        location: z.string().trim().max(200).nullable(),
      });

      const updatePayload = updateSchema.parse({
        full_name: fullName.trim() || null,
        username: username.trim() || null,
        bio: bio.trim() || null,
        location: location.trim() || null,
      });

      // Use edge function to update profile (bypasses RLS for custom auth)
      const { data, error } = await supabase.functions.invoke('update-profile', {
        body: {
          user_id: user.id,
          ...updatePayload,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      await refreshProfile();
      toast({ title: 'Profile updated!' });
    } catch (error: any) {
      toast({ title: 'Error updating profile', description: error.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleSendVerification = async () => {
    if (!email.trim()) {
      toast({ title: 'Please enter an email address', variant: 'destructive' });
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      toast({ title: 'Please enter a valid email address', variant: 'destructive' });
      return;
    }

    setSendingVerification(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-verification-email', {
        body: { user_id: user.id, email: email.trim() }
      });

      if (error || data?.error) {
        throw new Error(data?.error || error?.message || 'Failed to send verification');
      }

      setVerificationSent(true);
      await refreshProfile();
      toast({ 
        title: 'Verification email sent!', 
        description: 'Please check your inbox and click the verification link.'
      });

      // For development - show the debug link if available
      if (data?.debug_link) {
        console.log('Debug verification link:', data.debug_link);
        toast({
          title: 'Dev Mode: Verification Link',
          description: 'Check console for the verification link'
        });
      }
    } catch (error: any) {
      toast({ 
        title: 'Error sending verification', 
        description: error.message, 
        variant: 'destructive' 
      });
    } finally {
      setSendingVerification(false);
    }
  };

  const handleSavePrivacy = async () => {
    setSavingPrivacy(true);
    try {
      const privacySchema = z.object({
        show_email: z.boolean(),
        show_mobile: z.boolean(),
        show_location: z.boolean(),
      });

      const privacyPayload = privacySchema.parse({
        show_email: showEmail,
        show_mobile: showMobile,
        show_location: showLocation,
      });

      // Use edge function to update profile (bypasses RLS for custom auth)
      const { data, error } = await supabase.functions.invoke('update-profile', {
        body: {
          user_id: user.id,
          ...privacyPayload,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      await refreshProfile();
      toast({ title: 'Privacy settings saved!' });
    } catch (error: any) {
      toast({ title: 'Error updating privacy settings', description: error.message, variant: 'destructive' });
    } finally {
      setSavingPrivacy(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  // Calculate profile completion
  const profileFields = [
    { key: 'full_name', label: 'Full Name', completed: !!profile?.full_name },
    { key: 'username', label: 'Username', completed: !!profile?.username },
    { key: 'bio', label: 'Bio', completed: !!profile?.bio },
    { key: 'avatar_url', label: 'Profile Photo', completed: !!profile?.avatar_url },
    { key: 'location', label: 'Location', completed: !!profile?.location },
  ];
  
  const completedCount = profileFields.filter(f => f.completed).length;
  const completionPercentage = Math.round((completedCount / profileFields.length) * 100);
  const isProfileIncomplete = completionPercentage < 100;
  
  const getMissingFields = () => {
    return profileFields.filter(f => !f.completed).map(f => f.label);
  };

  return (
    <MainLayout>
      {/* Sticky Profile Completion Progress Bar */}
      <div className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-foreground">Profile Completion</span>
            <span className={`text-sm font-bold ${completionPercentage === 100 ? 'text-green-600' : 'text-primary'}`}>
              {completionPercentage}%
            </span>
          </div>
          <Progress value={completionPercentage} className="h-2" />
          {completionPercentage < 100 && (
            <p className="text-xs text-muted-foreground mt-1">
              Complete your profile to unlock all features
            </p>
          )}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        <h1 className="text-3xl font-bold text-foreground">Settings</h1>

        {/* Profile Incomplete Reminder */}
        {isProfileIncomplete && (
          <Alert variant="default" className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/20">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertTitle className="text-amber-800 dark:text-amber-400">Your profile is not completed</AlertTitle>
            <AlertDescription className="text-amber-700 dark:text-amber-300">
              Complete your profile to help others find and connect with you. Missing: {getMissingFields().join(', ')}.
            </AlertDescription>
          </Alert>
        )}

        {/* Email Verification Card */}
        <Card className="border-0 shadow-soft">
          <CardHeader>
            <div className="flex items-center gap-2">
              <BadgeCheck className="h-5 w-5 text-primary" />
              <CardTitle>Profile Verification</CardTitle>
            </div>
            <CardDescription>Verify your email to get a verified badge on your profile</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {profile?.email_verified ? (
              <Alert className="border-green-500/50 bg-green-50 dark:bg-green-950/20">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <AlertTitle className="text-green-800 dark:text-green-400">Email Verified</AlertTitle>
                <AlertDescription className="text-green-700 dark:text-green-300">
                  Your email ({profile.email}) is verified. You have a verified profile badge!
                </AlertDescription>
              </Alert>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="email"
                        type="email"
                        placeholder="Enter your email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="pl-10"
                        disabled={sendingVerification}
                      />
                    </div>
                    <Button 
                      onClick={handleSendVerification}
                      disabled={sendingVerification || !email.trim()}
                      className="gradient-primary text-white"
                    >
                      {sendingVerification ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Send className="mr-2 h-4 w-4" />
                          Verify
                        </>
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    We'll send a verification link to this email address
                  </p>
                </div>

                {verificationSent && (
                  <Alert className="border-blue-500/50 bg-blue-50 dark:bg-blue-950/20">
                    <Mail className="h-4 w-4 text-blue-600" />
                    <AlertTitle className="text-blue-800 dark:text-blue-400">Verification Sent</AlertTitle>
                    <AlertDescription className="text-blue-700 dark:text-blue-300">
                      Check your email ({email}) and click the verification link. Didn't receive it? Check your spam folder or try again.
                    </AlertDescription>
                  </Alert>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Privacy Settings Card */}
        <Card className="border-0 shadow-soft">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              <CardTitle>Privacy Settings</CardTitle>
            </div>
            <CardDescription>Control what information is visible on your public profile</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-3">
                <Mail className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium text-foreground">Show Email</p>
                  <p className="text-sm text-muted-foreground">Display your email on your public profile</p>
                </div>
              </div>
              <Switch 
                checked={showEmail} 
                onCheckedChange={setShowEmail}
                disabled={!profile?.email_verified}
              />
            </div>
            {!profile?.email_verified && (
              <p className="text-xs text-muted-foreground ml-8">Verify your email first to show it publicly</p>
            )}

            <Separator />

            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-3">
                <Phone className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium text-foreground">Show Mobile Number</p>
                  <p className="text-sm text-muted-foreground">Display your phone number on your public profile</p>
                </div>
              </div>
              <Switch 
                checked={showMobile} 
                onCheckedChange={setShowMobile}
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-3">
                <MapPin className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium text-foreground">Show Location</p>
                  <p className="text-sm text-muted-foreground">Display your location on your public profile</p>
                </div>
              </div>
              <Switch 
                checked={showLocation} 
                onCheckedChange={setShowLocation}
              />
            </div>

            <Button 
              onClick={handleSavePrivacy} 
              variant="outline"
              disabled={savingPrivacy}
              className="w-full"
            >
              {savingPrivacy ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Privacy Settings
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Profile Settings */}
        <Card className="border-0 shadow-soft">
          <CardHeader>
            <CardTitle>Profile</CardTitle>
            <CardDescription>Update your profile information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Avatar */}
            <div className="flex items-center gap-4">
              <div className="relative">
                <Avatar className="h-24 w-24">
                  <AvatarImage src={profile?.avatar_url || ''} />
                  <AvatarFallback className="gradient-primary text-white text-2xl">
                    {profile?.full_name?.charAt(0) || 'U'}
                  </AvatarFallback>
                </Avatar>
                <Button
                  size="icon"
                  variant="secondary"
                  className="absolute bottom-0 right-0 h-8 w-8 rounded-full"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingAvatar}
                >
                  <Camera className="h-4 w-4" />
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarChange}
                />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-foreground">Profile Photo</p>
                  <FieldStatus completed={!!profile?.avatar_url} />
                </div>
                <p className="text-sm text-muted-foreground">JPG, PNG. Max 5MB</p>
              </div>
            </div>

            <Separator />

            {/* Form Fields */}
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label htmlFor="fullName">Full Name</Label>
                  <FieldStatus completed={!!profile?.full_name} />
                </div>
                <Input
                  id="fullName"
                  placeholder="Your full name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label htmlFor="username">Username</Label>
                  <FieldStatus completed={!!profile?.username} />
                </div>
                <Input
                  id="username"
                  placeholder="your_username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label htmlFor="bio">Bio</Label>
                  <FieldStatus completed={!!profile?.bio} />
                </div>
                <Textarea
                  id="bio"
                  placeholder="Tell us about yourself..."
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  rows={3}
                />
              </div>

              <Separator className="my-2" />

              {/* Location - Panchayath & Ward */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label>Location</Label>
                  <FieldStatus completed={!!profile?.location} />
                </div>
                <PanchayathLocationPicker 
                  value={location} 
                  onChange={setLocation} 
                />
              </div>
            </div>

            <Button 
              onClick={handleSave} 
              className={hasUnsavedProfileChanges ? "gradient-primary text-white animate-pulse" : "gradient-primary text-white"}
              disabled={saving}
            >
              <Save className="mr-2 h-4 w-4" />
              {saving ? 'Saving...' : hasUnsavedProfileChanges ? 'Save Changes *' : 'Save Changes'}
            </Button>
            {hasUnsavedProfileChanges && (
              <p className="text-xs text-muted-foreground mt-2">You have unsaved changes</p>
            )}
          </CardContent>
        </Card>

        {/* Following & Followers */}
        <FollowStats userId={user.id} />

        {/* Account Settings */}
        <Card className="border-0 shadow-soft">
          <CardHeader>
            <CardTitle>Account</CardTitle>
            <CardDescription>Manage your account settings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Phone className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium text-foreground">Mobile Number</p>
                  <p className="text-sm text-muted-foreground">
                    {user.mobile_number}
                  </p>
                </div>
              </div>
            </div>

            <Separator />

            <Button variant="destructive" onClick={handleSignOut}>
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </Button>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
