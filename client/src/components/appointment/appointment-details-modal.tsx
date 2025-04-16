import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { format, parse } from "date-fns";
import { Edit, Trash, Clock, Eye, X, Save, CalendarIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Appointment, Room, User, RoomBooking } from "@shared/schema";
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
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
  const [editedAppointment, setEditedAppointment] = useState<Partial<AppointmentWithRooms>>({});
  const [customPricing, setCustomPricing] = useState(false);
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
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
  }
  
  const { data: appointment, isLoading: isAppointmentLoading } = useQuery<AppointmentWithRooms>({
    queryKey: ["/api/appointments", appointmentId],
    enabled: open && appointmentId > 0,
    queryFn: async ({ queryKey }) => {
      console.log('Fetching appointment details for ID:', appointmentId);
      const [_, id] = queryKey;
      const url = `/api/appointments/${id}`;
      console.log('API URL:', url);
      const response = await fetch(url, { credentials: "include" });
      if (!response.ok) {
        const errorData = await response.text();
        console.error('Error fetching appointment details:', response.status, errorData);
        throw new Error("Failed to fetch appointment details");
      }
      const data = await response.json();
      console.log('Appointment data received:', data);
      return data;
    },
  });
  
  const { data: room, isLoading: isRoomLoading } = useQuery<Room>({
    queryKey: ["/api/rooms", appointment?.roomId],
    enabled: !!appointment?.roomId,
  });

  const { data: rooms } = useQuery<Room[]>({
    queryKey: ["/api/rooms"],
    enabled: isEditMode,
  });
  
  // Get available facilities for a room
  const getAvailableFacilities = (roomId: number): string[] => {
    if (!rooms || !Array.isArray(rooms)) return [];
    
    const room = rooms.find(r => r.id === roomId);
    if (!room) return [];
    
    // Common facilities list
    const commonFacilities = [
      "Projector", "Whiteboard", "Video conferencing", "WiFi", "Air conditioning",
      "Coffee machine", "Water dispenser", "Microphones", "Sound system", "Catering service",
      "Flip charts", "Screen", "Podium", "Stage", "Teleconference", "Tables & chairs"
    ];
    
    // Try to parse the room's facilities if available
    if (room.facilities) {
      try {
        // Check if facilities is a string that needs parsing
        if (typeof room.facilities === 'string') {
          const parsedFacilities = JSON.parse(room.facilities);
          if (Array.isArray(parsedFacilities) && parsedFacilities.length > 0) {
            return parsedFacilities;
          }
        } 
        // Check if facilities is already an array
        else if (Array.isArray(room.facilities) && room.facilities.length > 0) {
          return room.facilities as string[];
        }
      } catch (e) {
        console.log('Error parsing room facilities:', e);
      }
    }
    
    return commonFacilities;
  };
  
  const { data: auditLogs, isLoading: isLogsLoading } = useQuery({
    queryKey: ["/api/appointments", appointmentId, "audit"],
    enabled: open && appointmentId > 0 && activeTab === "history",
  });
  
  // Initialize the edited appointment when the original appointment data is loaded
  useEffect(() => {
    if (appointment && !isEditMode) {
      setEditedAppointment({
        ...appointment,
      });
      
      setStartDate(appointment.startTime ? new Date(appointment.startTime) : undefined);
      setEndDate(appointment.endTime ? new Date(appointment.endTime) : undefined);
      
      // Check if the appointment has a custom price already
      if (appointment.costBreakdown && 
          typeof appointment.costBreakdown === 'object' && 
          (appointment.costBreakdown as any).isCustom) {
        setCustomPricing(true);
      } else {
        setCustomPricing(false);
      }
    }
  }, [appointment, isEditMode]);
  
  const updateAppointmentMutation = useMutation({
    mutationFn: async (data: Partial<Appointment>) => {
      const res = await apiRequest(
        "PUT",
        `/api/appointments/${appointmentId}`,
        data
      );
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Appointment updated",
        description: "The appointment has been successfully updated.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/appointments", appointmentId] });
    },
    onError: (error) => {
      toast({
        title: "Failed to update appointment",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteAppointmentMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/appointments/${appointmentId}`);
    },
    onSuccess: () => {
      toast({
        title: "Appointment deleted",
        description: "The appointment has been successfully deleted.",
      });
      onOpenChange(false);
      queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
    },
    onError: (error) => {
      toast({
        title: "Failed to delete appointment",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleApprove = () => {
    updateAppointmentMutation.mutate({ status: "approved" });
    if (onApprove) onApprove(appointmentId);
  };

  const handleReject = () => {
    setIsRejectDialogOpen(true);
  };

  const handleConfirmReject = () => {
    updateAppointmentMutation.mutate({ 
      status: "rejected",
      rejectionReason: rejectionReason 
    });
    setIsRejectDialogOpen(false);
    setRejectionReason("");
    if (onReject) onReject(appointmentId);
  };

  const handleDelete = () => {
    if (confirm("Are you sure you want to delete this appointment?")) {
      deleteAppointmentMutation.mutate();
    }
  };
  
  const handleInputChange = (field: string, value: any) => {
    setEditedAppointment(prev => ({
      ...prev,
      [field]: value
    }));
  };
  
  const handleToggleEditMode = () => {
    if (isEditMode) {
      // Save changes
      const updatedData: Partial<Appointment> = {
        ...editedAppointment
      };
      
      // Handle date fields
      if (startDate) {
        updatedData.startTime = startDate;
      }
      if (endDate) {
        updatedData.endTime = endDate;
      }
      
      // Handle custom pricing
      if (customPricing && updatedData.agreedCost) {
        updatedData.costBreakdown = {
          ...(typeof updatedData.costBreakdown === 'object' ? updatedData.costBreakdown : {}),
          base: updatedData.agreedCost,
          isCustom: true
        };
      }
      
      updateAppointmentMutation.mutate(updatedData);
      setIsEditMode(false);
    } else {
      // Enter edit mode
      setIsEditMode(true);
    }
  };
  
  // Calculate cost for a single room
  const calculateRoomCost = (roomId: number) => {
    if (!rooms || !Array.isArray(rooms)) return 0;
    
    const selectedRoom = rooms.find(r => r.id === roomId);
    if (!selectedRoom) return 0;
    
    // Determine which rate to use based on the cost type
    let baseCost = 0;
    let facilitiesCost = 0;
    let roomCostType = 'flat';
    let requestedFacilities: string[] = [];
    
    // Check if this room has a specific cost type in edited data
    if (editedAppointment.rooms && Array.isArray(editedAppointment.rooms)) {
      const roomData = editedAppointment.rooms.find(r => r.roomId === roomId);
      if (roomData) {
        if (roomData.costType) {
          roomCostType = roomData.costType;
        }
        if (roomData.requestedFacilities && Array.isArray(roomData.requestedFacilities)) {
          requestedFacilities = roomData.requestedFacilities;
        }
      }
    } 
    // Fallback to original room data
    else if (appointment && appointment.rooms && Array.isArray(appointment.rooms)) {
      const roomData = appointment.rooms.find(r => r.roomId === roomId);
      if (roomData) {
        if (roomData.costType) {
          roomCostType = roomData.costType;
        }
        if (roomData.requestedFacilities && Array.isArray(roomData.requestedFacilities)) {
          requestedFacilities = roomData.requestedFacilities;
        }
      }
    }
    // Last resort, use appointment's global cost type
    else {
      roomCostType = editedAppointment.costType || appointment?.costType || 'flat';
      // Use the global requested facilities as fallback
      requestedFacilities = editedAppointment.requestedFacilities as string[] || 
                            (appointment?.requestedFacilities as string[]) || 
                            [];
    }
    
    // Calculate base cost based on rate type
    if (roomCostType === 'flat') {
      baseCost = selectedRoom.flatRate || 0;
    } else if (roomCostType === 'hourly') {
      baseCost = selectedRoom.hourlyRate || 0;
      
      // Apply duration calculation for hourly rate
      if (startDate && endDate) {
        const durationHours = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60);
        baseCost = baseCost * Math.max(1, Math.ceil(durationHours));
      }
    } else if (roomCostType === 'per_attendee') {
      baseCost = selectedRoom.attendeeRate || 0;
      
      // Apply attendee count for per-attendee rate
      const attendeesCount = editedAppointment.attendeesCount || appointment?.attendeesCount || 1;
      baseCost = baseCost * attendeesCount;
    }
    
    // Calculate additional costs for facilities
    if (selectedRoom.facilities && requestedFacilities.length > 0) {
      try {
        // Parse facilities if they are stored as a string
        let availableFacilities: any[] = [];
        if (typeof selectedRoom.facilities === 'string') {
          availableFacilities = JSON.parse(selectedRoom.facilities);
        } else if (Array.isArray(selectedRoom.facilities)) {
          availableFacilities = selectedRoom.facilities;
        }
        
        // Check for facility costs - some may be strings, some may be objects with cost properties
        availableFacilities.forEach(facility => {
          if (typeof facility === 'object' && facility.id && facility.cost) {
            // Check if this facility is requested
            if (requestedFacilities.includes(facility.id) || 
                requestedFacilities.includes(facility.name)) {
              facilitiesCost += facility.cost;
            }
          }
        });
      } catch (e) {
        console.warn('Error calculating facility costs:', e);
      }
    }
    
    const totalCost = baseCost + facilitiesCost;
    console.log(`Calculated cost for room ${roomId} with type ${roomCostType}:`);
    console.log(`- Base cost: ${baseCost}`);
    console.log(`- Facilities cost: ${facilitiesCost}`);
    console.log(`- Total cost: ${totalCost}`);
    
    return totalCost;
  };
  
  // Calculate cost considering all rooms in the appointment
  const calculateCost = (roomId: number) => {
    // In case of multi-room booking, we'll need to get costs from all rooms
    if (appointment && Array.isArray(appointment.rooms) && appointment.rooms.length > 0) {
      // If we are editing, we'll use the calculateRoomCost for the primary room
      if (isEditMode) {
        return calculateRoomCost(roomId);
      }
      
      // For viewing, we use the stored costs from the rooms array
      let totalCost = 0;
      appointment.rooms.forEach(room => {
        if (room.roomId === roomId) {
          totalCost += room.cost;
        }
      });
      
      return totalCost;
    }
    
    // Fall back to single room calculation
    return calculateRoomCost(roomId);
  };
  
  const handleRoomChange = (roomId: number) => {
    handleInputChange('roomId', roomId);
    
    if (!customPricing) {
      const calculatedCost = calculateCost(roomId);
      handleInputChange('agreedCost', calculatedCost);
    }
  };
  
  const handleCustomPricingToggle = (enabled: boolean) => {
    setCustomPricing(enabled);
    
    if (!enabled && appointment) {
      console.log('Toggle off custom pricing, recalculating costs');
      
      // Handle multiple rooms case
      if (Array.isArray(editedAppointment.rooms) && editedAppointment.rooms.length > 0) {
        // Create new array for updated room costs
        const updatedRooms = [...editedAppointment.rooms].map(room => {
          // Calculate cost for each room
          const roomCost = calculateRoomCost(room.roomId);
          return {
            ...room,
            cost: roomCost
          };
        });
        
        // Calculate total from all rooms
        let totalCost = 0;
        updatedRooms.forEach(room => {
          totalCost += room.cost;
        });
        
        // Update cost breakdown to reflect automatic calculation
        // Calculate room and facility costs separately for breakdown
        let roomBaseCost = 0;
        let facilitiesCost = 0;
        
        updatedRooms.forEach(room => {
          // Get room details to calculate facility costs
          const roomDetails = rooms && Array.isArray(rooms) ? 
            rooms.find(r => r.id === room.roomId) : undefined;
            
          if (roomDetails && roomDetails.facilities && 
              room.requestedFacilities && room.requestedFacilities.length > 0) {
            try {
              // Parse facilities if needed
              let availableFacilities: any[] = [];
              if (typeof roomDetails.facilities === 'string') {
                availableFacilities = JSON.parse(roomDetails.facilities);
              } else if (Array.isArray(roomDetails.facilities)) {
                availableFacilities = roomDetails.facilities;
              }
              
              // Check each requested facility for costs
              room.requestedFacilities.forEach(facilityName => {
                const facility = availableFacilities.find(f => 
                  (typeof f === 'object' && f !== null && 
                  ((f as any).name === facilityName || (f as any).id === facilityName))
                );
                
                if (facility && typeof facility === 'object' && (facility as any).cost) {
                  facilitiesCost += (facility as any).cost;
                }
              });
            } catch (e) {
              console.warn('Error calculating facility costs for breakdown:', e);
            }
          }
        });
        
        // Basic cost is total minus facilities
        roomBaseCost = totalCost - facilitiesCost;
        
        const costBreakdown = {
          ...(appointment && typeof appointment.costBreakdown === 'object' ? appointment.costBreakdown : {}),
          base: roomBaseCost,
          facilities: facilitiesCost,
          isCustom: false,
          total: totalCost
        };
        
        // Update both rooms and cost information
        handleInputChange('rooms', updatedRooms);
        handleInputChange('agreedCost', totalCost);
        handleInputChange('costBreakdown', costBreakdown);
        
        console.log('Updated rooms with recalculated costs:', updatedRooms);
        console.log('Total cost after recalculation:', totalCost);
      } else {
        // Single room case
        const roomId = editedAppointment.roomId || appointment.roomId;
        const calculatedCost = calculateCost(roomId);
        
        // Update cost breakdown to reflect automatic calculation
        // Get room details
        const roomDetails = rooms && Array.isArray(rooms) ? 
          rooms.find(r => r.id === roomId) : undefined;
        
        // Calculate facility costs for single room
        let facilitiesCost = 0;
        let roomBaseCost = calculatedCost;
        
        if (roomDetails && roomDetails.facilities && 
            editedAppointment.requestedFacilities && 
            Array.isArray(editedAppointment.requestedFacilities) && 
            editedAppointment.requestedFacilities.length > 0) {
          try {
            // Parse facilities if needed
            let availableFacilities: any[] = [];
            if (typeof roomDetails.facilities === 'string') {
              availableFacilities = JSON.parse(roomDetails.facilities);
            } else if (Array.isArray(roomDetails.facilities)) {
              availableFacilities = roomDetails.facilities;
            }
            
            // Check each requested facility for costs
            editedAppointment.requestedFacilities.forEach((facilityName: string) => {
              const facility = availableFacilities.find(f => 
                (typeof f === 'object' && f !== null && 
                ((f as any).name === facilityName || (f as any).id === facilityName))
              );
              
              if (facility && typeof facility === 'object' && (facility as any).cost) {
                facilitiesCost += (facility as any).cost;
              }
            });
            
            // Adjust the base cost and total
            roomBaseCost = calculatedCost - facilitiesCost;
          } catch (e) {
            console.warn('Error calculating facility costs for single room:', e);
          }
        }
        
        const costBreakdown = {
          ...(appointment && typeof appointment.costBreakdown === 'object' ? appointment.costBreakdown : {}),
          base: roomBaseCost,
          facilities: facilitiesCost,
          isCustom: false,
          total: calculatedCost
        };
        
        handleInputChange('agreedCost', calculatedCost);
        handleInputChange('costBreakdown', costBreakdown);
        
        console.log('Single room recalculated cost:', calculatedCost);
      }
    } else if (enabled) {
      // Mark as custom but keep current price
      const currentCost = editedAppointment.agreedCost || appointment?.agreedCost || 0;
      const costBreakdown = {
        ...(appointment && typeof appointment.costBreakdown === 'object' ? appointment.costBreakdown : {}),
        base: currentCost,
        isCustom: true,
        total: currentCost
      };
      
      handleInputChange('costBreakdown', costBreakdown);
      console.log('Custom pricing enabled, keeping current cost:', currentCost);
    }
  };

  const isLoading = isAppointmentLoading || (isRoomLoading && !!appointment?.roomId);

  if (!open) return null;
  
  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <div className="flex justify-between items-center">
              <DialogTitle>Appointment Details</DialogTitle>
              <div className="flex items-center space-x-2">
                <Button variant="ghost" size="icon" onClick={handleDelete}>
                  <Trash className="h-5 w-5 text-gray-400 hover:text-red-500" />
                </Button>
              </div>
            </div>
          </DialogHeader>
          
          {appointment && appointment.status === 'pending' && !isEditMode && (
            <div className="px-6 mb-4">
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md mb-3">
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-yellow-800">Pending Approval</h3>
                    <div className="mt-1 text-xs text-yellow-700">
                      This appointment requires your approval or rejection.
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex justify-end space-x-3">
                <Button variant="outline" onClick={handleReject} className="bg-white hover:bg-gray-50">
                  Reject
                </Button>
                <Button onClick={handleApprove} className="bg-green-600 hover:bg-green-700">
                  Approve
                </Button>
              </div>
            </div>
          )}

          <Tabs defaultValue="details" value={activeTab} onValueChange={setActiveTab}>
            <div className="border-b border-gray-200">
              <TabsList className="w-full justify-start border-none bg-transparent p-0">
                <TabsTrigger 
                  value="details" 
                  className="data-[state=active]:bg-black data-[state=active]:text-white px-6 py-3 rounded-none"
                >
                  <div className="flex items-center">
                    <Eye className="h-5 w-5 mr-2" />
                    Details
                  </div>
                </TabsTrigger>
                <TabsTrigger 
                  value="rooms" 
                  className="data-[state=active]:bg-black data-[state=active]:text-white px-6 py-3 rounded-none"
                >
                  <div className="flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                    </svg>
                    Rooms
                  </div>
                </TabsTrigger>
                <TabsTrigger 
                  value="costs" 
                  className="data-[state=active]:bg-black data-[state=active]:text-white px-6 py-3 rounded-none"
                >
                  <div className="flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Costs
                  </div>
                </TabsTrigger>
                <TabsTrigger 
                  value="contact" 
                  className="data-[state=active]:bg-black data-[state=active]:text-white px-6 py-3 rounded-none"
                >
                  <div className="flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                    </svg>
                    Contact
                  </div>
                </TabsTrigger>
                <TabsTrigger 
                  value="history" 
                  className="data-[state=active]:bg-black data-[state=active]:text-white px-6 py-3 rounded-none"
                >
                  <div className="flex items-center">
                    <Clock className="h-5 w-5 mr-2" />
                    History
                  </div>
                </TabsTrigger>
              </TabsList>
            </div>

            {isLoading ? (
              <div className="flex justify-center items-center h-64">
                <p>Loading appointment details...</p>
              </div>
            ) : appointment ? (
              <>
                <TabsContent value="details" className="p-6">
                  <div className="flex items-start justify-between mb-6">
                    <div className="flex items-start">
                      <div className="flex-shrink-0 bg-indigo-100 rounded-full p-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div className="ml-4">
                        <h4 className="text-sm font-medium text-gray-900">Basic Information</h4>
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
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
                        <div>
                          <h5 className="text-xs font-medium text-gray-500 uppercase mb-1">Title</h5>
                          <p className="text-sm text-gray-900">{appointment.title}</p>
                        </div>
                        <div>
                          <h5 className="text-xs font-medium text-gray-500 uppercase mb-1">Status</h5>
                          <Badge 
                            variant={
                              appointment.status === 'approved' ? 'success' :
                              appointment.status === 'rejected' ? 'destructive' :
                              appointment.status === 'cancelled' ? 'outline' :
                              'secondary'
                            }
                          >
                            {appointment.status ? appointment.status.charAt(0).toUpperCase() + appointment.status.slice(1) : 'Unknown'}
                          </Badge>
                        </div>
                        <div>
                          <h5 className="text-xs font-medium text-gray-500 uppercase mb-1">Order #</h5>
                          <p className="text-sm text-gray-900">#{appointment.orderNumber}</p>
                        </div>
                        <div>
                          <h5 className="text-xs font-medium text-gray-500 uppercase mb-1">Date & Time</h5>
                          <p className="text-sm text-gray-900">
                            {appointment.startTime && appointment.endTime
                              ? `${format(new Date(appointment.startTime), "MMM d, h:mm a")} - ${format(
                                  new Date(appointment.endTime),
                                  "h:mm a"
                                )}`
                              : "N/A"}
                          </p>
                        </div>
                        <div>
                          <h5 className="text-xs font-medium text-gray-500 uppercase mb-1">Attendees</h5>
                          <p className="text-sm text-gray-900">{appointment.attendeesCount || "N/A"}</p>
                        </div>
                      </div>

                      <Separator className="my-6" />
                      
                      <div className="mt-4">
                        <h5 className="text-xs font-medium text-gray-500 uppercase mb-1">Purpose</h5>
                        <p className="text-sm text-gray-900">{appointment.purpose || "N/A"}</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">
                        <div>
                          <h5 className="text-xs font-medium text-gray-500 uppercase mb-1">Title</h5>
                          <Input
                            value={editedAppointment.title || ''}
                            onChange={(e) => handleInputChange('title', e.target.value)}
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <h5 className="text-xs font-medium text-gray-500 uppercase mb-1">Status</h5>
                          <Select
                            value={editedAppointment.status || 'pending'}
                            onValueChange={(value) => handleInputChange('status', value)}
                          >
                            <SelectTrigger className="w-full mt-1">
                              <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pending">Pending</SelectItem>
                              <SelectItem value="approved">Approved</SelectItem>
                              <SelectItem value="rejected">Rejected</SelectItem>
                              <SelectItem value="cancelled">Cancelled</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <h5 className="text-xs font-medium text-gray-500 uppercase mb-1">Date</h5>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant={"outline"}
                                className="w-full justify-start text-left font-normal mt-1"
                              >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {startDate ? format(startDate, "PPP") : (
                                  <span>Pick a date</span>
                                )}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                              <Calendar
                                mode="single"
                                selected={startDate}
                                onSelect={(date) => {
                                  if (date) {
                                    // Preserve time from old date
                                    const newDate = new Date(date);
                                    if (startDate) {
                                      newDate.setHours(
                                        startDate.getHours(),
                                        startDate.getMinutes()
                                      );
                                    }
                                    setStartDate(newDate);
                                    
                                    // If end date exists, also update it to the same day but keep time
                                    if (endDate) {
                                      const newEndDate = new Date(date);
                                      newEndDate.setHours(
                                        endDate.getHours(),
                                        endDate.getMinutes()
                                      );
                                      setEndDate(newEndDate);
                                    }
                                  }
                                }}
                                initialFocus
                              />
                            </PopoverContent>
                          </Popover>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <h5 className="text-xs font-medium text-gray-500 uppercase mb-1">Start Time</h5>
                            <Input
                              type="time"
                              value={startDate ? format(startDate, "HH:mm") : ""}
                              onChange={(e) => {
                                if (startDate) {
                                  const [hours, minutes] = e.target.value.split(':').map(Number);
                                  const newDate = new Date(startDate);
                                  newDate.setHours(hours, minutes);
                                  setStartDate(newDate);
                                } else {
                                  const today = new Date();
                                  const [hours, minutes] = e.target.value.split(':').map(Number);
                                  today.setHours(hours, minutes);
                                  setStartDate(today);
                                }
                              }}
                              className="mt-1"
                            />
                          </div>
                          <div>
                            <h5 className="text-xs font-medium text-gray-500 uppercase mb-1">End Time</h5>
                            <Input
                              type="time"
                              value={endDate ? format(endDate, "HH:mm") : ""}
                              onChange={(e) => {
                                if (endDate) {
                                  const [hours, minutes] = e.target.value.split(':').map(Number);
                                  const newDate = new Date(endDate);
                                  newDate.setHours(hours, minutes);
                                  setEndDate(newDate);
                                } else if (startDate) {
                                  const newDate = new Date(startDate);
                                  const [hours, minutes] = e.target.value.split(':').map(Number);
                                  newDate.setHours(hours, minutes);
                                  setEndDate(newDate);
                                }
                              }}
                              className="mt-1"
                            />
                          </div>
                        </div>
                      </div>
                      
                      <div className="space-y-6">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                          <div>
                            <h5 className="text-xs font-medium text-gray-500 uppercase mb-1">Primary Room</h5>
                            <Select
                              value={String(editedAppointment.roomId || '')}
                              onValueChange={(value) => handleRoomChange(Number(value))}
                            >
                              <SelectTrigger className="w-full mt-1">
                                <SelectValue placeholder="Select primary room" />
                              </SelectTrigger>
                              <SelectContent>
                                {rooms && rooms.map((room) => {
                                  // When editing, don't filter out booked rooms if they're already part of this appointment
                                  const isAlreadyBooked = editedAppointment.rooms && Array.isArray(editedAppointment.rooms) && 
                                    editedAppointment.rooms.some(bookedRoom => bookedRoom.roomId === room.id);
                                    
                                  return (
                                    <SelectItem key={room.id} value={String(room.id)}>
                                      {room.name}
                                    </SelectItem>
                                  );
                                })}
                              </SelectContent>
                            </Select>
                            <p className="text-xs text-gray-500 mt-1">
                              To book multiple rooms, use the New Booking page
                            </p>
                          </div>
                          <div>
                            <h5 className="text-xs font-medium text-gray-500 uppercase mb-1">Attendees</h5>
                            <Input
                              type="number"
                              min="1"
                              value={editedAppointment.attendeesCount || ''}
                              onChange={(e) => handleInputChange('attendeesCount', Number(e.target.value))}
                              className="mt-1"
                            />
                          </div>
                        </div>
                        
                        {/* Display room editing interface when multiple rooms exist */}
                        {editedAppointment.rooms && 
                         Array.isArray(editedAppointment.rooms) && 
                         (editedAppointment.rooms as RoomBooking[]).length > 0 && (
                          <>
                            <div className="mt-4 mb-4">
                              <h5 className="text-xs font-medium text-gray-500 uppercase mb-3">Booked Rooms</h5>
                              <div className="space-y-4 max-h-[350px] overflow-y-auto pr-1 border rounded-md p-4">
                                {(editedAppointment.rooms as RoomBooking[]).map((roomBooking, index) => (
                                  <div key={index} className="border rounded-lg p-3">
                                    <div className="flex justify-between items-center mb-2">
                                      <h5 className="font-medium text-sm">{roomBooking.roomName}</h5>
                                      <Badge variant="outline" className="ml-2">
                                        €{(roomBooking.cost / 100).toFixed(2)}
                                      </Badge>
                                    </div>
                                    
                                    <div className="space-y-3">
                                      <div>
                                        <h6 className="text-xs font-medium text-gray-500 uppercase mb-1">Cost Type</h6>
                                        <Select
                                          value={roomBooking.costType || 'flat'}
                                          onValueChange={(value) => {
                                            const updatedRooms = [...(editedAppointment.rooms as RoomBooking[])];
                                            updatedRooms[index] = {
                                              ...updatedRooms[index],
                                              costType: value as 'flat' | 'hourly' | 'per_attendee'
                                            };
                                            handleInputChange('rooms', updatedRooms);
                                          }}
                                        >
                                          <SelectTrigger className="w-full h-8 text-xs">
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
                                        <div className="flex flex-wrap gap-1 mb-2">
                                          {roomBooking.requestedFacilities && roomBooking.requestedFacilities.map((facility, i) => (
                                            <Badge key={i} variant="secondary" className="text-xs">
                                              {facility}
                                              <button 
                                                className="ml-1 text-gray-500 hover:text-red-500"
                                                onClick={() => {
                                                  const updatedRooms = [...(editedAppointment.rooms as RoomBooking[])];
                                                  const updatedFacilities = [...roomBooking.requestedFacilities];
                                                  updatedFacilities.splice(i, 1);
                                                  updatedRooms[index] = {
                                                    ...updatedRooms[index],
                                                    requestedFacilities: updatedFacilities
                                                  };
                                                  handleInputChange('rooms', updatedRooms);
                                                }}
                                              >
                                                <X className="h-3 w-3" />
                                              </button>
                                            </Badge>
                                          ))}
                                        </div>
                                        
                                        <div className="flex mt-2">
                                          <Input
                                            placeholder="Add facility"
                                            className="h-8 text-xs"
                                            onKeyDown={(e) => {
                                              if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                                                e.preventDefault();
                                                const facilityName = e.currentTarget.value.trim();
                                                const updatedRooms = [...(editedAppointment.rooms as RoomBooking[])];
                                                const updatedFacilities = [
                                                  ...(roomBooking.requestedFacilities || []), 
                                                  facilityName
                                                ];
                                                updatedRooms[index] = {
                                                  ...updatedRooms[index],
                                                  requestedFacilities: updatedFacilities
                                                };
                                                handleInputChange('rooms', updatedRooms);
                                                e.currentTarget.value = '';
                                              }
                                            }}
                                          />
                                          <Button 
                                            variant="outline" 
                                            size="sm" 
                                            className="ml-2 h-8"
                                            onClick={(e) => {
                                              const input = e.currentTarget.previousSibling as HTMLInputElement;
                                              if (input && input.value.trim()) {
                                                const facilityName = input.value.trim();
                                                const updatedRooms = [...(editedAppointment.rooms as RoomBooking[])];
                                                const updatedFacilities = [
                                                  ...(roomBooking.requestedFacilities || []),
                                                  facilityName
                                                ];
                                                updatedRooms[index] = {
                                                  ...updatedRooms[index],
                                                  requestedFacilities: updatedFacilities
                                                };
                                                handleInputChange('rooms', updatedRooms);
                                                input.value = '';
                                              }
                                            }}
                                          >
                                            Add
                                          </Button>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </>
                        )}
                        
                        <div className="sm:col-span-2">
                          <h5 className="text-xs font-medium text-gray-500 uppercase mb-1">Purpose</h5>
                          <Textarea
                            value={editedAppointment.purpose || ''}
                            onChange={(e) => handleInputChange('purpose', e.target.value)}
                            className="mt-1 h-24"
                          />
                        </div>
                      </div>
                    </>
                  )}

                  
                </TabsContent>

                <TabsContent value="rooms" className="p-6">
                  <div className="flex items-start justify-between mb-6">
                    <div className="flex items-start">
                      <div className="flex-shrink-0 bg-blue-100 rounded-full p-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                        </svg>
                      </div>
                      <div className="ml-4">
                        <h4 className="text-sm font-medium text-gray-900">Room Information</h4>
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
                              
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                  <h6 className="text-xs font-medium text-gray-500 uppercase mb-1">Cost Type</h6>
                                  <p className="text-sm text-gray-700">
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
                                    <div className="p-2 bg-gray-50 rounded-md">
                                      <p className="text-sm text-gray-500">No additional facilities requested</p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                          
                          <div className="mt-4 pt-4 border-t">
                            <div className="flex justify-between items-center">
                              <span className="text-sm font-medium">Total for all rooms:</span>
                              <span className="text-sm font-medium">
                                €{(appointment.agreedCost / 100).toFixed(2)}
                              </span>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                          <div>
                            <h5 className="text-xs font-medium text-gray-500 uppercase mb-1">Room Name</h5>
                            <p className="text-sm text-gray-900">{room?.name || "Loading..."}</p>
                          </div>
                          <div>
                            <h5 className="text-xs font-medium text-gray-500 uppercase mb-1">Location</h5>
                            <p className="text-sm text-gray-900">{room?.locationId ? `Location ID: ${room.locationId}` : "N/A"}</p>
                          </div>
                          <div>
                            <h5 className="text-xs font-medium text-gray-500 uppercase mb-1">Requested Facilities</h5>
                            {appointment.requestedFacilities && Array.isArray(appointment.requestedFacilities) && appointment.requestedFacilities.length > 0 ? (
                              <div className="flex flex-wrap gap-1 p-2 bg-gray-50 rounded-md">
                                {appointment.requestedFacilities.map((facility: string, index) => (
                                  <Badge key={index} variant="secondary" className="text-xs py-1">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                    {facility}
                                  </Badge>
                                ))}
                              </div>
                            ) : (
                              <div className="p-2 bg-gray-50 rounded-md">
                                <p className="text-sm text-gray-500">No additional facilities requested</p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div>
                          <h5 className="text-xs font-medium text-gray-500 uppercase mb-1">Primary Room</h5>
                          <Select
                            value={String(editedAppointment.roomId || '')}
                            onValueChange={(value) => handleRoomChange(Number(value))}
                          >
                            <SelectTrigger className="w-full mt-1">
                              <SelectValue placeholder="Select primary room" />
                            </SelectTrigger>
                            <SelectContent>
                              {rooms && rooms.map((room) => (
                                <SelectItem key={room.id} value={String(room.id)}>
                                  {room.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-gray-500 mt-1">
                            To book multiple rooms, use the New Booking page
                          </p>
                        </div>
                      </div>
                      
                      {/* Display room editing interface when multiple rooms exist */}
                      {editedAppointment.rooms && 
                       Array.isArray(editedAppointment.rooms) && 
                       (editedAppointment.rooms as RoomBooking[]).length > 0 && (
                        <>
                          <div className="mt-4 mb-4">
                            <h5 className="text-xs font-medium text-gray-500 uppercase mb-3">Booked Rooms</h5>
                            <div className="space-y-4 max-h-[400px] overflow-y-auto pr-1 border rounded-md p-4">
                              {(editedAppointment.rooms as RoomBooking[]).map((roomBooking, index) => (
                                <div key={index} className="border rounded-lg p-4">
                                  <div className="flex justify-between items-center mb-2">
                                    <h5 className="font-medium text-sm">{roomBooking.roomName}</h5>
                                    <Badge variant="outline" className="ml-2">
                                      €{(roomBooking.cost / 100).toFixed(2)}
                                    </Badge>
                                  </div>
                                  
                                  <div className="space-y-4">
                                    <div>
                                      <h6 className="text-xs font-medium text-gray-500 uppercase mb-1">Cost Type</h6>
                                      <Select
                                        value={roomBooking.costType || 'flat'}
                                        onValueChange={(value) => {
                                          const costType = value as 'flat' | 'hourly' | 'per_attendee';
                                          const updatedRooms = [...(editedAppointment.rooms as RoomBooking[])];
                                          
                                          // Get the room data
                                          const selectedRoom = rooms && Array.isArray(rooms) ? 
                                            rooms.find(r => r.id === roomBooking.roomId) : undefined;
                                          
                                          // Calculate new cost based on selected cost type
                                          let newCost = 0;
                                          if (selectedRoom) {
                                            if (costType === 'flat') {
                                              newCost = selectedRoom.flatRate || 0;
                                            } else if (costType === 'hourly') {
                                              newCost = selectedRoom.hourlyRate || 0;
                                              
                                              if (startDate && endDate) {
                                                const durationHours = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60);
                                                newCost = newCost * Math.max(1, Math.ceil(durationHours));
                                              }
                                            } else if (costType === 'per_attendee') {
                                              newCost = selectedRoom.attendeeRate || 0;
                                              const attendeesCount = editedAppointment.attendeesCount || 1;
                                              newCost = newCost * attendeesCount;
                                            }
                                          }
                                          
                                          console.log(`Recalculated cost for room ${roomBooking.roomId} with new type ${costType}: ${newCost}`);
                                          
                                          // Update the room with new cost and cost type
                                          updatedRooms[index] = {
                                            ...updatedRooms[index],
                                            costType,
                                            cost: newCost
                                          };
                                          
                                          // Calculate new total cost from all rooms
                                          let totalCost = 0;
                                          updatedRooms.forEach(room => {
                                            totalCost += room.cost;
                                          });
                                          
                                          // Update both the rooms and the total cost
                                          handleInputChange('rooms', updatedRooms);
                                          
                                          // Don't update global cost if custom pricing is enabled
                                          if (!customPricing) {
                                            handleInputChange('agreedCost', totalCost);
                                            
                                            // Update cost breakdown
                                            const costBreakdown = {
                                              ...(appointment && typeof appointment.costBreakdown === 'object' ? appointment.costBreakdown : {}),
                                              base: totalCost,
                                              isCustom: false,
                                              total: totalCost
                                            };
                                            handleInputChange('costBreakdown', costBreakdown);
                                          }
                                        }}
                                      >
                                        <SelectTrigger className="w-full h-8 text-xs">
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
                                      <div className="flex flex-wrap gap-1 mb-2">
                                        {roomBooking.requestedFacilities && roomBooking.requestedFacilities.map((facility, i) => (
                                          <Badge key={i} variant="secondary" className="text-xs">
                                            {facility}
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
                                                    const facility = availableFacilities.find(f => 
                                                      (typeof f === 'object' && f !== null && 
                                                      ((f as any).name === removedFacility || (f as any).id === removedFacility))
                                                    );
                                                    
                                                    if (facility && typeof facility === 'object' && (facility as any).cost) {
                                                      // Subtract the facility cost from the current room cost
                                                      const facilityCost = (facility as any).cost;
                                                      const newCost = roomBooking.cost - facilityCost;
                                                      console.log(`Removing facility ${removedFacility} with cost ${facilityCost}. New total: ${newCost}`);
                                                      
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
                                              <X className="h-3 w-3" />
                                            </button>
                                          </Badge>
                                        ))}
                                      </div>
                                      
                                      <div className="space-y-2">
                                        {/* Available facilities dropdown */}
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
                                                const facility = availableFacilities.find(f => 
                                                  (typeof f === 'object' && f !== null && 
                                                  ((f as any).name === value || (f as any).id === value))
                                                );
                                                
                                                if (facility && typeof facility === 'object' && (facility as any).cost) {
                                                  // Add the facility cost to the current room cost
                                                  const facilityCost = (facility as any).cost;
                                                  const newCost = roomBooking.cost + facilityCost;
                                                  console.log(`Adding facility ${value} with cost ${facilityCost}. New total: ${newCost}`);
                                                  
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
                                          <SelectTrigger className="w-full h-8 text-xs">
                                            <SelectValue placeholder="Select facility" />
                                          </SelectTrigger>
                                          <SelectContent>
                                            {(() => {
                                              const facilities = getAvailableFacilities(roomBooking.roomId);
                                              console.log('Available facilities:', facilities);
                                              return facilities.map((facility, i) => {
                                                console.log('Facility item:', facility, typeof facility);
                                                // Handle different types of facility values
                                                const facilityName = typeof facility === 'object' && facility !== null ? 
                                                  ((facility as any).name || JSON.stringify(facility)) : String(facility);
                                                const facilityValue = typeof facility === 'object' && facility !== null ? 
                                                  ((facility as any).name || JSON.stringify(facility)) : String(facility);
                                                  
                                                return (
                                                  <SelectItem key={i} value={facilityValue}>
                                                    {facilityName}
                                                  </SelectItem>
                                                );
                                              });
                                            })()}
                                          </SelectContent>
                                        </Select>
                                        
                                        {/* Manual entry for custom facilities */}
                                        <div className="flex mt-2">
                                          <Input
                                            placeholder="Or add custom facility"
                                            className="h-8 text-xs"
                                            onKeyDown={(e) => {
                                              if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                                                e.preventDefault();
                                                const facilityName = e.currentTarget.value.trim();
                                                
                                                // Don't add duplicates
                                                if (roomBooking.requestedFacilities && 
                                                    roomBooking.requestedFacilities.includes(facilityName)) {
                                                  e.currentTarget.value = '';
                                                  return;
                                                }
                                                
                                                const updatedRooms = [...(editedAppointment.rooms as RoomBooking[])];
                                                const updatedFacilities = [
                                                  ...(roomBooking.requestedFacilities || []), 
                                                  facilityName
                                                ];
                                                updatedRooms[index] = {
                                                  ...updatedRooms[index],
                                                  requestedFacilities: updatedFacilities
                                                };
                                                handleInputChange('rooms', updatedRooms);
                                                e.currentTarget.value = '';
                                              }
                                            }}
                                          />
                                          <Button 
                                            variant="outline" 
                                            size="sm" 
                                            className="ml-2 h-8"
                                            onClick={(e) => {
                                              const input = e.currentTarget.previousSibling as HTMLInputElement;
                                              if (input && input.value.trim()) {
                                                const facilityName = input.value.trim();
                                                
                                                // Don't add duplicates
                                                if (roomBooking.requestedFacilities && 
                                                    roomBooking.requestedFacilities.includes(facilityName)) {
                                                  input.value = '';
                                                  return;
                                                }
                                                
                                                const updatedRooms = [...(editedAppointment.rooms as RoomBooking[])];
                                                const updatedFacilities = [
                                                  ...(roomBooking.requestedFacilities || []),
                                                  facilityName
                                                ];
                                                updatedRooms[index] = {
                                                  ...updatedRooms[index],
                                                  requestedFacilities: updatedFacilities
                                                };
                                                handleInputChange('rooms', updatedRooms);
                                                input.value = '';
                                              }
                                            }}
                                          >
                                            Add
                                          </Button>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </>
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
                          <p className="text-xs text-gray-500">
                            Price is calculated based on the selected room, cost type, and duration/attendees.
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
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
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
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <div>
                        <h5 className="text-xs font-medium text-gray-500 uppercase mb-1">Contact Name</h5>
                        <p className="text-sm text-gray-900">{appointment.customerName || "N/A"}</p>
                      </div>
                      <div>
                        <h5 className="text-xs font-medium text-gray-500 uppercase mb-1">Contact Email</h5>
                        <p className="text-sm text-gray-900">{appointment.customerEmail || "N/A"}</p>
                      </div>
                      <div>
                        <h5 className="text-xs font-medium text-gray-500 uppercase mb-1">Contact Phone</h5>
                        <p className="text-sm text-gray-900">{appointment.customerPhone || "N/A"}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <div>
                        <h5 className="text-xs font-medium text-gray-500 uppercase mb-1">Contact Name</h5>
                        <Input
                          value={editedAppointment.customerName || ''}
                          onChange={(e) => handleInputChange('customerName', e.target.value)}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <h5 className="text-xs font-medium text-gray-500 uppercase mb-1">Contact Email</h5>
                        <Input
                          type="email"
                          value={editedAppointment.customerEmail || ''}
                          onChange={(e) => handleInputChange('customerEmail', e.target.value)}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <h5 className="text-xs font-medium text-gray-500 uppercase mb-1">Contact Phone</h5>
                        <Input
                          value={editedAppointment.customerPhone || ''}
                          onChange={(e) => handleInputChange('customerPhone', e.target.value)}
                          className="mt-1"
                        />
                      </div>

                    </div>
                  )}
                </TabsContent>

                <TabsContent value="history" className="p-6">
                  <div className="mb-6">
                    <h4 className="text-sm font-medium text-gray-900">Audit Log</h4>
                    <p className="text-xs text-gray-500 mt-1">Track all changes made to this appointment</p>
                  </div>

                  {isLogsLoading ? (
                    <div className="flex justify-center items-center h-36">
                      <p>Loading audit logs...</p>
                    </div>
                  ) : auditLogs && Array.isArray(auditLogs) && auditLogs.length > 0 ? (
                    <div className="border border-gray-200 rounded-md overflow-hidden">
                      {auditLogs.map((log: any, index) => (
                        <div key={log.id || index}>
                          <div className="px-4 py-3 bg-gray-50 text-xs uppercase font-medium text-gray-500 flex justify-between">
                            <span>{format(new Date(log.createdAt), "MMM dd, yyyy h:mm a")}</span>
                            <Badge variant="outline" className="text-xs uppercase">
                              {log.action}
                            </Badge>
                          </div>
                          <div className="p-4 border-t border-gray-200">
                            <p className="text-sm text-gray-600 mb-2">Updated by User ID: {log.userId}</p>
                            
                            {(log.oldData || log.newData) && (
                              <div className="mt-4 relative">
                                <div className="max-h-64 overflow-y-auto text-xs rounded-md bg-gray-50 p-4">
                                  {log.oldData && (
                                    <div className="mb-3">
                                      <h5 className="font-medium text-gray-700 mb-1">Previous Values:</h5>
                                      <div className="pl-2 border-l-2 border-red-300">
                                        {Object.entries(typeof log.oldData === 'object' ? log.oldData : {}).map(([key, value]: [string, any]) => (
                                          <div key={key} className="mb-1">
                                            <span className="font-medium">{key}:</span>{' '}
                                            <span className="text-red-500">{typeof value === 'object' ? JSON.stringify(value) : String(value)}</span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                  
                                  {log.newData && (
                                    <div>
                                      <h5 className="font-medium text-gray-700 mb-1">New Values:</h5>
                                      <div className="pl-2 border-l-2 border-green-300">
                                        {Object.entries(typeof log.newData === 'object' ? log.newData : {}).map(([key, value]: [string, any]) => (
                                          <div key={key} className="mb-1">
                                            <span className="font-medium">{key}:</span>{' '}
                                            <span className="text-green-600">{typeof value === 'object' ? JSON.stringify(value) : String(value)}</span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center text-gray-500 py-6 border rounded-md">
                      <p>No audit logs available for this appointment.</p>
                      <p className="text-xs mt-2">Changes to the appointment will be tracked here</p>
                    </div>
                  )}
                </TabsContent>
              </>
            ) : (
              <div className="flex justify-center items-center h-64">
                <p>Appointment not found</p>
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
              Please provide a reason for rejecting this appointment. This will be recorded in the audit log.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="my-4">
            <Textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Enter rejection reason"
              className="min-h-[100px]"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setRejectionReason("")}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmReject}>Submit</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}