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
import { Room, Facility } from "@shared/schema";
import { format, addHours, parse } from "date-fns";
import { z } from "zod";
import { Save, CalendarIcon } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

// Form schema using zod
const bookingFormSchema = z.object({
  title: z.string().min(1, "Event name is required"),
  roomId: z.coerce.number().min(1, "Room is required"),
  startTime: z.date({ required_error: "Start time is required" }),
  endTime: z.date({ required_error: "End time is required" }),
  purpose: z.string().optional(),
  customerName: z.string().min(1, "Customer name is required"),
  customerEmail: z.string().email("Invalid email format"),
  customerPhone: z.string().optional(),
  membershipNumber: z.string().optional(),
  attendeesCount: z.coerce.number().min(1, "Must have at least 1 attendee"),
  sendConfirmation: z.boolean().default(false),
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
      purpose: "",
      customerName: "",
      customerEmail: "",
      customerPhone: "",
      membershipNumber: "",
      attendeesCount: 1,
      sendConfirmation: false,
      requestedFacilities: [],
      costType: "flat",
    },
  });

  const selectedRoomId = form.watch("roomId");
  const { data: selectedRoom } = useQuery<Room>({
    queryKey: ["/api/rooms", selectedRoomId],
    enabled: selectedRoomId > 0,
  });

  const createBookingMutation = useMutation({
    mutationFn: async (data: BookingFormValues) => {
      const calculatedCost = calculateCost(data, selectedRoom);
      
      // Prepare the appointment data
      const appointmentData = {
        ...data,
        userId: user?.id,
        agreedCost: calculatedCost.total * 100, // Convert to cents
        costBreakdown: {
          base: calculatedCost.base * 100, // Convert to cents
          total: calculatedCost.total * 100, // Convert to cents
          hours: calculatedCost.hours,
          attendees: data.attendeesCount,
          facilities: calculatedCost.facilities,
        },
      };
      
      const res = await apiRequest("POST", "/api/appointments", appointmentData);
      return await res.json();
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

  const calculateCost = (formData: BookingFormValues, room?: Room) => {
    if (!room) return { base: 0, total: 0, hours: 0, facilities: [] };
    
    let baseCost = 0;
    let hours = 0;
    const facilityDetails: { name: string; cost: number }[] = [];
    
    // Calculate duration in hours (rounded up)
    if (formData.startTime && formData.endTime) {
      const duration = formData.endTime.getTime() - formData.startTime.getTime();
      hours = Math.ceil(duration / (1000 * 60 * 60));
    }
    
    // Calculate base cost based on cost type
    switch (formData.costType) {
      case "flat":
        baseCost = room.flatRate ? room.flatRate / 100 : 0;
        break;
      case "hourly":
        baseCost = (room.hourlyRate ? room.hourlyRate / 100 : 0) * hours;
        break;
      case "per_attendee":
        baseCost = (room.attendeeRate ? room.attendeeRate / 100 : 0) * formData.attendeesCount;
        break;
    }
    
    // Add cost of requested facilities
    let facilitiesCost = 0;
    if (room.facilities && Array.isArray(room.facilities) && formData.requestedFacilities?.length > 0) {
      formData.requestedFacilities.forEach(facilityName => {
        const facility = (room.facilities as unknown as Facility[]).find(f => f.name === facilityName);
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
                      name="roomId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Room</FormLabel>
                          <Select
                            onValueChange={(value) => field.onChange(parseInt(value))}
                            value={field.value ? field.value.toString() : undefined}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select a room" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {roomsLoading ? (
                                <SelectItem value="loading" disabled>
                                  Loading rooms...
                                </SelectItem>
                              ) : rooms?.length ? (
                                rooms.map((room) => (
                                  <SelectItem key={room.id} value={room.id.toString()}>
                                    {room.name}
                                  </SelectItem>
                                ))
                              ) : (
                                <SelectItem value="empty" disabled>
                                  No rooms available
                                </SelectItem>
                              )}
                            </SelectContent>
                          </Select>
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

                  {selectedRoom?.facilities && Array.isArray(selectedRoom.facilities) && (selectedRoom.facilities as unknown as Facility[]).length > 0 && (
                    <div className="mt-4">
                      <FormField
                        control={form.control}
                        name="requestedFacilities"
                        render={() => (
                          <FormItem>
                            <div className="mb-2">
                              <FormLabel>Requested Facilities</FormLabel>
                              <FormDescription>
                                Select the facilities you need for this booking
                              </FormDescription>
                            </div>
                            <div className="flex flex-wrap gap-4">
                              {(selectedRoom.facilities as unknown as Facility[]).map((facility) => (
                                <FormField
                                  key={facility.id}
                                  control={form.control}
                                  name="requestedFacilities"
                                  render={({ field }) => {
                                    return (
                                      <FormItem
                                        key={facility.id}
                                        className="flex flex-row items-start space-x-3 space-y-0"
                                      >
                                        <FormControl>
                                          <Checkbox
                                            checked={field.value?.includes(facility.name)}
                                            onCheckedChange={(checked) => {
                                              return checked
                                                ? field.onChange([...field.value, facility.name])
                                                : field.onChange(
                                                    field.value?.filter(
                                                      (value) => value !== facility.name
                                                    )
                                                  );
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
                                    );
                                  }}
                                />
                              ))}
                            </div>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
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
                              {...field}
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
                              onCheckedChange={field.onChange}
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
                  
                  <FormField
                    control={form.control}
                    name="costType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cost Type</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a cost type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="flat" disabled={!selectedRoom?.flatRate}>
                              Flat Rate {selectedRoom?.flatRate ? `(€${(selectedRoom.flatRate / 100).toFixed(2)})` : "(Not available)"}
                            </SelectItem>
                            <SelectItem value="hourly" disabled={!selectedRoom?.hourlyRate}>
                              Hourly Rate {selectedRoom?.hourlyRate ? `(€${(selectedRoom.hourlyRate / 100).toFixed(2)}/hour)` : "(Not available)"}
                            </SelectItem>
                            <SelectItem value="per_attendee" disabled={!selectedRoom?.attendeeRate}>
                              Per Attendee {selectedRoom?.attendeeRate ? `(€${(selectedRoom.attendeeRate / 100).toFixed(2)}/person)` : "(Not available)"}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Cost Preview */}
                  {selectedRoom && (
                    <div className="mt-6 bg-gray-50 p-4 rounded-lg border border-gray-200">
                      <h3 className="font-medium text-sm text-gray-700 mb-2">Cost Preview</h3>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Base Rate:</span>
                          <span>€{calculateCost(form.getValues(), selectedRoom).base.toFixed(2)}</span>
                        </div>
                        {form.watch("requestedFacilities")?.length > 0 && (
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
                  )}
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
