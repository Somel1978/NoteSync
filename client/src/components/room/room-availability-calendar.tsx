import { useCallback, useEffect, useMemo, useState } from "react";
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
    
  // Função para debugar o tempo de processamento do calendário
  useEffect(() => {
    console.time('calendar-render');
    console.log(`Renderizando calendário com ${appointments.length} agendamentos`);
    
    return () => {
      console.timeEnd('calendar-render');
    };
  }, [appointments]);
  
  // Pré-calcular quais dias têm compromissos
  const bookedDays = useMemo(() => {
    console.time('bookedDays-calculation');
    const result = new Set<string>();
    
    // Processamos cada compromisso uma vez só
    appointments.forEach(appointment => {
      const start = new Date(appointment.startTime);
      const end = new Date(appointment.endTime);
      
      // Para compromissos que duram mais de um dia, adicione todos os dias afetados
      if (!isSameDay(start, end)) {
        const days = eachDayOfInterval({ start, end });
        days.forEach(day => {
          result.add(format(day, 'yyyy-MM-dd'));
        });
      } else {
        // Para compromissos de um dia só, adicione apenas a data
        result.add(format(start, 'yyyy-MM-dd'));
      }
    });
    
    console.timeEnd('bookedDays-calculation');
    return result;
  }, [appointments]);
  
  // Mapa organizado de compromissos por dia para detalhes
  const appointmentsByDay = useMemo(() => {
    console.time('appointmentsByDay-calculation');
    const result = new Map<string, Appointment[]>();
    
    appointments.forEach(appointment => {
      const start = new Date(appointment.startTime);
      const end = new Date(appointment.endTime);
      
      // Se o compromisso é de um dia só ou abrange vários dias
      if (isSameDay(start, end)) {
        const dateKey = format(start, 'yyyy-MM-dd');
        const existing = result.get(dateKey) || [];
        result.set(dateKey, [...existing, appointment]);
      } else {
        // Para compromissos que abrangem vários dias, adicione a cada dia
        const days = eachDayOfInterval({ start, end });
        days.forEach(day => {
          const dateKey = format(day, 'yyyy-MM-dd');
          const existing = result.get(dateKey) || [];
          result.set(dateKey, [...existing, appointment]);
        });
      }
    });
    
    console.timeEnd('appointmentsByDay-calculation');
    return result;
  }, [appointments]);
  
  // Verificar rapidamente se uma data tem compromissos
  const hasAppointments = useCallback((date: Date) => {
    const dateKey = format(date, 'yyyy-MM-dd');
    return bookedDays.has(dateKey);
  }, [bookedDays]);
  
  // Obter compromissos para uma data específica
  const getAppointmentsForDate = useCallback((date: Date | null) => {
    if (!date) return [];
    
    const dateKey = format(date, 'yyyy-MM-dd');
    return appointmentsByDay.get(dateKey) || [];
  }, [appointmentsByDay]);
  
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
          available: (date) => !hasAppointments(date) && isAfter(date, today),
          past: (date) => isBefore(date, today) && !isSameDay(date, today)
        }}
        modifiersClassNames={{
          booked: "bg-red-50 dark:bg-red-900/20 relative after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:w-1 after:h-1 after:bg-red-500 after:rounded-full",
          available: "bg-green-50 dark:bg-green-900/20 relative after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:w-1 after:h-1 after:bg-green-500 after:rounded-full",
          past: "opacity-50 pointer-events-none"
        }}
        onDayClick={handleDayClick}
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