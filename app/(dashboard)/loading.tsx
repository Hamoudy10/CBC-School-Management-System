import { RouteLoading } from "@/components/ui/RouteLoading";

export default function DashboardLoading() {
  return (
    <RouteLoading
      label="Loading workspace..."
      hint="Keeping the dashboard shell active while the next module compiles and streams in."
    />
  );
}
