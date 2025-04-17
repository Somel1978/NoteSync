import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface MonthlyUtilizationChartProps {
  utilizationData: {
    month: string;
    utilization: number;
  }[];
}

export function MonthlyUtilizationChart({ utilizationData }: MonthlyUtilizationChartProps) {
  const { t } = useTranslation();
  
  // If no data, show a placeholder
  if (!utilizationData || utilizationData.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-medium">{t('dashboard.monthlyUtilization', 'Monthly Utilization')}</CardTitle>
        </CardHeader>
        <CardContent className="h-[300px] flex items-center justify-center">
          <p className="text-gray-500 text-sm">{t('dashboard.noUtilizationData', 'No utilization data available')}</p>
        </CardContent>
      </Card>
    );
  }
  
  // Ensure all data has a utilization value between 0 and 100
  const formattedData = utilizationData.map(item => ({
    ...item,
    utilization: Math.min(Math.max(item.utilization, 0), 100) // Clamp between 0 and 100
  }));
  
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-medium">{t('dashboard.monthlyUtilization', 'Monthly Utilization')}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={formattedData}
              margin={{
                top: 5,
                right: 20,
                left: 0,
                bottom: 5,
              }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis domain={[0, 100]} tickFormatter={(value) => `${value}%`} />
              <Tooltip formatter={(value) => [`${value}%`, t('dashboard.utilization', 'Utilization')]} />
              <Bar 
                dataKey="utilization" 
                fill="#6366f1" 
                radius={[4, 4, 0, 0]} 
                name={t('dashboard.utilization', 'Utilization')}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}