import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, TicketPlus, Users, BarChart3, Clock, Check, X, CirclePause } from "lucide-react";
import { StatsCard } from "@/components/dashboard/stats-card";

interface MetricsOverviewProps {
  totalAppointments: number;
  activeRooms: number;
  totalUsers: number;
  utilization: number;
  approvedCount: number;
  pendingCount: number;
  rejectedCount: number;
  cancelledCount: number;
}

export function MetricsOverview({
  totalAppointments,
  activeRooms,
  totalUsers,
  utilization,
  approvedCount,
  pendingCount,
  rejectedCount,
  cancelledCount
}: MetricsOverviewProps) {
  const { t } = useTranslation();
  
  return (
    <>
      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8">
        <StatsCard
          title={t('dashboard.totalBookings', 'Total Bookings')}
          value={totalAppointments}
          subtitle={t('dashboard.allTime', 'All time')}
          icon={<Calendar />}
          iconColor="text-indigo-500"
          iconBgColor="bg-indigo-50"
        />
        
        <StatsCard
          title={t('dashboard.activeRooms', 'Active Rooms')}
          value={activeRooms}
          subtitle={t('dashboard.acrossLocations', 'Across all locations')}
          icon={<TicketPlus />}
          iconColor="text-blue-500"
          iconBgColor="bg-blue-50"
        />
        
        <StatsCard
          title={t('dashboard.totalUsers', 'Total Users')}
          value={totalUsers}
          subtitle={t('dashboard.registeredUsers', 'Registered users')}
          icon={<Users />}
          iconColor="text-violet-500"
          iconBgColor="bg-violet-50"
        />
        
        <StatsCard
          title={t('dashboard.utilizationRate', 'Utilization Rate')}
          value={`${Math.round(utilization)}%`}
          subtitle={t('dashboard.roomUsageMonth', 'Room usage this month')}
          icon={<BarChart3 />}
          iconColor="text-emerald-500"
          iconBgColor="bg-emerald-50"
        />
      </div>
      
      {/* Booking Status Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8">
        <StatsCard
          title={t('appointments.approved', 'Approved')}
          value={approvedCount}
          subtitle={t('dashboard.bookings', 'bookings')}
          icon={<Check />}
          iconColor="text-green-500"
          iconBgColor="bg-green-50"
        />
        
        <StatsCard
          title={t('appointments.pending', 'Pending')}
          value={pendingCount}
          subtitle={t('dashboard.bookings', 'bookings')}
          icon={<Clock />}
          iconColor="text-amber-500"
          iconBgColor="bg-amber-50"
        />
        
        <StatsCard
          title={t('appointments.rejected', 'Rejected')}
          value={rejectedCount}
          subtitle={t('dashboard.bookings', 'bookings')}
          icon={<X />}
          iconColor="text-red-500"
          iconBgColor="bg-red-50"
        />
        
        <StatsCard
          title={t('appointments.cancelled', 'Cancelled')}
          value={cancelledCount}
          subtitle={t('dashboard.bookings', 'bookings')}
          icon={<CirclePause />}
          iconColor="text-gray-500"
          iconBgColor="bg-gray-100"
        />
      </div>
    </>
  );
}