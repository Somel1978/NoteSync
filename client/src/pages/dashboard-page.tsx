import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/app-layout";
import { StatsCard } from "@/components/dashboard/stats-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Calendar, TicketPlus, Users, BarChart3, Clock } from "lucide-react";
import { format } from "date-fns";
import { useTranslation } from "react-i18next";

interface DashboardStats {
  totalAppointments: number;
  recentAppointments: number;
  activeRooms: number;
  totalUsers: number;
  utilization: number;
  popularRooms: PopularRoom[];
  recentBookings: RecentBooking[];
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

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8">
          <StatsCard
            title={t('dashboard.totalBookings', 'Total Bookings')}
            value={data?.totalAppointments || 0}
            subtitle={t('dashboard.allTime', 'All time')}
            icon={<Calendar />}
            iconColor="text-indigo-500"
            iconBgColor="bg-indigo-50"
          />
          
          <StatsCard
            title={t('dashboard.activeRooms', 'Active Rooms')}
            value={data?.activeRooms || 0}
            subtitle={t('dashboard.acrossLocations', 'Across all locations')}
            icon={<TicketPlus />}
            iconColor="text-blue-500"
            iconBgColor="bg-blue-50"
          />
          
          <StatsCard
            title={t('dashboard.totalUsers', 'Total Users')}
            value={data?.totalUsers || 0}
            subtitle={t('dashboard.registeredUsers', 'Registered users')}
            icon={<Users />}
            iconColor="text-violet-500"
            iconBgColor="bg-violet-50"
          />
          
          <StatsCard
            title={t('dashboard.utilizationRate', 'Utilization Rate')}
            value={`${Math.round(data?.utilization || 0)}%`}
            subtitle={t('dashboard.roomUsageMonth', 'Room usage this month')}
            icon={<BarChart3 />}
            iconColor="text-emerald-500"
            iconBgColor="bg-emerald-50"
          />
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
                          {t(`appointments.${booking.status}`, booking.status.charAt(0).toUpperCase() + booking.status.slice(1))}
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
