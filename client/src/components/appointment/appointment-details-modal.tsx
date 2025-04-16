import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
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
import { format } from "date-fns";
import { Edit, Trash, Clock, Eye, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Appointment, Room, User } from "@shared/schema";

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
  const { toast } = useToast();
  
  const { data: appointment, isLoading: isAppointmentLoading } = useQuery<Appointment>({
    queryKey: ["/api/appointments", appointmentId],
    enabled: open && appointmentId > 0,
  });
  
  const { data: room, isLoading: isRoomLoading } = useQuery<Room>({
    queryKey: ["/api/rooms", appointment?.roomId],
    enabled: !!appointment?.roomId,
  });
  
  const { data: auditLogs, isLoading: isLogsLoading } = useQuery({
    queryKey: ["/api/appointments", appointmentId, "audit"],
    enabled: open && appointmentId > 0 && activeTab === "history",
  });
  
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
    updateAppointmentMutation.mutate({ status: "rejected" });
    if (onReject) onReject(appointmentId);
  };

  const handleDelete = () => {
    if (confirm("Are you sure you want to delete this appointment?")) {
      deleteAppointmentMutation.mutate();
    }
  };

  const isLoading = isAppointmentLoading || (isRoomLoading && !!appointment?.roomId);

  if (!open) return null;
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <div className="flex justify-between items-center">
            <DialogTitle>Appointment Details</DialogTitle>
            <div className="flex items-center space-x-2">
              <Button variant="ghost" size="icon" onClick={handleDelete}>
                <Trash className="h-5 w-5 text-gray-400 hover:text-red-500" />
              </Button>
              <DialogClose>
                <Button variant="ghost" size="icon">
                  <X className="h-5 w-5" />
                </Button>
              </DialogClose>
            </div>
          </div>
        </DialogHeader>

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
                <div className="flex items-start mb-6">
                  <div className="flex-shrink-0 bg-indigo-100 rounded-full p-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="ml-4">
                    <h4 className="text-sm font-medium text-gray-900">Basic Information</h4>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">
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
                      {appointment.status.charAt(0).toUpperCase() + appointment.status.slice(1)}
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
                </div>

                <Separator className="my-6" />

                <div>
                  <h4 className="text-sm font-medium text-gray-900 mb-4">Room Details</h4>

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
                      <div className="flex flex-wrap gap-2 mt-1">
                        {appointment.requestedFacilities && Array.isArray(appointment.requestedFacilities) && appointment.requestedFacilities.length > 0 ? (
                          appointment.requestedFacilities.map((facility: string, index) => (
                            <Badge key={index} variant="secondary">
                              {facility}
                            </Badge>
                          ))
                        ) : (
                          <p className="text-sm text-gray-500">None requested</p>
                        )}
                      </div>
                    </div>
                    <div>
                      <h5 className="text-xs font-medium text-gray-500 uppercase mb-1">Purpose</h5>
                      <p className="text-sm text-gray-900">{appointment.purpose || "N/A"}</p>
                    </div>
                  </div>
                </div>

                {appointment.status === 'pending' && (
                  <div className="mt-6 flex justify-end space-x-3">
                    <Button variant="outline" onClick={handleReject}>
                      Reject
                    </Button>
                    <Button onClick={handleApprove}>
                      Approve
                    </Button>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="costs" className="p-6">
                <div className="flex items-start mb-6">
                  <div className="flex-shrink-0 bg-yellow-100 rounded-full p-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="ml-4">
                    <h4 className="text-sm font-medium text-gray-900">Cost Information</h4>
                  </div>
                </div>

                <div className="space-y-6">
                  <div>
                    <h5 className="text-xs font-medium text-gray-500 uppercase mb-1">Cost Type</h5>
                    <p className="text-sm text-gray-900">{appointment.costType}</p>
                  </div>
                  <div>
                    <h5 className="text-xs font-medium text-gray-500 uppercase mb-1">Agreed Cost</h5>
                    <p className="text-sm text-gray-900">€{(appointment.agreedCost / 100).toFixed(2)}</p>
                  </div>
                  <div>
                    <h5 className="text-xs font-medium text-gray-500 uppercase mb-1">Cost Breakdown</h5>
                    <div className="mt-1 bg-gray-50 rounded-md p-4">
                      {appointment.costBreakdown && typeof appointment.costBreakdown === 'object' ? (
                        <>
                          <div className="flex justify-between text-sm text-gray-700">
                            <span>Base Rate:</span>
                            <span>€{((appointment.costBreakdown as any).base / 100).toFixed(2)}</span>
                          </div>
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
              </TabsContent>

              <TabsContent value="contact" className="p-6">
                <div className="flex items-start mb-6">
                  <div className="flex-shrink-0 bg-green-100 rounded-full p-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                    </svg>
                  </div>
                  <div className="ml-4">
                    <h4 className="text-sm font-medium text-gray-900">Contact Information</h4>
                  </div>
                </div>

                <div className="space-y-6">
                  <div>
                    <h5 className="text-xs font-medium text-gray-500 uppercase mb-1">Customer Name</h5>
                    <p className="text-sm text-gray-900">{appointment.customerName}</p>
                  </div>
                  <div>
                    <h5 className="text-xs font-medium text-gray-500 uppercase mb-1">Email</h5>
                    <p className="text-sm text-gray-900">{appointment.customerEmail}</p>
                  </div>
                  <div>
                    <h5 className="text-xs font-medium text-gray-500 uppercase mb-1">Phone</h5>
                    <p className="text-sm text-gray-900">{appointment.customerPhone || "N/A"}</p>
                  </div>
                  <div>
                    <h5 className="text-xs font-medium text-gray-500 uppercase mb-1">Attendees</h5>
                    <p className="text-sm text-gray-900">{appointment.attendeesCount}</p>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="history" className="p-6">
                <div className="mb-6">
                  <h4 className="text-sm font-medium text-gray-900">Audit Log</h4>
                </div>

                {isLogsLoading ? (
                  <div className="flex justify-center items-center h-36">
                    <p>Loading audit logs...</p>
                  </div>
                ) : auditLogs && Array.isArray(auditLogs) && auditLogs.length > 0 ? (
                  <div className="border border-gray-200 rounded-md overflow-hidden">
                    {auditLogs.map((log: any, index) => (
                      <div key={log.id || index}>
                        <div className="px-4 py-3 bg-gray-50 text-xs uppercase font-medium text-gray-500">
                          {format(new Date(log.createdAt), "MMM dd, yyyy h:mm a")}
                        </div>
                        <div className="p-4 border-t border-gray-200">
                          <p className="text-sm text-gray-600 mb-2">Updated by User ID: {log.userId}</p>
                          <p className="text-sm text-gray-600 capitalize">Action: {log.action}</p>
                          
                          {(log.oldData || log.newData) && (
                            <div className="mt-4 relative">
                              <div className="h-32 overflow-y-auto text-xs rounded-md bg-gray-50 p-2">
                                {log.oldData && (
                                  <p className="mb-2"><span className="text-red-500">-</span> {JSON.stringify(log.oldData)}</p>
                                )}
                                {log.newData && (
                                  <p><span className="text-green-500">+</span> {JSON.stringify(log.newData)}</p>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <p>No audit logs available</p>
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
  );
}
