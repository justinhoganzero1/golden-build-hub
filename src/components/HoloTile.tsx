// HoloTile — universal holographic tile/card with iridescent oil-slick edge
// glow, sweeping sheen on hover, and optional bubble icon. Drop-in replacement
// for any module tile or card across the app.
import { ReactNode } from "react";

interface HoloTileProps {
  /** Bubble image URL (generated 3D iridescent orb). Optional — falls back to icon. */
  bubbleSrc?: string;
  /** Lucide icon (or any ReactNode) shown when no bubbleSrc */
  icon?: ReactNode;
  /** Tile title */
  title: string;
  /** Optional small subtitle / description */
  subtitle?: string;
  /** Click handler */
  onClick?: () => void;
  /** Render as a link instead — pass href */
  href?: string;
  /** Compact mode: smaller bubble, single line */
  compact?: boolean;
  /** Disabled (locked) state */
  disabled?: boolean;
  /** Custom className overrides */
  className?: string;
  /** Optional badge (e.g. "Pro", "New", "Locked") */
  badge?: string;
  /** Children rendered after the text block */
  children?: ReactNode;
}

// Hash a string to a stable 0/1 so each tile picks a consistent rim variant
const variantFor = (s: string): "gold" | "violet" => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h) % 2 === 0 ? "gold" : "violet";
};

const HoloTile = ({
  bubbleSrc,
  icon,
  title,
  subtitle,
  onClick,
  href,
  compact = false,
  disabled = false,
  className = "",
  badge,
  children,
}: HoloTileProps) => {
  const bubbleSize = compact ? "w-14 h-14" : "w-16 h-16 sm:w-20 sm:h-20";
  const variant = variantFor(title);

  const content = (
    <>
      {/* Bubble / icon — centered, big, glowing like the chiclet icons */}
      <div className={`relative ${bubbleSize} flex items-center justify-center holo-float shrink-0`}>
        {bubbleSrc ? (
          <img
            src={bubbleSrc}
            alt=""
            width={compact ? 56 : 80}
            height={compact ? 56 : 80}
            loading="lazy"
            className={`w-full h-full object-contain ${
              variant === "gold"
                ? "drop-shadow-[0_4px_14px_rgba(255,190,80,0.55)]"
                : "drop-shadow-[0_4px_14px_rgba(170,90,255,0.55)]"
            }`}
          />
        ) : (
          <div className="holo-bubble w-full h-full flex items-center justify-center">
            <div className="relative z-10 text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.7)]">
              {icon}
            </div>
          </div>
        )}
      </div>

      {/* Label — small, centered under the icon, like Oracle/Movie/Photo/Voice */}
      <div className={`flex-1 min-w-0 ${compact ? "" : "text-center mt-2"}`}>
        <div className="flex items-center gap-2 justify-center">
          <h3
            className={`font-semibold truncate ${
              compact ? "text-sm" : "text-sm sm:text-base"
            } ${variant === "gold" ? "text-amber-100" : "text-violet-100"}`}
            style={{ textShadow: "0 1px 6px rgba(0,0,0,0.8)" }}
          >
            {title}
          </h3>
          {badge && (
            <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
              {badge}
            </span>
          )}
        </div>
        {subtitle && (
          <p className="text-[11px] text-muted-foreground/80 line-clamp-2 mt-0.5">{subtitle}</p>
        )}
        {children}
      </div>
    </>
  );

  const baseClasses = `holo-card ${variant === "violet" ? "holo-violet" : ""} ${
    compact ? "p-3 flex items-center gap-3" : "p-4 sm:p-5 flex flex-col items-center justify-center aspect-square"
  } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"} ${className}`;

  if (href && !disabled) {
    return (
      <a href={href} className={baseClasses}>
        {content}
      </a>
    );
  }

  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className={`${baseClasses} text-left w-full`}
    >
      {content}
    </button>
  );
};

export default HoloTile;
