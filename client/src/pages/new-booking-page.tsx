import React, { useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { AppLayout } from "@/components/layout/app-layout";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Room, Facility, RoomBooking, Appointment } from "@shared/schema";
import { format, addHours, parse } from "date-fns";
import { z } from "zod";
import { Check, CalendarIcon, Save, AlertCircle, Clock } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

// Form schema using zod
const bookingFormSchema = z.object({
  title: z.string().min(1, "Event name is required"),
  roomId: z.coerce.number().min(1, "At least one room is required"),
  selectedRooms: z.array(z.coerce.number()).min(1, "At least one room is required"),
  startTime: z.date({ required_error: "Start time is required" }),
  endTime: z.date({ required_error: "End time is required" }),
  purpose: z.string().optional(),
  customerName: z.string().min(1, "Customer name is required"),
  customerEmail: z.string().email("Invalid email format"),
  customerPhone: z.string().optional(),
  membershipNumber: z.string().optional(),
  attendeesCount: z.coerce.number().min(1, "Must have at least 1 attendee"),
  sendConfirmation: z.boolean().default(false),
  roomSettings: z.record(z.object({
    requestedFacilities: z.array(z.string()).default([]),
    costType: z.enum(["flat", "hourly", "per_attendee"]),
  })).default({}),
  // Keep for backward compatibility
  requestedFacilities: z.array(z.string()).default([]),
  costType: z.enum(["flat", "hourly", "per_attendee"]),
});

type BookingFormValues = z.infer<typeof bookingFormSchema>;

export default function NewBookingPage() {
  const { user } = useAuth();
  const { toast } = useToast();

  const { data: rooms, isLoading: roomsLoading } = useQuery<Room[]>({
    queryKey: ["/api/rooms"],
  });

  const form = useForm<BookingFormValues>({
    resolver: zodResolver(bookingFormSchema),
    defaultValues: {
      title: "",
      roomId: 0,
      selectedRooms: [] as number[],
      purpose: "",
      customerName: "",
      customerEmail: "",
      customerPhone: "",
      membershipNumber: "",
      attendeesCount: 1,
      sendConfirmation: false,
      roomSettings: {},
      requestedFacilities: [],
      costType: "flat",
    },
  });

  const selectedRoomId = form.watch("roomId");
  const { data: selectedRoom } = useQuery<Room>({
    queryKey: ["/api/rooms", selectedRoomId],
    enabled: selectedRoomId > 0,
  });
  
  // Fetch appointments for availability checking
  const startTime = form.watch('startTime');
  const endTime = form.watch('endTime');
  const { data: appointments } = useQuery<Appointment[]>({
    queryKey: ["/api/appointments"],
    // Only fetch when we have start and end times
    enabled: !!startTime && !!endTime,
  });

  const createBookingMutation = useMutation({
    mutationFn: async (data: BookingFormValues) => {
      const calculatedCost = calculateCost(data, selectedRoom);
      
      // Prepare room bookings data from selected rooms
      const roomBookings: RoomBooking[] = data.selectedRooms?.length 
        ? data.selectedRooms.map(roomId => {
            const room = rooms?.find(r => r.id === roomId);
            if (!room) return null;
            
            const roomSettings = data.roomSettings[roomId] || {
              requestedFacilities: [],
              costType: 'flat'
            };
            
            const roomCost = calculateRoomCost(
              roomId,
              roomSettings,
              data.startTime,
              data.endTime,
              data.attendeesCount
            );
            
            return {
              roomId,
              roomName: room.name,
              requestedFacilities: roomSettings.requestedFacilities || [],
              costType: roomSettings.costType,
              cost: roomCost.total * 100 // Convert to cents
            };
          }).filter(Boolean) as RoomBooking[]
        : selectedRoom 
          ? [{
              roomId: selectedRoom.id,
              roomName: selectedRoom.name,
              requestedFacilities: data.requestedFacilities || [],
              costType: data.costType,
              cost: calculateCost(data, selectedRoom).total * 100 // Convert to cents
            }]
          : [];
      
      // Format dates as ISO strings for backend processing
      // The server will convert these ISO strings back to Date objects
      const startTimeStr = data.startTime.toISOString();
      const endTimeStr = data.endTime.toISOString();
      
      // Prepare the appointment data
      const appointmentData = {
        ...data,
        startTime: startTimeStr,
        endTime: endTimeStr,
        userId: user?.id,
        agreedCost: calculatedCost.total * 100, // Convert to cents
        costBreakdown: {
          base: calculatedCost.base * 100, // Convert to cents
          total: calculatedCost.total * 100, // Convert to cents
          hours: calculatedCost.hours,
          attendees: data.attendeesCount,
          facilities: calculatedCost.facilities,
        },
        rooms: roomBookings
      };
      
      console.log("Submitting appointment data:", appointmentData);
      
      try {
        const res = await apiRequest("POST", "/api/appointments", appointmentData);
        return await res.json();
      } catch (error) {
        console.error("Error creating appointment:", error);
        throw error;
      }
    },
    onSuccess: () => {
      toast({
        title: "Booking created",
        description: "Your booking has been created successfully and is pending approval.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
      form.reset(); // Reset the form after successful submission
    },
    onError: (error) => {
      toast({
        title: "Failed to create booking",
        description: error.message || "An error occurred while creating the booking.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: BookingFormValues) => {
    createBookingMutation.mutate(data);
  };

  const calculateRoomCost = (
    roomId: number, 
    roomSettings: {
      requestedFacilities: string[];
      costType: "flat" | "hourly" | "per_attendee";
    },
    startTime?: Date,
    endTime?: Date,
    attendeesCount: number = 1
  ) => {
    const room = rooms?.find(r => r.id === roomId);
    if (!room) return { base: 0, total: 0, hours: 0, facilities: [], roomName: "Unknown Room" };
    
    let baseCost = 0;
    let hours = 0;
    const facilityDetails: { name: string; cost: number }[] = [];
    
    // Calculate duration in hours (rounded up)
    if (startTime && endTime) {
      const duration = endTime.getTime() - startTime.getTime();
      hours = Math.ceil(duration / (1000 * 60 * 60));
    }
    
    // Calculate base cost based on cost type
    switch (roomSettings.costType) {
      case "flat":
        baseCost = room.flatRate ? room.flatRate / 100 : 0;
        break;
      case "hourly":
        baseCost = (room.hourlyRate ? room.hourlyRate / 100 : 0) * hours;
        break;
      case "per_attendee":
        baseCost = (room.attendeeRate ? room.attendeeRate / 100 : 0) * attendeesCount;
        break;
    }
    
    // Add cost of requested facilities
    let facilitiesCost = 0;
    const facilities = room.facilities && Array.isArray(room.facilities) 
      ? (room.facilities as unknown as Facility[])
      : [];
      
    if (facilities.length > 0 && roomSettings.requestedFacilities?.length > 0) {
      roomSettings.requestedFacilities.forEach(facilityName => {
        const facility = facilities.find(f => f.name === facilityName);
        if (facility) {
          facilitiesCost += facility.cost / 100;
          facilityDetails.push({ name: facility.name, cost: facility.cost / 100 });
        }
      });
    }
    
    return {
      base: baseCost,
      total: baseCost + facilitiesCost,
      hours,
      facilities: facilityDetails,
      roomName: room.name,
    };
  };

  // Function to check if a room is available during selected time
  const isRoomAvailable = useCallback((roomId: number) => {
    if (!startTime || !endTime || !appointments) {
      return true; // If no time selected or no appointment data, assume available
    }
    
    // Check for conflicts with existing appointments
    const conflicts = appointments.filter(appointment => {
      // Skip if it's not for this room
      if (appointment.roomId !== roomId) return false;
      
      const appointmentStart = new Date(appointment.startTime);
      const appointmentEnd = new Date(appointment.endTime);
      
      // Check for overlap
      return (
        (startTime <= appointmentEnd && endTime >= appointmentStart) ||
        (appointmentStart <= endTime && appointmentEnd >= startTime)
      );
    });
    
    return conflicts.length === 0;
  }, [startTime, endTime, appointments]);
  
  const calculateCost = (formData: BookingFormValues, room?: Room) => {
    if (formData.selectedRooms?.length > 0) {
      // Calculate cost for all selected rooms
      const roomCosts = formData.selectedRooms.map(roomId => {
        const roomSettings = formData.roomSettings[roomId] || { 
          requestedFacilities: [], 
          costType: 'flat' 
        };
        
        return calculateRoomCost(
          roomId,
          roomSettings,
          formData.startTime,
          formData.endTime,
          formData.attendeesCount
        );
      });
      
      // Calculate totals
      const base = roomCosts.reduce((sum, cost) => sum + cost.base, 0);
      const total = roomCosts.reduce((sum, cost) => sum + cost.total, 0);
      const facilities = roomCosts.flatMap(cost => 
        cost.facilities.map(f => ({
          ...f,
          roomName: cost.roomName
        }))
      );
      
      // Get hours from the first room (they should all be the same)
      const hours = roomCosts[0]?.hours || 0;
      
      return {
        base,
        total,
        hours,
        facilities,
        roomCosts
      };
    } else if (room) {
      // Legacy single room calculation
      const result = calculateRoomCost(
        room.id,
        {
          requestedFacilities: formData.requestedFacilities || [],
          costType: formData.costType
        },
        formData.startTime,
        formData.endTime,
        formData.attendeesCount
      );
      
      return {
        base: result.base,
        total: result.total,
        hours: result.hours,
        facilities: result.facilities,
        roomCosts: [result]
      };
    }
    
    // Default empty result
    return { 
      base: 0, 
      total: 0, 
      hours: 0, 
      facilities: [],
      roomCosts: []
    };
  };

  return (
    <AppLayout>
      <div className="p-8">
        <header className="mb-8">
          <h1 className="text-2xl font-semibold text-gray-800">New Booking</h1>
          <p className="text-gray-600 text-sm">Create a new room booking request</p>
        </header>

        <Card>
          <CardContent className="pt-6">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {/* Basic Information */}
                <div>
                  <h2 className="text-lg font-medium text-gray-800 mb-4">Basic Information</h2>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="title"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Event Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter event name" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="selectedRooms"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Rooms</FormLabel>
                          <FormDescription>
                            Select one or more rooms for your booking
                          </FormDescription>
                          <div className="space-y-2">
                            {roomsLoading ? (
                              <div className="text-sm text-gray-500">Loading rooms...</div>
                            ) : rooms && rooms.length > 0 ? (
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {rooms.map((room) => {
                                  const isSelected = field.value?.includes(room.id);
                                  const isAvailable = isRoomAvailable(room.id);
                                  const showAvailability = startTime && endTime;
                                  
                                  return (
                                    <div 
                                      key={room.id}
                                      className={`p-4 border rounded-md cursor-pointer transition-colors ${
                                        isSelected 
                                          ? "border-primary bg-primary/5" 
                                          : showAvailability && !isAvailable
                                          ? "border-red-200 bg-red-50"
                                          : "border-gray-200 hover:border-gray-300"
                                      } ${showAvailability && !isAvailable ? 'opacity-60' : ''}`}
                                      onClick={() => {
                                        // If room is not available at selected time, show warning
                                        if (showAvailability && !isAvailable) {
                                          toast({
                                            title: "Room unavailable",
                                            description: `${room.name} is already booked for the selected time.`,
                                            variant: "destructive",
                                          });
                                          return;
                                        }
                                        
                                        const newSelectedRooms = isSelected
                                          ? field.value.filter(id => id !== room.id)
                                          : [...field.value, room.id];
                                        
                                        field.onChange(newSelectedRooms);
                                        
                                        // Set the primary room (roomId) to the first selected room
                                        if (newSelectedRooms.length > 0) {
                                          form.setValue('roomId', newSelectedRooms[0]);
                                          
                                          // Always ensure room settings exist for selected rooms
                                          if (!isSelected) {
                                            // Safe way to update room settings without causing state issues
                                            setTimeout(() => {
                                              form.setValue(`roomSettings.${room.id}`, {
                                                requestedFacilities: [],
                                                costType: 'flat'
                                              });
                                            }, 0);
                                          }
                                        } else {
                                          form.setValue('roomId', 0);
                                        }
                                      }}
                                    >
                                      <div className="flex justify-between items-start">
                                        <div>
                                          <h3 className="font-medium">{room.name}</h3>
                                          <div className="text-sm text-gray-500">
                                            Capacity: {room.capacity} people
                                            
                                            {/* Availability indicator */}
                                            {showAvailability && (
                                              <div className={`flex items-center mt-1 ${isAvailable ? 'text-green-600' : 'text-red-600'}`}>
                                                {isAvailable ? (
                                                  <>
                                                    <Clock className="h-3 w-3 mr-1" />
                                                    <span>Available</span>
                                                  </>
                                                ) : (
                                                  <>
                                                    <AlertCircle className="h-3 w-3 mr-1" />
                                                    <span>Booked</span>
                                                  </>
                                                )}
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                        <div className="h-5 w-5 mt-1 flex items-center justify-center">
                                          {isSelected && <Check className="h-4 w-4 text-primary" />}
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="text-sm text-gray-500">No rooms available</div>
                            )}
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                    <FormField
                      control={form.control}
                      name="startTime"
                      render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel>Start Time</FormLabel>
                          <Popover>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant={"outline"}
                                  className={cn(
                                    "pl-3 text-left font-normal",
                                    !field.value && "text-muted-foreground"
                                  )}
                                >
                                  {field.value ? (
                                    format(field.value, "PPP HH:mm")
                                  ) : (
                                    <span>Select start date and time</span>
                                  )}
                                  <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={field.value}
                                onSelect={(date) => {
                                  if (date) {
                                    const now = new Date();
                                    date.setHours(now.getHours());
                                    date.setMinutes(0);
                                    
                                    field.onChange(date);
                                    
                                    // Set end time to 1 hour after start time if not set yet
                                    const currentEndTime = form.getValues("endTime");
                                    if (!currentEndTime) {
                                      form.setValue("endTime", addHours(date, 1));
                                    }
                                  }
                                }}
                                disabled={(date) => date < new Date()}
                                initialFocus
                              />
                              <div className="p-3 border-t border-border">
                                <Input
                                  type="time"
                                  onChange={(e) => {
                                    const timeStr = e.target.value;
                                    const date = field.value || new Date();
                                    const [hours, minutes] = timeStr.split(':').map(Number);
                                    
                                    date.setHours(hours);
                                    date.setMinutes(minutes);
                                    
                                    field.onChange(date);
                                  }}
                                  value={field.value ? format(field.value, "HH:mm") : ""}
                                />
                              </div>
                            </PopoverContent>
                          </Popover>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="endTime"
                      render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel>End Time</FormLabel>
                          <Popover>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant={"outline"}
                                  className={cn(
                                    "pl-3 text-left font-normal",
                                    !field.value && "text-muted-foreground"
                                  )}
                                >
                                  {field.value ? (
                                    format(field.value, "PPP HH:mm")
                                  ) : (
                                    <span>Select end date and time</span>
                                  )}
                                  <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={field.value}
                                onSelect={(date) => {
                                  if (date) {
                                    const startTime = form.getValues("startTime");
                                    if (startTime) {
                                      // Transfer the hours/minutes from startTime + 1 hour
                                      date.setHours(startTime.getHours() + 1);
                                      date.setMinutes(startTime.getMinutes());
                                    } else {
                                      // Default to current time + 1 hour
                                      const now = new Date();
                                      date.setHours(now.getHours() + 1);
                                      date.setMinutes(0);
                                    }
                                    field.onChange(date);
                                  }
                                }}
                                disabled={(date) => {
                                  const startTime = form.getValues("startTime");
                                  return startTime ? date < startTime : date < new Date();
                                }}
                                initialFocus
                              />
                              <div className="p-3 border-t border-border">
                                <Input
                                  type="time"
                                  onChange={(e) => {
                                    const timeStr = e.target.value;
                                    const date = field.value || new Date();
                                    const [hours, minutes] = timeStr.split(':').map(Number);
                                    
                                    date.setHours(hours);
                                    date.setMinutes(minutes);
                                    
                                    field.onChange(date);
                                  }}
                                  value={field.value ? format(field.value, "HH:mm") : ""}
                                />
                              </div>
                            </PopoverContent>
                          </Popover>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="mt-4">
                    <FormField
                      control={form.control}
                      name="purpose"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Purpose</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Describe the purpose of this booking"
                              className="resize-none"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Room-specific settings for selected rooms */}
                  {form.getValues('selectedRooms')?.length > 0 && (
                    <div className="mt-6 border-t border-gray-200 pt-4">
                      <h3 className="text-md font-medium text-gray-800 mb-4">Room Settings</h3>
                      
                      <div className="space-y-6">
                        {form.getValues('selectedRooms').map(roomId => {
                          const room = rooms?.find(r => r.id === roomId);
                          if (!room) return null;
                          
                          // Cast facilities to the correct type to handle room facilities
                          const facilities = room.facilities && Array.isArray(room.facilities) 
                            ? (room.facilities as unknown as Facility[]) 
                            : [];
                              
                          return (
                            <div key={room.id} className="p-4 border rounded-md bg-gray-50">
                              <h4 className="font-medium mb-2">{room.name} Settings</h4>
                              
                              {/* Pricing model selector */}
                              <FormField
                                control={form.control}
                                name={`roomSettings.${room.id}.costType`}
                                render={({ field }) => (
                                  <FormItem className="mb-4">
                                    <FormLabel>Pricing Model</FormLabel>
                                    <Select
                                      onValueChange={(value) => {
                                        field.onChange(value);
                                        
                                        // Force cost preview update
                                        setTimeout(() => {
                                          form.trigger('roomSettings');
                                        }, 50);
                                      }}
                                      value={field.value}
                                    >
                                      <FormControl>
                                        <SelectTrigger>
                                          <SelectValue placeholder="Select pricing model" />
                                        </SelectTrigger>
                                      </FormControl>
                                      <SelectContent>
                                        <SelectItem value="flat">Flat Rate</SelectItem>
                                        <SelectItem value="hourly">Hourly Rate</SelectItem>
                                        <SelectItem value="per_attendee">Per Attendee</SelectItem>
                                      </SelectContent>
                                    </Select>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                              
                              {/* Room facilities - only show if room has facilities */}
                              {Array.isArray(facilities) && facilities.length > 0 && facilities.every(f => f && typeof f.name === 'string') && (
                                <FormField
                                  control={form.control}
                                  name={`roomSettings.${room.id}.requestedFacilities`}
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>Additional Facilities</FormLabel>
                                      <FormDescription>
                                        Select the facilities you need for this room
                                      </FormDescription>
                                      
                                      <div className="flex flex-wrap gap-4 mt-2">
                                        {facilities.map((facility, index) => (
                                          <FormItem
                                            key={facility.id || `facility-${index}`}
                                            className="flex flex-row items-start space-x-3 space-y-0"
                                          >
                                            <FormControl>
                                              <Checkbox
                                                checked={field.value?.includes(facility.name)}
                                                onCheckedChange={(checked) => {
                                                  // Prevent rapid rerendering and potential infinite loops
                                                  setTimeout(() => {
                                                    if (checked) {
                                                      const currentValues = field.value || [];
                                                      // Only add if not already included
                                                      if (!currentValues.includes(facility.name)) {
                                                        // Update form with new selection
                                                        field.onChange([...currentValues, facility.name]);
                                                        
                                                        // Force cost preview update
                                                        setTimeout(() => {
                                                          form.trigger('roomSettings');
                                                        }, 50);
                                                      }
                                                    } else {
                                                      // Update form with removed selection
                                                      field.onChange(
                                                        (field.value || []).filter(
                                                          (value) => value !== facility.name
                                                        )
                                                      );
                                                      
                                                      // Force cost preview update
                                                      setTimeout(() => {
                                                        form.trigger('roomSettings');
                                                      }, 50);
                                                    }
                                                  }, 0);
                                                }}
                                              />
                                            </FormControl>
                                            <FormLabel className="font-normal">
                                              {facility.name}
                                              {facility.cost > 0 && (
                                                <span className="text-sm text-gray-500 ml-1">
                                                  (+€{(facility.cost / 100).toFixed(2)})
                                                </span>
                                              )}
                                            </FormLabel>
                                          </FormItem>
                                        ))}
                                      </div>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Customer Information */}
                <div className="border-t border-gray-200 pt-6">
                  <h2 className="text-lg font-medium text-gray-800 mb-4">Customer Information</h2>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="customerName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Customer Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter customer name" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="customerEmail"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input type="email" placeholder="Enter email address" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="customerPhone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Phone</FormLabel>
                          <FormControl>
                            <Input type="tel" placeholder="Enter phone number" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="membershipNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Membership Number</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter membership number (optional)" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="attendeesCount"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Number of Attendees</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              placeholder={`Maximum ${selectedRoom?.capacity || 50} attendees allowed`}
                              min="1"
                              max={selectedRoom?.capacity || 50}
                              // Use onChange to capture value changes and update cost preview
                              onChange={(e) => {
                                field.onChange(e);
                                // Force cost preview update after value changes
                                setTimeout(() => {
                                  form.trigger('attendeesCount');
                                  form.trigger('roomSettings');
                                }, 50);
                              }}
                              value={field.value}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="mt-4">
                    <FormField
                      control={form.control}
                      name="sendConfirmation"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={(checked) => {
                                // Prevent rapid rerendering by using setTimeout
                                setTimeout(() => field.onChange(checked), 0);
                              }}
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel>Send Confirmation Email</FormLabel>
                            <FormDescription>
                              Send a booking confirmation email to the customer
                            </FormDescription>
                          </div>
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* Pricing Information */}
                <div className="border-t border-gray-200 pt-6">
                  <h2 className="text-lg font-medium text-gray-800 mb-4">Pricing Information</h2>

                  {/* Cost Preview */}
                  {form.getValues('selectedRooms')?.length > 0 ? (
                    <div className="mt-6 bg-gray-50 p-4 rounded-lg border border-gray-200">
                      <h3 className="font-medium text-gray-700 mb-3">Cost Preview</h3>
                      
                      {/* Show costs for each room - using getValues to prevent excessive rerenders */}
                      <div className="space-y-4">
                        {calculateCost(form.getValues()).roomCosts?.map((roomCost, index) => (
                          <div key={index} className="p-3 border border-gray-200 rounded-md bg-white">
                            <div className="font-medium mb-2">{roomCost.roomName}</div>
                            
                            <div className="space-y-1">
                              <div className="flex justify-between text-sm">
                                <span>Base Rate:</span>
                                <span>€{roomCost.base.toFixed(2)}</span>
                              </div>
                              
                              {roomCost.facilities.length > 0 && (
                                <div>
                                  <div className="text-sm font-medium mt-1">Facilities:</div>
                                  {roomCost.facilities.map((facility, fIndex) => (
                                    <div key={fIndex} className="flex justify-between text-sm pl-4">
                                      <span>{facility.name}</span>
                                      <span>€{facility.cost.toFixed(2)}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                              
                              <div className="flex justify-between text-sm font-medium mt-1">
                                <span>Room Total:</span>
                                <span>€{roomCost.total.toFixed(2)}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                        
                        {/* Grand total */}
                        <div className="border-t border-gray-300 pt-3 mt-3 flex justify-between font-medium">
                          <span>Grand Total:</span>
                          <span>€{calculateCost(form.getValues()).total.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  ) : selectedRoom ? (
                    <div className="mt-6 bg-gray-50 p-4 rounded-lg border border-gray-200">
                      <h3 className="font-medium text-sm text-gray-700 mb-2">Cost Preview</h3>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Base Rate:</span>
                          <span>€{calculateCost(form.getValues(), selectedRoom).base.toFixed(2)}</span>
                        </div>
                        {form.getValues("requestedFacilities")?.length > 0 && (
                          <div>
                            <div className="text-sm font-medium">Facilities:</div>
                            {calculateCost(form.getValues(), selectedRoom).facilities.map((facility, index) => (
                              <div key={index} className="flex justify-between text-sm pl-4">
                                <span>{facility.name}</span>
                                <span>€{facility.cost.toFixed(2)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="border-t border-gray-200 pt-2 flex justify-between font-medium">
                          <span>Total:</span>
                          <span>€{calculateCost(form.getValues(), selectedRoom).total.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="flex justify-end">
                  <Button
                    type="submit"
                    className="flex items-center"
                    disabled={createBookingMutation.isPending}
                  >
                    {createBookingMutation.isPending ? (
                      <>Creating Booking...</>
                    ) : (
                      <>
                        <Save className="h-5 w-5 mr-2" />
                        Create Booking
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
