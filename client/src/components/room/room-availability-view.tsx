import { useTranslation } from "react-i18next";
import { useParams, useLocation } from "wouter";
import { useState, useEffect, useMemo } from "react";
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
import { useAuth } from "@/hooks/use-auth";

export function RoomAvailabilityView() {
  const { t, i18n } = useTranslation();
  const { id } = useParams<{ id?: string }>();
  const roomId = id ? parseInt(id) : undefined;
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  
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

  // Console log para rastrear renderizações
  useEffect(() => {
    console.log('RoomAvailabilityView renderizado');
    console.time('room-view-render');
    return () => {
      console.timeEnd('room-view-render');
    };
  }, []);

  // Fetch specific room if ID is provided
  const { data: room, isLoading: isRoomLoading } = useQuery<Room>({
    queryKey: ["/api/public/rooms", roomId],
    enabled: !!roomId,
    staleTime: 0, // Sem cache - sempre em tempo real
    queryFn: async () => {
      console.time('fetch-room');
      if (!roomId) return null;
      
      try {
        // Buscar todas as salas e filtrar pelo ID
        const startTime = performance.now();
        const res = await fetch('/api/public/rooms', {
          credentials: "include",
        });
        if (!res.ok) {
          throw new Error(`Error fetching rooms: ${res.status}`);
        }
        const rooms = await res.json();
        const selectedRoom = rooms.find((r: Room) => r.id === roomId);
        
        if (!selectedRoom) {
          throw new Error(`Room with ID ${roomId} not found`);
        }
        
        const endTime = performance.now();
        console.log(`Tempo para carregar sala: ${endTime - startTime}ms`);
        console.timeEnd('fetch-room');
        return selectedRoom;
      } catch (error) {
        console.error("Erro ao carregar sala:", error);
        console.timeEnd('fetch-room');
        throw error;
      }
    },
  });
  
  // Fetch all rooms if no ID is provided
  const { data: rooms = [], isLoading: isRoomsLoading } = useQuery<Room[]>({
    queryKey: ["/api/public/rooms"],
    enabled: !roomId,
    staleTime: 0, // Sem cache
  });
  
  // Fetch locations for context
  const { data: locations = [], isLoading: isLocationsLoading } = useQuery<Location[]>({
    queryKey: ["/api/public/locations"],
    staleTime: 0, // Sem cache
  });
  
  // Estado para acompanhar o mês atual do calendário
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  
  // Calcular datas de início e fim para o mês atual
  const startOfCurrentMonth = useMemo(() => {
    const date = new Date(currentMonth);
    date.setDate(1); // Primeiro dia do mês
    date.setHours(0, 0, 0, 0);
    return date;
  }, [currentMonth]);
  
  const endOfCurrentMonth = useMemo(() => {
    const date = new Date(currentMonth);
    date.setMonth(date.getMonth() + 1); // Próximo mês
    date.setDate(0); // Último dia do mês atual
    date.setHours(23, 59, 59, 999);
    return date;
  }, [currentMonth]);
  
  // Manipulador para mudança de mês
  const handleMonthChange = (newMonth: Date) => {
    console.log(`Mês alterado para: ${format(newMonth, 'MMMM yyyy')}`);
    setIsMonthChanging(true);
    setCurrentMonth(newMonth);
  };
  
  // Estado para controlar o carregamento do mês
  const [isMonthChanging, setIsMonthChanging] = useState(false);
  
  // Fetch appointments for the specific room only for the selected month
  const { data: appointments = [], isLoading: isAppointmentsLoading, isFetching } = useQuery<Appointment[]>({
    queryKey: ["/api/public/appointments/room", roomId, format(startOfCurrentMonth, 'yyyy-MM')],
    enabled: !!roomId,
    staleTime: 0, // Sem cache
    queryFn: async () => {
      console.time('fetch-appointments');
      if (!roomId) return [];
      try {
        const startTime = performance.now();
        
        // Adicionar parâmetros de consulta para filtrar por mês
        const url = new URL(`/api/public/appointments/room/${roomId}`, window.location.origin);
        url.searchParams.append('startDate', startOfCurrentMonth.toISOString());
        url.searchParams.append('endDate', endOfCurrentMonth.toISOString());
        
        const res = await fetch(url.toString(), {
          credentials: "include",
        });
        
        if (!res.ok) {
          console.error(`Error fetching appointments: ${res.status}`);
          return [];
        }
        
        const appointments = await res.json();
        const endTime = performance.now();
        console.log(`Tempo para carregar agendamentos: ${endTime - startTime}ms`);
        console.log(`Número de agendamentos carregados: ${appointments.length}`);
        console.log(`Período: ${format(startOfCurrentMonth, 'dd/MM/yyyy')} a ${format(endOfCurrentMonth, 'dd/MM/yyyy')}`);
        console.timeEnd('fetch-appointments');
        return appointments;
      } catch (error) {
        console.error("Failed to fetch appointments:", error);
        console.timeEnd('fetch-appointments');
        return [];
      }
    },
  });
  
  // Reseta o estado quando o carregamento é concluído
  useEffect(() => {
    if (!isFetching && isMonthChanging) {
      setIsMonthChanging(false);
    }
  }, [isFetching, isMonthChanging]);
  
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
                  
                  {/* Botão de reserva - mostra apenas para usuários logados */}
                  {user ? (
                    <div className="mt-6">
                      <Button 
                        className="w-full"
                        onClick={() => setLocation(`/new-booking?roomId=${room.id}`)}
                      >
                        {t("rooms.bookNow")}
                      </Button>
                    </div>
                  ) : null}
                </div>
                
                <div>
                  <h3 className="font-medium text-lg mb-3">{t("rooms.availability")}</h3>
                  <RoomAvailabilityCalendar 
                    appointments={appointments} 
                    roomId={room.id} 
                    locale={getDateLocale()}
                    isLoading={isMonthChanging || isFetching}
                    onMonthChange={handleMonthChange}
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