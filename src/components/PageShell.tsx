import { ReactNode } from "react";
import UniversalBackButton from "./UniversalBackButton";

interface PageShellProps {
  title: string;
  subtitle?: string;
  children?: ReactNode;
  icon?: ReactNode;
}

const PageShell = ({ title, subtitle, children, icon }: PageShellProps) => {
  return (
    <div className="min-h-screen bg-background p-4 max-w-2xl mx-auto">
      <UniversalBackButton />
      <div className="flex items-center gap-3 mb-6">
        {icon && <div className="text-primary">{icon}</div>}
        <div>
          <h1 className="text-2xl font-bold text-primary">{title}</h1>
          {subtitle && <p className="text-muted-foreground text-sm">{subtitle}</p>}
        </div>
      </div>
      {children || (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mb-4">
            {icon || <span className="text-2xl">🚧</span>}
          </div>
          <p className="text-muted-foreground">Coming soon</p>
        </div>
      )}
    </div>
  );
};

export default PageShell;
