import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { insertRoomSchema, Room, Facility, Location } from "@shared/schema";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { X, Trash } from "lucide-react";

const roomFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  locationId: z.coerce.number().min(1, "Location is required"),
  description: z.string().optional(),
  capacity: z.coerce.number().min(1, "Capacity must be at least 1"),
  flatRate: z.coerce.number().optional(),
  hourlyRate: z.coerce.number().optional(),
  attendeeRate: z.coerce.number().optional(),
  active: z.boolean().default(true),
  facilities: z.array(z.object({
    id: z.string(),
    name: z.string(),
    cost: z.coerce.number(),
  })).default([]),
});

type RoomFormValues = z.infer<typeof roomFormSchema>;

interface RoomFormModalProps {
  room?: Room;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RoomFormModal({ room, open, onOpenChange }: RoomFormModalProps) {
  const { toast } = useToast();
  const [newFacility, setNewFacility] = useState({ name: "", cost: "" });
  
  const { data: locations } = useQuery<Location[]>({
    queryKey: ["/api/locations"],
  });

  const form = useForm<RoomFormValues>({
    resolver: zodResolver(roomFormSchema),
    defaultValues: {
      name: room?.name || "",
      locationId: room?.locationId || 0,
      description: room?.description || "",
      capacity: room?.capacity || 0,
      flatRate: room?.flatRate ? room.flatRate / 100 : undefined,
      hourlyRate: room?.hourlyRate ? room.hourlyRate / 100 : undefined,
      attendeeRate: room?.attendeeRate ? room.attendeeRate / 100 : undefined,
      active: room?.active ?? true,
      facilities: ((room?.facilities as unknown as Facility[]) || []).map(facility => ({
        ...facility,
        cost: facility.cost / 100,
      })),
    },
  });

  const createRoomMutation = useMutation({
    mutationFn: async (formData: RoomFormValues) => {
      // Convert currency values from decimal to cents for storage
      const dataToSend = {
        ...formData,
        flatRate: formData.flatRate !== undefined ? Math.round(formData.flatRate * 100) : undefined,
        hourlyRate: formData.hourlyRate !== undefined ? Math.round(formData.hourlyRate * 100) : undefined,
        attendeeRate: formData.attendeeRate !== undefined ? Math.round(formData.attendeeRate * 100) : undefined,
        facilities: formData.facilities.map(facility => ({
          ...facility,
          cost: Math.round(facility.cost * 100),
        })),
      };
      
      const res = await apiRequest("POST", "/api/rooms", dataToSend);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Room created",
        description: "The room has been successfully created.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/rooms"] });
      onOpenChange(false);
    },
    onError: (error) => {
      toast({
        title: "Failed to create room",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateRoomMutation = useMutation({
    mutationFn: async (formData: RoomFormValues) => {
      if (!room) throw new Error("Room is undefined");
      
      // Convert currency values from decimal to cents for storage
      const dataToSend = {
        ...formData,
        flatRate: formData.flatRate !== undefined ? Math.round(formData.flatRate * 100) : undefined,
        hourlyRate: formData.hourlyRate !== undefined ? Math.round(formData.hourlyRate * 100) : undefined,
        attendeeRate: formData.attendeeRate !== undefined ? Math.round(formData.attendeeRate * 100) : undefined,
        facilities: formData.facilities.map(facility => ({
          ...facility,
          cost: Math.round(facility.cost * 100),
        })),
      };
      
      const res = await apiRequest("PUT", `/api/rooms/${room.id}`, dataToSend);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Room updated",
        description: "The room has been successfully updated.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/rooms"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rooms", room?.id] });
      onOpenChange(false);
    },
    onError: (error) => {
      toast({
        title: "Failed to update room",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: RoomFormValues) => {
    if (room) {
      updateRoomMutation.mutate(data);
    } else {
      createRoomMutation.mutate(data);
    }
  };

  const addFacility = () => {
    if (!newFacility.name.trim()) return;
    
    const cost = parseFloat(newFacility.cost) || 0;
    const facilities = form.getValues("facilities") || [];
    
    form.setValue("facilities", [
      ...facilities,
      {
        id: Date.now().toString(),
        name: newFacility.name.trim(),
        cost,
      },
    ]);
    
    setNewFacility({ name: "", cost: "" });
  };

  const removeFacility = (id: string) => {
    const facilities = form.getValues("facilities");
    form.setValue(
      "facilities",
      facilities.filter((f) => f.id !== id)
    );
  };

  const isPending = createRoomMutation.isPending || updateRoomMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{room ? "Edit Room" : "Add Room"}</DialogTitle>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Room name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="locationId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Location</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value ? String(field.value) : undefined}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a location" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {locations?.map((location) => (
                        <SelectItem key={location.id} value={String(location.id)}>
                          {location.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="capacity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Capacity</FormLabel>
                  <FormControl>
                    <Input type="number" min="1" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Room description" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="hourlyRate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Hourly Rate (€)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" min="0" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="flatRate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Flat Rate (€)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" min="0" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="attendeeRate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Rate per Attendee (€)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" min="0" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <div>
              <h4 className="text-sm font-medium mb-4">Facilities</h4>
              
              <div className="space-y-3">
                {form.watch("facilities").map((facility, index) => (
                  <div key={facility.id} className="flex items-center justify-between">
                    <div className="flex items-center">
                      <span className="text-sm text-gray-900">{facility.name}</span>
                    </div>
                    <div className="flex items-center">
                      <div className="flex rounded-md shadow-sm mr-2">
                        <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-gray-300 bg-gray-50 text-gray-500 sm:text-sm">€</span>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          className="w-16 rounded-l-none"
                          value={facility.cost}
                          onChange={(e) => {
                            const facilities = [...form.getValues("facilities")];
                            facilities[index].cost = parseFloat(e.target.value) || 0;
                            form.setValue("facilities", facilities);
                          }}
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeFacility(facility.id)}
                      >
                        <Trash className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                ))}
                
                <div className="flex items-center justify-between mt-4">
                  <div className="flex-1 mr-2">
                    <Input
                      placeholder="Add facility"
                      value={newFacility.name}
                      onChange={(e) => setNewFacility({ ...newFacility, name: e.target.value })}
                    />
                  </div>
                  <div className="flex rounded-md shadow-sm mr-2">
                    <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-gray-300 bg-gray-50 text-gray-500 sm:text-sm">€</span>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="Cost"
                      className="w-16 rounded-l-none"
                      value={newFacility.cost}
                      onChange={(e) => setNewFacility({ ...newFacility, cost: e.target.value })}
                    />
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    onClick={addFacility}
                  >
                    Add
                  </Button>
                </div>
              </div>
            </div>
            
            <FormField
              control={form.control}
              name="active"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>Active</FormLabel>
                    <p className="text-sm text-muted-foreground">
                      This room is available for booking
                    </p>
                  </div>
                </FormItem>
              )}
            />
            
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Saving..." : room ? "Save Changes" : "Create Room"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
