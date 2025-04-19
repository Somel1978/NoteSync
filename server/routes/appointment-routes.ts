import type { Express, Request, Response } from "express";
import { storage } from "../storage";
import { isAdmin, isAdminOrDirector, isAuthenticated } from "./index";
import { insertAppointmentSchema } from "@shared/schema";
import { EmailNotificationService } from "../utils/email";

export function registerAppointmentRoutes(app: Express): void {
  // Public endpoint for getting appointments by room
  app.get("/api/public/appointments/room/:id", async (req: Request, res: Response, next: Function) => {
    try {
      const roomId = parseInt(req.params.id);
      if (isNaN(roomId)) {
        return res.status(400).json({ message: "Invalid room ID" });
      }
      
      const { startDate, endDate, includeRejected } = req.query;
      // Por padrão, não inclui agendamentos rejeitados
      const shouldIncludeRejected = includeRejected === 'true';
      
      let appointments;
      
      // Se startDate e endDate estiverem presentes, use-os para filtrar
      if (startDate && endDate) {
        console.log(`Filtrando agendamentos por data: ${startDate} até ${endDate}`);
        const start = new Date(startDate as string);
        const end = new Date(endDate as string);
        
        // Verificar se as datas são válidas
        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
          return res.status(400).json({
            error: "Invalid date format. Please use ISO format (YYYY-MM-DDTHH:MM:SS.sssZ)."
          });
        }
        
        appointments = await storage.getAppointmentsByDateRange(start, end, shouldIncludeRejected);
        // Filtre apenas os agendamentos para a sala específica
        appointments = appointments.filter(a => a.roomId === roomId);
      } else {
        // Caso contrário, busque todos os agendamentos para a sala
        appointments = await storage.getAppointmentsByRoom(roomId, shouldIncludeRejected);
      }
      
      res.json(appointments);
    } catch (error) {
      next(error);
    }
  });
  // Get all appointments
  app.get("/api/appointments", isAuthenticated, async (req: Request, res: Response, next: Function) => {
    try {
      let appointments;
      
      // Filter by user if specified
      if (req.query.userId) {
        const userId = parseInt(req.query.userId as string);
        
        // Regular users can only see their own appointments
        if (req.user?.role !== 'admin' && req.user?.role !== 'director' && req.user?.id !== userId) {
          return res.status(403).json({ message: "Forbidden - You can only view your own appointments" });
        }
        
        appointments = await storage.getAppointmentsByUser(userId);
      } else {
        // For admin/director, return all appointments; for regular users, return only their own
        if (req.user?.role === 'admin' || req.user?.role === 'director') {
          appointments = await storage.getAllAppointments();
        } else {
          appointments = await storage.getAppointmentsByUser(req.user?.id as number);
        }
      }
      
      res.json(appointments);
    } catch (error) {
      next(error);
    }
  });
  
  // Create a new appointment
  app.post("/api/appointments", isAuthenticated, async (req: Request, res: Response, next: Function) => {
    try {
      // Create a deep copy of the request body
      const processedData = { ...req.body };
      
      // Clear out the object and rebuild it to avoid null date issues
      const formattedData: Record<string, any> = {};
      
      // Copy all non-date fields
      Object.keys(processedData).forEach(key => {
        if (key !== 'startTime' && key !== 'endTime') {
          formattedData[key] = processedData[key];
        }
      });
      
      // Explicitly handle date fields
      try {
        // Handle startTime
        console.log("Original startTime:", processedData.startTime, "Type:", typeof processedData.startTime);
        if (processedData.startTime) {
          try {
            const startDate = new Date(processedData.startTime);
            // Verify it's a valid date
            if (!isNaN(startDate.getTime())) {
              formattedData.startTime = startDate;
              console.log("Parsed startTime:", startDate.toISOString());
            } else {
              throw new Error(`Invalid startTime value: ${processedData.startTime}`);
            }
          } catch (error) {
            console.error("Failed to parse startTime:", error);
            throw new Error(`Failed to parse startTime: ${error instanceof Error ? error.message : String(error)}`);
          }
        } else {
          throw new Error("Missing required startTime field");
        }
        
        // Handle endTime
        console.log("Original endTime:", processedData.endTime, "Type:", typeof processedData.endTime);
        if (processedData.endTime) {
          try {
            const endDate = new Date(processedData.endTime);
            // Verify it's a valid date
            if (!isNaN(endDate.getTime())) {
              formattedData.endTime = endDate;
              console.log("Parsed endTime:", endDate.toISOString());
            } else {
              throw new Error(`Invalid endTime value: ${processedData.endTime}`);
            }
          } catch (error) {
            console.error("Failed to parse endTime:", error);
            throw new Error(`Failed to parse endTime: ${error instanceof Error ? error.message : String(error)}`);
          }
        } else {
          throw new Error("Missing required endTime field");
        }
      } catch (error) {
        const dateError = error as Error;
        console.error("Date validation error:", dateError.message);
        return res.status(400).json({ 
          message: "Invalid date format", 
          error: dateError.message 
        });
      }
      
      // Add the user ID
      formattedData.userId = req.user?.id;
      
      // Log what we're attempting to create
      console.log("Creating appointment with processed data:", JSON.stringify(formattedData, (key, value) => {
        if (value instanceof Date) {
          return value.toISOString();
        }
        return value;
      }));
      
      try {
        // Process the appointment including custom fields using the formattedData with proper date fields
        console.log("Storage: createAppointment with processed data:", JSON.stringify(formattedData, (key, value) => {
          if (value instanceof Date) {
            return value.toISOString();
          }
          return value;
        }));
        
        // Create a typed object that matches the required Appointment type
        const appointmentData = {
          ...formattedData, // Keep all original data
          // But ensure these required fields are properly typed
          title: formattedData.title as string,
          roomId: formattedData.roomId as number,
          userId: formattedData.userId as number,
          startTime: formattedData.startTime as Date,
          endTime: formattedData.endTime as Date,
          customerName: formattedData.customerName as string,
          customerEmail: formattedData.customerEmail as string,
          attendeesCount: formattedData.attendeesCount as number,
          costType: formattedData.costType as string,
          agreedCost: formattedData.agreedCost as number,
          status: formattedData.status || 'pending',
          // Ensure we have an orderNumber (will be set by storage if not provided)
          orderNumber: formattedData.orderNumber || undefined
        };
        
        const appointment = await storage.createAppointment(appointmentData);
        
        // Create audit log for appointment creation
        try {
          await storage.createAuditLog({
            appointmentId: appointment.id,
            userId: req.user?.id as number,
            action: "created",
            details: "Appointment created"
          });
          console.log("Created audit log for new appointment:", appointment.id);
        } catch (auditError) {
          console.error("Error creating audit log:", auditError);
          // Continue without failing the request
        }
        
        // Send email notification
        try {
          await EmailNotificationService.appointmentCreated(appointment, req.user!);
        } catch (emailError) {
          console.error("Error sending appointment creation notification:", emailError);
          // Continue without failing the request
        }
        
        res.status(201).json(appointment);
      } catch (error) {
        console.error("Error creating appointment:", error);
        res.status(400).json({ 
          message: "Failed to create appointment", 
          error: error instanceof Error ? error.message : String(error) 
        });
      }
    } catch (error) {
      console.error("Unexpected error in appointment creation:", error);
      
      // If the error has statusCode property, it's likely from a third-party API
      if ((error as any).statusCode) {
        return res.status((error as any).statusCode).json({ 
          message: "Error from external service", 
          error: (error as any).message 
        });
      }
      next(error);
    }
  });
  
  // Get a specific appointment
  app.get("/api/appointments/:id", isAuthenticated, async (req: Request, res: Response, next: Function) => {
    try {
      const id = parseInt(req.params.id);
      const appointment = await storage.getAppointment(id);
      
      if (!appointment) {
        return res.status(404).json({ message: "Appointment not found" });
      }
      
      // Regular users can only view their own appointments
      if (req.user?.role !== 'admin' && req.user?.role !== 'director' && appointment.userId !== req.user?.id) {
        return res.status(403).json({ message: "Forbidden - You can only view your own appointments" });
      }
      
      res.json(appointment);
    } catch (error) {
      next(error);
    }
  });
  
  // Common function for handling both PATCH and PUT appointment updates
  const updateAppointment = async (req: Request, res: Response, next: Function) => {
    try {
      const id = parseInt(req.params.id);
      const appointment = await storage.getAppointment(id);
      
      if (!appointment) {
        return res.status(404).json({ message: "Appointment not found" });
      }
      
      // If not admin/director and not the owner, don't allow update
      if (req.user?.role !== "admin" && req.user?.role !== "director" && appointment.userId !== req.user?.id) {
        return res.status(403).json({ message: "Forbidden - You can only update your own appointments" });
      }
      
      // Create a clean copy of the request body without any dates for now
      const updateData: Record<string, any> = {};
      
      // Copy all non-date fields directly
      Object.keys(req.body).forEach(key => {
        if (key !== 'startTime' && key !== 'endTime' && key !== 'createdAt' && key !== 'updatedAt') {
          updateData[key] = req.body[key];
        }
      });
      
      // Manually handle the date fields
      if (req.body.startTime) {
        try {
          console.log("Original startTime value from client:", req.body.startTime);
          
          // Make sure we have a valid date string
          const startTimeStr = String(req.body.startTime).trim();
          
          // Try to create a valid Date object
          const startDate = new Date(startTimeStr);
          
          // Verify the date is valid
          if (!isNaN(startDate.getTime())) {
            console.log("Valid startTime parsed:", startDate.toISOString());
            updateData.startTime = startDate;
          } else {
            console.error("Invalid startTime value:", startTimeStr);
            // Keep the original value from the database
            updateData.startTime = appointment.startTime;
          }
        } catch (e) {
          console.error("Error parsing startTime:", e);
          // Keep the original value from the database
          updateData.startTime = appointment.startTime;
        }
      }
      
      if (req.body.endTime) {
        try {
          console.log("Original endTime value from client:", req.body.endTime);
          
          // Make sure we have a valid date string
          const endTimeStr = String(req.body.endTime).trim();
          
          // Try to create a valid Date object
          const endDate = new Date(endTimeStr);
          
          // Verify the date is valid
          if (!isNaN(endDate.getTime())) {
            console.log("Valid endTime parsed:", endDate.toISOString());
            updateData.endTime = endDate;
          } else {
            console.error("Invalid endTime value:", endTimeStr);
            // Keep the original value from the database
            updateData.endTime = appointment.endTime;
          }
        } catch (e) {
          console.error("Error parsing endTime:", e);
          // Keep the original value from the database
          updateData.endTime = appointment.endTime;
        }
      }
      
      // Log what we're updating with
      console.log("Updating appointment with data:", JSON.stringify(updateData, (key, value) => {
        if (value instanceof Date) {
          return value.toISOString();
        }
        return value;
      }));
      
      // Check if status is being changed
      const statusChanged = updateData.status && updateData.status !== appointment.status;
      const oldAppointment = { ...appointment };
      
      // Update the appointment with proper error handling
      try {
        const updatedAppointment = await storage.updateAppointment(id, updateData);
        
        if (!updatedAppointment) {
          return res.status(500).json({ message: "Failed to update appointment" });
        }
        
        // Create audit log entry
        await storage.createAuditLog({
          appointmentId: id,
          userId: req.user?.id as number,
          action: statusChanged ? `status-changed-to-${updateData.status}` : "updated",
          details: statusChanged 
            ? `Status changed from ${oldAppointment.status} to ${updateData.status}`
            : "Appointment details updated"
        });
        
        // Try to send notifications but don't fail if email sending fails
        try {
          // Send appropriate email notification
          if (statusChanged) {
            await EmailNotificationService.appointmentStatusChanged(updatedAppointment, req.user!, oldAppointment.status);
          } else {
            await EmailNotificationService.appointmentUpdated(updatedAppointment, req.user!, oldAppointment);
          }
        } catch (emailError) {
          console.error("Error sending email notification:", emailError);
          // Continue without failing the request
        }
        
        return res.json(updatedAppointment);
      } catch (updateError) {
        console.error("Error updating appointment:", updateError);
        return res.status(500).json({ 
          message: "Error updating appointment", 
          error: updateError instanceof Error ? updateError.message : String(updateError) 
        });
      }
    } catch (error) {
      next(error);
    }
  };

  // Register both PUT and PATCH endpoints for appointment updates
  app.put("/api/appointments/:id", isAuthenticated, updateAppointment);
  app.patch("/api/appointments/:id", isAuthenticated, updateAppointment);
  
  // Delete an appointment
  app.delete("/api/appointments/:id", isAuthenticated, async (req: Request, res: Response, next: Function) => {
    try {
      const id = parseInt(req.params.id);
      const appointment = await storage.getAppointment(id);
      
      if (!appointment) {
        return res.status(404).json({ message: "Appointment not found" });
      }
      
      // Only allow admins, directors, or the appointment owner to delete
      if (req.user?.role !== "admin" && req.user?.role !== "director" && appointment.userId !== req.user?.id) {
        return res.status(403).json({ message: "Forbidden - You can only delete your own appointments" });
      }
      
      // Delete the appointment, passing the user ID for audit logging
      const result = await storage.deleteAppointment(id, req.user?.id);
      
      if (!result) {
        return res.status(404).json({ message: "Appointment not found" });
      }
      
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  });
  
  // Get audit logs for an appointment (supporting both /audit and /auditlogs endpoints)
  const getAuditLogs = async (req: Request, res: Response, next: Function) => {
    try {
      const id = parseInt(req.params.id);
      const appointment = await storage.getAppointment(id);
      
      if (!appointment) {
        return res.status(404).json({ message: "Appointment not found" });
      }
      
      // Regular users can only view audit logs for their own appointments
      if (req.user?.role !== 'admin' && req.user?.role !== 'director' && appointment.userId !== req.user?.id) {
        return res.status(403).json({ message: "Forbidden - You can only view audit logs for your own appointments" });
      }
      
      const auditLogs = await storage.getAuditLogsByAppointment(id);
      res.json(auditLogs);
    } catch (error) {
      next(error);
    }
  };
  
  // Register both endpoints for audit logs
  app.get("/api/appointments/:id/audit", isAuthenticated, getAuditLogs);
  app.get("/api/appointments/:id/auditlogs", isAuthenticated, getAuditLogs);
  
  // Appointment rejection endpoint with reason
  app.put("/api/appointments/:id/reject", isAuthenticated, async (req: Request, res: Response, next: Function) => {
    try {
      const id = parseInt(req.params.id);
      console.log(`Received rejection request for appointment ${id}. Full request body:`, req.body);
      const { reason } = req.body;
      
      console.log(`Rejection request for appointment ${id} with reason:`, reason);
      
      const appointment = await storage.getAppointment(id);
      
      if (!appointment) {
        return res.status(404).json({ message: "Appointment not found" });
      }
      
      // Only allow admins, directors, or the appointment owner to reject
      if (req.user?.role !== "admin" && req.user?.role !== "director" && appointment.userId !== req.user?.id) {
        return res.status(403).json({ message: "Forbidden - You can only reject your own appointments" });
      }
      
      // Update the appointment with rejected status and reason
      const rejectionReason = reason || "No reason provided";
      console.log(`Updating appointment ${id} with rejection reason:`, rejectionReason);
      
      // Log what data we're sending to updateAppointment
      console.log('Enviando dados para storage.updateAppointment:', 
        JSON.stringify({
          status: "rejected",
          rejectionReason: rejectionReason
        }, null, 2)
      );
      
      // Usar SQL direto para garantir a atualização do campo de rejeição
      console.log('TESTE: Usando SQL direto para atualizar com rejection_reason:', rejectionReason);
      
      // Primeiro atualizamos o status via método normal
      const updatedAppointment = await storage.updateAppointment(id, {
        status: "rejected"
      });
      
      // Depois atualizamos o motivo da rejeição diretamente no banco usando SQL
      if (updatedAppointment) {
        // Utilizamos pool do PostgreSQL para executar SQL direto
        await storage.executeRawSQL(
          'UPDATE appointments SET rejection_reason = $1 WHERE id = $2',
          [rejectionReason, id]
        );
        
        // Atualizamos a propriedade no objeto para retornar ao cliente
        (updatedAppointment as any).rejectionReason = rejectionReason;
      }
      
      // Imprimir o resultado para debug
      console.log('RESULTADO DA ATUALIZAÇÃO:', JSON.stringify(updatedAppointment, null, 2));
      
      if (!updatedAppointment) {
        return res.status(500).json({ message: "Failed to reject appointment" });
      }
      
      // Create audit log entry with newData to store rejection reason
      // Use JSON.stringify for the oldData and newData to ensure they are properly stored
      const oldDataJson = JSON.stringify({ status: appointment.status });
      const newDataJson = JSON.stringify({
        status: "rejected",
        rejectionReason: rejectionReason
      });
      
      console.log("Creating audit log with oldData:", oldDataJson);
      console.log("Creating audit log with newData:", newDataJson);
      
      await storage.createAuditLog({
        appointmentId: id,
        userId: req.user?.id as number,
        action: "status-changed-to-rejected",
        details: `Status changed from ${appointment.status} to rejected. Reason: ${rejectionReason}`,
        oldData: oldDataJson,
        newData: newDataJson
      });
      
      // Try to send notification but don't fail if email sending fails
      try {
        // Send email notification about the status change
        if (updatedAppointment) {
          await EmailNotificationService.appointmentStatusChanged(
            updatedAppointment, 
            req.user!, 
            appointment.status
          );
        }
      } catch (emailError) {
        console.error("Error sending rejection notification:", emailError);
        // Continue without failing the request
      }
      
      return res.json(updatedAppointment);
    } catch (error) {
      next(error);
    }
  });
  
  // Enhanced Statistics endpoint
  app.get("/api/stats", isAdminOrDirector, async (req: Request, res: Response, next: Function) => {
    try {
      // Get basic stats
      const allAppointments = await storage.getAllAppointments();
      const totalAppointments = allAppointments.length;
      const activeRooms = (await storage.getActiveRooms()).length;
      const totalUsers = (await storage.getAllUsers()).length;
      
      // Current date and important dates
      const now = new Date();
      
      // Start of current month
      const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      // End of current month
      const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      
      // Start of year
      const yearStart = new Date(now.getFullYear(), 0, 1);
      
      // Get all locations
      const locations = await storage.getAllLocations();
      
      // Get all rooms with their location information
      const rooms = await storage.getAllRooms();
      
      // Calculate booking status counts
      const statusCounts = {
        approved: 0,
        pending: 0,
        rejected: 0,
        cancelled: 0
      };
      
      allAppointments.forEach(appointment => {
        if (appointment.status === 'approved') statusCounts.approved++;
        else if (appointment.status === 'pending') statusCounts.pending++;
        else if (appointment.status === 'rejected') statusCounts.rejected++;
        else if (appointment.status === 'cancelled') statusCounts.cancelled++;
      });
      
      // Get active bookings (upcoming approved bookings)
      const activeBookings = allAppointments.filter(appointment => 
        appointment.status === 'approved' && 
        new Date(appointment.endTime) >= now
      ).sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
      
      // Get bookings pending approval
      const pendingBookings = allAppointments.filter(appointment => 
        appointment.status === 'pending'
      ).sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
      
      // Metrics by room
      const roomMetrics = await Promise.all(rooms.map(async room => {
        // Get all bookings for this room
        const roomBookings = await storage.getAppointmentsByRoom(room.id);
        const approvedBookings = roomBookings.filter(b => b.status === 'approved');
        const rejectedBookings = roomBookings.filter(b => b.status === 'rejected');
        
        // Current month utilization in hours
        const currentMonthBookings = approvedBookings.filter(booking => 
          new Date(booking.startTime) >= currentMonthStart && 
          new Date(booking.endTime) <= currentMonthEnd
        );
        
        // Year to date bookings
        const ytdBookings = approvedBookings.filter(booking => 
          new Date(booking.startTime) >= yearStart
        );
        
        // Calculate utilization in hours
        let monthlyHours = 0;
        currentMonthBookings.forEach(booking => {
          const start = new Date(booking.startTime);
          const end = new Date(booking.endTime);
          const durationHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
          monthlyHours += durationHours;
        });
        
        // Calculate revenue 
        let monthlyRevenue = 0;
        let ytdRevenue = 0;
        
        // For current month revenue
        currentMonthBookings.forEach(booking => {
          if (booking.rooms && Array.isArray(booking.rooms)) {
            const roomEntry = booking.rooms.find((r: any) => r.roomId === room.id);
            if (roomEntry && roomEntry.cost) {
              monthlyRevenue += roomEntry.cost;
            }
          }
        });
        
        // For YTD revenue
        ytdBookings.forEach(booking => {
          if (booking.rooms && Array.isArray(booking.rooms)) {
            const roomEntry = booking.rooms.find((r: any) => r.roomId === room.id);
            if (roomEntry && roomEntry.cost) {
              ytdRevenue += roomEntry.cost;
            }
          }
        });
        
        // Average revenue per booking
        const avgRevenuePerBooking = currentMonthBookings.length > 0 
          ? monthlyRevenue / currentMonthBookings.length 
          : 0;
        
        return {
          id: room.id,
          name: room.name,
          locationId: room.locationId,
          locationName: locations.find(l => l.id === room.locationId)?.name || 'Unknown Location',
          monthlyHours,
          monthlyRevenue,
          ytdRevenue,
          avgRevenuePerBooking,
          totalBookings: roomBookings.length,
          approvedBookings: approvedBookings.length,
          rejectedBookings: rejectedBookings.length,
          pendingBookings: roomBookings.filter(b => b.status === 'pending').length
        };
      }));
      
      // Metrics by location
      const locationMetrics = locations.map(location => {
        const locationRooms = roomMetrics.filter(r => r.locationId === location.id);
        
        // Aggregate metrics
        const monthlyHours = locationRooms.reduce((total, room) => total + room.monthlyHours, 0);
        const monthlyRevenue = locationRooms.reduce((total, room) => total + room.monthlyRevenue, 0);
        const ytdRevenue = locationRooms.reduce((total, room) => total + room.ytdRevenue, 0);
        const totalBookings = locationRooms.reduce((total, room) => total + room.totalBookings, 0);
        const approvedBookings = locationRooms.reduce((total, room) => total + room.approvedBookings, 0);
        const rejectedBookings = locationRooms.reduce((total, room) => total + room.rejectedBookings, 0);
        const pendingBookings = locationRooms.reduce((total, room) => total + room.pendingBookings, 0);
        
        // Average revenue per booking at this location
        const avgRevenuePerBooking = approvedBookings > 0 
          ? monthlyRevenue / approvedBookings
          : 0;
        
        return {
          id: location.id,
          name: location.name,
          monthlyHours,
          monthlyRevenue, 
          ytdRevenue,
          avgRevenuePerBooking,
          totalBookings,
          approvedBookings,
          rejectedBookings,
          pendingBookings
        };
      });
      
      // Total metrics
      const totalMonthlyHours = roomMetrics.reduce((total, room) => total + room.monthlyHours, 0);
      const totalMonthlyRevenue = roomMetrics.reduce((total, room) => total + room.monthlyRevenue, 0);
      const totalYtdRevenue = roomMetrics.reduce((total, room) => total + room.ytdRevenue, 0);
      
      res.json({
        // Basic stats
        totalAppointments,
        activeRooms,
        totalUsers,
        statusCounts,
        
        // List metrics
        activeBookings,
        pendingBookings,
        roomMetrics,
        locationMetrics,
        
        // Totals
        totalMonthlyHours,
        totalMonthlyRevenue,
        totalYtdRevenue
      });
    } catch (error) {
      next(error);
    }
  });
}