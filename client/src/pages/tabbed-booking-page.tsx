import React, { useCallback, useState } from "react";
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
import { format, addHours } from "date-fns";
import { z } from "zod";
import { Check, CalendarIcon, Save, AlertCircle, Clock, User, Building, Mail } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

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

export default function TabbedBookingPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("event-details");

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
      setActiveTab("event-details"); // Reset to first tab
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
  
  // Helper to navigate to next tab
  const goToNextTab = () => {
    if (activeTab === "event-details") {
      // Validate fields in this tab before proceeding
      form.trigger(["title", "startTime", "endTime", "attendeesCount"]).then(isValid => {
        if (isValid) setActiveTab("rooms");
      });
    } else if (activeTab === "rooms") {
      form.trigger("selectedRooms").then(isValid => {
        if (isValid) setActiveTab("customer-info");
      });
    }
  };

  // Helper to navigate to previous tab
  const goToPrevTab = () => {
    if (activeTab === "rooms") {
      setActiveTab("event-details");
    } else if (activeTab === "customer-info") {
      setActiveTab("rooms");
    }
  };

  return (
    <AppLayout>
      <div className="container max-w-4xl py-6 px-4 sm:px-6">
        <h1 className="text-3xl font-bold tracking-tight mb-1">New Booking</h1>
        <p className="text-muted-foreground mb-6">Create a new room reservation request</p>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <Card>
              <CardContent className="pt-6">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="event-details">Event Details</TabsTrigger>
                    <TabsTrigger value="rooms">Rooms</TabsTrigger>
                    <TabsTrigger value="customer-info">Customer Info</TabsTrigger>
                  </TabsList>
                  
                  {/* Tab 1: Event Details */}
                  <TabsContent value="event-details" className="space-y-4 pt-4">
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

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="startTime"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Start Time</FormLabel>
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
                                        date.setHours(startTime.getHours() + 1);
                                        date.setMinutes(startTime.getMinutes());
                                      } else {
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
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

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
                    
                    <div className="flex justify-end pt-4">
                      <Button type="button" onClick={goToNextTab}>
                        Next: Room Selection
                      </Button>
                    </div>
                  </TabsContent>
                  
                  {/* Tab 2: Room Selection */}
                  <TabsContent value="rooms" className="space-y-4 pt-4">
                    <FormField
                      control={form.control}
                      name="selectedRooms"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Select Rooms</FormLabel>
                          <FormDescription>
                            Please select one or more rooms for your booking
                          </FormDescription>
                          
                          {roomsLoading ? (
                            <div className="text-sm text-muted-foreground py-4">Loading rooms...</div>
                          ) : rooms && rooms.length > 0 ? (
                            <div className="space-y-2 mt-2">
                              {rooms.map((room) => {
                                const isSelected = field.value?.includes(room.id);
                                const isAvailable = isRoomAvailable(room.id);
                                const showAvailability = startTime && endTime;
                                
                                return (
                                  <div 
                                    key={room.id}
                                    className={cn(
                                      "border rounded-md p-3 cursor-pointer transition-colors",
                                      isSelected ? "border-primary bg-primary/5" : 
                                        showAvailability && !isAvailable ? "border-destructive/60 bg-destructive/5" :
                                        "border-border",
                                      showAvailability && !isAvailable ? "opacity-60" : ""
                                    )}
                                    onClick={() => {
                                      if (!startTime || !endTime) {
                                        toast({
                                          title: "Date Selection Required",
                                          description: "Please select start and end dates before picking rooms",
                                          variant: "destructive"
                                        });
                                        return;
                                      }
                                      
                                      if (showAvailability && !isAvailable) {
                                        toast({
                                          title: "Room Unavailable",
                                          description: `${room.name} is already booked during the selected time`,
                                          variant: "destructive"
                                        });
                                        return;
                                      }
                                      
                                      const newSelectedRooms = isSelected
                                        ? field.value.filter(id => id !== room.id)
                                        : [...field.value, room.id];
                                      
                                      field.onChange(newSelectedRooms);
                                      
                                      if (newSelectedRooms.length > 0) {
                                        form.setValue('roomId', newSelectedRooms[0]);
                                        
                                        if (!isSelected) {
                                          form.setValue(`roomSettings.${room.id}`, {
                                            requestedFacilities: [],
                                            costType: 'flat'
                                          });
                                        }
                                      } else {
                                        form.setValue('roomId', 0);
                                      }
                                    }}
                                  >
                                    <div className="flex justify-between items-start">
                                      <div className="flex-1">
                                        <h3 className="font-medium">{room.name}</h3>
                                        <div className="text-sm text-muted-foreground mt-1">
                                          <span>Capacity: {room.capacity} people</span>
                                          <div className="flex flex-wrap gap-1 mt-1">
                                            {room.flatRate && (
                                              <Badge variant="outline" className="text-xs">
                                                Flat: ${(room.flatRate / 100).toFixed(2)}
                                              </Badge>
                                            )}
                                            {room.hourlyRate && (
                                              <Badge variant="outline" className="text-xs">
                                                Hourly: ${(room.hourlyRate / 100).toFixed(2)}
                                              </Badge>
                                            )}
                                            {room.attendeeRate && (
                                              <Badge variant="outline" className="text-xs">
                                                Per person: ${(room.attendeeRate / 100).toFixed(2)}
                                              </Badge>
                                            )}
                                          </div>
                                        </div>
                                        {showAvailability && (
                                          <div className={`text-xs mt-1 ${isAvailable ? "text-green-600" : "text-red-600"}`}>
                                            {isAvailable ? "Available" : "Not available at selected time"}
                                          </div>
                                        )}
                                      </div>
                                      
                                      <div className={cn(
                                        "h-5 w-5 rounded-full border-2 flex items-center justify-center",
                                        isSelected ? "bg-primary border-primary" : "border-muted-foreground/30"
                                      )}>
                                        {isSelected && <Check className="h-3 w-3 text-white" />}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="text-sm text-muted-foreground py-4">No rooms available</div>
                          )}
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <div className="flex justify-between pt-4">
                      <Button type="button" variant="outline" onClick={goToPrevTab}>
                        Back
                      </Button>
                      <Button type="button" onClick={goToNextTab}>
                        Next: Customer Info
                      </Button>
                    </div>
                  </TabsContent>
                  
                  {/* Tab 3: Customer Information */}
                  <TabsContent value="customer-info" className="space-y-4 pt-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                    </div>

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
                    
                    <FormField
                      control={form.control}
                      name="notes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Additional Notes</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Any additional information"
                              className="min-h-[80px] resize-none"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

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
                    
                    {/* Cost Summary */}
                    {form.getValues('selectedRooms')?.length > 0 && (
                      <div className="bg-muted/50 p-4 rounded-lg mt-2">
                        <h3 className="font-semibold mb-2">Cost Summary</h3>
                        {(() => {
                          const costInfo = calculateCost(form.getValues());
                          const formattedTotal = costInfo.total.toFixed(2);
                          
                          return (
                            <div className="text-sm">
                              <div className="flex justify-between">
                                <span>Total Cost:</span>
                                <span className="font-medium">${formattedTotal}</span>
                              </div>
                              <div className="text-xs text-muted-foreground mt-1">
                                Includes {costInfo.roomCosts?.length} room(s), {costInfo.hours} hour(s)
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    )}
                    
                    <div className="flex justify-between pt-4">
                      <Button type="button" variant="outline" onClick={goToPrevTab}>
                        Back
                      </Button>
                      <Button 
                        type="submit"
                        disabled={createBookingMutation.isPending}
                      >
                        {createBookingMutation.isPending ? (
                          "Creating Booking..."
                        ) : (
                          <>
                            <Save className="h-4 w-4 mr-2" />
                            Create Booking
                          </>
                        )}
                      </Button>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </form>
        </Form>
      </div>
    </AppLayout>
  );
}