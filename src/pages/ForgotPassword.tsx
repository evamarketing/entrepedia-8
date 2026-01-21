import { useState } from 'react';
import { format } from 'date-fns';
import logoImg from '@/assets/logo.jpg';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Eye, EyeOff, Phone, Lock, ArrowLeft, Check, X, KeyRound, Loader2, CalendarIcon } from 'lucide-react';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

const phoneSchema = z.string().min(1, 'Mobile number is required').refine(
  (val) => /^[0-9]{10}$/.test(val),
  { message: 'Please enter a valid 10-digit mobile number' }
);
const passwordSchema = z.string().min(6, 'Password must be at least 6 characters');

type Step = 'verify' | 'password' | 'success';

export default function ForgotPassword() {
  const [step, setStep] = useState<Step>('verify');
  const [mobileNumber, setMobileNumber] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState<Date | undefined>(undefined);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  const navigate = useNavigate();
  const { toast } = useToast();

  // Password strength calculation
  const getPasswordStrength = (pwd: string) => {
    const checks = {
      minLength: pwd.length >= 6,
      hasUppercase: /[A-Z]/.test(pwd),
      hasLowercase: /[a-z]/.test(pwd),
      hasNumber: /[0-9]/.test(pwd),
      hasSpecial: /[!@#$%^&*(),.?":{}|<>]/.test(pwd),
    };
    
    const passedChecks = Object.values(checks).filter(Boolean).length;
    let strength: 'weak' | 'fair' | 'good' | 'strong' = 'weak';
    let color = 'bg-destructive';
    
    if (passedChecks >= 5) {
      strength = 'strong';
      color = 'bg-emerald-500';
    } else if (passedChecks >= 4) {
      strength = 'good';
      color = 'bg-emerald-400';
    } else if (passedChecks >= 3) {
      strength = 'fair';
      color = 'bg-yellow-500';
    }
    
    return { checks, passedChecks, strength, color, percentage: (passedChecks / 5) * 100 };
  };

  const passwordStrength = getPasswordStrength(newPassword);

  const handleVerifyIdentity = async () => {
    const newErrors: Record<string, string> = {};
    
    const phoneResult = phoneSchema.safeParse(mobileNumber);
    if (!phoneResult.success) {
      newErrors.mobileNumber = phoneResult.error.errors[0].message;
    }
    
    if (!dateOfBirth) {
      newErrors.dateOfBirth = 'Date of birth is required';
    }
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    
    setErrors({});
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('password-reset', {
        body: { 
          action: 'verify_identity', 
          mobile_number: mobileNumber,
          date_of_birth: format(dateOfBirth!, 'yyyy-MM-dd')
        }
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      toast({
        title: 'Identity Verified',
        description: 'Please set your new password.',
      });
      setStep('password');
    } catch (error: any) {
      toast({
        title: 'Verification Failed',
        description: error.message || 'Mobile number and date of birth do not match',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    const newErrors: Record<string, string> = {};
    
    const passwordResult = passwordSchema.safeParse(newPassword);
    if (!passwordResult.success) {
      newErrors.password = passwordResult.error.errors[0].message;
    }
    if (newPassword !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    setErrors({});
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('password-reset', {
        body: { 
          action: 'reset_password', 
          mobile_number: mobileNumber, 
          date_of_birth: format(dateOfBirth!, 'yyyy-MM-dd'),
          new_password: newPassword 
        }
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      toast({
        title: 'Password Reset Successful',
        description: 'You can now sign in with your new password.',
      });
      setStep('success');
    } catch (error: any) {
      toast({
        title: 'Reset Failed',
        description: error.message || 'Failed to reset password',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const renderStepContent = () => {
    switch (step) {
      case 'verify':
        return (
          <>
            <CardHeader className="space-y-1 pb-4">
              <CardTitle className="text-2xl text-center">Forgot Password</CardTitle>
              <CardDescription className="text-center">
                Enter your registered mobile number and date of birth to verify your identity
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="mobileNumber">Mobile Number</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input 
                    id="mobileNumber" 
                    type="tel"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={10}
                    placeholder="Enter 10-digit mobile number"
                    className="pl-10" 
                    value={mobileNumber} 
                    onChange={e => setMobileNumber(e.target.value.replace(/\D/g, ''))} 
                  />
                </div>
                {errors.mobileNumber && <p className="text-sm text-destructive">{errors.mobileNumber}</p>}
              </div>
              
              <div className="space-y-2">
                <Label>Date of Birth</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !dateOfBirth && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateOfBirth ? format(dateOfBirth, "PPP") : <span>Select your date of birth</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dateOfBirth}
                      onSelect={setDateOfBirth}
                      disabled={(date) =>
                        date > new Date() || date < new Date("1900-01-01")
                      }
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                      captionLayout="dropdown-buttons"
                      fromYear={1920}
                      toYear={new Date().getFullYear()}
                    />
                  </PopoverContent>
                </Popover>
                {errors.dateOfBirth && <p className="text-sm text-destructive">{errors.dateOfBirth}</p>}
              </div>
              
              <Button 
                onClick={handleVerifyIdentity}
                className="w-full h-12 gradient-primary text-white font-semibold" 
                disabled={loading || !mobileNumber || !dateOfBirth}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  'Verify Identity'
                )}
              </Button>
            </CardContent>
          </>
        );

      case 'password':
        return (
          <>
            <CardHeader className="space-y-1 pb-4">
              <CardTitle className="text-2xl text-center">Set New Password</CardTitle>
              <CardDescription className="text-center">
                Create a strong password for your account
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="newPassword">New Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input 
                    id="newPassword" 
                    type={showPassword ? 'text' : 'password'} 
                    placeholder="Enter new password" 
                    className="pl-10 pr-10" 
                    value={newPassword} 
                    onChange={e => setNewPassword(e.target.value)} 
                  />
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="icon" 
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8" 
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
                
                {newPassword && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                        <div 
                          className={`h-full transition-all duration-300 ${passwordStrength.color}`}
                          style={{ width: `${passwordStrength.percentage}%` }}
                        />
                      </div>
                      <span className={`text-xs font-medium capitalize ${
                        passwordStrength.strength === 'strong' ? 'text-emerald-500' :
                        passwordStrength.strength === 'good' ? 'text-emerald-400' :
                        passwordStrength.strength === 'fair' ? 'text-yellow-500' :
                        'text-destructive'
                      }`}>
                        {passwordStrength.strength}
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-1 text-xs">
                      <div className={`flex items-center gap-1 ${passwordStrength.checks.minLength ? 'text-emerald-500' : 'text-muted-foreground'}`}>
                        {passwordStrength.checks.minLength ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                        <span>6+ characters</span>
                      </div>
                      <div className={`flex items-center gap-1 ${passwordStrength.checks.hasUppercase ? 'text-emerald-500' : 'text-muted-foreground'}`}>
                        {passwordStrength.checks.hasUppercase ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                        <span>Uppercase letter</span>
                      </div>
                      <div className={`flex items-center gap-1 ${passwordStrength.checks.hasLowercase ? 'text-emerald-500' : 'text-muted-foreground'}`}>
                        {passwordStrength.checks.hasLowercase ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                        <span>Lowercase letter</span>
                      </div>
                      <div className={`flex items-center gap-1 ${passwordStrength.checks.hasNumber ? 'text-emerald-500' : 'text-muted-foreground'}`}>
                        {passwordStrength.checks.hasNumber ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                        <span>Number</span>
                      </div>
                      <div className={`flex items-center gap-1 ${passwordStrength.checks.hasSpecial ? 'text-emerald-500' : 'text-muted-foreground'}`}>
                        {passwordStrength.checks.hasSpecial ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                        <span>Special character</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input 
                    id="confirmPassword" 
                    type={showConfirmPassword ? 'text' : 'password'} 
                    placeholder="Repeat your password" 
                    className="pl-10 pr-10" 
                    value={confirmPassword} 
                    onChange={e => setConfirmPassword(e.target.value)} 
                  />
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="icon" 
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8" 
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                {errors.confirmPassword && <p className="text-sm text-destructive">{errors.confirmPassword}</p>}
              </div>
              
              <Button 
                onClick={handleResetPassword}
                className="w-full h-12 gradient-primary text-white font-semibold" 
                disabled={loading || !newPassword || !confirmPassword}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Resetting Password...
                  </>
                ) : (
                  'Reset Password'
                )}
              </Button>
              
              <Button 
                variant="ghost" 
                onClick={() => { setStep('verify'); setNewPassword(''); setConfirmPassword(''); }}
                className="w-full"
              >
                Go Back
              </Button>
            </CardContent>
          </>
        );

      case 'success':
        return (
          <>
            <CardHeader className="space-y-1 pb-4">
              <div className="mx-auto w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mb-4">
                <KeyRound className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
              </div>
              <CardTitle className="text-2xl text-center">Password Reset!</CardTitle>
              <CardDescription className="text-center">
                Your password has been successfully reset. You can now sign in with your new password.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button 
                onClick={() => navigate('/auth')}
                className="w-full h-12 gradient-primary text-white font-semibold"
              >
                Sign In Now
              </Button>
            </CardContent>
          </>
        );
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center gradient-hero px-4 py-12">
      <div className="w-full max-w-md">
        {/* Back button */}
        <Button variant="ghost" className="mb-6" onClick={() => navigate('/auth')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to sign in
        </Button>

        {/* Logo */}
        <div className="text-center mb-8">
          <img src={logoImg} alt="സംരംഭക Logo" className="h-20 w-auto rounded-2xl mx-auto mb-4 shadow-glow" />
          <h1 className="text-3xl font-bold text-foreground">സംരംഭക.com</h1>
          <p className="text-muted-foreground mt-2">Reset Your Password</p>
        </div>

        <Card className="shadow-medium border-0">
          {renderStepContent()}
        </Card>
      </div>
    </div>
  );
}