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
  showCloseButton = true 
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
      <AlertCircle className="h-4 w-4 text-amber-500 shrink-0" />
      <div className="flex-1 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-300">
          <span className="font-medium text-amber-700 dark:text-amber-400">Complete profile:</span>
          <span className="flex items-center gap-1">
            {issues.map((issue, i) => (
              <span key={i} className="flex items-center gap-1">
                {issue.text}
                {i < issues.length - 1 && <span className="text-amber-400">•</span>}
              </span>
            ))}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs border-amber-500 text-amber-700 hover:bg-amber-100 dark:text-amber-400 dark:hover:bg-amber-950"
            onClick={() => navigate('/settings')}
          >
            <Settings className="mr-1 h-3 w-3" />
            Settings
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 hover:bg-amber-200/50"
            onClick={() => setDismissed(true)}
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Alert>
  );
}
