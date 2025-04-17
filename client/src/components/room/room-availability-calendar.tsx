import { useState, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Appointment } from "@shared/schema";
import { Calendar } from "@/components/ui/calendar";
import { format, isBefore, isAfter, isSameDay, isWithinInterval, addDays, eachDayOfInterval, Locale } from "date-fns";

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
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  
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
  
  return (
    <div className="space-y-4">
      <Calendar
        mode="single"
        selected={selectedDate}
        onSelect={setSelectedDate}
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
        components={{
          Day: ({ date, ...props }) => (
            <div {...props} className={dayClassName(date)}>
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
    </div>
  );
}