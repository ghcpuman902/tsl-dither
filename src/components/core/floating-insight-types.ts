export type FloatingInsightView = "card" | "circle" | "expanded";

export type FloatingInsightContent = {
  eyebrow?: string;
  title: string;
  subtitle: string;
  cardPreview: string;
  expandedMarkdown: string;
};

export type FloatingInsightCardProps = {
  content: FloatingInsightContent;
  className?: string;
  defaultView?: FloatingInsightView;
  positionClassName?: string;
};
