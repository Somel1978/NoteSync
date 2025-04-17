import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
  
  const data = [
    { name: t('appointments.approved'), value: approvedCount, color: '#10b981' },
    { name: t('appointments.pending'), value: pendingCount, color: '#f59e0b' },
    { name: t('appointments.rejected'), value: rejectedCount, color: '#ef4444' },
    { name: t('appointments.cancelled'), value: cancelledCount, color: '#6b7280' },
  ].filter(item => item.value > 0); // Only show statuses with bookings
  
  // If no data, show a placeholder
  if (data.length === 0 || (approvedCount === 0 && pendingCount === 0 && rejectedCount === 0 && cancelledCount === 0)) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-medium">{t('dashboard.bookingStatusChart', 'Booking Status')}</CardTitle>
        </CardHeader>
        <CardContent className="h-[300px] flex items-center justify-center">
          <p className="text-gray-500 text-sm">{t('dashboard.noBookingsData', 'No booking data available')}</p>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-medium">{t('dashboard.bookingStatusChart', 'Booking Status')}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={90}
                paddingAngle={5}
                dataKey="value"
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Legend />
              <Tooltip 
                formatter={(value) => [`${value} ${t('dashboard.bookings', 'bookings')}`, t('dashboard.count', 'Count')]}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}