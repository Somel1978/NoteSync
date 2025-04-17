import { useTranslation } from "react-i18next";
import { useParams } from "wouter";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Room, Location, Appointment } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { format, addDays, isWithinInterval, isSameDay } from "date-fns";
import { Calendar, Clock, User, MapPin, Info, ListChecks, DollarSign } from "lucide-react";
import { ptBR, enUS, es } from "date-fns/locale";
import { RoomAvailabilityCalendar } from "./room-availability-calendar";

export function RoomAvailabilityView() {
  const { t, i18n } = useTranslation();
  const { id } = useParams<{ id?: string }>();
  const roomId = id ? parseInt(id) : undefined;
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  
  // Get the right locale for date-fns
  const getDateLocale = () => {
    switch (i18n.language) {
      case "pt":
        return ptBR;
      case "es":
        return es;
      default:
        return enUS;
    }
  };

  // Fetch specific room if ID is provided
  const { data: room, isLoading: isRoomLoading } = useQuery<Room>({
    queryKey: ["/api/public/rooms", roomId],
    enabled: !!roomId,
  });
  
  // Fetch all rooms if no ID is provided
  const { data: rooms = [], isLoading: isRoomsLoading } = useQuery<Room[]>({
    queryKey: ["/api/public/rooms"],
    enabled: !roomId,
  });
  
  // Fetch locations for context
  const { data: locations = [], isLoading: isLocationsLoading } = useQuery<Location[]>({
    queryKey: ["/api/public/locations"],
  });
  
  // Fetch appointments for the specific room
  const { data: appointments = [], isLoading: isAppointmentsLoading } = useQuery<Appointment[]>({
    queryKey: ["/api/public/appointments/room", roomId],
    enabled: !!roomId,
  });
  
  // Find the location name for the current room
  const getLocationName = (locationId: number) => {
    const location = locations.find(loc => loc.id === locationId);
    return location ? location.name : t("common.notAvailable");
  };
  
  // Check if a specific date has any appointments
  const hasAppointmentsOnDate = (date: Date) => {
    return appointments.some(appointment => {
      const startTime = new Date(appointment.startTime);
      const endTime = new Date(appointment.endTime);
      
      return isSameDay(date, startTime) || 
             isSameDay(date, endTime) || 
             (isWithinInterval(date, { start: startTime, end: endTime }));
    });
  };
  
  // Calculate next 90 days
  const generateDaysArray = () => {
    const days = [];
    const today = new Date();
    
    for (let i = 0; i < 90; i++) {
      const date = addDays(today, i);
      days.push({
        date,
        hasAppointments: hasAppointmentsOnDate(date)
      });
    }
    
    return days;
  };

  // Generate content based on whether we're looking at a specific room or all rooms
  const content = () => {
    if (isRoomLoading || isRoomsLoading || isLocationsLoading || isAppointmentsLoading) {
      return (
        <div className="space-y-4">
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-4 w-2/3" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
            <Skeleton className="h-64" />
            <Skeleton className="h-64" />
          </div>
        </div>
      );
    }
    
    if (roomId && room) {
      // Single room view
      return (
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold mb-2">
              {t("rooms.availabilityCalendar")}
            </h1>
            <p className="text-gray-600 mb-4">
              {t("rooms.availabilityDescription")}
            </p>
          </div>
          
          <Card>
            <CardHeader>
              <CardTitle>{room.name}</CardTitle>
              <CardDescription>{getLocationName(room.locationId)}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <div className="flex flex-col space-y-3">
                    <div className="flex items-center">
                      <MapPin className="mr-2 h-4 w-4 text-gray-500" />
                      <span>{getLocationName(room.locationId)}</span>
                    </div>
                    
                    <div className="flex items-center">
                      <User className="mr-2 h-4 w-4 text-gray-500" />
                      <span>{t("rooms.capacity")}: {room.capacity}</span>
                    </div>
                    
                    <div className="flex items-center">
                      <Clock className="mr-2 h-4 w-4 text-gray-500" />
                      <span>{t("rooms.hourlyRate")}: {(room.hourlyRate || 0) / 100}€</span>
                    </div>
                    
                    {room.flatRate && (
                      <div className="flex items-center">
                        <DollarSign className="mr-2 h-4 w-4 text-gray-500" />
                        <span>{t("rooms.flatRate")}: {room.flatRate / 100}€</span>
                      </div>
                    )}
                    
                    {room.description && (
                      <div className="flex items-start">
                        <Info className="mr-2 h-4 w-4 text-gray-500 mt-1" />
                        <span>{room.description || t("rooms.noDescription")}</span>
                      </div>
                    )}
                    
                    {room.facilities && Array.isArray(room.facilities) && room.facilities.length > 0 && (
                      <div className="flex items-start">
                        <ListChecks className="mr-2 h-4 w-4 text-gray-500 mt-1" />
                        <div>
                          <span className="font-medium">{t("rooms.facilities")}:</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {room.facilities.map((facility: any, index: number) => (
                              <Badge key={index} variant="outline" className="text-xs">
                                {typeof facility === 'object' && facility.name ? facility.name : String(facility)}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className="mt-6">
                    <Button 
                      className="w-full"
                      onClick={() => window.location.href = "/auth"}
                    >
                      {t("rooms.bookNow")}
                    </Button>
                  </div>
                </div>
                
                <div>
                  <h3 className="font-medium text-lg mb-3">{t("rooms.availability")}</h3>
                  <RoomAvailabilityCalendar 
                    appointments={appointments} 
                    roomId={room.id} 
                    locale={getDateLocale()}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    } else {
      // All rooms or no specific room selected
      return (
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold mb-2">
              {t("rooms.availabilityCalendar")}
            </h1>
            <p className="text-gray-600 mb-4">
              {t("rooms.availabilityDescription")}
            </p>
          </div>
          
          {rooms.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {rooms.map(room => (
                <Card key={room.id} className="overflow-hidden hover:shadow-md transition-shadow">
                  <CardHeader>
                    <CardTitle>{room.name}</CardTitle>
                    <CardDescription>{getLocationName(room.locationId)}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-col space-y-2">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center">
                          <User className="mr-2 h-4 w-4 text-gray-500" />
                          <span>{t("rooms.capacity")}: {room.capacity}</span>
                        </div>
                        <Badge className={room.active ? "bg-green-500" : "bg-gray-400"}>
                          {room.active ? t("rooms.active") : t("rooms.inactive")}
                        </Badge>
                      </div>
                      
                      <div className="flex items-center">
                        <Clock className="mr-2 h-4 w-4 text-gray-500" />
                        <span>{t("rooms.hourlyRate")}: {(room.hourlyRate || 0) / 100}€</span>
                      </div>
                      
                      <div className="mt-4">
                        <Button 
                          className="w-full"
                          onClick={() => window.location.href = `/rooms/availability/${room.id}`}
                          variant="outline"
                        >
                          {t("rooms.availabilityCalendar")}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 rounded-lg shadow">
              {t("rooms.noRoomsAvailable")}
            </div>
          )}
        </div>
      );
    }
  };

  return content();
}