import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background px-4 text-center">
      <p className="text-6xl font-extrabold text-brand-600">404</p>
      <h1 className="text-lg font-extrabold">Page not found</h1>
      <p className="text-sm text-muted-foreground">That shelf is empty — let's get you back.</p>
      <Link to="/dashboard">
        <Button>Back to dashboard</Button>
      </Link>
    </div>
  );
}
