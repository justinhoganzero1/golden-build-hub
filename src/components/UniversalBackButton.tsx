import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface UniversalBackButtonProps {
  label?: string;
}

const UniversalBackButton = ({ label = "Back" }: UniversalBackButtonProps) => {
  const navigate = useNavigate();

  return (
    <button
      onClick={() => navigate(-1)}
      className="flex items-center gap-2 text-primary hover:text-foreground transition-colors mb-4"
    >
      <ArrowLeft className="w-5 h-5" />
      <span className="text-sm font-medium">{label}</span>
    </button>
  );
};

export default UniversalBackButton;
