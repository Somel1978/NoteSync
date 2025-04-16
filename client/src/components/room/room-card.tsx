import { Room, Facility, Location } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PencilIcon, TrashIcon, UserIcon, DollarSignIcon, ClockIcon } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ReactNode } from "react";

interface RoomCardProps {
  room: Room;
  onEdit: (room: Room) => void;
  onDelete: (roomId: number) => void;
}

export function RoomCard({ room, onEdit, onDelete }: RoomCardProps) {
  const { t } = useTranslation();
  const { data: location } = useQuery<Location>({
    queryKey: ["/api/locations", room.locationId],
  });

  const formatCurrency = (value?: number | null) => {
    if (value === undefined || value === null) return t('common.notAvailable', 'N/A');
    return `€${(value / 100).toFixed(2)}`;
  };

  const renderFacilities = () => {
    if (!room.facilities || !Array.isArray(room.facilities) || room.facilities.length === 0) {
      return null;
    }
    
    return (
      <div className="mt-4">
        <h4 className="text-sm font-medium text-gray-700">{t('rooms.facilities', 'Facilities')}</h4>
        <div className="mt-2 flex flex-wrap gap-2">
          {room.facilities.map((facility: any) => (
            <Badge
              key={facility.id}
              variant="secondary"
              className="flex items-center"
            >
              {facility.name} {facility.cost > 0 && `- ${formatCurrency(facility.cost)}`}
            </Badge>
          ))}
        </div>
      </div>
    );
  };

  return (
    <Card className="bg-gray-50 p-4 rounded-lg border border-gray-200">
      <CardContent className="p-0">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="text-lg font-medium text-gray-900">{room.name}</h3>
            <p className="text-sm text-gray-500">{location?.name || `${t('appointments.location', 'Location')} ID: ${room.locationId}`}</p>
          </div>
          <div className="flex space-x-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onEdit(room)}
            >
              <PencilIcon className="h-5 w-5 text-gray-400 hover:text-gray-500" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onDelete(room.id)}
            >
              <TrashIcon className="h-5 w-5 text-gray-400 hover:text-red-500" />
            </Button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <div className="flex items-center">
              <UserIcon className="h-5 w-5 text-gray-400 mr-2" />
              <span className="text-sm text-gray-700">{t('rooms.capacity', 'Capacity')}: {room.capacity}</span>
            </div>
          </div>
          <div>
            <div className="flex items-center">
              <DollarSignIcon className="h-5 w-5 text-gray-400 mr-2" />
              <span className="text-sm text-gray-700">{t('rooms.flatRate', 'Flat Rate')}: {formatCurrency(room.flatRate)}</span>
            </div>
          </div>
          <div>
            <div className="flex items-center">
              <ClockIcon className="h-5 w-5 text-gray-400 mr-2" />
              <span className="text-sm text-gray-700">{t('rooms.hourlyRate', 'Hourly Rate')}: {formatCurrency(room.hourlyRate)}</span>
            </div>
          </div>
        </div>

        {room.description && (
          <div className="mt-4">
            <p className="text-sm text-gray-700">{room.description}</p>
          </div>
        )}

        {renderFacilities()}

        <div className="mt-4 flex items-center">
          <div className="flex h-5 items-center">
            <div
              className={`h-2.5 w-2.5 rounded-full mr-2 ${
                room.active ? "bg-green-500" : "bg-gray-400"
              }`}
            ></div>
          </div>
          <div className="text-sm">
            <p className="font-medium text-gray-700">
              {room.active ? t('rooms.active', 'Active') : t('rooms.inactive', 'Inactive')}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}