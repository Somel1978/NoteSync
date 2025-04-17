import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslation } from "react-i18next";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

interface BookingStatusChartProps {
  approvedCount: number;
  pendingCount: number;
  rejectedCount: number;
  cancelledCount: number;
}

export function BookingStatusChart({ 
  approvedCount, 
  pendingCount, 
  rejectedCount, 
  cancelledCount 
}: BookingStatusChartProps) {
  const { t } = useTranslation();
  
  // Prepare data for pie chart
  const data = [
    { name: t('appointments.approved', 'Approved'), value: approvedCount, color: '#10b981' },
    { name: t('appointments.pending', 'Pending'), value: pendingCount, color: '#6366f1' },
    { name: t('appointments.rejected', 'Rejected'), value: rejectedCount, color: '#ef4444' },
    { name: t('appointments.cancelled', 'Cancelled'), value: cancelledCount, color: '#94a3b8' },
  ].filter(item => item.value > 0); // Only show statuses with at least one booking
  
  // Custom tooltip formatter
  const customTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border rounded shadow-md">
          <p className="font-medium text-sm">{payload[0].name}: {payload[0].value}</p>
          <p className="text-xs text-gray-500">{t('dashboard.count', 'Count')}</p>
        </div>
      );
    }
    return null;
  };
  
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-medium">
          {t('dashboard.bookingStatusChart', 'Booking Status')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {data.length > 0 ? (
          <div className="h-[300px] mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={2}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={customTooltip} />
                <Legend layout="vertical" align="right" verticalAlign="middle" />
              </PieChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <p>{t('dashboard.noBookingData', 'No booking data available')}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}