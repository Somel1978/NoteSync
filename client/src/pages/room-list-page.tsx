import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { AppLayout } from "@/components/layout/app-layout";
import { RoomCard } from "@/components/room/room-card";
import { RoomFormModal } from "@/components/room/room-form-modal";
import { Button } from "@/components/ui/button";
import { Room } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { Plus, FilterX } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function RoomListPage() {
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [locationFilter, setLocationFilter] = useState<string>("all");
  const { toast } = useToast();

  const { data: rooms, isLoading: roomsLoading } = useQuery<Room[]>({
    queryKey: ["/api/rooms"],
  });

  const { data: locations, isLoading: locationsLoading } = useQuery({
    queryKey: ["/api/locations"],
  });

  const deleteRoomMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/rooms/${id}`);
    },
    onSuccess: () => {
      toast({
        title: "Room deleted",
        description: "The room has been successfully deleted.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/rooms"] });
    },
    onError: (error) => {
      toast({
        title: "Failed to delete room",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleAddRoom = () => {
    setSelectedRoom(null);
    setModalOpen(true);
  };

  const handleEditRoom = (room: Room) => {
    setSelectedRoom(room);
    setModalOpen(true);
  };

  const handleDeleteRoom = (roomId: number) => {
    if (confirm("Are you sure you want to delete this room? This action cannot be undone.")) {
      deleteRoomMutation.mutate(roomId);
    }
  };

  const filteredRooms = rooms?.filter(room => 
    locationFilter === "all" || room.locationId.toString() === locationFilter
  );

  const getLocationName = (locationId: number) => {
    if (!locations || !Array.isArray(locations)) return `Location #${locationId}`;
    const location = locations.find((loc: any) => loc.id === locationId);
    return location ? location.name : `Location #${locationId}`;
  };

  return (
    <AppLayout>
      <div className="p-4 pt-8 sm:p-8">
        <header className="mb-6 sm:mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center">
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold text-gray-800">Available Rooms</h1>
            <p className="text-gray-600 text-sm">Manage rooms and their facilities</p>
          </div>
          <div className="mt-4 sm:mt-0">
            <Button 
              className="flex items-center" 
              onClick={handleAddRoom}
            >
              <Plus className="h-5 w-5 mr-2" />
              Add Room
            </Button>
          </div>
        </header>

        <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Filter by location:</span>
            <Select
              value={locationFilter}
              onValueChange={setLocationFilter}
              disabled={locationsLoading}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Select a location" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Locations</SelectItem>
                {Array.isArray(locations) && locations.map((location: any) => (
                  <SelectItem key={location.id} value={location.id.toString()}>
                    {location.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {locationFilter !== "all" && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLocationFilter("all")}
                className="ml-2"
              >
                <FilterX className="h-4 w-4 mr-1" />
                Clear
              </Button>
            )}
          </div>
          <div className="flex items-center text-sm text-gray-500">
            {filteredRooms ? `Showing ${filteredRooms.length} of ${rooms?.length} rooms` : "Loading rooms..."}
          </div>
        </div>

        {roomsLoading ? (
          <div className="flex justify-center items-center h-64">
            <p className="text-gray-500">Loading rooms...</p>
          </div>
        ) : filteredRooms && filteredRooms.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredRooms.map((room) => (
              <RoomCard
                key={room.id}
                room={room}
                onEdit={handleEditRoom}
                onDelete={handleDeleteRoom}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col justify-center items-center h-64 bg-gray-50 rounded-lg border border-dashed border-gray-300">
            <p className="text-gray-500 mb-4">No rooms found</p>
            <Button onClick={handleAddRoom}>Add Your First Room</Button>
          </div>
        )}

        <RoomFormModal
          room={selectedRoom || undefined}
          open={modalOpen}
          onOpenChange={setModalOpen}
        />
      </div>
    </AppLayout>
  );
}
