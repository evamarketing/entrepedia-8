import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { Share2, MessageCircle } from 'lucide-react';
import { JobsSection } from '@/components/jobs/JobsSection';

const Index = () => {
  const navigate = useNavigate();
  const [mobileNumber, setMobileNumber] = useState('');
  const [generatedLink, setGeneratedLink] = useState('');

  const generateReferralLink = () => {
    if (!mobileNumber || mobileNumber.length < 10) {
      toast({
        title: "Invalid Mobile Number",
        description: "Please enter a valid 10-digit mobile number.",
        variant: "destructive"
      });
      return;
    }
    const baseUrl = window.location.origin;
    const link = `${baseUrl}/quiz?ref=${mobileNumber}`;
    setGeneratedLink(link);
    toast({
      title: "Referral Link Generated!",
      description: "Share this link to invite others to participate."
    });
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(generatedLink);
      toast({
        title: "Link Copied!",
        description: "Referral link has been copied to clipboard."
      });
    } catch (error) {
      toast({
        title: "Copy Failed",
        description: "Please copy the link manually.",
        variant: "destructive"
      });
    }
  };

  const shareOnWhatsApp = () => {
    if (!generatedLink) {
      toast({
        title: "No Link Generated",
        description: "Please generate a share link first.",
        variant: "destructive"
      });
      return;
    }

    const message = `🇮🇳 ഇ-ലൈഫ് സൊസൈറ്റി സ്വാതന്ത്ര്യ ദിന ക്വിസ് മത്സരത്തിൽ പങ്കെടുക്കൂ! 

📝 നിങ്ങളുടെ അറിവ് പരീക്ഷിക്കാനുള്ള അവസരം
🏆 മികച്ച പ്രകടനത്തിന് സമ്മാനങ്ങൾ
⏰ ഇപ്പോൾ തന്നെ പങ്കെടുക്കൂ!

${generatedLink}

#IndependenceDay #Quiz #ELifeSociety`;

    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
    
    toast({
      title: "WhatsApp Opened!",
      description: "Share the quiz link with your friends."
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-green-50">
      {/* Navigation */}
      <nav className="bg-white/90 backdrop-blur-sm border-b shadow-sm">
        <div className="container mx-auto px-4 py-3">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-5 bg-gradient-to-r from-orange-500 via-white to-green-500 rounded-sm border"></div>
              <h1 className="text-xl font-bold text-slate-800">ഇ-ലൈഫ് സൊസൈറ്റി</h1>
            </div>
            <div className="flex items-center space-x-2 text-sm">
              <span className="bg-orange-100 px-3 py-1 rounded-full">0</span>
              <span className="text-slate-600">അഡ്മിൻ</span>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="py-12 px-4">
        <div className="container mx-auto max-w-2xl text-center">
          {/* Indian Flag Emblem */}
          <div className="mb-6 flex justify-center">
            <div className="relative">
              <div className="w-20 h-20 rounded-full bg-gradient-to-b from-orange-500 via-white to-green-500 border-4 border-blue-600 flex items-center justify-center">
                <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center">
                  <div className="w-6 h-6 bg-white rounded-full"></div>
                </div>
              </div>
            </div>
          </div>

          {/* Main Title */}
          <div className="mb-6">
            <h2 className="text-3xl md:text-4xl font-bold mb-3">
              <span className="text-orange-600">ഇ ലൈഫ് സൊസൈറ്റി</span>{' '}
              <span className="text-green-600 font-bold text-2xl block mt-1">ചോദ്യോത്തര മത്സരം</span>
            </h2>
            <p className="text-base text-slate-600 mb-6">
              നിങ്ങളുടെ അറിവ് പരീക്ഷിക്കാനുള്ള സമയമായി
            </p>
          </div>

          {/* Main Quiz Button */}
          <div className="mb-8">
            <Button 
              onClick={() => navigate('/quiz')} 
              size="lg" 
              className="text-lg px-10 py-5 bg-gradient-to-r from-orange-500 to-green-500 hover:from-orange-600 hover:to-green-600 text-white font-semibold rounded-xl shadow-lg transform hover:scale-105 transition-all duration-200"
            >
              ചോദ്യങ്ങൾ
            </Button>
          </div>

          {/* Share Link Section */}
          <Card className="max-w-md mx-auto bg-white/80 backdrop-blur-sm shadow-lg">
            <CardContent className="p-5">
              <div className="flex items-center justify-center mb-3">
                <Share2 className="h-4 w-4 text-slate-600 mr-2" />
                <h3 className="font-semibold text-slate-700 text-xs">
                  ഇവിടെ നിങ്ങളുടെ നമ്പർ കൊടുത്താൽ നിങ്ങളുടെ പേരിലുള്ള ലിങ്ക് കിട്ടും
                </h3>
              </div>
              
              <div className="space-y-3">
                <div>
                  <Label htmlFor="mobile" className="text-slate-700 font-medium text-sm">Your Mobile Number</Label>
                  <Input 
                    id="mobile" 
                    value={mobileNumber} 
                    onChange={e => setMobileNumber(e.target.value)} 
                    placeholder="Enter 10-digit mobile number" 
                    maxLength={10} 
                    className="mt-1.5 border-slate-300 focus:border-blue-500" 
                  />
                </div>
                
                <Button 
                  onClick={generateReferralLink} 
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-lg"
                >
                  Generate Share Link
                </Button>
                
                {generatedLink && (
                  <div className="space-y-2 pt-2 border-t border-slate-200">
                    <div className="flex space-x-2">
                      <Input value={generatedLink} readOnly className="flex-1 text-xs" />
                      <Button onClick={copyToClipboard} variant="outline" size="sm">
                        Copy
                      </Button>
                    </div>
                    
                    <Button 
                      onClick={shareOnWhatsApp} 
                      className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-2 rounded-lg"
                    >
                      <MessageCircle className="h-4 w-4 mr-2" />
                      Share on WhatsApp
                    </Button>
                    
                    <p className="text-xs text-slate-500 text-center">
                      Share this link with friends and family!
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Jobs Section */}
          <div className="max-w-md mx-auto">
            <JobsSection />
          </div>

          {/* Admin Access */}
          <div className="mt-8">
            <Button 
              onClick={() => navigate('/admin-login')} 
              variant="ghost" 
              className="text-slate-500 hover:text-slate-700"
            >
              Admin Panel
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-5 px-4 bg-gradient-to-r from-orange-500 to-green-500">
        <div className="container mx-auto text-center">
          <p className="text-base font-semibold text-white">സ്വാതന്ത്ര്യ ദിന ക്വിസ് മത്സരം 2024</p>
          <p className="mt-1 text-white/90 text-sm">77 വർഷത്തെ സ്വാതന്ത്ര്യം ആഘോഷിക്കുന്നു 🇮🇳</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
