import { useNavigate } from 'react-router-dom';
import { AlertCircle, X, Settings, User, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useAuth } from '@/contexts/AuthContext';
import { useState } from 'react';

interface ProfileCompletionBannerProps {
  className?: string;
  showCloseButton?: boolean;
}

export function ProfileCompletionBanner({ 
  className = '',
  showCloseButton = false 
}: ProfileCompletionBannerProps) {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [dismissed, setDismissed] = useState(false);

  if (!user || dismissed) return null;

  // Check what's incomplete
  const issues: { icon: React.ReactNode; text: string }[] = [];

  if (!profile?.full_name) {
    issues.push({
      icon: <User className="h-4 w-4" />,
      text: 'Add your full name'
    });
  }

  if (!profile?.username) {
    issues.push({
      icon: <User className="h-4 w-4" />,
      text: 'Set a username'
    });
  }

  if (!profile?.location) {
    issues.push({
      icon: <MapPin className="h-4 w-4" />,
      text: 'Add your location'
    });
  }

  if (!profile?.avatar_url) {
    issues.push({
      icon: <User className="h-4 w-4" />,
      text: 'Upload a profile photo'
    });
  }

  if (issues.length === 0) return null;

  return (
    <Alert 
      variant="default" 
      className={`border-amber-500/50 bg-amber-50 dark:bg-amber-950/20 ${className}`}
    >
      <AlertCircle className="h-5 w-5 text-amber-500" />
      <div className="flex-1">
        <AlertTitle className="text-amber-700 dark:text-amber-400 flex items-center justify-between">
          Complete Your Profile
          {showCloseButton && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 -mr-2"
              onClick={() => setDismissed(true)}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </AlertTitle>
        <AlertDescription className="text-amber-600 dark:text-amber-300">
          <ul className="mt-2 space-y-1 text-sm">
            {issues.map((issue, i) => (
              <li key={i} className="flex items-center gap-2">
                {issue.icon}
                {issue.text}
              </li>
            ))}
          </ul>
          <Button
            variant="outline"
            size="sm"
            className="mt-3 border-amber-500 text-amber-700 hover:bg-amber-100 dark:text-amber-400 dark:hover:bg-amber-950"
            onClick={() => navigate('/settings')}
          >
            <Settings className="mr-2 h-4 w-4" />
            Go to Settings
          </Button>
        </AlertDescription>
      </div>
    </Alert>
  );
}
