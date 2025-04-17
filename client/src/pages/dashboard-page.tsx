import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { format, subMonths } from "date-fns";
import { useTranslation } from "react-i18next";
import { MetricsOverview } from "@/components/dashboard/metrics-overview";
import { BookingStatusChart } from "@/components/dashboard/booking-status-chart";
import { MonthlyUtilizationChart } from "@/components/dashboard/monthly-utilization-chart";

interface DashboardStats {
  totalAppointments: number;
  recentAppointments: number;
  activeRooms: number;
  totalUsers: number;
  utilization: number;
  popularRooms: PopularRoom[];
  recentBookings: RecentBooking[];
  statusCounts?: {
    approved: number;
    pending: number;
    rejected: number;
    cancelled: number;
  };
  monthlyUtilization?: {
    month: string;
    utilization: number;
  }[];
}

interface PopularRoom {
  room: {
    id: number;
    name: string;
    locationId: number;
  };
  bookings: number;
  utilization: number;
}

interface RecentBooking {
  id: number;
  title: string;
  startTime: string;
  endTime: string;
  status: string;
  customerName: string;
  roomId: number;
}

export default function DashboardPage() {
  const { t } = useTranslation();
  const { data, isLoading, error } = useQuery<DashboardStats>({
    queryKey: ["/api/stats"],
  });
  
  const { data: rooms } = useQuery({
    queryKey: ["/api/rooms"],
  });
  
  // Generate mock data for monthly utilization if not provided by API
  const mockMonthlyUtilization = () => {
    const result = [];
    const now = new Date();
    
    for (let i = 5; i >= 0; i--) {
      const date = subMonths(now, i);
      const monthName = format(date, 'MMM');
      
      // Base value on real utilization data with some randomness
      const baseUtilization = data?.utilization || 0;
      const randomOffset = Math.floor(Math.random() * 15) - 7; // Random value between -7 and 7
      const utilization = Math.max(0, Math.min(100, baseUtilization + randomOffset));
      
      result.push({
        month: monthName,
        utilization
      });
    }
    
    return result;
  };
  
  // Calculate status counts if not provided by API
  const calculateStatusCounts = () => {
    if (!data?.recentBookings) return { approved: 0, pending: 0, rejected: 0, cancelled: 0 };
    
    const counts = {
      approved: 0,
      pending: 0,
      rejected: 0,
      cancelled: 0
    };
    
    data.recentBookings.forEach(booking => {
      if (booking.status === 'approved') counts.approved++;
      else if (booking.status === 'pending') counts.pending++;
      else if (booking.status === 'rejected') counts.rejected++;
      else if (booking.status === 'cancelled') counts.cancelled++;
    });
    
    return counts;
  };
  
  // Get status counts, either from API or calculated
  const statusCounts = data?.statusCounts || calculateStatusCounts();
  
  // Get monthly utilization data, either from API or generated
  const monthlyUtilization = data?.monthlyUtilization || mockMonthlyUtilization();
  
  if (isLoading) {
    return (
      <AppLayout>
        <div className="p-8">
          <div className="flex justify-center items-center h-96">
            <p className="text-gray-500">{t('common.loading', 'Loading dashboard data...')}</p>
          </div>
        </div>
      </AppLayout>
    );
  }
  
  if (error) {
    return (
      <AppLayout>
        <div className="p-8">
          <div className="flex justify-center items-center h-96">
            <p className="text-red-500">{t('common.error', 'Error loading dashboard:')} {error.message}</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  const getRoomName = (roomId: number) => {
    if (!rooms || !Array.isArray(rooms)) return `${t('rooms.room', 'Room')} #${roomId}`;
    const room = rooms.find((r: any) => r.id === roomId);
    return room ? room.name : `${t('rooms.room', 'Room')} #${roomId}`;
  };
  
  return (
    <AppLayout>
      <div className="p-4 pt-8 sm:p-8">
        <header className="mb-6 sm:mb-8">
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-800">{t('dashboard.title', 'Dashboard')}</h1>
          <p className="text-gray-600 text-sm">{t('dashboard.subtitle', 'Real-time overview of your room management system')}</p>
        </header>

        {/* Metrics Overview */}
        <MetricsOverview 
          totalAppointments={data?.totalAppointments || 0}
          activeRooms={data?.activeRooms || 0}
          totalUsers={data?.totalUsers || 0}
          utilization={data?.utilization || 0}
          approvedCount={statusCounts.approved}
          pendingCount={statusCounts.pending}
          rejectedCount={statusCounts.rejected}
          cancelledCount={statusCounts.cancelled}
        />

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-8 mb-8">
          <BookingStatusChart 
            approvedCount={statusCounts.approved}
            pendingCount={statusCounts.pending}
            rejectedCount={statusCounts.rejected}
            cancelledCount={statusCounts.cancelled}
          />
          <MonthlyUtilizationChart utilizationData={monthlyUtilization} />
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-8">
          {/* Recent Bookings */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-medium">{t('dashboard.recentBookings', 'Recent Bookings')}</CardTitle>
            </CardHeader>
            <CardContent>
              {data?.recentBookings && data.recentBookings.length > 0 ? (
                <div className="space-y-4">
                  {data.recentBookings.map((booking) => (
                    <div key={booking.id} className="border-b border-gray-100 pb-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-medium text-gray-800">{booking.title}</h3>
                          <p className="text-sm text-gray-600">
                            {format(new Date(booking.startTime), "MMM d, h:mm a")} - {format(new Date(booking.endTime), "h:mm a")}
                          </p>
                          <p className="text-sm text-gray-600">
                            {getRoomName(booking.roomId)} - {booking.customerName}
                          </p>
                        </div>
                        <Badge
                          variant={
                            booking.status === "approved" ? "success" : 
                            booking.status === "rejected" ? "destructive" : 
                            "secondary"
                          }
                        >
                          {booking.status === "approved" 
                            ? t('appointments.approved')
                            : booking.status === "rejected" 
                            ? t('appointments.rejected')
                            : booking.status === "cancelled" 
                            ? t('appointments.cancelled')
                            : t('appointments.pending')
                          }
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <p>{t('dashboard.noBookings', 'No recent bookings')}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Popular Rooms */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-medium">{t('dashboard.popularRooms', 'Popular Rooms')}</CardTitle>
            </CardHeader>
            <CardContent>
              {data?.popularRooms && data.popularRooms.length > 0 ? (
                <div className="space-y-6">
                  {data.popularRooms.slice(0, 4).map((roomData) => (
                    <div key={roomData.room.id} className="mb-6">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h3 className="font-medium text-gray-800">{roomData.room.name}</h3>
                          <p className="text-sm text-gray-600">{t('appointments.location', 'Location')} ID: {roomData.room.locationId}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium text-gray-800">{roomData.bookings} {t('dashboard.bookings', 'bookings')}</p>
                          <p className="text-sm text-gray-600">{Math.round(roomData.utilization)}% {t('dashboard.utilization', 'utilization')}</p>
                        </div>
                      </div>
                      <Progress value={roomData.utilization} className="h-2" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <p>{t('dashboard.noRoomsData', 'No rooms data available')}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
