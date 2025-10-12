import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface QuickActionButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ReactNode;
  label: string;
  description?: string;
}

export function QuickActionButton({
  icon,
  label,
  description,
  className,
  ...props
}: QuickActionButtonProps) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex flex-col items-center justify-center rounded-md border border-input bg-background p-4 text-sm font-medium ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
        className
      )}
      {...props}
    >
      <div className="mb-2">{icon}</div>
      <div className="text-sm font-medium">{label}</div>
      {description && (
        <div className="mt-1 text-xs text-muted-foreground">{description}</div>
      )}
    </button>
  );
}
