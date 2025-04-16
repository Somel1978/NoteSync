import { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: ReactNode;
  subtitle?: string;
  iconColor?: string;
  iconBgColor?: string;
}

export function StatsCard({
  title,
  value,
  icon,
  subtitle,
  iconColor = "text-indigo-500",
  iconBgColor = "bg-indigo-50",
}: StatsCardProps) {
  return (
    <Card className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-gray-500">{title}</h2>
        <div className={cn("p-2 rounded-md", iconBgColor)}>
          <div className={cn("h-5 w-5", iconColor)}>{icon}</div>
        </div>
      </div>
      <div className="mt-4">
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
      </div>
    </Card>
  );
}
