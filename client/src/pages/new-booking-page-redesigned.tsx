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
import { Card, CardContent, CardHeader, CardFooter } from "@/components/ui/card";
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
import { format, addHours } from "date-fns";
import { z } from "zod";
import { Check, CalendarIcon, Save, AlertCircle, Clock, User, Building, Phone, Mail } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "react-i18next";

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
  customerOrganization: z.string().optional(),
  notes: z.string().optional(),
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
  const { t } = useTranslation();

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
      customerOrganization: "",
      notes: "",
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
      <div className="container mx-auto max-w-4xl py-6 px-4 sm:px-6">
        <div className="flex flex-col space-y-6">
          <div className="flex flex-col space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">New Booking</h1>
            <p className="text-muted-foreground">Create a new room reservation request</p>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              {/* Step 1: Basic Information */}
              <Card>
                <CardHeader className="pb-4">
                  <h2 className="text-xl font-semibold">Event Details</h2>
                </CardHeader>
                <CardContent className="space-y-6">
                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Event Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter event name or title" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="startTime"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Start Time</FormLabel>
                          <div className="relative">
                            <Popover>
                              <PopoverTrigger asChild>
                                <FormControl>
                                  <Button
                                    variant={"outline"}
                                    className={cn(
                                      "w-full pl-3 text-left font-normal",
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
                                <div className="border-t border-border p-3">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm">Time:</span>
                                    <Input
                                      type="time"
                                      className="flex-1"
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
                                </div>
                              </PopoverContent>
                            </Popover>
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="endTime"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>End Time</FormLabel>
                          <div className="relative">
                            <Popover>
                              <PopoverTrigger asChild>
                                <FormControl>
                                  <Button
                                    variant={"outline"}
                                    className={cn(
                                      "w-full pl-3 text-left font-normal",
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
                                <div className="border-t border-border p-3">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm">Time:</span>
                                    <Input
                                      type="time"
                                      className="flex-1"
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
                                </div>
                              </PopoverContent>
                            </Popover>
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

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

                  <FormField
                    control={form.control}
                    name="attendeesCount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Number of Attendees</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            min={1} 
                            {...field} 
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              {/* Step 2: Room Selection */}
              <Card>
                <CardHeader className="pb-4">
                  <h2 className="text-xl font-semibold">Room Selection</h2>
                  <p className="text-muted-foreground text-sm">Select one or more rooms for your event</p>
                </CardHeader>
                <CardContent>
                  <FormField
                    control={form.control}
                    name="selectedRooms"
                    render={({ field }) => (
                      <FormItem>
                        <div className="space-y-4">
                          {roomsLoading ? (
                            <div className="text-sm text-muted-foreground p-4 text-center">
                              Loading available rooms...
                            </div>
                          ) : rooms && rooms.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {rooms.map((room) => {
                                const isSelected = field.value?.includes(room.id);
                                const isAvailable = isRoomAvailable(room.id);
                                const showAvailability = startTime && endTime;
                                
                                return (
                                  <div 
                                    key={room.id}
                                    className={cn(
                                      "group relative rounded-lg border-2 shadow-sm transition-all hover:shadow-md p-4",
                                      isSelected ? "border-primary bg-primary/5" : 
                                      showAvailability && !isAvailable ? "border-destructive/60 bg-destructive/5" :
                                      "border-border",
                                      showAvailability && !isAvailable ? "opacity-70" : ""
                                    )}
                                    onClick={() => {
                                      // First check if dates are selected
                                      const startTime = form.getValues('startTime');
                                      const endTime = form.getValues('endTime');
                                      
                                      if (!startTime || !endTime) {
                                        toast({
                                          title: "Dates Required",
                                          description: "Please select start and end dates before choosing rooms",
                                          variant: "destructive"
                                        });
                                        return;
                                      }
                                      
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
                                    <div className="flex items-start justify-between gap-4">
                                      <div className="flex-1">
                                        <h3 className="font-medium text-lg">{room.name}</h3>
                                        <div className="text-sm text-muted-foreground mt-1 space-y-1">
                                          <p>Capacity: {room.capacity} people</p>
                                          
                                          {/* Pricing information */}
                                          <div className="text-xs space-x-2">
                                            {room.flatRate && (
                                              <Badge variant="outline" className="font-normal">
                                                Flat: ${(room.flatRate / 100).toFixed(2)}
                                              </Badge>
                                            )}
                                            {room.hourlyRate && (
                                              <Badge variant="outline" className="font-normal">
                                                Hourly: ${(room.hourlyRate / 100).toFixed(2)}
                                              </Badge>
                                            )}
                                            {room.attendeeRate && (
                                              <Badge variant="outline" className="font-normal">
                                                Per Person: ${(room.attendeeRate / 100).toFixed(2)}
                                              </Badge>
                                            )}
                                          </div>
                                          
                                          {/* Availability indicator */}
                                          {showAvailability && (
                                            <div className={cn(
                                              "flex items-center mt-2 text-sm",
                                              isAvailable ? "text-green-600" : "text-red-600"
                                            )}>
                                              {isAvailable ? (
                                                <>
                                                  <Clock className="h-3.5 w-3.5 mr-1" />
                                                  <span>Available</span>
                                                </>
                                              ) : (
                                                <>
                                                  <AlertCircle className="h-3.5 w-3.5 mr-1" />
                                                  <span>Booked</span>
                                                </>
                                              )}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                      <div className={cn(
                                        "h-5 w-5 flex items-center justify-center rounded-full border-2",
                                        isSelected ? "border-primary bg-primary text-white" : "border-muted-foreground/30"
                                      )}>
                                        {isSelected && <Check className="h-3 w-3" />}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="text-sm text-muted-foreground p-4 text-center border rounded-md">
                              No rooms available
                            </div>
                          )}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              {/* Room-specific settings for selected rooms */}
              {form.getValues('selectedRooms')?.length > 0 && (
                <Card>
                  <CardHeader className="pb-4">
                    <h2 className="text-xl font-semibold">Room Settings</h2>
                    <p className="text-muted-foreground text-sm">Configure settings for each selected room</p>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-6">
                      {form.getValues('selectedRooms').map(roomId => {
                        const room = rooms?.find(r => r.id === roomId);
                        if (!room) return null;
                        
                        // Cast facilities to the correct type to handle room facilities
                        const facilities = room.facilities && Array.isArray(room.facilities) 
                          ? (room.facilities as unknown as Facility[]) 
                          : [];
                            
                        return (
                          <div key={room.id} className="rounded-lg border bg-card p-5 shadow-sm">
                            <h3 className="font-semibold text-lg mb-4">{room.name}</h3>
                            
                            {/* Pricing model selector */}
                            <FormField
                              control={form.control}
                              name={`roomSettings.${room.id}.costType`}
                              render={({ field }) => (
                                <FormItem className="mb-5">
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
                                    defaultValue="flat"
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
                                    
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                                      {facilities.map((facility, index) => (
                                        <FormItem
                                          key={facility.id || `facility-${index}`}
                                          className="flex items-start space-x-3 space-y-0 rounded-md border p-3"
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
                                          <div className="flex-1 space-y-1 leading-none">
                                            <FormLabel className="font-normal cursor-pointer">
                                              {facility.name}
                                            </FormLabel>
                                            <div className="text-sm text-muted-foreground">
                                              ${(facility.cost / 100).toFixed(2)}
                                            </div>
                                          </div>
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
                  </CardContent>
                </Card>
              )}

              {/* Step 3: Customer Information */}
              <Card>
                <CardHeader className="pb-4">
                  <h2 className="text-xl font-semibold">Customer Information</h2>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="customerName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Customer Name</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <User className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                              <Input className="pl-9" placeholder="Full name" {...field} />
                            </div>
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
                            <div className="relative">
                              <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                              <Input className="pl-9" placeholder="Email address" {...field} />
                            </div>
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
                          <FormLabel>Phone Number</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Phone className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                              <Input className="pl-9" placeholder="Phone number" {...field} />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="customerOrganization"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Organization</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Building className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                              <Input className="pl-9" placeholder="Company or organization" {...field} />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="mt-6">
                    <FormField
                      control={form.control}
                      name="notes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Additional Notes</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Any additional information or special requirements"
                              className="min-h-[100px] resize-none"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="mt-6">
                    <FormField
                      control={form.control}
                      name="sendConfirmation"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel className="font-medium cursor-pointer">
                              Send Confirmation Email
                            </FormLabel>
                            <FormDescription>
                              Send an email confirmation to the customer with booking details
                            </FormDescription>
                          </div>
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Cost Preview */}
              {form.getValues('selectedRooms')?.length > 0 && !!startTime && !!endTime && (
                <Card>
                  <CardHeader className="pb-4">
                    <h2 className="text-xl font-semibold">Cost Summary</h2>
                    <p className="text-sm text-muted-foreground">Estimated cost breakdown for your booking</p>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {(() => {
                        const costInfo = calculateCost(form.getValues());
                        const formattedTotal = costInfo.total.toFixed(2);
                        
                        return (
                          <>
                            <div className="bg-muted/50 p-4 rounded-lg">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium">Duration:</span>
                                <span className="text-sm">{costInfo.hours} hour{costInfo.hours !== 1 ? 's' : ''}</span>
                              </div>
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium">Attendees:</span>
                                <span className="text-sm">{form.getValues('attendeesCount')} person{form.getValues('attendeesCount') !== 1 ? 's' : ''}</span>
                              </div>
                              <Separator className="my-3" />
                              {costInfo.roomCosts?.map((roomCost, index) => (
                                <div key={index} className="mb-3">
                                  <h3 className="text-sm font-medium mb-2">{roomCost.roomName}</h3>
                                  <div className="pl-2 border-l-2 border-primary/20 space-y-1 text-sm">
                                    <div className="flex justify-between">
                                      <span className="text-muted-foreground">Base rate:</span>
                                      <span>${roomCost.base.toFixed(2)}</span>
                                    </div>
                                    {roomCost.facilities.length > 0 && (
                                      <div className="text-muted-foreground">
                                        <div className="flex justify-between">
                                          <span>Facilities:</span>
                                          <span>${roomCost.facilities.reduce((sum, f) => sum + f.cost, 0).toFixed(2)}</span>
                                        </div>
                                        <div className="pl-2 text-xs space-y-0.5 mt-1">
                                          {roomCost.facilities.map((f, idx) => (
                                            <div key={idx} className="flex justify-between">
                                              <span>{f.name}:</span>
                                              <span>${f.cost.toFixed(2)}</span>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}
                              <Separator className="my-3" />
                              <div className="flex items-center justify-between font-semibold text-lg mt-2">
                                <span>Total:</span>
                                <span>${formattedTotal}</span>
                              </div>
                            </div>
                            <div className="text-xs text-muted-foreground italic">
                              Note: This is an estimated cost. Final pricing may be adjusted during approval.
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardFooter className="flex justify-between pt-6">
                  <Button 
                    variant="outline"
                    type="button" 
                    onClick={() => form.reset()}
                  >
                    Clear Form
                  </Button>
                  <Button
                    type="submit"
                    disabled={createBookingMutation.isPending}
                    className="min-w-[150px]"
                  >
                    {createBookingMutation.isPending ? (
                      <>Creating Booking...</>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        Create Booking
                      </>
                    )}
                  </Button>
                </CardFooter>
              </Card>
            </form>
          </Form>
        </div>
      </div>
    </AppLayout>
  );
}