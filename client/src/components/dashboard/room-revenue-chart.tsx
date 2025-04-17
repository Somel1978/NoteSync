import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslation } from "react-i18next";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface RoomRevenueData {
  name: string;
  revenue: number;
}

interface RoomRevenueChartProps {
  roomsData: {
    room: {
      id: number;
      name: string;
    };
    revenue?: number;
  }[];
}

export function RoomRevenueChart({ roomsData }: RoomRevenueChartProps) {
  const { t } = useTranslation();
  
  // Prepare data for chart
  const chartData: RoomRevenueData[] = roomsData
    .filter(room => room.revenue && room.revenue > 0) // Only include rooms with positive revenue
    .sort((a, b) => (b.revenue || 0) - (a.revenue || 0)) // Sort by revenue descending
    .slice(0, 5) // Limit to top 5 rooms by revenue
    .map(room => ({
      name: room.room.name,
      revenue: ((room.revenue || 0) / 100) // Convert cents to euros
    }));
  
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-medium">
          {t('dashboard.roomRevenue', 'Revenue by Room')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {chartData.length > 0 ? (
          <div className="h-[300px] mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{
                  top: 5,
                  right: 10,
                  left: 10,
                  bottom: 50,
                }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="name" 
                  angle={-45} 
                  textAnchor="end"
                  height={70} 
                  tickMargin={25}
                />
                <YAxis 
                  tickFormatter={(value) => `€${value}`}
                />
                <Tooltip 
                  formatter={(value: number) => [`€${value.toFixed(2)}`, t('dashboard.revenue', 'Revenue')]}
                  labelFormatter={(label) => `${label}`}
                />
                <Bar 
                  dataKey="revenue" 
                  fill="#10b981" 
                  name={t('dashboard.revenue', 'Revenue')}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <p>{t('dashboard.noRevenueData', 'No revenue data available')}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}