import { BarChart3, Briefcase, FileText, TrendingUp, Users, Calendar } from "lucide-react";
import UniversalBackButton from "@/components/UniversalBackButton";
const tools = [{ icon: <Briefcase className="w-5 h-5" />, title: "Resume Builder", desc: "AI-powered resume creation" },{ icon: <FileText className="w-5 h-5" />, title: "Cover Letter", desc: "Generate tailored cover letters" },{ icon: <Users className="w-5 h-5" />, title: "Interview Prep", desc: "Practice with AI interviewer" },{ icon: <Calendar className="w-5 h-5" />, title: "Career Planner", desc: "Map your career trajectory" },{ icon: <TrendingUp className="w-5 h-5" />, title: "Salary Insights", desc: "Market salary data and trends" }];
const ProfessionalHubPage = () => (
  <div className="min-h-screen bg-background pb-20">
    <UniversalBackButton />
    <div className="px-4 pt-14 pb-4">
      <div className="flex items-center gap-3 mb-4"><div className="p-2 rounded-xl bg-primary/10"><BarChart3 className="w-7 h-7 text-primary" /></div><div><h1 className="text-xl font-bold text-primary">Professional Hub</h1><p className="text-muted-foreground text-xs">Career & business tools</p></div></div>
      <div className="space-y-3">{tools.map(t => (<button key={t.title} className="w-full bg-card border border-border rounded-xl p-4 flex items-center gap-4 hover:border-primary transition-colors text-left"><div className="p-2 rounded-lg bg-primary/10 text-primary">{t.icon}</div><div><h3 className="text-sm font-semibold text-foreground">{t.title}</h3><p className="text-xs text-muted-foreground">{t.desc}</p></div></button>))}</div>
    </div>
  </div>
);
export default ProfessionalHubPage;
