import { useState } from "react";
import { Mail, Lock, ArrowRight, Shield } from "lucide-react";
import solaceBanner from "@/assets/solace-banner.jpg";

const SignInPage = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);

  const handleSignIn = (e: React.FormEvent) => {
    e.preventDefault();
    // Sign in logic will be implemented with Lovable Cloud
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-start pt-4 px-4">
      {/* Banner */}
      <div className="w-full max-w-md overflow-hidden rounded-xl mb-6">
        <img
          src={solaceBanner}
          alt="Solace Banner"
          className="w-full h-auto object-cover"
          width={1024}
          height={512}
        />
      </div>

      {/* Sign In Card */}
      <div className="w-full max-w-md border border-border rounded-2xl p-8 bg-card animate-slide-up">
        <h2 className="text-2xl font-bold text-primary text-center mb-6">Sign In</h2>

        {/* Social Buttons */}
        <button className="w-full flex items-center justify-center gap-3 py-3 border border-border rounded-lg text-primary hover:bg-secondary transition-colors mb-3">
          <span className="text-lg font-bold" style={{ color: '#4285F4' }}>G</span>
          Continue with Google
        </button>
        <button className="w-full flex items-center justify-center gap-3 py-3 border border-border rounded-lg text-primary hover:bg-secondary transition-colors mb-4">
          <span className="text-lg">🍎</span>
          Continue with Apple
        </button>

        {/* Divider */}
        <div className="flex items-center gap-4 mb-4">
          <div className="flex-1 h-px bg-border" />
          <span className="text-muted-foreground text-xs">OR</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        {/* Form */}
        <form onSubmit={handleSignIn} className="space-y-4">
          <div>
            <label className="text-muted-foreground text-sm mb-1 block">Email</label>
            <div className="flex items-center gap-3 border border-border rounded-lg px-4 py-3 bg-input">
              <Mail className="w-4 h-4 text-muted-foreground" />
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-transparent text-foreground placeholder:text-muted-foreground outline-none flex-1 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="text-muted-foreground text-sm mb-1 block">Password</label>
            <div className="flex items-center gap-3 border border-border rounded-lg px-4 py-3 bg-input">
              <Lock className="w-4 h-4 text-muted-foreground" />
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-transparent text-foreground placeholder:text-muted-foreground outline-none flex-1 text-sm"
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-muted-foreground text-sm cursor-pointer">
              <button
                type="button"
                onClick={() => setRememberMe(!rememberMe)}
                className={`w-4 h-4 rounded-full border-2 transition-colors ${
                  rememberMe ? "bg-primary border-primary" : "border-border"
                }`}
              />
              Remember me
            </label>
            <span className="text-primary text-xs flex items-center gap-1">
              <Shield className="w-3 h-3" /> Secure login
            </span>
          </div>

          <button
            type="submit"
            className="w-full py-4 bg-primary text-primary-foreground font-bold rounded-lg flex items-center justify-center gap-2 hover:brightness-110 transition-all"
          >
            Sign In <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <p className="text-center text-muted-foreground text-sm mt-4">
          New here?{" "}
          <span className="text-primary cursor-pointer hover:underline">Create an account</span>
        </p>

        {/* Anti-hacker badge */}
        <div className="flex justify-center mt-4">
          <div className="flex items-center gap-2 px-4 py-2 rounded-full border text-xs" style={{ borderColor: 'hsl(160, 84%, 39%)', color: 'hsl(160, 84%, 39%)' }}>
            <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: 'hsl(160, 84%, 39%)' }} />
            AI ANTI-HACKER ACTIVE
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: 'hsl(160, 84%, 39%)' }} />
          </div>
        </div>
      </div>

      <p className="text-muted-foreground text-xs mt-4 mb-8">
        By continuing, you agree to our{" "}
        <span className="text-primary cursor-pointer">Terms of Service</span>
      </p>
    </div>
  );
};

export default SignInPage;
