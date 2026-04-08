import { Shield, Heart, Sparkles, Globe, Lock, Users } from "lucide-react";
import UniversalBackButton from "@/components/UniversalBackButton";
import { useNavigate } from "react-router-dom";

const AboutPage = () => {
  const navigate = useNavigate();

  const features = [
    { icon: <Sparkles className="w-5 h-5" />, title: "AI-Powered", desc: "40+ AI tools for creativity, productivity, and wellness" },
    { icon: <Shield className="w-5 h-5" />, title: "Maximum Security", desc: "101 AI security guards protecting your data 24/7" },
    { icon: <Heart className="w-5 h-5" />, title: "Wellness First", desc: "Mental health support, crisis resources, and diagnostics" },
    { icon: <Globe className="w-5 h-5" />, title: "Universal Access", desc: "Multi-language support and elderly-friendly design" },
    { icon: <Lock className="w-5 h-5" />, title: "Private Vault", desc: "Encrypted storage for your most sensitive files" },
    { icon: <Users className="w-5 h-5" />, title: "Family Hub", desc: "Connect and protect your loved ones" },
  ];

  return (
    <div className="min-h-screen bg-background pb-20">
      <UniversalBackButton />
      <div className="px-4 pt-14 pb-4 max-w-3xl mx-auto">
        {/* App Identity */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary via-purple-500 to-blue-500 flex items-center justify-center mx-auto mb-4 shadow-lg">
            <Shield className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-primary">Solace</h1>
          <p className="text-muted-foreground text-sm mt-1">Your AI Companion For Everything</p>
          <p className="text-xs text-muted-foreground mt-1">Version 1.0.0</p>
        </div>

        {/* Description */}
        <div className="bg-card border border-border rounded-xl p-4 mb-6">
          <h2 className="text-lg font-semibold text-primary mb-2">About Solace</h2>
          <p className="text-sm text-foreground leading-relaxed">
            Solace is the world's most secure AI-powered super app, designed to be your all-in-one digital companion. 
            From creative tools like AI art generation and video editing, to safety features including crisis support 
            and real-time threat detection — Solace puts the power of 40+ specialized AI tools in your pocket.
          </p>
          <p className="text-sm text-foreground leading-relaxed mt-3">
            Protected by 101 dedicated AI security systems, Solace sets a new standard in mobile app security. 
            Whether you're managing your health, creating stunning media, learning new skills, or keeping your 
            family safe, Solace is built to help you thrive in every aspect of life.
          </p>
        </div>

        {/* Key Features */}
        <h2 className="text-lg font-semibold text-primary mb-3">Key Features</h2>
        <div className="grid grid-cols-2 gap-3 mb-6">
          {features.map((f) => (
            <div key={f.title} className="bg-card border border-border rounded-xl p-3">
              <div className="text-primary mb-2">{f.icon}</div>
              <h3 className="text-sm font-semibold text-foreground">{f.title}</h3>
              <p className="text-xs text-muted-foreground mt-1">{f.desc}</p>
            </div>
          ))}
        </div>

        {/* Legal Links */}
        <div className="bg-card border border-border rounded-xl overflow-hidden divide-y divide-border mb-6">
          <button onClick={() => navigate("/privacy-policy")} className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-secondary/50 transition-colors text-left">
            <span className="text-sm text-foreground">Privacy Policy</span>
            <span className="text-xs text-muted-foreground">→</span>
          </button>
          <button onClick={() => navigate("/terms-of-service")} className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-secondary/50 transition-colors text-left">
            <span className="text-sm text-foreground">Terms of Service</span>
            <span className="text-xs text-muted-foreground">→</span>
          </button>
        </div>

        {/* Credits */}
        <div className="text-center text-xs text-muted-foreground space-y-1">
          <p>Built with ❤️ by Solace AI</p>
          <p>© {new Date().getFullYear()} Solace AI. All rights reserved.</p>
          <p className="mt-2">Powered by advanced AI technology</p>
          <p>support@solace-ai.app</p>
        </div>
      </div>
    </div>
  );
};

export default AboutPage;
