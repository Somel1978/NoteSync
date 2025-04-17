import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { startOfDay, addDays, format, isWeekend, isWithinInterval } from "date-fns";
import { pt, es, enUS } from "date-fns/locale";
import { Room, Appointment } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, HelpCircle } from "lucide-react";

interface RoomAvailabilityCalendarProps {
  room: Room;
  onDateClick?: (date: Date) => void;
  numberOfDays?: number;
}

export function RoomAvailabilityCalendar({ 
  room, 
  onDateClick,
  numberOfDays = 90 
}: RoomAvailabilityCalendarProps) {
  const { t, i18n } = useTranslation();
  const [startDate, setStartDate] = useState<Date>(startOfDay(new Date()));
  
  // Get the current locale from i18n
  const getLocale = () => {
    switch (i18n.language) {
      case 'pt':
        return pt;
      case 'es':
        return es;
      default:
        return enUS;
    }
  };

  // Fetch appointments for the room
  const { data: appointments, isLoading: isLoadingAppointments } = useQuery<Appointment[]>({
    queryKey: ['/api/public/appointments/room', room.id],
    enabled: !!room,
  });

  // Generate an array of the next N days
  const generateDays = () => {
    const days = [];
    for (let i = 0; i < numberOfDays; i++) {
      days.push(addDays(startDate, i));
    }
    return days;
  };

  // Check if a date is booked
  const isDateBooked = (date: Date) => {
    if (!appointments) return false;
    
    // Start of day for comparison
    const dayStart = startOfDay(date);
    const dayEnd = addDays(dayStart, 1);
    
    return appointments.some(appointment => {
      const appointmentStart = new Date(appointment.startTime);
      const appointmentEnd = new Date(appointment.endTime);
      
      // Check if appointment overlaps with the date
      return isWithinInterval(appointmentStart, { start: dayStart, end: dayEnd }) ||
             isWithinInterval(appointmentEnd, { start: dayStart, end: dayEnd }) ||
             (appointmentStart <= dayStart && appointmentEnd >= dayEnd);
    });
  };

  // Navigate to previous period
  const goToPrevious = () => {
    setStartDate(addDays(startDate, -numberOfDays));
  };

  // Navigate to next period
  const goToNext = () => {
    setStartDate(addDays(startDate, numberOfDays));
  };

  // Reset to current date
  const goToCurrent = () => {
    setStartDate(startOfDay(new Date()));
  };

  const days = generateDays();

  // Handle date click
  const handleDateClick = (date: Date) => {
    if (onDateClick) {
      onDateClick(date);
    }
  };

  return (
    <Card className="w-full overflow-hidden">
      <div className="bg-primary text-white p-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold">{t('rooms.availability')}</h3>
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-white hover:text-white hover:bg-primary-hover"
            onClick={goToPrevious}
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <Button 
            variant="secondary" 
            size="sm"
            onClick={goToCurrent}
            className="text-xs px-2"
          >
            {t('common.today')}
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-white hover:text-white hover:bg-primary-hover"
            onClick={goToNext}
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
      </div>
      <CardContent className="p-4">
        <div className="mb-4 flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            {format(startDate, "PPP", { locale: getLocale() })} - {format(addDays(startDate, numberOfDays - 1), "PPP", { locale: getLocale() })}
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-500"></div>
              <span className="text-xs">{t('appointments.booked')}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
              <span className="text-xs">{t('appointments.available')}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-gray-300"></div>
              <span className="text-xs">{t('appointments.weekend')}</span>
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6">
                  <HelpCircle className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">{t('rooms.availabilityHelp')}</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
        
        {isLoadingAppointments ? (
          <div className="grid grid-cols-7 gap-2 sm:grid-cols-7 md:grid-cols-14 lg:grid-cols-15">
            {Array.from({ length: 30 }).map((_, index) => (
              <Skeleton key={index} className="h-10 w-full" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-7 gap-2 sm:grid-cols-7 md:grid-cols-14 lg:grid-cols-15">
            {days.map((day) => {
              const isBooked = isDateBooked(day);
              const weekend = isWeekend(day);
              const today = format(new Date(), 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd');
              
              return (
                <Button
                  key={day.toISOString()}
                  variant="outline"
                  size="sm"
                  className={`
                    h-10 relative
                    ${weekend ? 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700' : ''}
                    ${isBooked ? 'bg-red-100 hover:bg-red-200 border-red-300 dark:bg-red-900/20 dark:hover:bg-red-900/30 dark:border-red-900/30' : ''}
                    ${!isBooked && !weekend ? 'bg-green-100 hover:bg-green-200 border-green-300 dark:bg-green-900/20 dark:hover:bg-green-900/30 dark:border-green-900/30' : ''}
                    ${today ? 'ring-2 ring-primary ring-offset-2' : ''}
                  `}
                  onClick={() => handleDateClick(day)}
                >
                  <div className="flex flex-col items-center">
                    <span className="text-xs font-medium">
                      {format(day, 'EEE', { locale: getLocale() })}
                    </span>
                    <span className="text-sm">
                      {format(day, 'd', { locale: getLocale() })}
                    </span>
                  </div>
                  {isBooked && (
                    <Badge
                      variant="destructive"
                      className="absolute -top-2 -right-2 h-4 w-4 p-0 flex items-center justify-center"
                    />
                  )}
                </Button>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}