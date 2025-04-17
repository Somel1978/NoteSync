import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslation } from "react-i18next";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface MonthlyUtilizationProps {
  utilizationData: {
    month: string;
    utilization: number;
  }[];
}

export function MonthlyUtilizationChart({ utilizationData }: MonthlyUtilizationProps) {
  const { t } = useTranslation();
  
  // Custom tooltip formatter
  const customTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border rounded shadow-md">
          <p className="font-medium text-sm">{label}</p>
          <p className="text-xs text-gray-700">{`${Math.round(payload[0].value)}% ${t('dashboard.utilization', 'utilization')}`}</p>
        </div>
      );
    }
    return null;
  };
  
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-medium">
          {t('dashboard.monthlyUtilization', 'Monthly Utilization')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {utilizationData.length > 0 ? (
          <div className="h-[300px] mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={utilizationData}
                margin={{
                  top: 5,
                  right: 10,
                  left: 10,
                  bottom: 20,
                }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis 
                  domain={[0, 100]}
                  tickFormatter={(value) => `${value}%`}
                />
                <Tooltip content={customTooltip} />
                <Bar 
                  dataKey="utilization" 
                  fill="#8884d8" 
                  name={t('dashboard.utilization', 'Utilization')}
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <p>{t('dashboard.noUtilizationData', 'No utilization data available')}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}