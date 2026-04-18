import { ReactNode } from "react";
import { useSiteContent } from "@/hooks/useSiteContent";

/**
 * <EditableText page="landing" slot="hero_title" fallback="Welcome to SOLACE" />
 * Renders the latest DB value (or the hardcoded fallback if none set).
 * Admin edits via /admin/editor update this live for everyone.
 */
export const EditableText = ({
  page,
  slot,
  fallback,
  as: Tag = "span",
  className,
}: {
  page: string;
  slot: string;
  fallback: string;
  as?: keyof JSX.IntrinsicElements;
  className?: string;
}) => {
  const { get } = useSiteContent();
  const value = get(page, slot, fallback);
  return <Tag className={className}>{value as ReactNode}</Tag>;
};

export const EditableImage = ({
  page,
  slot,
  fallback,
  alt,
  className,
}: {
  page: string;
  slot: string;
  fallback: string;
  alt: string;
  className?: string;
}) => {
  const { get } = useSiteContent();
  const src = get(page, slot, fallback);
  return <img src={src} alt={alt} className={className} loading="lazy" />;
};
