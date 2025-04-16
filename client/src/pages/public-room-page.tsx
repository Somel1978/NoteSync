import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { Room, Location } from "@shared/schema";
import { 
  User, 
  MapPin, 
  Clock, 
  Calendar,
  ListChecks,
  DollarSign
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PublicLayout } from "@/components/layout/public-layout";

export default function PublicRoomPage() {
  const { t } = useTranslation();

  // Fetch locations
  const { data: locations = [] } = useQuery<Location[]>({
    queryKey: ["/api/public/locations"],
  });

  // Fetch rooms
  const { data: rooms = [], isLoading } = useQuery<Room[]>({
    queryKey: ["/api/public/rooms"],
  });

  // Group rooms by location
  const roomsByLocation = rooms.reduce((acc, room) => {
    if (!acc[room.locationId]) {
      acc[room.locationId] = [];
    }
    
    acc[room.locationId].push(room);
    
    return acc;
  }, {} as Record<number, Room[]>);

  const content = (
    <div>
      <h1 className="text-2xl font-bold mb-2">
        {t("rooms.title")}
      </h1>
      <p className="text-gray-600 mb-6">
        {t("rooms.subtitle")}
      </p>

      {/* Show rooms by location */}
      {locations.length > 0 ? (
        locations.map(location => (
          <div key={location.id} className="space-y-4 mb-8">
            <h3 className="text-xl font-semibold flex items-center">
              <MapPin className="mr-2 h-5 w-5" />
              {location.name}
            </h3>
            {roomsByLocation[location.id]?.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {roomsByLocation[location.id].map(room => (
                  <Card key={room.id} className="overflow-hidden hover:shadow-md transition-shadow bg-white dark:bg-gray-800">
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h4 className="font-medium text-lg">{room.name}</h4>
                          <p className="text-sm text-gray-500 dark:text-gray-400">{location.name}</p>
                        </div>
                        <Badge className={room.active ? "bg-green-500" : "bg-gray-400"}>
                          {room.active ? t("rooms.active") : t("rooms.inactive")}
                        </Badge>
                      </div>
                      
                      <div className="grid grid-cols-1 gap-2 mb-4">
                        <div className="flex items-center text-sm text-gray-600 dark:text-gray-300">
                          <User className="mr-2 h-4 w-4" />
                          <span>{t("rooms.capacity")}: {room.capacity}</span>
                        </div>
                        <div className="flex items-center text-sm text-gray-600 dark:text-gray-300">
                          <Clock className="mr-2 h-4 w-4" />
                          <span>{t("rooms.hourlyRate")}: {(room.hourlyRate || 0) / 100}€</span>
                        </div>
                        {room.flatRate && (
                          <div className="flex items-center text-sm text-gray-600 dark:text-gray-300">
                            <DollarSign className="mr-2 h-4 w-4" />
                            <span>{t("rooms.flatRate")}: {room.flatRate / 100}€</span>
                          </div>
                        )}
                        {room.facilities && Array.isArray(room.facilities) && room.facilities.length > 0 && (
                          <div className="flex items-start text-sm text-gray-600 dark:text-gray-300 mt-2">
                            <ListChecks className="mr-2 h-4 w-4 mt-0.5" />
                            <div>
                              <span className="font-medium">{t("rooms.facilities")}:</span>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {(room.facilities as string[]).map((facility, index) => (
                                  <Badge key={index} variant="outline" className="text-xs">
                                    {facility}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                      
                      <div className="flex mt-4 justify-end">
                        <Badge variant="outline" className="cursor-pointer">
                          {t("rooms.availabilityCalendar")} →
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 rounded-lg shadow">
                {t("rooms.noRoomsFound")}
              </div>
            )}
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