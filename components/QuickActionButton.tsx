import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface BaseProps {
  icon: React.ReactNode;
  label: string;
  description?: string;
  color?: string;
  className?: string;
}

type ButtonProps = BaseProps & {
  href?: never;
  onClick?: () => void;
} & React.ButtonHTMLAttributes<HTMLButtonElement>;

type LinkProps = BaseProps & {
  href: string;
  onClick?: never;
} & React.AnchorHTMLAttributes<HTMLAnchorElement>;

type QuickActionButtonProps = ButtonProps | LinkProps;

export function QuickActionButton({
  icon,
  label,
  description,
  color = 'primary',
  className,
  href,
  ...props
}: QuickActionButtonProps) {
  const content = (
    <>
      <div className={`p-3 rounded-full ${getColorClasses(color)} mb-2`}>
        {icon}
      </div>
      <span className="font-medium">{label}</span>
      {description && (
        <span className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          {description}
        </span>
      )}
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className={cn(
          "flex flex-col items-center justify-center p-4 rounded-lg border border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors",
          className
        )}
        {...props as React.AnchorHTMLAttributes<HTMLAnchorElement>}
      >
        {content}
      </Link>
    );
  }

  return (
    <button
      type="button"
      className={cn(
        "flex flex-col items-center justify-center p-4 rounded-lg border border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors w-full",
        className
      )}
      {...props as React.ButtonHTMLAttributes<HTMLButtonElement>}
    >
      {content}
    </button>
  );
}

function getColorClasses(color: string): string {
  const colorMap: Record<string, string> = {
    primary: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
    green: 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400',
    red: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
    yellow: 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400',
    purple: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
    default: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  };
  return colorMap[color] || colorMap.default;
}
