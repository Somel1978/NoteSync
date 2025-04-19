import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { useTranslation } from "react-i18next";
import { 
  BarChart3, 
  CalendarDays, 
  Clock, 
  DollarSign, 
  Building2, 
  Users, 
  ListChecks,
  ArrowUpRight,
  Hourglass
} from "lucide-react";
import { Link } from "wouter";

// Interface definitions for dashboard data
interface DashboardStats {
  // Basic stats
  totalAppointments: number;
  activeRooms: number;
  totalUsers: number;
  statusCounts: {
    approved: number;
    pending: number;
    rejected: number;
  };
  
  // List metrics
  activeBookings: Booking[];
  pendingBookings: Booking[];
  roomMetrics: RoomMetric[];
  locationMetrics: LocationMetric[];
  
  // Totals
  totalMonthlyHours: number;
  totalMonthlyRevenue: number;
  totalYtdRevenue: number;
}

interface Booking {
  id: number;
  title: string;
  startTime: string;
  endTime: string;
  status: string;
  userId: number;
  customerName?: string;
  contactEmail?: string;
  contactPhone?: string;
  rooms: any[];
}

interface RoomMetric {
  id: number;
  name: string;
  locationId: number;
  locationName: string;
  monthlyHours: number;
  monthlyRevenue: number;
  ytdRevenue: number;
  avgRevenuePerBooking: number;
  totalBookings: number;
  approvedBookings: number;
  rejectedBookings: number;
  pendingBookings: number;
}

interface LocationMetric {
  id: number;
  name: string;
  monthlyHours: number;
  monthlyRevenue: number;
  ytdRevenue: number;
  avgRevenuePerBooking: number;
  totalBookings: number;
  approvedBookings: number;
  rejectedBookings: number;
  pendingBookings: number;
}

// Component to display a metric card
const MetricCard = ({ title, value, icon, description }: { 
  title: string; 
  value: string | number;
  icon: React.ReactNode;
  description?: string;
}) => (
  <Card>
    <CardContent className="pt-6">
      <div className="flex items-center justify-between space-x-4">
        <div className="flex-1">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <div className="text-2xl font-bold">{value}</div>
          {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
        </div>
        <div className="text-muted-foreground">
          {icon}
        </div>
      </div>
    </CardContent>
  </Card>
);

// Helper to format currency
const formatCurrency = (amount: number) => {
  return `€${(amount / 100).toFixed(2)}`;
};

export default function DashboardPage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState("overview");
  
  // Fetch dashboard stats from API
  const { data, isLoading, error } = useQuery<DashboardStats>({
    queryKey: ["/api/stats"],
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

  if (!data) {
    return (
      <AppLayout>
        <div className="p-8">
          <div className="flex justify-center items-center h-96">
            <p className="text-red-500">{t('dashboard.noData', 'No data available.')}</p>
          </div>
        </div>
      </AppLayout>
    );
  }
  
  return (
    <AppLayout>
      <div className="p-4 md:p-8 space-y-8">
        <header>
          <h1 className="text-2xl font-bold tracking-tight">{t('dashboard.title', 'Dashboard')}</h1>
          <p className="text-muted-foreground">
            {t('dashboard.subtitle', 'Overview of your room booking system')}
          </p>
        </header>
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">
              {t('dashboard.overview', 'Overview')}
            </TabsTrigger>
            <TabsTrigger value="room-metrics">
              {t('dashboard.roomMetrics', 'Room Metrics')}
            </TabsTrigger>
            <TabsTrigger value="location-metrics">
              {t('dashboard.locationMetrics', 'Location Metrics')}
            </TabsTrigger>
            <TabsTrigger value="bookings">
              {t('dashboard.bookings', 'Bookings')}
            </TabsTrigger>
          </TabsList>
          
          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard 
                title={t('dashboard.totalHours', 'Total Hours')}
                value={data.totalMonthlyHours.toFixed(1)}
                icon={<Clock className="h-6 w-6" />}
                description={t('dashboard.hoursThisMonth', 'Hours booked this month')}
              />
              <MetricCard 
                title={t('dashboard.monthlyRevenue', 'Monthly Revenue')}
                value={formatCurrency(data.totalMonthlyRevenue)}
                icon={<DollarSign className="h-6 w-6" />}
                description={t('dashboard.revenueThisMonth', 'Revenue this month')}
              />
              <MetricCard 
                title={t('dashboard.ytdRevenue', 'YTD Revenue')}
                value={formatCurrency(data.totalYtdRevenue)}
                icon={<BarChart3 className="h-6 w-6" />}
                description={t('dashboard.revenueYearToDate', 'Revenue year to date')}
              />
              <MetricCard 
                title={t('dashboard.totalBookings', 'Total Bookings')}
                value={data.totalAppointments}
                icon={<CalendarDays className="h-6 w-6" />}
                description={t('dashboard.bookingsAllTime', 'All time bookings')}
              />
            </div>
            
            {/* Booking Status */}
            <Card>
              <CardHeader>
                <CardTitle>{t('dashboard.bookingStatus', 'Booking Status')}</CardTitle>
                <CardDescription>
                  {t('dashboard.bookingStatusDescription', 'Overview of booking statuses across all rooms and locations')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="flex flex-col p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <span className="text-sm text-muted-foreground">{t('appointments.approved', 'Approved')}</span>
                    <span className="text-2xl font-bold text-green-600 dark:text-green-400">{data.statusCounts.approved}</span>
                  </div>
                  <div className="flex flex-col p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                    <span className="text-sm text-muted-foreground">{t('appointments.pending', 'Pending')}</span>
                    <span className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{data.statusCounts.pending}</span>
                  </div>
                  <div className="flex flex-col p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                    <span className="text-sm text-muted-foreground">{t('appointments.rejected', 'Rejected')}</span>
                    <span className="text-2xl font-bold text-red-600 dark:text-red-400">{data.statusCounts.rejected}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            {/* Top Rooms and Locations */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Top Rooms */}
              <Card>
                <CardHeader>
                  <CardTitle>{t('dashboard.topPerformingRooms', 'Top Performing Rooms')}</CardTitle>
                  <CardDescription>
                    {t('dashboard.topPerformingRoomsDescription', 'Highest revenue rooms this month')}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('rooms.room', 'Room')}</TableHead>
                        <TableHead className="text-right">{t('dashboard.revenue', 'Revenue')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.roomMetrics
                        .sort((a, b) => b.monthlyRevenue - a.monthlyRevenue)
                        .slice(0, 5)
                        .map(room => (
                          <TableRow key={room.id}>
                            <TableCell className="font-medium">{room.name}</TableCell>
                            <TableCell className="text-right">{formatCurrency(room.monthlyRevenue)}</TableCell>
                          </TableRow>
                        ))
                      }
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
              
              {/* Top Locations */}
              <Card>
                <CardHeader>
                  <CardTitle>{t('dashboard.topPerformingLocations', 'Top Performing Locations')}</CardTitle>
                  <CardDescription>
                    {t('dashboard.topPerformingLocationsDescription', 'Highest revenue locations this month')}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('locations.location', 'Location')}</TableHead>
                        <TableHead className="text-right">{t('dashboard.revenue', 'Revenue')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.locationMetrics
                        .sort((a, b) => b.monthlyRevenue - a.monthlyRevenue)
                        .map(location => (
                          <TableRow key={location.id}>
                            <TableCell className="font-medium">{location.name}</TableCell>
                            <TableCell className="text-right">{formatCurrency(location.monthlyRevenue)}</TableCell>
                          </TableRow>
                        ))
                      }
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          
          {/* Room Metrics Tab */}
          <TabsContent value="room-metrics" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>{t('dashboard.roomMetrics', 'Room Metrics')}</CardTitle>
                <CardDescription>
                  {t('dashboard.roomMetricsDescription', 'Details of usage and revenue by room')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('rooms.room', 'Room')}</TableHead>
                      <TableHead>{t('locations.location', 'Location')}</TableHead>
                      <TableHead className="text-right">{t('dashboard.hoursMonth', 'Hours/Month')}</TableHead>
                      <TableHead className="text-right">{t('dashboard.revenueMonth', 'Revenue/Month')}</TableHead>
                      <TableHead className="text-right">{t('dashboard.avgBooking', 'Avg/Booking')}</TableHead>
                      <TableHead className="text-right">{t('dashboard.ytdRevenue', 'YTD Revenue')}</TableHead>
                      <TableHead className="text-center">{t('dashboard.bookings', 'Bookings')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.roomMetrics.map(room => (
                      <TableRow key={room.id}>
                        <TableCell className="font-medium">{room.name}</TableCell>
                        <TableCell>{room.locationName}</TableCell>
                        <TableCell className="text-right">{room.monthlyHours.toFixed(1)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(room.monthlyRevenue)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(room.avgRevenuePerBooking)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(room.ytdRevenue)}</TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-2">
                            <Badge variant="outline" className="bg-green-50 text-green-700 hover:bg-green-100">
                              {room.approvedBookings}
                            </Badge>
                            <Badge variant="outline" className="bg-yellow-50 text-yellow-700 hover:bg-yellow-100">
                              {room.pendingBookings}
                            </Badge>
                            <Badge variant="outline" className="bg-red-50 text-red-700 hover:bg-red-100">
                              {room.rejectedBookings}
                            </Badge>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* Location Metrics Tab */}
          <TabsContent value="location-metrics" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>{t('dashboard.locationMetrics', 'Location Metrics')}</CardTitle>
                <CardDescription>
                  {t('dashboard.locationMetricsDescription', 'Details of usage and revenue by location')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('locations.location', 'Location')}</TableHead>
                      <TableHead className="text-right">{t('dashboard.hoursMonth', 'Hours/Month')}</TableHead>
                      <TableHead className="text-right">{t('dashboard.revenueMonth', 'Revenue/Month')}</TableHead>
                      <TableHead className="text-right">{t('dashboard.avgBooking', 'Avg/Booking')}</TableHead>
                      <TableHead className="text-right">{t('dashboard.ytdRevenue', 'YTD Revenue')}</TableHead>
                      <TableHead className="text-center">{t('dashboard.bookings', 'Bookings')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.locationMetrics.map(location => (
                      <TableRow key={location.id}>
                        <TableCell className="font-medium">{location.name}</TableCell>
                        <TableCell className="text-right">{location.monthlyHours.toFixed(1)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(location.monthlyRevenue)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(location.avgRevenuePerBooking)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(location.ytdRevenue)}</TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-2">
                            <Badge variant="outline" className="bg-green-50 text-green-700 hover:bg-green-100">
                              {location.approvedBookings}
                            </Badge>
                            <Badge variant="outline" className="bg-yellow-50 text-yellow-700 hover:bg-yellow-100">
                              {location.pendingBookings}
                            </Badge>
                            <Badge variant="outline" className="bg-red-50 text-red-700 hover:bg-red-100">
                              {location.rejectedBookings}
                            </Badge>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* Bookings Tab */}
          <TabsContent value="bookings" className="space-y-6">
            {/* Active Bookings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <ListChecks className="h-5 w-5 mr-2" />
                  {t('dashboard.activeBookings', 'Active Bookings')}
                </CardTitle>
                <CardDescription>
                  {t('dashboard.activeBookingsDescription', 'Currently active and upcoming approved bookings')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {data.activeBookings.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('appointments.title', 'Title')}</TableHead>
                        <TableHead>{t('appointments.datetime', 'Date & Time')}</TableHead>
                        <TableHead>{t('appointments.customer', 'Customer')}</TableHead>
                        <TableHead className="text-right">{t('common.actions', 'Actions')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.activeBookings.slice(0, 5).map(booking => (
                        <TableRow key={booking.id}>
                          <TableCell className="font-medium">{booking.title}</TableCell>
                          <TableCell>
                            {format(new Date(booking.startTime), "MMM d, h:mm a")} - {format(new Date(booking.endTime), "h:mm a")}
                          </TableCell>
                          <TableCell>{booking.customerName || t('common.unknown', 'Unknown')}</TableCell>
                          <TableCell className="text-right">
                            <Button asChild variant="ghost" size="sm">
                              <Link href={`/admin/appointments/details/${booking.id}`}>
                                <ArrowUpRight className="h-4 w-4 mr-1" />
                                {t('common.details', 'Details')}
                              </Link>
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-6 text-muted-foreground">
                    {t('dashboard.noActiveBookings', 'No active bookings at the moment')}
                  </div>
                )}
                
                {data.activeBookings.length > 5 && (
                  <div className="mt-4 text-center">
                    <Button asChild variant="outline">
                      <Link href="/admin/appointments">
                        {t('dashboard.viewAllActiveBookings', 'View all active bookings')}
                      </Link>
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
            
            {/* Pending Approval */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Hourglass className="h-5 w-5 mr-2" />
                  {t('dashboard.pendingApproval', 'Pending Approval')}
                </CardTitle>
                <CardDescription>
                  {t('dashboard.pendingApprovalDescription', 'Bookings that need approval')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {data.pendingBookings.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('appointments.title', 'Title')}</TableHead>
                        <TableHead>{t('appointments.datetime', 'Date & Time')}</TableHead>
                        <TableHead>{t('appointments.customer', 'Customer')}</TableHead>
                        <TableHead className="text-right">{t('common.actions', 'Actions')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.pendingBookings.slice(0, 5).map(booking => (
                        <TableRow key={booking.id}>
                          <TableCell className="font-medium">{booking.title}</TableCell>
                          <TableCell>
                            {format(new Date(booking.startTime), "MMM d, h:mm a")} - {format(new Date(booking.endTime), "h:mm a")}
                          </TableCell>
                          <TableCell>{booking.customerName || t('common.unknown', 'Unknown')}</TableCell>
                          <TableCell className="text-right">
                            <Button asChild variant="ghost" size="sm">
                              <Link href={`/admin/appointments/details/${booking.id}`}>
                                <ArrowUpRight className="h-4 w-4 mr-1" />
                                {t('common.review', 'Review')}
                              </Link>
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-6 text-muted-foreground">
                    {t('dashboard.noPendingBookings', 'No bookings pending approval')}
                  </div>
                )}
                
                {data.pendingBookings.length > 5 && (
                  <div className="mt-4 text-center">
                    <Button asChild variant="outline">
                      <Link href="/admin/appointments?status=pending">
                        {t('dashboard.viewAllPendingBookings', 'View all pending bookings')}
                      </Link>
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}