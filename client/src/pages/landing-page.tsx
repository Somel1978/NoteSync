import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { Appointment, Location, Room } from "@shared/schema";
import { Link } from "wouter";
import { 
  Clock, 
  MapPin, 
  User, 
  Calendar,
  BadgeCheck, 
  BadgeX, 
  Clock8,
  CalendarRange 
} from "lucide-react";
import { format } from "date-fns";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";

export default function LandingPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("appointments");

  // Fetch appointments
  const { data: appointments = [] } = useQuery<Appointment[]>({
    queryKey: ["/api/public/appointments"],
  });

  // Fetch locations
  const { data: locations = [] } = useQuery<Location[]>({
    queryKey: ["/api/public/locations"],
  });

  // Fetch rooms
  const { data: rooms = [] } = useQuery<Room[]>({
    queryKey: ["/api/public/rooms"],
  });

  // Group appointments by location
  const appointmentsByLocation = appointments.reduce((acc, appointment) => {
    const room = rooms.find(r => r.id === appointment.roomId);
    const locationId = room?.locationId || 0;
    
    if (!acc[locationId]) {
      acc[locationId] = [];
    }
    
    acc[locationId].push({
      ...appointment,
      room
    });
    
    return acc;
  }, {} as Record<number, (Appointment & { room?: Room })[]>);

  // Group rooms by location
  const roomsByLocation = rooms.reduce((acc, room) => {
    if (!acc[room.locationId]) {
      acc[room.locationId] = [];
    }
    
    acc[room.locationId].push(room);
    
    return acc;
  }, {} as Record<number, Room[]>);

  // Helper functions
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-green-500">{t('appointments.approved')}</Badge>;
      case 'rejected':
        return <Badge variant="destructive">{t('appointments.rejected')}</Badge>;
      case 'cancelled':
        return <Badge variant="outline">{t('appointments.cancelled')}</Badge>;
      default:
        return <Badge variant="secondary">{t('appointments.pending')}</Badge>;
    }
  };

  const formatDateTime = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return format(date, "MMM d, h:mm a");
    } catch {
      return dateString;
    }
  };

  const getLocationName = (locationId: number) => {
    const location = locations.find(l => l.id === locationId);
    return location?.name || `${t('appointments.location')} ${locationId}`;
  };

  return (
    <div className="container py-8 mx-auto">
      <div className="flex flex-col items-center mb-8">
        <h1 className="text-3xl font-bold text-center mb-2">
          {t("common.roomBookingSystem")}
        </h1>
        <p className="text-lg text-gray-600 text-center max-w-2xl">
          {t("auth.systemDescription")}
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-8">
          <TabsTrigger value="appointments">
            <Calendar className="mr-2 h-4 w-4" />
            {t("navigation.appointments")}
          </TabsTrigger>
          <TabsTrigger value="rooms">
            <MapPin className="mr-2 h-4 w-4" />
            {t("navigation.rooms")}
          </TabsTrigger>
        </TabsList>

        {/* Appointments Tab */}
        <TabsContent value="appointments" className="space-y-8">
          <div className="grid gap-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold">
                {t("appointments.title")}
              </h2>
              {user && (
                <Link to="/dashboard">
                  <Badge variant="outline" className="cursor-pointer">
                    {t("dashboard.title")} →
                  </Badge>
                </Link>
              )}
            </div>
            <p className="text-gray-600">
              {t("appointments.subtitle")}
            </p>

            {/* Show appointments by location */}
            {locations.length > 0 ? (
              locations.map(location => (
                <div key={location.id} className="space-y-4">
                  <h3 className="text-xl font-semibold flex items-center">
                    <MapPin className="mr-2 h-5 w-5" />
                    {location.name}
                  </h3>
                  <div className="grid gap-4">
                    {appointmentsByLocation[location.id]?.length > 0 ? (
                      appointmentsByLocation[location.id].map(appointment => (
                        <Card key={appointment.id} className="overflow-hidden">
                          <CardContent className="p-0">
                            <div className="flex justify-between items-center p-4 border-b">
                              <div className="font-medium text-lg">{appointment.title}</div>
                              {getStatusBadge(appointment.status)}
                            </div>
                            <div className="p-4 grid gap-2">
                              <div className="flex items-center text-gray-600">
                                <Clock className="mr-2 h-4 w-4" />
                                <span>
                                  {formatDateTime(appointment.startTime)} - {formatDateTime(appointment.endTime)}
                                </span>
                              </div>
                              <div className="flex items-center text-gray-600">
                                <MapPin className="mr-2 h-4 w-4" />
                                <span>
                                  {appointment.room?.name || `${t('rooms.room')} ${appointment.roomId}`}
                                </span>
                              </div>
                              <div className="flex items-center text-gray-600">
                                <User className="mr-2 h-4 w-4" />
                                <span>
                                  {appointment.customerName}
                                  {user && appointment.customerEmail && (
                                    <span> • {appointment.customerEmail}</span>
                                  )}
                                  {user && appointment.customerPhone && (
                                    <span> • {appointment.customerPhone}</span>
                                  )}
                                </span>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        {t("appointments.noData")}
                      </div>
                    )}
                  </div>
                  <Separator className="my-6" />
                </div>
              ))
            ) : (
              <div className="text-center py-12 text-gray-500">
                {t("locations.noLocations")}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Rooms Tab */}
        <TabsContent value="rooms" className="space-y-8">
          <div className="grid gap-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold">
                {t("rooms.title")}
              </h2>
              {user && (
                <Link to="/rooms">
                  <Badge variant="outline" className="cursor-pointer">
                    {t("rooms.title")} →
                  </Badge>
                </Link>
              )}
            </div>
            <p className="text-gray-600">
              {t("rooms.subtitle")}
            </p>
           
            {/* Show rooms by location */}
            {locations.length > 0 ? (
              locations.map(location => (
                <div key={location.id} className="space-y-4">
                  <h3 className="text-xl font-semibold flex items-center">
                    <MapPin className="mr-2 h-5 w-5" />
                    {location.name}
                  </h3>
                  {roomsByLocation[location.id]?.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {roomsByLocation[location.id].map(room => (
                        <Card key={room.id} className="overflow-hidden hover:shadow-md transition-shadow">
                          <CardContent className="p-4">
                            <div className="flex justify-between items-start mb-4">
                              <div>
                                <h4 className="font-medium text-lg">{room.name}</h4>
                                <p className="text-sm text-gray-500">{location.name}</p>
                              </div>
                              <Badge className={room.active ? "bg-green-500" : "bg-gray-400"}>
                                {room.active ? t("rooms.active") : t("rooms.inactive")}
                              </Badge>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-2 mb-4">
                              <div className="flex items-center text-sm text-gray-600">
                                <User className="mr-1 h-4 w-4" />
                                <span>{t("rooms.capacity")}: {room.capacity}</span>
                              </div>
                              <div className="flex items-center text-sm text-gray-600">
                                <Clock8 className="mr-1 h-4 w-4" />
                                <span>{t("rooms.hourlyRate")}: {(room.hourlyRate || 0) / 100}€</span>
                              </div>
                            </div>
                            
                            <div className="flex mt-4 justify-end">
                              <Link to={`/rooms/${room.id}`}>
                                <Badge variant="outline" className="cursor-pointer">
                                  {t("common.view")} →
                                </Badge>
                              </Link>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      {t("rooms.noRoomsFound")}
                    </div>
                  )}
                  <Separator className="my-6" />
                </div>
              ))
            ) : (
              <div className="text-center py-12 text-gray-500">
                {t("locations.noLocations")}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}