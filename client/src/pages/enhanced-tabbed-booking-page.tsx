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
import { format, addHours, parse } from "date-fns";
import { z } from "zod";
import { Check, CalendarIcon, Save, AlertCircle, Clock, User, Mail, Phone, Building } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useTranslation } from "react-i18next";

// Form schema using zod - identical to original
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

export default function EnhancedTabbedBookingPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();
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
        title: t("booking.created"),
        description: t("booking.createdDescription"),
      });
      queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
      form.reset(); // Reset the form after successful submission
      setActiveTab("event-details");
    },
    onError: (error) => {
      toast({
        title: t("booking.failed"),
        description: error.message || t("booking.failedDescription"),
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
        <h1 className="text-2xl font-semibold mb-1">{t("booking.newBooking")}</h1>
        <p className="text-muted-foreground mb-6">{t("booking.newBookingDescription")}</p>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <Card>
              <CardContent className="pt-6">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="event-details">{t("booking.tabs.eventDetails")}</TabsTrigger>
                    <TabsTrigger value="rooms">{t("booking.tabs.rooms")}</TabsTrigger>
                    <TabsTrigger value="customer-info">{t("booking.tabs.customerInfo")}</TabsTrigger>
                  </TabsList>
                  
                  {/* Tab 1: Event Details */}
                  <TabsContent value="event-details" className="space-y-4 pt-4">
                    <FormField
                      control={form.control}
                      name="title"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("booking.eventName")}</FormLabel>
                          <FormControl>
                            <Input placeholder={t("booking.enterEventName")} {...field} />
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
                            <FormLabel>{t("booking.startTime")}</FormLabel>
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
                                      <span>{t("booking.selectStartTime")}</span>
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
                                    <span className="text-sm">{t("booking.time")}:</span>
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
                            <FormLabel>{t("booking.endTime")}</FormLabel>
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
                                      <span>{t("booking.selectEndTime")}</span>
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
                                    <span className="text-sm">{t("booking.time")}:</span>
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
                      name="purpose"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("booking.purpose")}</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder={t("booking.purposePlaceholder")}
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
                          <FormLabel>{t("booking.attendeesCount")}</FormLabel>
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
                        {t("booking.nextRoomSelection")} →
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
                          <FormLabel>{t("booking.selectRooms")}</FormLabel>
                          <FormDescription>
                            {t("booking.selectRoomsDescription")}
                          </FormDescription>
                          
                          {roomsLoading ? (
                            <div className="text-sm text-muted-foreground py-4">{t("common.loading")}</div>
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
                                          title: t("booking.datesRequired"),
                                          description: t("booking.datesRequiredDescription"),
                                          variant: "destructive"
                                        });
                                        return;
                                      }
                                      
                                      if (showAvailability && !isAvailable) {
                                        toast({
                                          title: t("booking.roomUnavailable"),
                                          description: t("booking.roomUnavailableDescription", { roomName: room.name }),
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
                                          <span>{t("booking.capacity")}: {room.capacity} {t("booking.people")}</span>
                                          <div className="flex flex-wrap gap-1 mt-1">
                                            {room.flatRate && (
                                              <Badge variant="outline" className="text-xs">
                                                {t("booking.flat")}: €{(room.flatRate / 100).toFixed(2)}
                                              </Badge>
                                            )}
                                            {room.hourlyRate && (
                                              <Badge variant="outline" className="text-xs">
                                                {t("booking.hourly")}: €{(room.hourlyRate / 100).toFixed(2)}
                                              </Badge>
                                            )}
                                            {room.attendeeRate && (
                                              <Badge variant="outline" className="text-xs">
                                                {t("booking.perAttendee")}: €{(room.attendeeRate / 100).toFixed(2)}
                                              </Badge>
                                            )}
                                          </div>
                                        </div>
                                        {showAvailability && (
                                          <div className={`text-xs mt-1 ${isAvailable ? "text-green-600" : "text-red-600"}`}>
                                            {isAvailable ? t("booking.available") : t("booking.unavailable")}
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
                            <div className="text-sm text-muted-foreground py-4">{t("booking.noRooms")}</div>
                          )}
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Room Settings for each selected room */}
                    {form.getValues('selectedRooms')?.length > 0 && (
                      <div className="space-y-6 mt-6 pt-4 border-t">
                        <h3 className="text-lg font-medium">{t("booking.roomSettings")}</h3>
                        
                        {form.getValues('selectedRooms').map(roomId => {
                          const room = rooms?.find(r => r.id === roomId);
                          if (!room) return null;
                          
                          const facilities = room.facilities && Array.isArray(room.facilities) 
                            ? (room.facilities as unknown as Facility[])
                            : [];
                            
                          return (
                            <div key={roomId} className="border p-4 rounded-lg space-y-4">
                              <h4 className="font-medium">{room.name}</h4>
                              
                              {/* Pricing Model Selection */}
                              <FormField
                                control={form.control}
                                name={`roomSettings.${roomId}.costType`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>{t("booking.pricingModel")}</FormLabel>
                                    <Select
                                      onValueChange={field.onChange}
                                      defaultValue={field.value || "flat"}
                                    >
                                      <FormControl>
                                        <SelectTrigger>
                                          <SelectValue placeholder={t("booking.selectPricingModel")} />
                                        </SelectTrigger>
                                      </FormControl>
                                      <SelectContent>
                                        {room.flatRate && (
                                          <SelectItem value="flat">
                                            {t("booking.flatRate")} - €{(room.flatRate / 100).toFixed(2)}
                                          </SelectItem>
                                        )}
                                        {room.hourlyRate && (
                                          <SelectItem value="hourly">
                                            {t("booking.hourlyRate")} - €{(room.hourlyRate / 100).toFixed(2)}
                                          </SelectItem>
                                        )}
                                        {room.attendeeRate && (
                                          <SelectItem value="per_attendee">
                                            {t("booking.perAttendeeRate")} - €{(room.attendeeRate / 100).toFixed(2)}
                                          </SelectItem>
                                        )}
                                      </SelectContent>
                                    </Select>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                              
                              {/* Facilities Selection */}
                              {facilities.length > 0 && (
                                <FormField
                                  control={form.control}
                                  name={`roomSettings.${roomId}.requestedFacilities`}
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>{t("booking.facilities")}</FormLabel>
                                      <FormDescription>
                                        {t("booking.facilitiesDescription")}
                                      </FormDescription>
                                      
                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                                        {facilities.map((facility, idx) => (
                                          <FormItem
                                            key={facility.id || `facility-${idx}`}
                                            className="flex space-x-3 space-y-0 items-center border rounded-md p-3"
                                          >
                                            <FormControl>
                                              <Checkbox
                                                checked={field.value?.includes(facility.name)}
                                                onCheckedChange={(checked) => {
                                                  if (checked) {
                                                    const updatedFacilities = [...(field.value || []), facility.name];
                                                    field.onChange(updatedFacilities);
                                                  } else {
                                                    const updatedFacilities = (field.value || []).filter(
                                                      (name) => name !== facility.name
                                                    );
                                                    field.onChange(updatedFacilities);
                                                  }
                                                }}
                                              />
                                            </FormControl>
                                            <div className="flex justify-between items-center w-full">
                                              <span className="text-sm font-medium">{facility.name}</span>
                                              <span className="text-xs text-muted-foreground">
                                                €{(facility.cost / 100).toFixed(2)}
                                              </span>
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
                    )}
                    
                    <div className="flex justify-between pt-4">
                      <Button type="button" variant="outline" onClick={goToPrevTab}>
                        ← {t("common.back")}
                      </Button>
                      <Button type="button" onClick={goToNextTab}>
                        {t("booking.nextCustomerInfo")} →
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
                            <FormLabel>{t("booking.customerName")}</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <User className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input className="pl-9" placeholder={t("booking.fullName")} {...field} />
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
                            <FormLabel>{t("booking.email")}</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input className="pl-9" placeholder={t("booking.emailAddress")} {...field} />
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
                            <FormLabel>{t("booking.phone")}</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <Phone className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input className="pl-9" placeholder={t("booking.phoneNumber")} {...field} />
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
                            <FormLabel>{t("booking.organization")}</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <Building className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input className="pl-9" placeholder={t("booking.companyOrOrganization")} {...field} />
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="membershipNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("booking.membershipNumber")}</FormLabel>
                          <FormControl>
                            <Input placeholder={t("booking.membershipNumberPlaceholder")} {...field} />
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
                          <FormLabel>{t("booking.notes")}</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder={t("booking.notesPlaceholder")}
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
                              {t("booking.sendConfirmation")}
                            </FormLabel>
                            <FormDescription>
                              {t("booking.sendConfirmationDescription")}
                            </FormDescription>
                          </div>
                        </FormItem>
                      )}
                    />
                    
                    {/* Cost Summary */}
                    {form.getValues('selectedRooms')?.length > 0 && (
                      <div className="bg-muted/50 p-4 rounded-lg mt-2">
                        <h3 className="font-semibold mb-2">{t("booking.costSummary")}</h3>
                        {(() => {
                          const costInfo = calculateCost(form.getValues());
                          const formattedTotal = costInfo.total.toFixed(2);
                          
                          return (
                            <div className="text-sm">
                              <div className="flex justify-between">
                                <span>{t("booking.totalCost")}:</span>
                                <span className="font-medium">€{formattedTotal}</span>
                              </div>
                              <div className="text-xs text-muted-foreground mt-1">
                                {t("booking.costDetails", {
                                  roomCount: costInfo.roomCosts?.length,
                                  hours: costInfo.hours
                                })}
                              </div>
                              {costInfo.facilities.length > 0 && (
                                <div className="mt-2 text-xs">
                                  <span className="text-muted-foreground">{t("booking.includedFacilities")}:</span>
                                  <div className="pl-2 mt-1 space-y-1">
                                    {costInfo.facilities.map((facility, idx) => (
                                      <div key={idx} className="flex justify-between">
                                        <span>{facility.name}</span>
                                        <span>€{facility.cost.toFixed(2)}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    )}
                    
                    <div className="flex justify-between pt-4">
                      <Button type="button" variant="outline" onClick={goToPrevTab}>
                        ← {t("common.back")}
                      </Button>
                      <Button 
                        type="submit"
                        disabled={createBookingMutation.isPending}
                      >
                        {createBookingMutation.isPending ? (
                          t("booking.creating")
                        ) : (
                          <>
                            <Save className="h-4 w-4 mr-2" />
                            {t("booking.createBooking")}
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