"use client";

import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const swatches = [
  { name: "Primary", className: "bg-primary" },
  { name: "Success", className: "bg-success" },
  { name: "Warning", className: "bg-warning" },
  { name: "Error", className: "bg-destructive" },
  { name: "Muted", className: "bg-muted" },
  { name: "Border", className: "bg-border" },
];

export default function HelloWorldPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <CardTitle className="text-2xl">Hello World</CardTitle>
              <CardDescription>
                Switch between light and dark mode.
              </CardDescription>
            </div>
            <ThemeToggle />
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="grid grid-cols-3 gap-3">
            {swatches.map((swatch) => (
              <div key={swatch.name} className="space-y-1.5">
                <div
                  className={`h-10 rounded-md border border-border ${swatch.className}`}
                />
                <p className="text-xs text-muted-foreground">
                  {swatch.name}
                </p>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-primary-soft px-2.5 py-1 text-xs font-medium text-primary">
              AI draft
            </span>
            <span className="rounded-full bg-success-soft px-2.5 py-1 text-xs font-medium text-success">
              Approved
            </span>
            <span className="rounded-full bg-warning-soft px-2.5 py-1 text-xs font-medium text-warning">
              Pending
            </span>
            <span className="rounded-full bg-destructive-soft px-2.5 py-1 text-xs font-medium text-destructive">
              Failed
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button>Primary action</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline">Outline</Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}