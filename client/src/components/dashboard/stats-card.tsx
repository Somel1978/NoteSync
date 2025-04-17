import React, { ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';

interface StatsCardProps {
  title: string;
  value: string | number;
  subtitle: string;
  icon: ReactNode;
  iconColor: string;
  iconBgColor: string;
}

export function StatsCard({ title, value, subtitle, icon, iconColor, iconBgColor }: StatsCardProps) {
  return (
    <Card>
      <CardContent className="flex items-start pt-6">
        <div className={`${iconBgColor} rounded-full p-3 mr-4`}>
          <div className={`${iconColor}`}>
            {icon}
          </div>
        </div>
        <div>
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <h4 className="text-2xl font-bold mt-1">{value}</h4>
          <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
        </div>
      </CardContent>
    </Card>
  );
}