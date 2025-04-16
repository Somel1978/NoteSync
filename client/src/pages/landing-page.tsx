import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { Appointment, Location, Room } from "@shared/schema";
import { Link } from "wouter";
import { 
  Clock, 
  MapPin, 
  User, 
  Clock8 
} from "lucide-react";
import { format } from "date-fns";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { PublicLayout } from "@/components/layout/public-layout";

export default function LandingPage() {
  const { t } = useTranslation();
  const { user } = useAuth();

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

  const content = (
    <div>
      <h1 className="text-2xl font-bold mb-2">
        {t("appointments.title")}
      </h1>
      <p className="text-gray-600 mb-6">
        {t("appointments.subtitle")}
      </p>

      {/* Show appointments by location */}
      {locations.length > 0 ? (
        locations.map(location => (
          <div key={location.id} className="space-y-4 mb-8">
            <h3 className="text-xl font-semibold flex items-center">
              <MapPin className="mr-2 h-5 w-5" />
              {location.name}
            </h3>
            <div className="grid gap-4">
              {appointmentsByLocation[location.id]?.length > 0 ? (
                appointmentsByLocation[location.id].map(appointment => (
                  <Card key={appointment.id} className="overflow-hidden bg-white dark:bg-gray-800">
                    <CardContent className="p-0">
                      <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-700">
                        <div className="font-medium text-lg">{appointment.title}</div>
                        {getStatusBadge(appointment.status)}
                      </div>
                      <div className="p-4 grid gap-2">
                        <div className="flex items-center text-gray-600 dark:text-gray-300">
                          <Clock className="mr-2 h-4 w-4" />
                          <span>
                            {formatDateTime(appointment.startTime)} - {formatDateTime(appointment.endTime)}
                          </span>
                        </div>
                        <div className="flex items-center text-gray-600 dark:text-gray-300">
                          <MapPin className="mr-2 h-4 w-4" />
                          <span>
                            {appointment.room?.name || `${t('rooms.room')} ${appointment.roomId}`}
                          </span>
                        </div>
                        <div className="flex items-center text-gray-600 dark:text-gray-300">
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
                <div className="text-center py-8 text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 rounded-lg shadow">
                  {t("appointments.noData")}
                </div>
              )}
            </div>
          </div>
        ))
      ) : (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 rounded-lg shadow">
          {t("locations.noLocations")}
        </div>
      )}
    </div>
  );

  return <PublicLayout>{content}</PublicLayout>;
}