import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { AppLayout } from "@/components/layout/app-layout";
import { DataTable } from "@/components/ui/data-table";
import { AppointmentDetailsModal } from "@/components/appointment/appointment-details-modal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { Eye, Filter, Clock, CheckCircle2, XCircle } from "lucide-react";
import { Appointment } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";

export default function AppointmentsPage() {
  const { t } = useTranslation();
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<number | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const { toast } = useToast();

  const { data: appointments, isLoading } = useQuery<Appointment[]>({
    queryKey: ["/api/appointments", statusFilter],
    queryFn: async ({ queryKey }) => {
      const [_, status] = queryKey;
      const url = status ? `/api/appointments?status=${status}` : "/api/appointments";
      const response = await fetch(url, { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch appointments");
      return await response.json();
    },
  });

  const { data: rooms } = useQuery({
    queryKey: ["/api/rooms"],
  });

  const approveAppointmentMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("PUT", `/api/appointments/${id}`, {
        status: "approved",
      });
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: t('appointments.approveSuccess', 'Appointment approved'),
        description: t('appointments.approveSuccessDetail', 'The appointment has been successfully approved.'),
      });
      queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
    },
    onError: (error) => {
      toast({
        title: t('appointments.approveError', 'Failed to approve appointment'),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const rejectAppointmentMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("PUT", `/api/appointments/${id}`, {
        status: "rejected",
      });
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: t('appointments.rejectSuccess', 'Appointment rejected'),
        description: t('appointments.rejectSuccessDetail', 'The appointment has been successfully rejected.'),
      });
      queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
    },
    onError: (error) => {
      toast({
        title: t('appointments.rejectError', 'Failed to reject appointment'),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const getRoomName = (roomId: number) => {
    if (!rooms || !Array.isArray(rooms)) return t('common.loading', 'Loading...');
    const room = rooms.find((r: any) => r.id === roomId);
    return room ? room.name : `${t('rooms.room', 'Room')} #${roomId}`;
  };

  const handleViewDetails = (appointmentId: number) => {
    setSelectedAppointmentId(appointmentId);
    setModalOpen(true);
  };

  const handleApprove = (id: number) => {
    approveAppointmentMutation.mutate(id);
  };

  const handleReject = (id: number) => {
    if (confirm(t('appointments.confirmReject', 'Are you sure you want to reject this appointment?'))) {
      rejectAppointmentMutation.mutate(id);
    }
  };

  const columns: ColumnDef<Appointment>[] = [
    {
      accessorKey: "orderNumber",
      header: t('appointments.orderNumber', 'Order #'),
      cell: ({ row }) => <span>#{row.original.orderNumber}</span>,
      size: 80,
    },
    {
      accessorKey: "startTime",
      header: t('appointments.dateTime', 'Date & Time'),
      cell: ({ row }) => (
        <span className="whitespace-nowrap">
          {format(new Date(row.original.startTime), "MMM d, h:mm a")} - {format(new Date(row.original.endTime), "h:mm a")}
        </span>
      ),
    },
    {
      accessorKey: "title",
      header: t('appointments.details', 'Details'),
      cell: ({ row }) => (
        <div>
          <div className="font-medium">{row.original.title}</div>
          <div className="text-sm text-gray-500">{getRoomName(row.original.roomId)}</div>
          <div className="flex items-center text-xs text-gray-500">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {Array.isArray(rooms) && rooms.find((r: any) => r.id === row.original.roomId)?.locationId || t('appointments.location', 'Location')}
          </div>
          <div className="text-sm text-gray-500">
            {t('appointments.purpose', 'Purpose')}: {row.original.purpose || "N/A"}
          </div>
        </div>
      ),
    },
    {
      accessorKey: "status",
      header: t('appointments.status', 'Status'),
      cell: ({ row }) => {
        const status = row.original.status;
        const variant = 
          status === "approved" ? "success" :
          status === "rejected" ? "destructive" :
          status === "cancelled" ? "outline" :
          "secondary";
        
        return (
          <Badge variant={variant} className="whitespace-nowrap">
            {status === "approved" 
              ? t('appointments.approved')
              : status === "rejected" 
              ? t('appointments.rejected')
              : status === "cancelled" 
              ? t('appointments.cancelled')
              : t('appointments.pending')
            }
          </Badge>
        );
      },
      size: 100,
    },
    {
      id: "actions",
      header: t('appointments.actions', 'Actions'),
      cell: ({ row }) => {
        const appointment = row.original;
        return (
          <div className="flex flex-wrap gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleViewDetails(appointment.id)}
              title={t('common.view', 'View Details')}
              className="h-8 w-8"
            >
              <Eye className="h-4 w-4 text-gray-500" />
            </Button>
          </div>
        );
      },
      size: 100,
    },
  ];

  return (
    <AppLayout>
      <div className="p-4 pt-8 sm:p-8">
        <header className="mb-6 sm:mb-8">
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-800">{t('appointments.title', 'Approve Appointments')}</h1>
          <p className="text-gray-600 text-sm">{t('appointments.subtitle', 'Review and manage appointment requests')}</p>
        </header>

        <Card className="mb-8">
          <div className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center border-b">
            <div className="mb-4 sm:mb-0">
              <h2 className="font-medium">{t('appointments.filters', 'Filters')}</h2>
            </div>
            <div className="flex flex-wrap gap-2 sm:gap-3">
              <Button 
                variant={statusFilter === null ? "default" : "outline"}
                size="sm"
                onClick={() => setStatusFilter(null)}
                className="flex items-center"
              >
                <Filter className="h-4 w-4 mr-1 sm:mr-2" />
                <span>{t('common.all', 'All')}</span>
              </Button>
              <Button 
                variant={statusFilter === "pending" ? "default" : "outline"}
                size="sm"
                onClick={() => setStatusFilter("pending")}
                className="flex items-center"
              >
                <Clock className="h-4 w-4 mr-1 sm:mr-2" />
                <span>{t('appointments.pending', 'Pending')}</span>
              </Button>
              <Button 
                variant={statusFilter === "approved" ? "default" : "outline"}
                size="sm"
                onClick={() => setStatusFilter("approved")}
                className="flex items-center"
              >
                <CheckCircle2 className="h-4 w-4 mr-1 sm:mr-2" />
                <span>{t('appointments.approved', 'Approved')}</span>
              </Button>
              <Button 
                variant={statusFilter === "rejected" ? "default" : "outline"}
                size="sm"
                onClick={() => setStatusFilter("rejected")}
                className="flex items-center"
              >
                <XCircle className="h-4 w-4 mr-1 sm:mr-2" />
                <span>{t('appointments.rejected', 'Rejected')}</span>
              </Button>
            </div>
          </div>

          <div className="p-4">
            <DataTable
              columns={columns}
              data={appointments || []}
              searchPlaceholder={t('appointments.searchPlaceholder', 'Search appointments...')}
              searchColumn="title"
            />
          </div>
        </Card>

        {selectedAppointmentId && (
          <AppointmentDetailsModal
            appointmentId={selectedAppointmentId}
            open={modalOpen}
            onOpenChange={setModalOpen}
            onApprove={handleApprove}
            onReject={handleReject}
          />
        )}
      </div>
    </AppLayout>
  );
}
