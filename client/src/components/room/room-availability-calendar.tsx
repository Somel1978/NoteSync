import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Appointment } from "@shared/schema";
import { Calendar } from "@/components/ui/calendar";
import { format, isBefore, isAfter, isSameDay, isWithinInterval, addDays, eachDayOfInterval, Locale, getHours, getMinutes, parseISO } from "date-fns";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Clock } from "lucide-react";

interface RoomAvailabilityCalendarProps {
  appointments: Appointment[];
  roomId: number;
  locale: Locale;
}

export function RoomAvailabilityCalendar({
  appointments,
  roomId,
  locale
}: RoomAvailabilityCalendarProps) {
  const { t } = useTranslation();
  
  // State for daily detail dialog
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [dayDetailOpen, setDayDetailOpen] = useState(false);
  
  // Current date for calculations
  const today = new Date();
  
  // Calculate availability for the next 90 days
  const appointmentDays = useMemo(() => {
    const result = new Map<string, Appointment[]>();
    const next90Days = eachDayOfInterval({
      start: today,
      end: addDays(today, 90)
    });
    
    // Initialize all days with empty arrays
    next90Days.forEach(day => {
      result.set(format(day, 'yyyy-MM-dd'), []);
    });
    
    // Add appointments to their respective days
    appointments.forEach(appointment => {
      const start = new Date(appointment.startTime);
      const end = new Date(appointment.endTime);
      
      // Get all days between start and end
      const appointmentDays = eachDayOfInterval({ start, end });
      
      // Add this appointment to each day it spans
      appointmentDays.forEach(day => {
        const dateKey = format(day, 'yyyy-MM-dd');
        const existing = result.get(dateKey) || [];
        result.set(dateKey, [...existing, appointment]);
      });
    });
    
    return result;
  }, [appointments, today]);
  
  // Determine if a date has appointments
  const hasAppointments = useCallback((date: Date) => {
    const dateKey = format(date, 'yyyy-MM-dd');
    const dayAppointments = appointmentDays.get(dateKey) || [];
    return dayAppointments.length > 0;
  }, [appointmentDays]);
  
  // Custom day render function
  const dayClassName = useCallback((date: Date) => {
    // Basic styles for all days
    let className = "relative rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors";
    
    // Disable past dates
    if (isBefore(date, today) && !isSameDay(date, today)) {
      className += " opacity-50 pointer-events-none";
      return className;
    }
    
    // Check if this date has appointments
    if (hasAppointments(date)) {
      className += " bg-red-50 dark:bg-red-900/20";
      
      // Add dot indicator
      className += " after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:w-1 after:h-1 after:bg-red-500 after:rounded-full";
    } else {
      className += " bg-green-50 dark:bg-green-900/20";
      
      // Add available indicator
      className += " after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:w-1 after:h-1 after:bg-green-500 after:rounded-full";
    }
    
    return className;
  }, [hasAppointments, today]);
  
  // Get appointments for the selected date
  const getAppointmentsForDate = useCallback((date: Date | null) => {
    if (!date) return [];
    
    const dateKey = format(date, 'yyyy-MM-dd');
    return appointmentDays.get(dateKey) || [];
  }, [appointmentDays]);
  
  // Format time for display
  const formatTimeDisplay = (dateString: string): string => {
    const date = parseISO(dateString);
    return `${String(getHours(date)).padStart(2, '0')}:${String(getMinutes(date)).padStart(2, '0')}`;
  };
  
  // Handle day clicks to show availability details
  const handleDayClick = (date: Date) => {
    setSelectedDate(date);
    setDayDetailOpen(true);
  };
  
  // Reorder hours as a timeline
  const renderHourlyTimeline = () => {
    if (!selectedDate) return null;
    
    const dateAppointments = getAppointmentsForDate(selectedDate);
    const hours = [];
    
    // Generate all hours of the day
    for (let i = 0; i < 24; i++) {
      hours.push({
        hour: i,
        display: `${String(i).padStart(2, '0')}:00`,
        appointments: dateAppointments.filter(appointment => {
          const start = new Date(appointment.startTime);
          const end = new Date(appointment.endTime);
          const hourStart = new Date(selectedDate);
          hourStart.setHours(i, 0, 0, 0);
          const hourEnd = new Date(selectedDate);
          hourEnd.setHours(i, 59, 59, 999);
          
          // Check if the appointment overlaps with this hour
          return (
            (start <= hourEnd && end >= hourStart) ||
            (start >= hourStart && start <= hourEnd) ||
            (end >= hourStart && end <= hourEnd)
          );
        })
      });
    }
    
    return (
      <div className="space-y-2 max-h-80 overflow-y-auto">
        {hours.map(hour => (
          <div 
            key={hour.hour} 
            className={`p-2 rounded flex items-center justify-between ${hour.appointments.length > 0 ? 'bg-red-50 dark:bg-red-900/20' : 'bg-green-50 dark:bg-green-900/20'}`}
          >
            <div className="flex items-center">
              <Clock className="mr-2 h-4 w-4 text-gray-500" />
              <span>{hour.display}</span>
            </div>
            <div>
              {hour.appointments.length > 0 ? (
                <span className="text-xs font-medium text-red-500">{t("booking.unavailable")}</span>
              ) : (
                <span className="text-xs font-medium text-green-500">{t("booking.available")}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };
  
  return (
    <div className="space-y-4">
      <Calendar
        mode="default"
        className="rounded-md border"
        locale={locale}
        fromDate={today}
        toDate={addDays(today, 90)}
        modifiers={{
          booked: (date) => hasAppointments(date),
          available: (date) => !hasAppointments(date) && isAfter(date, today)
        }}
        modifiersClassNames={{
          booked: "bg-red-50 dark:bg-red-900/20",
          available: "bg-green-50 dark:bg-green-900/20"
        }}
        onDayClick={handleDayClick}
        components={{
          Day: ({ date, ...props }) => (
            <div 
              {...props} 
              className={dayClassName(date)}
              onClick={() => handleDayClick(date)}
            >
              {date.getDate()}
            </div>
          )
        }}
      />
      
      <div className="flex items-center justify-center space-x-4 text-sm">
        <div className="flex items-center">
          <span className="w-3 h-3 mr-2 rounded-full bg-green-500"></span>
          <span>{t("booking.available")}</span>
        </div>
        <div className="flex items-center">
          <span className="w-3 h-3 mr-2 rounded-full bg-red-500"></span>
          <span>{t("booking.unavailable")}</span>
        </div>
      </div>
      
      <div className="text-center text-sm text-gray-500 mt-2">
        {t("rooms.availabilityHelp")}
      </div>
      
      {/* Dialog for detailed hourly view */}
      <Dialog open={dayDetailOpen} onOpenChange={setDayDetailOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {selectedDate && format(selectedDate, 'dd/MM/yyyy')} - {t("rooms.hourlyAvailability")}
            </DialogTitle>
            <DialogDescription>
              {t("rooms.hourlyAvailabilityDescription")}
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            {renderHourlyTimeline()}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}