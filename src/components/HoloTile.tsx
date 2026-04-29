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
  const bubbleSize = compact ? "w-12 h-12" : "w-20 h-20 sm:w-24 sm:h-24";

  const content = (
    <>
      {/* Bubble / icon */}
      <div className={`relative ${bubbleSize} flex items-center justify-center holo-float shrink-0`}>
        {bubbleSrc ? (
          <img
            src={bubbleSrc}
            alt=""
            width={compact ? 48 : 96}
            height={compact ? 48 : 96}
            loading="lazy"
            className="w-full h-full object-contain drop-shadow-[0_8px_20px_rgba(140,70,255,0.45)]"
          />
        ) : (
          <div className="holo-bubble w-full h-full flex items-center justify-center">
            <div className="relative z-10 text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]">
              {icon}
            </div>
          </div>
        )}
      </div>

      {/* Text block */}
      <div className={`flex-1 min-w-0 ${compact ? "" : "text-center mt-3"}`}>
        <div className="flex items-center gap-2 justify-center">
          <h3 className={`font-bold text-foreground truncate ${compact ? "text-sm" : "text-base"}`}>
            {title}
          </h3>
          {badge && (
            <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
              {badge}
            </span>
          )}
        </div>
        {subtitle && (
          <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{subtitle}</p>
        )}
        {children}
      </div>
    </>
  );

  const baseClasses = `holo-card p-4 ${compact ? "flex items-center gap-3" : "flex flex-col items-center"} ${
    disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
  } ${className}`;

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
