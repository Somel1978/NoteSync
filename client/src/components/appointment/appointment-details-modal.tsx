import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";
import { Edit, Save, X, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Appointment, Room, RoomBooking } from "@shared/schema";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface AppointmentDetailsModalProps {
  appointmentId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApprove?: (id: number) => void;
  onReject?: (id: number) => void;
}

export function AppointmentDetailsModal({
  appointmentId,
  open,
  onOpenChange,
  onApprove,
  onReject,
}: AppointmentDetailsModalProps) {
  const [activeTab, setActiveTab] = useState("details");
  const [isEditMode, setIsEditMode] = useState(false);
  const [activeRoomIndex, setActiveRoomIndex] = useState(-1);
  const [customFacilityName, setCustomFacilityName] = useState("");
  const [customFacilityCost, setCustomFacilityCost] = useState(0);
  const [editedAppointment, setEditedAppointment] = useState<Partial<AppointmentWithRooms>>({});
  const [customPricing, setCustomPricing] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);

  const { toast } = useToast();
  
  // Define a type that includes the appointment with properly typed rooms
  type AppointmentWithRooms = Omit<Appointment, 'rooms'> & {
    rooms: RoomBooking[];
  }
  
  // Helper functions to safely handle rooms array
  const getRoomsArray = (appointment?: AppointmentWithRooms | null): RoomBooking[] => {
    if (!appointment) return [];
    if (!appointment.rooms) return [];
    if (!Array.isArray(appointment.rooms)) return [];
    return appointment.rooms;
  };

  // Fetch appointment data
  const { data: appointment, isLoading: isAppointmentLoading } = useQuery<AppointmentWithRooms>({
    queryKey: ["/api/appointments", appointmentId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/appointments/${appointmentId}`);
      const data = await res.json();
      return data;
    },
    enabled: open && appointmentId > 0,
  });

  // Fetch room data for the primary room
  const { data: room, isLoading: isRoomLoading } = useQuery<Room>({
    queryKey: ["/api/rooms", appointment?.roomId],
    enabled: !!appointment?.roomId,
  });

  // Fetch all rooms data for selecting/editing
  const { data: rooms } = useQuery<Room[]>({
    queryKey: ["/api/rooms"],
    enabled: open && isEditMode,
  });

  // Fetch audit logs for the appointment
  const { data: auditLogs, isLoading: isLogsLoading } = useQuery({
    queryKey: [`/api/appointments/${appointmentId}/audit`],
    enabled: open && appointmentId > 0 && activeTab === "history",
  });

  // Mutation for approving appointments
  const approveMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("PUT", `/api/appointments/${id}/approve`);
      return await res.json();
    },
    onSuccess: () => {
      toast({ title: "Appointment approved" });
      queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error approving appointment",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Mutation for rejecting appointments
  const rejectMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: number; reason: string }) => {
      const res = await apiRequest("PUT", `/api/appointments/${id}/reject`, { reason });
      return await res.json();
    },
    onSuccess: () => {
      toast({ title: "Appointment rejected" });
      queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
      onOpenChange(false);
      setRejectionReason("");
    },
    onError: (error: Error) => {
      toast({
        title: "Error rejecting appointment",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Mutation for updating appointment
  const updateMutation = useMutation({
    mutationFn: async (data: Partial<Appointment>) => {
      const res = await apiRequest("PUT", `/api/appointments/${appointmentId}`, data);
      return await res.json();
    },
    onSuccess: () => {
      toast({ title: "Appointment updated successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
      setIsEditMode(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error updating appointment",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Initialize edited appointment when appointment data loads
  useEffect(() => {
    if (appointment) {
      setEditedAppointment(appointment);
      
      // Check if custom pricing is enabled
      if (appointment.costBreakdown && 
          typeof appointment.costBreakdown === 'object' && 
          (appointment.costBreakdown as any).isCustom) {
        setCustomPricing(true);
      } else {
        setCustomPricing(false);
      }
    }
  }, [appointment]);

  // Reset state when modal closes
  useEffect(() => {
    if (!open) {
      setIsEditMode(false);
      setActiveTab("details");
      setEditedAppointment({});
      setCustomPricing(false);
    }
  }, [open]);

  // Get available facilities for a room
  const getAvailableFacilities = (roomId: number) => {
    if (!rooms) return [];
    const targetRoom = rooms.find(r => r.id === roomId);
    if (!targetRoom || !targetRoom.facilities) return [];
    
    try {
      if (typeof targetRoom.facilities === 'string') {
        return JSON.parse(targetRoom.facilities);
      }
      return targetRoom.facilities;
    } catch (e) {
      console.error('Error parsing facilities:', e);
      return [];
    }
  };

  // Handlers
  const handleToggleEditMode = () => {
    if (isEditMode) {
      // Save changes
      updateMutation.mutate(editedAppointment);
    } else {
      // Enter edit mode
      setIsEditMode(true);
    }
  };

  const handleInputChange = (field: string, value: any) => {
    setEditedAppointment((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleApprove = () => {
    if (onApprove && appointmentId) {
      onApprove(appointmentId);
    } else {
      approveMutation.mutate(appointmentId);
    }
  };

  const handleReject = () => {
    setIsRejectDialogOpen(true);
  };

  const handleConfirmReject = () => {
    if (onReject && appointmentId) {
      onReject(appointmentId);
    } else {
      rejectMutation.mutate({ id: appointmentId, reason: rejectionReason });
    }
    setIsRejectDialogOpen(false);
  };

  const handleRoomChange = (roomId: number) => {
    handleInputChange('roomId', roomId);
  };

  const handleCustomPricingToggle = (checked: boolean) => {
    setCustomPricing(checked);
    
    // When custom pricing is disabled, revert to calculated cost
    if (!checked) {
      console.log("Toggle off custom pricing, recalculating costs");
      
      // Calculate costs for each room
      let totalCost = 0;
      const updatedRooms = [...(editedAppointment.rooms as RoomBooking[])];
      
      updatedRooms.forEach((roomBooking, index) => {
        const selectedRoom = rooms?.find(r => r.id === roomBooking.roomId);
        if (selectedRoom) {
          const roomCost = calculateRoomCost(roomBooking.roomId, roomBooking.costType, roomBooking.requestedFacilities);
          
          updatedRooms[index] = {
            ...updatedRooms[index],
            cost: roomCost.totalCost
          };
          
          totalCost += roomCost.totalCost;
        }
      });
      
      handleInputChange('rooms', updatedRooms);
      handleInputChange('agreedCost', totalCost);
      
      // Update the cost breakdown
      const costBreakdown = {
        ...(appointment?.costBreakdown || {}),
        total: totalCost,
        isCustom: false
      };
      handleInputChange('costBreakdown', costBreakdown);
    } else {
      // When enabling custom pricing, just mark as custom
      const costBreakdown = {
        ...(appointment?.costBreakdown || {}),
        isCustom: true
      };
      handleInputChange('costBreakdown', costBreakdown);
    }
  };

  // Calculate cost for a room based on type, facilities, etc.
  const calculateRoomCost = (roomId: number, costType?: string, requestedFacilities?: string[]) => {
    if (!rooms || !Array.isArray(rooms)) {
      return { baseCost: 0, facilitiesCost: 0, totalCost: 0 };
    }
    
    const selectedRoom = rooms.find(r => r.id === roomId);
    if (!selectedRoom) {
      return { baseCost: 0, facilitiesCost: 0, totalCost: 0 };
    }
    
    // Get base cost based on type
    let baseCost = 0;
    const roomCostType = costType || 'flat';
    
    if (roomCostType === 'flat') {
      baseCost = selectedRoom.flatRate || 0;
    } else if (roomCostType === 'hourly') {
      // Calculate duration in hours based on appointment start and end times
      let hours = 1; // Default to 1 hour
      
      if (editedAppointment.startTime && editedAppointment.endTime) {
        const startTime = new Date(editedAppointment.startTime);
        const endTime = new Date(editedAppointment.endTime);
        const durationMs = endTime.getTime() - startTime.getTime();
        hours = Math.max(1, Math.ceil(durationMs / (1000 * 60 * 60)));
      }
      
      baseCost = (selectedRoom.hourlyRate || 0) * hours;
    } else if (roomCostType === 'per_attendee') {
      // Cost per attendee
      const attendees = editedAppointment.attendeesCount || 1;
      baseCost = (selectedRoom.attendeeRate || 0) * attendees;
    }
    
    // Calculate facilities cost
    let facilitiesCost = 0;
    const facilities = requestedFacilities || [];
    
    if (selectedRoom.facilities && facilities.length > 0) {
      try {
        let availableFacilities = [];
        
        if (typeof selectedRoom.facilities === 'string') {
          availableFacilities = JSON.parse(selectedRoom.facilities);
        } else if (Array.isArray(selectedRoom.facilities)) {
          availableFacilities = selectedRoom.facilities;
        }
        
        facilities.forEach(facilityName => {
          const facility = availableFacilities.find((f: any) => 
            (typeof f === 'object' && f !== null && f.name === facilityName)
          );
          
          if (facility && typeof facility === 'object' && facility.cost) {
            facilitiesCost += facility.cost;
          }
        });
      } catch (e) {
        console.error('Error calculating facilities cost:', e);
      }
    }
    
    const totalCost = baseCost + facilitiesCost;
    return { baseCost, facilitiesCost, totalCost };
  };

  // Calculate cost for the appointment (sum of all rooms)
  const calculateCost = () => {
    // If we have multiple rooms
    if (editedAppointment.rooms && Array.isArray(editedAppointment.rooms)) {
      let totalCost = 0;
      
      editedAppointment.rooms.forEach(room => {
        // Each room has its own cost stored
        totalCost += room.cost || 0;
      });
      
      return totalCost;
    }
    
    // If just a single room
    return editedAppointment.roomId ? calculateRoomCost(editedAppointment.roomId).totalCost : 0;
  };
  
  // Function to handle custom facility addition
  const handleAddCustomFacility = (roomIndex: number) => {
    if (!customFacilityName || customFacilityCost <= 0 || !editedAppointment.rooms) return;
    
    // Create the custom facility object
    const customFacility = {
      id: `custom-${Date.now()}`,
      name: customFacilityName,
      cost: customFacilityCost
    };
    
    // Add it to the room's facilities
    const updatedRooms = [...(editedAppointment.rooms as RoomBooking[])];
    const requestedFacilities = [...(updatedRooms[roomIndex].requestedFacilities || [])];
    
    // Add facility name to requested facilities
    requestedFacilities.push(customFacilityName);
    
    // Update the room with new cost including the facility
    const newCost = updatedRooms[roomIndex].cost + customFacilityCost;
    updatedRooms[roomIndex] = {
      ...updatedRooms[roomIndex],
      cost: newCost,
      requestedFacilities: requestedFacilities
    };
    
    // Update the edited appointment state
    handleInputChange('rooms', updatedRooms);
    
    // Update the total cost if not using custom pricing
    if (!customPricing) {
      let totalCost = 0;
      updatedRooms.forEach(room => {
        totalCost += room.cost;
      });
      handleInputChange('agreedCost', totalCost);
    }
    
    // Reset form
    setCustomFacilityName("");
    setCustomFacilityCost(0);
    
    // Show success message
    toast({
      title: "Custom facility added",
      description: `Added ${customFacilityName} (€${(customFacilityCost/100).toFixed(2)})`,
    });
  };

  if (isAppointmentLoading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <div className="flex justify-center items-center h-40">
            <p>Loading appointment details...</p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }


  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">
              {appointment?.title || "Appointment Details"}
            </DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="details" value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid grid-cols-5 mb-4">
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="rooms">Rooms</TabsTrigger>
              <TabsTrigger value="costs">Costs</TabsTrigger>
              <TabsTrigger value="contact">Contact</TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
            </TabsList>

            {appointment ? (
              <>
                <TabsContent value="details" className="p-6">
                  <div className="flex items-start justify-between mb-6">
                    <div className="flex items-start">
                      <div className="flex-shrink-0 bg-primary-100 rounded-full p-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <div className="ml-4">
                        <h4 className="text-sm font-medium text-gray-900">Appointment Information</h4>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      {appointment.status === "pending" && (
                        <>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={handleReject}
                            className="text-xs text-red-500 border-red-200 hover:bg-red-50"
                          >
                            Reject
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={handleApprove}
                            className="text-xs text-green-500 border-green-200 hover:bg-green-50"
                          >
                            Approve
                          </Button>
                        </>
                      )}
                      
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={handleToggleEditMode}
                        className="text-xs"
                      >
                        {isEditMode ? (
                          <>
                            <Save className="h-4 w-4 mr-2" />
                            Save
                          </>
                        ) : (
                          <>
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
                          </>
                        )}
                      </Button>
                    </div>
                  </div>

                  {appointment.status !== "pending" && (
                    <div className={`p-4 mb-6 rounded-md ${
                      appointment.status === "approved" ? "bg-green-50 text-green-800" : 
                      appointment.status === "rejected" ? "bg-red-50 text-red-800" : 
                      "bg-gray-50 text-gray-800"
                    }`}>
                      <h3 className="font-medium">
                        Status: {
                          appointment.status === "approved" ? "Approved" : 
                          appointment.status === "rejected" ? "Rejected" : 
                          appointment.status === "cancelled" ? "Cancelled" : 
                          appointment.status
                        }
                      </h3>
                      
                      {appointment.status === "rejected" && appointment.rejectionReason && (
                        <p className="mt-2 text-sm">
                          <span className="font-medium">Reason:</span> {appointment.rejectionReason}
                        </p>
                      )}
                    </div>
                  )}

                  {!isEditMode ? (
                    <div className="space-y-6">
                      <div>
                        <h5 className="text-xs font-medium text-gray-500 uppercase mb-1">Title</h5>
                        <p className="text-sm text-gray-900">{appointment.title}</p>
                      </div>
                      <div>
                        <h5 className="text-xs font-medium text-gray-500 uppercase mb-1">Description</h5>
                        <p className="text-sm text-gray-900">{appointment.description || "No description provided"}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-6">
                        <div>
                          <h5 className="text-xs font-medium text-gray-500 uppercase mb-1">Date</h5>
                          <p className="text-sm text-gray-900">
                            {appointment.startTime ? format(new Date(appointment.startTime), "MMMM d, yyyy") : "Not set"}
                          </p>
                        </div>
                        <div>
                          <h5 className="text-xs font-medium text-gray-500 uppercase mb-1">Time</h5>
                          <p className="text-sm text-gray-900">
                            {appointment.startTime && appointment.endTime ? (
                              <>
                                {format(new Date(appointment.startTime), "h:mm a")} - {format(new Date(appointment.endTime), "h:mm a")}
                              </>
                            ) : (
                              "Not set"
                            )}
                          </p>
                        </div>
                      </div>
                      <div>
                        <h5 className="text-xs font-medium text-gray-500 uppercase mb-1">Attendees</h5>
                        <p className="text-sm text-gray-900">{appointment.attendeesCount || 0} people</p>
                      </div>
                      <div>
                        <h5 className="text-xs font-medium text-gray-500 uppercase mb-1">Order Number</h5>
                        <p className="text-sm text-gray-900">{appointment.orderNumber || "Not assigned"}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <div>
                        <h5 className="text-xs font-medium text-gray-500 uppercase mb-1">Title</h5>
                        <Input
                          value={editedAppointment.title || ""}
                          onChange={(e) => handleInputChange('title', e.target.value)}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <h5 className="text-xs font-medium text-gray-500 uppercase mb-1">Description</h5>
                        <Textarea
                          value={editedAppointment.description || ""}
                          onChange={(e) => handleInputChange('description', e.target.value)}
                          className="mt-1"
                          rows={4}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-6">
                        <div>
                          <h5 className="text-xs font-medium text-gray-500 uppercase mb-1">Start Time</h5>
                          <Input
                            type="datetime-local"
                            value={editedAppointment.startTime ? new Date(editedAppointment.startTime).toISOString().slice(0, 16) : ""}
                            onChange={(e) => handleInputChange('startTime', e.target.value)}
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <h5 className="text-xs font-medium text-gray-500 uppercase mb-1">End Time</h5>
                          <Input
                            type="datetime-local"
                            value={editedAppointment.endTime ? new Date(editedAppointment.endTime).toISOString().slice(0, 16) : ""}
                            onChange={(e) => handleInputChange('endTime', e.target.value)}
                            className="mt-1"
                          />
                        </div>
                      </div>
                      <div>
                        <h5 className="text-xs font-medium text-gray-500 uppercase mb-1">Attendees</h5>
                        <Input
                          type="number"
                          value={editedAppointment.attendeesCount || 0}
                          onChange={(e) => handleInputChange('attendeesCount', Number(e.target.value))}
                          min={0}
                          className="mt-1"
                        />
                      </div>
                      {rooms && (
                        <div>
                          <h5 className="text-xs font-medium text-gray-500 uppercase mb-1">Primary Room</h5>
                          <Select
                            value={editedAppointment.roomId?.toString() || ""}
                            onValueChange={(value) => handleRoomChange(Number(value))}
                          >
                            <SelectTrigger className="w-full mt-1">
                              <SelectValue placeholder="Select a room" />
                            </SelectTrigger>
                            <SelectContent>
                              {rooms.map((room) => (
                                <SelectItem key={room.id} value={room.id.toString()}>
                                  {room.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>
                  )}
                </TabsContent>
                
                <TabsContent value="rooms" className="p-6">
                  <div className="flex items-start justify-between mb-6">
                    <div className="flex items-start">
                      <div className="flex-shrink-0 bg-blue-100 rounded-full p-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                      </div>
                      <div className="ml-4">
                        <h4 className="text-sm font-medium text-gray-900">Booked Rooms</h4>
                      </div>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={handleToggleEditMode}
                      className="text-xs"
                    >
                      {isEditMode ? (
                        <>
                          <Save className="h-4 w-4 mr-2" />
                          Save
                        </>
                      ) : (
                        <>
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </>
                      )}
                    </Button>
                  </div>

                  {!isEditMode ? (
                    <div>
                      <h4 className="text-sm font-medium text-gray-900 mb-4">Booked Rooms</h4>
                      
                      {getRoomsArray(appointment).length > 0 ? (
                        <div className="space-y-4 overflow-y-auto pr-1">
                          {getRoomsArray(appointment).map((roomBooking: RoomBooking, index: number) => (
                            <div key={index} className="border rounded-lg p-4">
                              <div className="flex justify-between items-center mb-3">
                                <h5 className="font-medium">{roomBooking.roomName}</h5>
                                <Badge variant="outline" className="ml-2">
                                  €{(roomBooking.cost / 100).toFixed(2)}
                                </Badge>
                              </div>
                              
                              <div className="space-y-4">
                                <div>
                                  <h6 className="text-xs font-medium text-gray-500 uppercase mb-1">Cost Type</h6>
                                  <p className="text-sm text-gray-900">
                                    {roomBooking.costType === 'flat' ? 'Flat Rate' : 
                                     roomBooking.costType === 'hourly' ? 'Hourly Rate' : 
                                     roomBooking.costType === 'per_attendee' ? 'Per Attendee' : 
                                     roomBooking.costType}
                                  </p>
                                </div>
                                
                                <div>
                                  <h6 className="text-xs font-medium text-gray-500 uppercase mb-1">Facilities</h6>
                                  {roomBooking.requestedFacilities && roomBooking.requestedFacilities.length > 0 ? (
                                    <div className="flex flex-wrap gap-1 p-2 bg-gray-50 rounded-md">
                                      {roomBooking.requestedFacilities.map((facility: string, i: number) => (
                                        <Badge key={i} variant="secondary" className="text-xs py-1">
                                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                          </svg>
                                          {facility}
                                        </Badge>
                                      ))}
                                    </div>
                                  ) : (
                                    <p className="text-sm text-gray-500">No additional facilities requested</p>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center text-gray-500 p-6">
                          <p>No rooms have been added to this appointment.</p>
                          <p className="text-sm mt-2">Use the New Booking page to create an appointment with multiple rooms.</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div>
                      <h4 className="text-sm font-medium text-gray-900 mb-4">Booked Rooms</h4>
                      
                      {editedAppointment.rooms && Array.isArray(editedAppointment.rooms) && (editedAppointment.rooms as RoomBooking[]).length > 0 ? (
                        <div className="space-y-4 overflow-y-auto pr-1 border rounded-md p-4 max-h-[400px]">
                          {(editedAppointment.rooms as RoomBooking[]).map((roomBooking, index) => (
                            <div key={index} className="border rounded-lg p-4">
                              <div className="flex justify-between items-center mb-3">
                                <h5 className="font-medium">{roomBooking.roomName}</h5>
                                <Badge variant="outline" className="ml-2">
                                  €{(roomBooking.cost / 100).toFixed(2)}
                                </Badge>
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  className="ml-2 p-0 h-6" 
                                  onClick={() => setActiveRoomIndex(index)}
                                >
                                  {activeRoomIndex === index ? "✓ Active" : "Set Active"}
                                </Button>
                              </div>
                              
                              <div className="space-y-4">
                                <div>
                                  <h6 className="text-xs font-medium text-gray-500 uppercase mb-1">Cost Type</h6>
                                  <Select
                                    value={roomBooking.costType || 'flat'}
                                    onValueChange={(value) => {
                                      const updatedRooms = [...(editedAppointment.rooms as RoomBooking[])];
                                      
                                      // Calculate new cost based on the cost type
                                      const { totalCost } = calculateRoomCost(
                                        roomBooking.roomId, 
                                        value as 'flat' | 'hourly' | 'per_attendee',
                                        roomBooking.requestedFacilities
                                      );
                                      
                                      updatedRooms[index] = {
                                        ...updatedRooms[index],
                                        costType: value as 'flat' | 'hourly' | 'per_attendee',
                                        cost: totalCost
                                      };
                                      
                                      // Update the room data
                                      handleInputChange('rooms', updatedRooms);
                                      
                                      // Also update the global agreed cost if not using custom pricing
                                      if (!customPricing) {
                                        let totalCost = 0;
                                        updatedRooms.forEach(room => {
                                          totalCost += room.cost;
                                        });
                                        
                                        handleInputChange('agreedCost', totalCost);
                                      }
                                    }}
                                  >
                                    <SelectTrigger className="w-full mt-1">
                                      <SelectValue placeholder="Select cost type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="flat">Flat Rate</SelectItem>
                                      <SelectItem value="hourly">Hourly Rate</SelectItem>
                                      <SelectItem value="per_attendee">Per Attendee</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                
                                <div>
                                  <h6 className="text-xs font-medium text-gray-500 uppercase mb-1">Facilities</h6>
                                  <div className="flex flex-wrap gap-1 p-2 bg-gray-50 rounded-md">
                                    {roomBooking.requestedFacilities && roomBooking.requestedFacilities.map((facility, i) => {
                                      // For each facility, find the cost if available
                                      const availableFacilities = getAvailableFacilities(roomBooking.roomId);
                                      const facilityData = availableFacilities.find((f: any) => 
                                        typeof f === 'object' && f !== null && f.name === facility
                                      );
                                      
                                      return (
                                        <Badge key={i} variant="secondary" className="text-xs py-1 pr-2">
                                          {facility} 
                                          {facilityData && typeof facilityData === 'object' && facilityData.cost && (
                                            <span className="ml-1 text-gray-500 text-xs">
                                              €{(facilityData.cost / 100).toFixed(2)}
                                            </span>
                                          )}
                                          <button 
                                            className="ml-1 text-gray-500 hover:text-red-500"
                                            onClick={() => {
                                              const updatedRooms = [...(editedAppointment.rooms as RoomBooking[])];
                                              const updatedFacilities = [...roomBooking.requestedFacilities];
                                              const removedFacility = updatedFacilities[i];
                                              updatedFacilities.splice(i, 1);
                                              
                                              // Calculate new cost after removing the facility
                                              const selectedRoom = rooms && Array.isArray(rooms) ? 
                                                rooms.find(r => r.id === roomBooking.roomId) : undefined;
                                                
                                              if (selectedRoom && selectedRoom.facilities && removedFacility) {
                                                try {
                                                  // Parse facilities if needed
                                                  let availableFacilities: any[] = [];
                                                  if (typeof selectedRoom.facilities === 'string') {
                                                    availableFacilities = JSON.parse(selectedRoom.facilities);
                                                  } else if (Array.isArray(selectedRoom.facilities)) {
                                                    availableFacilities = selectedRoom.facilities;
                                                  }
                                                  
                                                  // Find the removed facility's cost
                                                  const facility = availableFacilities.find((f: any) => 
                                                    (typeof f === 'object' && f !== null && 
                                                    (f.name === removedFacility || f.id === removedFacility))
                                                  );
                                                  
                                                  if (facility && typeof facility === 'object' && facility.cost) {
                                                    // Subtract the facility cost from the current room cost
                                                    const facilityCost = facility.cost;
                                                    const newCost = roomBooking.cost - facilityCost;
                                                    
                                                    // Update the room with the new cost
                                                    updatedRooms[index] = {
                                                      ...updatedRooms[index],
                                                      cost: newCost,
                                                      requestedFacilities: updatedFacilities
                                                    };
                                                    
                                                    // Calculate new total cost
                                                    let totalCost = 0;
                                                    updatedRooms.forEach(room => {
                                                      totalCost += room.cost;
                                                    });
                                                    
                                                    // Update both rooms and cost information
                                                    handleInputChange('rooms', updatedRooms);
                                                    
                                                    // Update global cost and breakdown if not using custom pricing
                                                    if (!customPricing) {
                                                      handleInputChange('agreedCost', totalCost);
                                                      
                                                      // Create updated cost breakdown
                                                      const costBreakdown = {
                                                        ...(appointment && typeof appointment.costBreakdown === 'object' ? 
                                                          appointment.costBreakdown : {}),
                                                        total: totalCost,
                                                        isCustom: false
                                                      };
                                                      handleInputChange('costBreakdown', costBreakdown);
                                                    }
                                                    return; // Exit early as we've handled the update
                                                  }
                                                } catch (e) {
                                                  console.warn('Error calculating facility cost for removal:', e);
                                                }
                                              }
                                              
                                              // Fallback to just updating the facilities list without cost changes
                                              updatedRooms[index] = {
                                                ...updatedRooms[index],
                                                requestedFacilities: updatedFacilities
                                              };
                                              handleInputChange('rooms', updatedRooms);
                                            }}
                                          >
                                            <X className="h-3 w-3 ml-1" />
                                          </button>
                                        </Badge>
                                      );
                                    })}
                                  </div>
                                  
                                  <div className="mt-2">
                                    <h6 className="text-xs font-medium text-gray-500 uppercase mb-1">Add Facility</h6>
                                    <div className="flex gap-2">
                                      <Select
                                        onValueChange={(value) => {
                                          if (!value) return;
                                          
                                          // Don't add duplicates
                                          if (roomBooking.requestedFacilities && 
                                              roomBooking.requestedFacilities.includes(value)) {
                                            return;
                                          }
                                          
                                          const updatedRooms = [...(editedAppointment.rooms as RoomBooking[])];
                                          const updatedFacilities = [
                                            ...(roomBooking.requestedFacilities || []), 
                                            value
                                          ];
                                          
                                          // Calculate new cost that includes facility
                                          const selectedRoom = rooms && Array.isArray(rooms) ? 
                                            rooms.find(r => r.id === roomBooking.roomId) : undefined;
                                            
                                          if (selectedRoom && selectedRoom.facilities) {
                                            try {
                                              // Parse facilities if needed
                                              let availableFacilities: any[] = [];
                                              if (typeof selectedRoom.facilities === 'string') {
                                                availableFacilities = JSON.parse(selectedRoom.facilities);
                                              } else if (Array.isArray(selectedRoom.facilities)) {
                                                availableFacilities = selectedRoom.facilities;
                                              }
                                              
                                              // Find the added facility's cost
                                              const facility = availableFacilities.find((f: any) => 
                                                (typeof f === 'object' && f !== null && 
                                                (f.name === value || f.id === value))
                                              );
                                              
                                              if (facility && typeof facility === 'object' && facility.cost) {
                                                // Add the facility cost to the current room cost
                                                const facilityCost = facility.cost;
                                                const newCost = roomBooking.cost + facilityCost;
                                                
                                                // Update the room with the new cost and facilities
                                                updatedRooms[index] = {
                                                  ...updatedRooms[index],
                                                  cost: newCost,
                                                  requestedFacilities: updatedFacilities
                                                };
                                                
                                                // Calculate new total cost
                                                let totalCost = 0;
                                                updatedRooms.forEach(room => {
                                                  totalCost += room.cost;
                                                });
                                                
                                                // Update both rooms and cost information
                                                handleInputChange('rooms', updatedRooms);
                                                
                                                // Update global cost if not using custom pricing
                                                if (!customPricing) {
                                                  handleInputChange('agreedCost', totalCost);
                                                }
                                                return; // Exit early as we've handled the update
                                              }
                                            } catch (e) {
                                              console.warn('Error calculating facility cost:', e);
                                            }
                                          }
                                          
                                          // Fallback to just updating the facilities list without cost changes
                                          updatedRooms[index] = {
                                            ...updatedRooms[index],
                                            requestedFacilities: updatedFacilities
                                          };
                                          handleInputChange('rooms', updatedRooms);
                                        }}
                                      >
                                        <SelectTrigger className="w-full mt-1">
                                          <SelectValue placeholder="Select facility" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {(() => {
                                            const availableFacilities = getAvailableFacilities(roomBooking.roomId);
                                            return availableFacilities.map((facility: any, i: number) => {
                                              if (typeof facility !== 'object' || facility === null) return null;
                                              
                                              // Skip facilities that are already selected
                                              if (roomBooking.requestedFacilities && 
                                                  roomBooking.requestedFacilities.includes(facility.name)) {
                                                return null;
                                              }
                                              
                                              return (
                                                <SelectItem key={i} value={facility.name}>
                                                  {facility.name} (€{(facility.cost / 100).toFixed(2)})
                                                </SelectItem>
                                              );
                                            });
                                          })()}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                    
                                    {/* Add a divider between existing facility selector and custom facility form */}
                                    <div className="mt-4 mb-2">
                                      <Separator />
                                      <h6 className="text-xs font-medium text-gray-500 uppercase mt-3 mb-1">Add Custom Facility</h6>
                                    </div>
                                    
                                    {/* Custom facility form */}
                                    <div className="grid grid-cols-3 gap-2 mt-2">
                                      <div className="col-span-2">
                                        <Input
                                          placeholder="Facility name"
                                          value={customFacilityName}
                                          onChange={(e) => setCustomFacilityName(e.target.value)}
                                          className="h-9 text-sm"
                                        />
                                      </div>
                                      <div>
                                        <Input
                                          placeholder="Cost (cents)"
                                          type="number"
                                          min="0"
                                          value={customFacilityCost}
                                          onChange={(e) => setCustomFacilityCost(Number(e.target.value))}
                                          className="h-9 text-sm"
                                        />
                                      </div>
                                      
                                      <div className="col-span-3 mt-1">
                                        <Button 
                                          className="w-full text-xs" 
                                          variant="outline" 
                                          size="sm"
                                          disabled={!customFacilityName || customFacilityCost <= 0}
                                          onClick={() => handleAddCustomFacility(index)}
                                        >
                                          Add Custom Facility
                                        </Button>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center text-gray-500 p-6">
                          <p>No rooms have been added to this appointment.</p>
                          <p className="text-sm mt-2">Use the New Booking page to create an appointment with multiple rooms.</p>
                        </div>
                      )}
                    </div>
                  )}
                </TabsContent>
                
                <TabsContent value="costs" className="p-6">
                  <div className="flex items-start justify-between mb-6">
                    <div className="flex items-start">
                      <div className="flex-shrink-0 bg-yellow-100 rounded-full p-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div className="ml-4">
                        <h4 className="text-sm font-medium text-gray-900">Cost Information</h4>
                      </div>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={handleToggleEditMode}
                      className="text-xs"
                    >
                      {isEditMode ? (
                        <>
                          <Save className="h-4 w-4 mr-2" />
                          Save
                        </>
                      ) : (
                        <>
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </>
                      )}
                    </Button>
                  </div>

                  {!isEditMode ? (
                    <div className="space-y-6">
                      {/* Cost type is now handled per room, not globally */}
                      <div>
                        <h5 className="text-xs font-medium text-gray-500 uppercase mb-1">Cost Calculation</h5>
                        <p className="text-sm text-gray-900">
                          Individual room pricing ({getRoomsArray(appointment).length} room{getRoomsArray(appointment).length !== 1 ? 's' : ''})
                        </p>
                      </div>
                      <div>
                        <h5 className="text-xs font-medium text-gray-500 uppercase mb-1">Agreed Cost</h5>
                        <p className="text-sm text-gray-900">€{(appointment.agreedCost / 100).toFixed(2)}</p>
                        
                        {appointment.costBreakdown && 
                         typeof appointment.costBreakdown === 'object' && 
                         (appointment.costBreakdown as any).isCustom && (
                          <Badge className="mt-1" variant="outline">Custom Price</Badge>
                        )}
                      </div>
                      <div>
                        <h5 className="text-xs font-medium text-gray-500 uppercase mb-1">Cost Breakdown</h5>
                        <div className="mt-1 bg-gray-50 rounded-md p-4">
                          {getRoomsArray(appointment).length > 0 ? (
                            <>
                              {getRoomsArray(appointment).map((roomBooking: RoomBooking, index: number) => (
                                <div key={index} className="mb-3">
                                  <div className="flex justify-between text-sm">
                                    <span className="font-medium">{roomBooking.roomName}:</span>
                                    <span>€{(roomBooking.cost / 100).toFixed(2)}</span>
                                  </div>
                                  <p className="text-xs text-gray-500 ml-4">
                                    {roomBooking.costType === 'flat' ? 'Flat Rate' : 
                                     roomBooking.costType === 'hourly' ? 'Hourly Rate' : 
                                     roomBooking.costType === 'per_attendee' ? 'Per Attendee' : 
                                     roomBooking.costType}
                                  </p>
                                  
                                  {/* Show facilities costs */}
                                  {roomBooking.requestedFacilities && roomBooking.requestedFacilities.length > 0 && (
                                    <div className="ml-4 mt-1 text-xs text-gray-600">
                                      <p>Facilities:</p>
                                      <ul className="ml-2">
                                        {roomBooking.requestedFacilities.map((facility, facilityIndex) => {
                                          // Get facility cost if available
                                          const availableFacilities = getAvailableFacilities(roomBooking.roomId);
                                          const facilityData = availableFacilities.find((f: any) => 
                                            typeof f === 'object' && f !== null && f.name === facility
                                          );
                                          
                                          const facilityCost = facilityData && typeof facilityData === 'object' ? 
                                            facilityData.cost : 0;
                                          
                                          return (
                                            <li key={facilityIndex} className="flex justify-between">
                                              <span>- {facility}</span>
                                              <span>€{(facilityCost / 100).toFixed(2)}</span>
                                            </li>
                                          );
                                        })}
                                      </ul>
                                    </div>
                                  )}
                                  
                                  {index < getRoomsArray(appointment).length - 1 && <Separator className="my-2" />}
                                </div>
                              ))}
                              
                              <Separator className="my-3" />
                              
                              {appointment.costBreakdown && typeof appointment.costBreakdown === 'object' && (
                                <>
                                  <div className="flex justify-between text-sm text-gray-700">
                                    <span>Base Rate:</span>
                                    <span>€{((appointment.costBreakdown as any).base / 100).toFixed(2)}</span>
                                  </div>
                                  
                                  {/* Show facilities cost if available */}
                                  {(appointment.costBreakdown as any).facilities > 0 && (
                                    <div className="flex justify-between text-sm text-gray-700 mt-1">
                                      <span>Additional Facilities:</span>
                                      <span>€{((appointment.costBreakdown as any).facilities / 100).toFixed(2)}</span>
                                    </div>
                                  )}
                                </>
                              )}
                              
                              <div className="flex justify-between font-medium text-sm mt-2">
                                <span>Total:</span>
                                <span>€{(appointment.agreedCost / 100).toFixed(2)}</span>
                              </div>
                              
                              {appointment.costBreakdown && 
                               typeof appointment.costBreakdown === 'object' && 
                               (appointment.costBreakdown as any).isCustom && (
                                <p className="text-xs text-gray-500 italic mt-2 text-center">
                                  Custom price applied
                                </p>
                              )}
                            </>
                          ) : appointment.costBreakdown && typeof appointment.costBreakdown === 'object' ? (
                            <>
                              <div className="flex justify-between text-sm text-gray-700">
                                <span>Base Rate:</span>
                                <span>€{((appointment.costBreakdown as any).base / 100).toFixed(2)}</span>
                              </div>
                              
                              {/* Show facilities cost if available */}
                              {(appointment.costBreakdown as any).facilities > 0 && (
                                <div className="flex justify-between text-sm text-gray-700 mt-1">
                                  <span>Additional Facilities:</span>
                                  <span>€{((appointment.costBreakdown as any).facilities / 100).toFixed(2)}</span>
                                </div>
                              )}
                              
                              <Separator className="my-2" />
                              <div className="flex justify-between font-medium text-sm">
                                <span>Total:</span>
                                <span>€{(appointment.agreedCost / 100).toFixed(2)}</span>
                              </div>
                            </>
                          ) : (
                            <p className="text-sm text-gray-500">No detailed breakdown available</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {/* Cost type selection is now per room, handled on the room tab */}
                      <div className="bg-blue-50 p-4 rounded-md mb-4">
                        <h5 className="text-xs font-medium text-blue-800 mb-1">Room-Based Pricing</h5>
                        <p className="text-xs text-blue-700">
                          Cost types are now managed per room. Please go to the Rooms tab to modify cost types for each room.
                        </p>
                      </div>
                      
                      <div className="flex items-center space-x-2 p-3 bg-gray-50 rounded-md">
                        <Switch
                          id="custom-pricing"
                          checked={customPricing}
                          onCheckedChange={handleCustomPricingToggle}
                        />
                        <label
                          htmlFor="custom-pricing"
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                          Use Custom Price
                        </label>
                      </div>

                      <div>
                        <h5 className="text-xs font-medium text-gray-500 uppercase mb-1">Agreed Cost (in cents)</h5>
                        <Input
                          type="number"
                          value={editedAppointment.agreedCost || 0}
                          onChange={(e) => handleInputChange('agreedCost', Number(e.target.value))}
                          disabled={!customPricing}
                          className="mt-1"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Displayed as: €{((editedAppointment.agreedCost || 0) / 100).toFixed(2)}
                        </p>
                      </div>
                      
                      {!customPricing && (
                        <div className="bg-gray-50 rounded-md p-4">
                          <h6 className="text-xs font-medium text-gray-700 mb-2">Automatic Price Calculation</h6>
                          <p className="text-xs text-gray-600">
                            The price is automatically calculated based on selected rooms, facilities, duration and number of attendees.
                          </p>
                          <p className="text-xs text-gray-600 mt-1">
                            Current total: €{((calculateCost() || 0) / 100).toFixed(2)}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </TabsContent>
                
                <TabsContent value="contact" className="p-6">
                  <div className="flex items-start justify-between mb-6">
                    <div className="flex items-start">
                      <div className="flex-shrink-0 bg-green-100 rounded-full p-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      </div>
                      <div className="ml-4">
                        <h4 className="text-sm font-medium text-gray-900">Contact Information</h4>
                      </div>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={handleToggleEditMode}
                      className="text-xs"
                    >
                      {isEditMode ? (
                        <>
                          <Save className="h-4 w-4 mr-2" />
                          Save
                        </>
                      ) : (
                        <>
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </>
                      )}
                    </Button>
                  </div>

                  {!isEditMode ? (
                    <div className="space-y-6">
                      <div>
                        <h5 className="text-xs font-medium text-gray-500 uppercase mb-1">Customer Name</h5>
                        <p className="text-sm text-gray-900">{appointment.customerName || "Not provided"}</p>
                      </div>
                      <div>
                        <h5 className="text-xs font-medium text-gray-500 uppercase mb-1">Email</h5>
                        <p className="text-sm text-gray-900">{appointment.customerEmail || "Not provided"}</p>
                      </div>
                      <div>
                        <h5 className="text-xs font-medium text-gray-500 uppercase mb-1">Phone</h5>
                        <p className="text-sm text-gray-900">{appointment.customerPhone || "Not provided"}</p>
                      </div>
                      <div>
                        <h5 className="text-xs font-medium text-gray-500 uppercase mb-1">Organization</h5>
                        <p className="text-sm text-gray-900">{appointment.customerOrganization || "Not provided"}</p>
                      </div>
                      <div>
                        <h5 className="text-xs font-medium text-gray-500 uppercase mb-1">Notes</h5>
                        <p className="text-sm text-gray-900 whitespace-pre-line">{appointment.notes || "No additional notes"}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <div>
                        <h5 className="text-xs font-medium text-gray-500 uppercase mb-1">Customer Name</h5>
                        <Input
                          value={editedAppointment.customerName || ""}
                          onChange={(e) => handleInputChange('customerName', e.target.value)}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <h5 className="text-xs font-medium text-gray-500 uppercase mb-1">Email</h5>
                        <Input
                          type="email"
                          value={editedAppointment.customerEmail || ""}
                          onChange={(e) => handleInputChange('customerEmail', e.target.value)}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <h5 className="text-xs font-medium text-gray-500 uppercase mb-1">Phone</h5>
                        <Input
                          value={editedAppointment.customerPhone || ""}
                          onChange={(e) => handleInputChange('customerPhone', e.target.value)}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <h5 className="text-xs font-medium text-gray-500 uppercase mb-1">Organization</h5>
                        <Input
                          value={editedAppointment.customerOrganization || ""}
                          onChange={(e) => handleInputChange('customerOrganization', e.target.value)}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <h5 className="text-xs font-medium text-gray-500 uppercase mb-1">Notes</h5>
                        <Textarea
                          value={editedAppointment.notes || ""}
                          onChange={(e) => handleInputChange('notes', e.target.value)}
                          className="mt-1"
                          rows={4}
                        />
                      </div>
                    </div>
                  )}
                </TabsContent>
                
                <TabsContent value="history" className="p-6">
                  <div className="flex items-start mb-6">
                    <div className="flex-shrink-0 bg-purple-100 rounded-full p-2">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div className="ml-4">
                      <h4 className="text-sm font-medium text-gray-900">Appointment History</h4>
                      <p className="text-xs text-gray-500 mt-1">
                        A log of all changes made to this appointment
                      </p>
                    </div>
                  </div>

                  {isLogsLoading ? (
                    <div className="flex justify-center items-center h-40">
                      <p>Loading history...</p>
                    </div>
                  ) : auditLogs && Array.isArray(auditLogs) && auditLogs.length > 0 ? (
                    <div className="space-y-4 max-h-[400px] overflow-y-auto">
                      {auditLogs.map((log: any, index: number) => (
                        <div 
                          key={index} 
                          className={`p-4 rounded-md border-l-4 ${
                            log.actionType === 'create' ? 'border-l-green-500 bg-green-50' :
                            log.actionType === 'update' ? 'border-l-blue-500 bg-blue-50' :
                            log.actionType === 'approve' ? 'border-l-emerald-500 bg-emerald-50' :
                            log.actionType === 'reject' ? 'border-l-red-500 bg-red-50' :
                            log.actionType === 'delete' ? 'border-l-gray-500 bg-gray-50' :
                            'border-l-gray-300 bg-gray-50'
                          }`}
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <h5 className="font-medium text-sm">
                                {log.actionType === 'create' ? 'Appointment Created' :
                                 log.actionType === 'update' ? 'Appointment Updated' :
                                 log.actionType === 'approve' ? 'Appointment Approved' :
                                 log.actionType === 'reject' ? 'Appointment Rejected' :
                                 log.actionType === 'delete' ? 'Appointment Deleted' :
                                 log.actionType}
                              </h5>
                              <p className="text-xs text-gray-500 mt-1">
                                {log.timestamp ? format(new Date(log.timestamp), "MMM d, yyyy 'at' h:mm a") : "Unknown date"}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-xs text-gray-500">
                                {log.userId ? `User ID: ${log.userId}` : "System"}
                              </p>
                            </div>
                          </div>
                          
                          {log.details && (
                            <div className="mt-3">
                              <h6 className="text-xs font-medium text-gray-700 mb-1">Changes:</h6>
                              <div className="text-xs text-gray-600 whitespace-pre-line bg-white p-2 rounded border">
                                {typeof log.details === 'string' ? log.details : JSON.stringify(log.details, null, 2)}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center text-gray-500 p-6">
                      <p>No history records found for this appointment.</p>
                    </div>
                  )}
                </TabsContent>
              </>
            ) : (
              <div className="flex justify-center items-center h-40">
                <p>No appointment data available.</p>
              </div>
            )}
          </Tabs>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject Appointment</AlertDialogTitle>
            <AlertDialogDescription>
              Please provide a reason for rejecting this appointment. This information will be shared with the customer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Reason for rejection..."
              className="w-full"
              rows={4}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmReject}>
              Confirm Rejection
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}