/**
 * Temporary typographic wordmark. No approved logo asset exists yet, so this
 * is a placeholder, not a final logo. Replace when the client supplies one.
 */
type WordmarkProps = {
  className?: string;
  as?: "span" | "div";
  tone?: "default" | "inverse";
};

export function Wordmark({
  className = "",
  as: Tag = "span",
  tone = "default",
}: WordmarkProps) {
  const baseText = tone === "inverse" ? "text-cream" : "text-foreground";
  const accentText = tone === "inverse" ? "text-saffron" : "text-highlight-ink";

  return (
    <Tag
      className={`font-heading text-2xl font-extrabold tracking-tight drop-shadow-[0_1px_0_rgba(23,58,145,0.08)] ${baseText} ${className}`.trim()}
    >
      Dairy<span className={accentText}>buy</span>
    </Tag>
  );
}
