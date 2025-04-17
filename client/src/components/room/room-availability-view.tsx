import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Room } from "@shared/schema";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RoomAvailabilityCalendar } from "./room-availability-calendar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useLocation, useRoute } from "wouter";
import { ScrollArea } from "@/components/ui/scroll-area";

export function RoomAvailabilityView() {
  const { t } = useTranslation();
  const [location, navigate] = useLocation();
  const [, params] = useRoute("/rooms/:id");
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);

  // Fetch rooms data
  const { data: rooms, isLoading: isLoadingRooms } = useQuery<Room[]>({
    queryKey: ["/api/public/rooms"],
  });

  // Handle room selection from the tabs
  const handleRoomChange = (roomId: string) => {
    const room = rooms?.find((r) => r.id.toString() === roomId);
    if (room) {
      setSelectedRoom(room);
      navigate(`/rooms/${roomId}`);
    }
  };

  // Set the selected room when the component mounts or when the URL changes
  useState(() => {
    if (params?.id && rooms) {
      const roomId = parseInt(params.id);
      const room = rooms.find((r) => r.id === roomId);
      if (room) {
        setSelectedRoom(room);
      } else {
        // If room not found and we have rooms, select the first one
        if (rooms.length > 0) {
          setSelectedRoom(rooms[0]);
          navigate(`/rooms/${rooms[0].id}`);
        }
      }
    } else if (rooms && rooms.length > 0 && !selectedRoom) {
      // If no room ID in URL and we have rooms, select the first one
      setSelectedRoom(rooms[0]);
      navigate(`/rooms/${rooms[0].id}`);
    }
  });

  // Function to handle date click
  const handleDateClick = (date: Date) => {
    // You could implement booking actions here
    console.log("Date clicked:", date);
  };

  return (
    <div className="container mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold mb-4">{t("rooms.availability")}</h1>
      <p className="text-muted-foreground mb-6">
        {t("rooms.availabilityDescription")}
      </p>

      <Separator className="my-6" />

      {isLoadingRooms ? (
        <div className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-[400px] w-full" />
        </div>
      ) : rooms && rooms.length > 0 ? (
        <Tabs
          defaultValue={selectedRoom?.id.toString() || rooms[0].id.toString()}
          onValueChange={handleRoomChange}
          className="w-full"
        >
          <ScrollArea className="w-full">
            <div className="pb-4 max-w-full">
              <TabsList className="h-12 w-auto">
                {rooms.map((room) => (
                  <TabsTrigger
                    key={room.id}
                    value={room.id.toString()}
                    className="flex items-center gap-2 px-4"
                  >
                    <span>{room.name}</span>
                    {room.active ? (
                      <Badge className="bg-green-500 hover:bg-green-600">
                        {t("rooms.active")}
                      </Badge>
                    ) : (
                      <Badge variant="destructive">{t("rooms.inactive")}</Badge>
                    )}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>
          </ScrollArea>

          {rooms.map((room) => (
            <TabsContent
              key={room.id}
              value={room.id.toString()}
              className="space-y-6"
            >
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>{room.name}</span>
                    <Badge className="ml-2">
                      {t("common.capacity")}: {room.capacity}
                    </Badge>
                  </CardTitle>
                  <CardDescription>
                    {room.description || t("common.noDescription")}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div>
                      <h3 className="text-lg font-semibold mb-2">
                        {t("rooms.details")}
                      </h3>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">
                            {t("common.location")}:
                          </span>
                          <span className="font-medium">
                            {room.locationId}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">
                            {t("rooms.flatRate")}:
                          </span>
                          <span className="font-medium">
                            {room.flatRate
                              ? `€${(room.flatRate / 100).toFixed(2)}`
                              : t("common.notApplicable")}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">
                            {t("rooms.hourlyRate")}:
                          </span>
                          <span className="font-medium">
                            {room.hourlyRate
                              ? `€${(room.hourlyRate / 100).toFixed(2)}`
                              : t("common.notApplicable")}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">
                            {t("rooms.attendeeRate")}:
                          </span>
                          <span className="font-medium">
                            {room.attendeeRate
                              ? `€${(room.attendeeRate / 100).toFixed(2)}`
                              : t("common.notApplicable")}
                          </span>
                        </div>
                      </div>

                      {room.facilities && room.facilities.length > 0 && (
                        <div className="mt-4">
                          <h3 className="text-lg font-semibold mb-2">
                            {t("rooms.facilities")}
                          </h3>
                          <div className="flex flex-wrap gap-2">
                            {room.facilities.map((facility) => (
                              <Badge
                                key={facility.id}
                                variant="outline"
                                className="flex gap-2"
                              >
                                <span>{facility.name}</span>
                                <span className="text-xs">
                                  €{(facility.cost / 100).toFixed(2)}
                                </span>
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <div>
                      <div className="relative h-48 w-full overflow-hidden rounded-lg bg-muted mb-4">
                        <div className="absolute inset-0 flex items-center justify-center bg-muted">
                          <span className="text-muted-foreground">
                            {t("common.noImage")}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <RoomAvailabilityCalendar 
                room={room} 
                onDateClick={handleDateClick}
                numberOfDays={90}
              />
            </TabsContent>
          ))}
        </Tabs>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground">
              {t("rooms.noRoomsAvailable")}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}