import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { 
  Briefcase, 
  ChevronDown, 
  ChevronUp, 
  Plus, 
  MapPin, 
  Calendar, 
  Hash,
  Clock,
  Users,
  Send,
  Phone,
  User
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface JobData {
  id: string;
  title: string;
  description: string;
  conditions: string | null;
  location: string | null;
  status: string;
  max_applications: number | null;
  expires_at: string | null;
  created_at: string;
  creator_id: string;
  application_count?: number;
}

// Inline CreateJobDialog for this section
function CreateJobDialogInline({ onJobCreated }: { onJobCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    conditions: '',
    location: '',
    max_applications: '',
    expires_days: '7',
    creator_mobile: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title || !formData.description) {
      toast({
        title: 'Missing Information',
        description: 'Please fill in the title and description.',
        variant: 'destructive',
      });
      return;
    }

    if (!formData.creator_mobile || formData.creator_mobile.length < 10) {
      toast({
        title: 'Mobile Required',
        description: 'Please enter your mobile number to post a job.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    try {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + parseInt(formData.expires_days || '7'));

      const { error } = await supabase.from('jobs').insert({
        title: formData.title,
        description: formData.description,
        conditions: formData.conditions || null,
        location: formData.location || null,
        max_applications: formData.max_applications ? parseInt(formData.max_applications) : null,
        expires_at: expiresAt.toISOString(),
        creator_id: formData.creator_mobile,
        status: 'open',
      });

      if (error) throw error;

      toast({
        title: 'Job Posted!',
        description: 'Your job listing has been created successfully.',
      });

      setFormData({
        title: '',
        description: '',
        conditions: '',
        location: '',
        max_applications: '',
        expires_days: '7',
        creator_mobile: '',
      });
      setOpen(false);
      onJobCreated();
    } catch (error) {
      console.error('Error creating job:', error);
      toast({
        title: 'Error',
        description: 'Failed to create job. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="bg-gradient-to-r from-orange-500 to-green-500 hover:from-orange-600 hover:to-green-600 text-white gap-1">
          <Plus className="h-4 w-4" />
          Post Job
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Briefcase className="h-5 w-5 text-orange-500" />
            Create New Job
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="creator_mobile">Your Mobile Number *</Label>
            <Input
              id="creator_mobile"
              value={formData.creator_mobile}
              onChange={(e) => setFormData((prev) => ({ ...prev, creator_mobile: e.target.value }))}
              placeholder="Enter your 10-digit mobile"
              maxLength={10}
              required
            />
          </div>
          <div>
            <Label htmlFor="title">Job Title *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
              placeholder="e.g., Driver, Helper, Cook"
              required
            />
          </div>
          <div>
            <Label htmlFor="description">Description *</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
              placeholder="Describe the job requirements"
              rows={3}
              required
            />
          </div>
          <div>
            <Label htmlFor="conditions">Requirements</Label>
            <Textarea
              id="conditions"
              value={formData.conditions}
              onChange={(e) => setFormData((prev) => ({ ...prev, conditions: e.target.value }))}
              placeholder="Any specific requirements"
              rows={2}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="location" className="flex items-center gap-1">
                <MapPin className="h-3 w-3" /> Location
              </Label>
              <Input
                id="location"
                value={formData.location}
                onChange={(e) => setFormData((prev) => ({ ...prev, location: e.target.value }))}
                placeholder="Job location"
              />
            </div>
            <div>
              <Label htmlFor="max_applications" className="flex items-center gap-1">
                <Hash className="h-3 w-3" /> Max Applicants
              </Label>
              <Input
                id="max_applications"
                type="number"
                value={formData.max_applications}
                onChange={(e) => setFormData((prev) => ({ ...prev, max_applications: e.target.value }))}
                placeholder="Unlimited"
                min="1"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="expires_days" className="flex items-center gap-1">
              <Calendar className="h-3 w-3" /> Expires in (days)
            </Label>
            <Input
              id="expires_days"
              type="number"
              value={formData.expires_days}
              onChange={(e) => setFormData((prev) => ({ ...prev, expires_days: e.target.value }))}
              placeholder="7"
              min="1"
              max="30"
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Posting...' : 'Post Job'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Inline JobCard for this section
function JobCardInline({ job, onUpdate }: { job: JobData; onUpdate: () => void }) {
  const [applyOpen, setApplyOpen] = useState(false);
  const [applying, setApplying] = useState(false);
  const [applicantData, setApplicantData] = useState({
    name: '',
    mobile: '',
    message: '',
  });

  const isExpired = job.expires_at && new Date(job.expires_at) < new Date();
  const isClosed = job.status === 'closed' || isExpired;

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!applicantData.name || !applicantData.mobile) {
      toast({
        title: 'Missing Information',
        description: 'Please enter your name and mobile number.',
        variant: 'destructive',
      });
      return;
    }

    setApplying(true);

    try {
      const { error } = await supabase.from('job_applications').insert({
        job_id: job.id,
        applicant_id: applicantData.mobile,
        message: `Name: ${applicantData.name}\n${applicantData.message || ''}`,
      });

      if (error) {
        if (error.code === '23505') {
          toast({
            title: 'Already Applied',
            description: 'You have already applied to this job.',
            variant: 'destructive',
          });
          return;
        }
        throw error;
      }

      toast({
        title: 'Application Submitted!',
        description: 'Your application has been sent.',
      });

      setApplicantData({ name: '', mobile: '', message: '' });
      setApplyOpen(false);
      onUpdate();
    } catch (error) {
      console.error('Error applying:', error);
      toast({
        title: 'Error',
        description: 'Failed to submit application.',
        variant: 'destructive',
      });
    } finally {
      setApplying(false);
    }
  };

  return (
    <Card className="bg-white shadow-md hover:shadow-lg transition-all border-slate-200">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <CardTitle className="text-base font-semibold text-slate-800">
            {job.title}
          </CardTitle>
          <Badge 
            variant={isClosed ? 'secondary' : 'default'}
            className={isClosed ? 'bg-red-100 text-red-600 text-xs' : 'bg-green-100 text-green-600 text-xs'}
          >
            {isClosed ? 'Closed' : 'Open'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 pt-0">
        <p className="text-slate-600 text-sm line-clamp-2">{job.description}</p>
        
        {job.conditions && (
          <p className="text-xs text-slate-500">
            <span className="font-medium">Requirements: </span>
            {job.conditions}
          </p>
        )}

        <div className="flex flex-wrap gap-2 text-xs text-slate-500">
          {job.location && (
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {job.location}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {formatDistanceToNow(new Date(job.created_at), { addSuffix: true })}
          </span>
          {job.application_count !== undefined && (
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              {job.application_count} applied
            </span>
          )}
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
          <span className="flex items-center gap-1 text-xs text-slate-400">
            <Phone className="h-3 w-3" />
            {job.creator_id}
          </span>

          {!isClosed && (
            <Dialog open={applyOpen} onOpenChange={setApplyOpen}>
              <DialogTrigger asChild>
                <Button 
                  size="sm"
                  className="bg-gradient-to-r from-orange-500 to-green-500 hover:from-orange-600 hover:to-green-600 text-xs h-8"
                >
                  <Send className="h-3 w-3 mr-1" />
                  Apply
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Apply for {job.title}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleApply} className="space-y-4">
                  <div>
                    <Label htmlFor="applicant_name" className="flex items-center gap-1">
                      <User className="h-3 w-3" /> Your Name *
                    </Label>
                    <Input
                      id="applicant_name"
                      value={applicantData.name}
                      onChange={(e) => setApplicantData(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Enter your full name"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="applicant_mobile" className="flex items-center gap-1">
                      <Phone className="h-3 w-3" /> Mobile Number *
                    </Label>
                    <Input
                      id="applicant_mobile"
                      value={applicantData.mobile}
                      onChange={(e) => setApplicantData(prev => ({ ...prev, mobile: e.target.value }))}
                      placeholder="Enter your 10-digit mobile"
                      maxLength={10}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="applicant_message">Message (Optional)</Label>
                    <Textarea
                      id="applicant_message"
                      value={applicantData.message}
                      onChange={(e) => setApplicantData(prev => ({ ...prev, message: e.target.value }))}
                      placeholder="Why are you interested?"
                      rows={2}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={applying}>
                    {applying ? 'Submitting...' : 'Submit Application'}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function JobsSection() {
  const [jobs, setJobs] = useState<JobData[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  const fetchJobs = async () => {
    setLoading(true);
    try {
      // Auto-close expired jobs
      await supabase
        .from('jobs')
        .update({ status: 'closed' })
        .eq('status', 'open')
        .lt('expires_at', new Date().toISOString())
        .not('expires_at', 'is', null);

      // Fetch all jobs
      const { data, error } = await supabase
        .from('jobs')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get application counts
      const jobsWithCounts = await Promise.all(
        (data || []).map(async (job) => {
          const { count } = await supabase
            .from('job_applications')
            .select('*', { count: 'exact', head: true })
            .eq('job_id', job.id);

          return {
            ...job,
            application_count: count || 0,
          };
        })
      );

      setJobs(jobsWithCounts);
    } catch (error) {
      console.error('Error fetching jobs:', error);
      toast({
        title: 'Error',
        description: 'Failed to load jobs.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, []);

  const displayedJobs = expanded ? jobs : jobs.slice(0, 3);
  const openJobs = jobs.filter(j => j.status === 'open');

  return (
    <Card className="bg-white/80 backdrop-blur-sm shadow-lg border-0 mt-8">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-slate-800">
            <Briefcase className="h-5 w-5 text-orange-500" />
            Jobs
            {openJobs.length > 0 && (
              <span className="text-sm font-normal text-slate-500">
                ({openJobs.length} open)
              </span>
            )}
          </CardTitle>
          <CreateJobDialogInline onJobCreated={fetchJobs} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          Array(2).fill(0).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full rounded-lg" />
          ))
        ) : jobs.length > 0 ? (
          <>
            {displayedJobs.map((job) => (
              <JobCardInline key={job.id} job={job} onUpdate={fetchJobs} />
            ))}
            {jobs.length > 3 && (
              <Button 
                variant="ghost" 
                className="w-full text-slate-600"
                onClick={() => setExpanded(!expanded)}
              >
                {expanded ? (
                  <>
                    <ChevronUp className="h-4 w-4 mr-2" />
                    Show Less
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-4 w-4 mr-2" />
                    Show All ({jobs.length} jobs)
                  </>
                )}
              </Button>
            )}
          </>
        ) : (
          <div className="text-center py-8">
            <Briefcase className="h-12 w-12 mx-auto text-slate-300 mb-3" />
            <p className="text-slate-500">No jobs posted yet</p>
            <p className="text-sm text-slate-400 mt-1">
              Be the first to post a job!
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
