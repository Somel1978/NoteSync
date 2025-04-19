import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useTranslation } from "react-i18next";
import { useToast } from "@/hooks/use-toast";
import { Room, Location } from "@shared/schema";
import { RoomFormModal } from "@/components/room/room-form-modal";
import { LocationFormModal } from "@/components/location/location-form-modal";
import { Pencil, Trash, PlusCircle } from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const LocationRoomManagement = () => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [roomModalOpen, setRoomModalOpen] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [locationModalOpen, setLocationModalOpen] = useState(false);
  
  // Fetch data
  const { data: rooms = [] } = useQuery<Room[]>({
    queryKey: ['/api/rooms'],
    enabled: true,
  });
  
  const { data: locations = [] } = useQuery<Location[]>({
    queryKey: ['/api/locations'],
    enabled: true,
  });
  
  // Delete location mutation
  const deleteLocationMutation = useMutation({
    mutationFn: async (locationId: number) => {
      const res = await apiRequest("DELETE", `/api/locations/${locationId}`);
      if (!res.ok) {
        throw new Error(await res.text());
      }
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/locations'] });
      queryClient.invalidateQueries({ queryKey: ['/api/rooms'] });
      toast({
        title: t('locations.deleteSuccess'),
        description: t('locations.deleteSuccessDetail'),
      });
    },
    onError: (error: Error) => {
      toast({
        title: t('locations.deleteError'),
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Delete room mutation
  const deleteRoomMutation = useMutation({
    mutationFn: async (roomId: number) => {
      const res = await apiRequest("DELETE", `/api/rooms/${roomId}`);
      if (!res.ok) {
        throw new Error(await res.text());
      }
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/rooms'] });
      toast({
        title: t('rooms.deleteSuccess'),
        description: t('rooms.deleteSuccessDetail'),
      });
    },
    onError: (error: Error) => {
      toast({
        title: t('rooms.deleteError'),
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Room handler
  const handleEditRoom = (room: Room) => {
    setSelectedRoom(room);
    setRoomModalOpen(true);
  };
  
  // Prepare locations with their rooms
  const locationsWithRooms = locations.map(location => {
    const locationRooms = rooms.filter(room => room.locationId === location.id);
    return {
      ...location,
      rooms: locationRooms
    };
  });
  
  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">{t('locations.title')}</h2>
          <p className="text-muted-foreground">{t('locations.description')}</p>
        </div>
        
        <Button onClick={() => {
          setSelectedLocation(null);
          setLocationModalOpen(true);
        }}>
          <PlusCircle className="h-4 w-4 mr-2" />
          {t('locations.addLocation')}
        </Button>
      </div>
      
      {/* Locations and Rooms List */}
      {locationsWithRooms.length > 0 ? (
        <div className="space-y-8">
          {locationsWithRooms.map((location: any) => (
            <Card key={location.id} className="overflow-hidden">
              <CardHeader className="bg-muted/30">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle>{location.name}</CardTitle>
                    <CardDescription>{location.description}</CardDescription>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedLocation(location);
                        setLocationModalOpen(true);
                      }}
                    >
                      <Pencil className="h-4 w-4 mr-1" />
                      {t('common.edit')}
                    </Button>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-red-600"
                      onClick={() => {
                        if (confirm(`${t('common.delete')} ${location.name}?`)) {
                          deleteLocationMutation.mutate(location.id);
                        }
                      }}
                    >
                      <Trash className="h-4 w-4 mr-1" />
                      {t('common.delete')}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium">{t('rooms.title')}</h3>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedRoom({
                        id: 0,
                        name: "",
                        description: "",
                        locationId: location.id,
                        capacity: 0,
                        flatRate: null,
                        hourlyRate: null,
                        attendeeRate: null,
                        facilities: [],
                        active: true,
                        createdAt: new Date()
                      } as Room);
                      setRoomModalOpen(true);
                    }}
                  >
                    <PlusCircle className="h-4 w-4 mr-1" />
                    {t('rooms.addRoom')}
                  </Button>
                </div>
                
                {location.rooms && location.rooms.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {location.rooms.map((room: Room) => (
                      <Card key={room.id} className="overflow-hidden">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div>
                              <h4 className="font-medium">{room.name}</h4>
                              <p className="text-sm text-muted-foreground">
                                {t('rooms.capacity')}: {room.capacity} {t('rooms.people')}
                              </p>
                              <div className="mt-2 flex items-center space-x-2">
                                {room.active ? (
                                  <Badge variant="outline" className="bg-green-50 text-green-600 border-green-200">
                                    {t('common.active')}
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="bg-red-50 text-red-600 border-red-200">
                                    {t('common.inactive')}
                                  </Badge>
                                )}
                                
                                {room.flatRate !== null && (
                                  <Badge variant="outline">
                                    {t('rooms.flatRate')}: €{(room.flatRate/100).toFixed(2)}
                                  </Badge>
                                )}
                                
                                {room.hourlyRate !== null && (
                                  <Badge variant="outline">
                                    {t('rooms.hourlyRate')}: €{(room.hourlyRate/100).toFixed(2)}/h
                                  </Badge>
                                )}
                                
                                {room.attendeeRate !== null && (
                                  <Badge variant="outline">
                                    {t('rooms.attendeeRate')}: €{(room.attendeeRate/100).toFixed(2)}/p
                                  </Badge>
                                )}
                              </div>
                            </div>
                            
                            <div className="flex items-center space-x-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditRoom(room)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-red-600"
                                onClick={() => {
                                  if (confirm(`${t('common.delete')} ${room.name}?`)) {
                                    deleteRoomMutation.mutate(room.id);
                                  }
                                }}
                              >
                                <Trash className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="text-center p-4 bg-muted/20 rounded-md">
                    <p className="text-muted-foreground">{t('rooms.noRooms')}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-8">
            <div className="text-center">
              <p className="text-muted-foreground">
                {t('locations.noLocations')}
              </p>
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Room Modal */}
      <RoomFormModal
        room={selectedRoom || undefined}
        open={roomModalOpen}
        onOpenChange={(open) => {
          setRoomModalOpen(open);
          if (!open) {
            // When modal is closed, invalidate the queries to refresh the data
            queryClient.invalidateQueries({ queryKey: ['/api/rooms'] });
          }
        }}
      />
      
      {/* Location Modal */}
      <LocationFormModal
        location={selectedLocation || undefined}
        open={locationModalOpen}
        onOpenChange={(open) => {
          setLocationModalOpen(open);
          if (!open) {
            // When modal is closed, invalidate the queries to refresh the data
            queryClient.invalidateQueries({ queryKey: ['/api/locations'] });
          }
        }}
      />
    </>
  );
};