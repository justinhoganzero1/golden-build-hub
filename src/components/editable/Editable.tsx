import { createElement, ReactNode } from "react";
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
  as = "span",
  className,
}: {
  page: string;
  slot: string;
  fallback: string;
  as?: string;
  className?: string;
}) => {
  const { get } = useSiteContent();
  const value = get(page, slot, fallback);
  return createElement(as, { className }, value as ReactNode);
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
