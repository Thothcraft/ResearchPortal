import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ExternalLink } from "lucide-react";

interface ResourceLink {
  title: string;
  href: string;
  description: string;
}

interface ResourceLinksProps {
  title?: string;
  links: ResourceLink[];
  className?: string;
}

export function ResourceLinks({
  title = "Resources",
  links,
  className,
}: ResourceLinksProps) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {links.map((link) => (
          <div key={link.href} className="flex items-center justify-between">
            <div className="space-y-1">
              <h3 className="text-sm font-medium">{link.title}</h3>
              <p className="text-sm text-muted-foreground">
                {link.description}
              </p>
            </div>
            <Link 
              href={link.href} 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex h-10 w-10 items-center justify-center rounded-md text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
            >
              <ExternalLink className="h-4 w-4" />
              <span className="sr-only">Open {link.title}</span>
            </Link>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
