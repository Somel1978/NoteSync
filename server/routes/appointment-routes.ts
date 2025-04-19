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
      
      // Filter by status if specified
      if (req.query.status) {
        const status = req.query.status as string;
        if (status && ['pending', 'approved', 'rejected', 'cancelled', 'finished'].includes(status)) {
          appointments = appointments.filter(a => a.status === status);
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
  
  // Mark appointment as finished with final revenue
  app.put("/api/appointments/:id/finish", isAuthenticated, async (req: Request, res: Response, next: Function) => {
    try {
      const id = parseInt(req.params.id);
      console.log(`Received finish request for appointment ${id}. Full request body:`, req.body);
      const { finalRevenue } = req.body;
      
      console.log(`Finish request for appointment ${id} with finalRevenue:`, finalRevenue);
      
      const appointment = await storage.getAppointment(id);
      
      if (!appointment) {
        return res.status(404).json({ message: "Appointment not found" });
      }
      
      // Only allow admins, directors, or the appointment owner to mark as finished
      if (req.user?.role !== "admin" && req.user?.role !== "director" && appointment.userId !== req.user?.id) {
        return res.status(403).json({ message: "Forbidden - You can only finish your own appointments" });
      }
      
      // Verify the appointment is in approved status before finishing
      if (appointment.status !== "approved") {
        return res.status(400).json({ 
          message: "Cannot finish appointment", 
          error: "Only approved appointments can be marked as finished" 
        });
      }
      
      // Update the appointment status to finished and add final revenue
      const updatedAppointment = await storage.updateAppointment(id, {
        status: "finished",
        finalRevenue: finalRevenue
      });
      
      if (!updatedAppointment) {
        return res.status(500).json({ message: "Failed to update appointment status" });
      }
      
      // Create audit log entry
      await storage.createAuditLog({
        appointmentId: id,
        userId: req.user?.id as number,
        action: "status-changed-to-finished",
        details: `Appointment marked as finished with final revenue: €${(finalRevenue / 100).toFixed(2)}`
      });
      
      // Send email notification
      try {
        await EmailNotificationService.appointmentStatusChanged(updatedAppointment, req.user!, "approved");
      } catch (emailError) {
        console.error("Error sending appointment finished notification:", emailError);
        // Continue without failing the request
      }
      
      res.json(updatedAppointment);
    } catch (error) {
      console.error("Error finishing appointment:", error);
      next(error);
    }
  });
  
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
        finished: 0
      };
      
      allAppointments.forEach(appointment => {
        if (appointment.status === 'approved') statusCounts.approved++;
        else if (appointment.status === 'pending') statusCounts.pending++;
        else if (appointment.status === 'rejected') statusCounts.rejected++;
        else if (appointment.status === 'finished') statusCounts.finished++;
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
        
        // Current month utilization in hours - include bookings that overlap with the month
        const currentMonthBookings = approvedBookings.filter(booking => {
          const bookingStart = new Date(booking.startTime);
          const bookingEnd = new Date(booking.endTime);
          
          // A booking is in the current month if:
          // 1. It starts in the month, or
          // 2. It ends in the month, or
          // 3. It spans the entire month (starts before and ends after)
          return (
            (bookingStart >= currentMonthStart && bookingStart <= currentMonthEnd) || // starts in month
            (bookingEnd >= currentMonthStart && bookingEnd <= currentMonthEnd) || // ends in month
            (bookingStart <= currentMonthStart && bookingEnd >= currentMonthEnd) // spans entire month
          );
        });
        
        // Year to date bookings - include bookings that started this year or overlap with this year
        const ytdBookings = approvedBookings.filter(booking => {
          const bookingStart = new Date(booking.startTime);
          const bookingEnd = new Date(booking.endTime);
          
          return (
            bookingStart >= yearStart || // started this year
            (bookingStart < yearStart && bookingEnd >= yearStart) // started before this year but ends in this year
          );
        });
        
        // Calculate utilization in hours - only count the hours within the current month
        let monthlyHours = 0;
        currentMonthBookings.forEach(booking => {
          // Calculate the effective start and end times within the current month
          let effectiveStart = new Date(booking.startTime);
          let effectiveEnd = new Date(booking.endTime);
          
          // If the booking started before this month, use the month start
          if (effectiveStart < currentMonthStart) {
            effectiveStart = new Date(currentMonthStart);
          }
          
          // If the booking ends after this month, use the month end
          if (effectiveEnd > currentMonthEnd) {
            effectiveEnd = new Date(currentMonthEnd);
          }
          
          // Calculate the duration in hours only for the part within this month
          const durationHours = (effectiveEnd.getTime() - effectiveStart.getTime()) / (1000 * 60 * 60);
          monthlyHours += durationHours;
        });
        
        // Calculate revenue 
        let monthlyRevenue = 0;
        let ytdRevenue = 0;
        
        // For current month revenue - use finalRevenue for 'finished' bookings when available
        currentMonthBookings.forEach(booking => {
          // Verificar se é um agendamento finalizado com receita final registrada
          if (booking.status === 'finished' && booking.finalRevenue !== null && booking.finalRevenue !== undefined) {
            // Para agendamentos finalizados com várias salas, precisamos calcular a proporção da receita
            // que pertence a esta sala específica com base no custo original
            let totalOriginalCost = 0;
            let thisRoomCost = 0;
            
            if (booking.rooms && Array.isArray(booking.rooms)) {
              // Calcular o custo total original e o custo desta sala
              booking.rooms.forEach((r: any) => {
                if (r.cost) totalOriginalCost += r.cost;
                if (r.roomId === room.id && r.cost) thisRoomCost = r.cost;
              });
              
              // Se temos um custo total e um custo para esta sala, podemos calcular a proporção
              if (totalOriginalCost > 0 && thisRoomCost > 0) {
                const proportion = thisRoomCost / totalOriginalCost;
                monthlyRevenue += booking.finalRevenue * proportion;
              } else if (booking.rooms.length === 1) {
                // Se só tem uma sala, toda a receita vai para ela
                monthlyRevenue += booking.finalRevenue;
              }
            } else {
              // Se não temos informação da sala, mas temos receita final, consideramos tudo
              monthlyRevenue += booking.finalRevenue;
            }
          } else {
            // Para agendamentos não finalizados, usamos o valor original
            if (booking.rooms && Array.isArray(booking.rooms)) {
              const roomEntry = booking.rooms.find((r: any) => r.roomId === room.id);
              if (roomEntry && roomEntry.cost) {
                monthlyRevenue += roomEntry.cost;
              }
            }
          }
        });
        
        // For YTD revenue - também usar finalRevenue quando disponível
        ytdBookings.forEach(booking => {
          // Verificar se é um agendamento finalizado com receita final registrada
          if (booking.status === 'finished' && booking.finalRevenue !== null && booking.finalRevenue !== undefined) {
            // Para agendamentos finalizados com várias salas, precisamos calcular a proporção da receita
            // que pertence a esta sala específica com base no custo original
            let totalOriginalCost = 0;
            let thisRoomCost = 0;
            
            if (booking.rooms && Array.isArray(booking.rooms)) {
              // Calcular o custo total original e o custo desta sala
              booking.rooms.forEach((r: any) => {
                if (r.cost) totalOriginalCost += r.cost;
                if (r.roomId === room.id && r.cost) thisRoomCost = r.cost;
              });
              
              // Se temos um custo total e um custo para esta sala, podemos calcular a proporção
              if (totalOriginalCost > 0 && thisRoomCost > 0) {
                const proportion = thisRoomCost / totalOriginalCost;
                ytdRevenue += booking.finalRevenue * proportion;
              } else if (booking.rooms.length === 1) {
                // Se só tem uma sala, toda a receita vai para ela
                ytdRevenue += booking.finalRevenue;
              }
            } else {
              // Se não temos informação da sala, mas temos receita final, consideramos tudo
              ytdRevenue += booking.finalRevenue;
            }
          } else {
            // Para agendamentos não finalizados, usamos o valor original
            if (booking.rooms && Array.isArray(booking.rooms)) {
              const roomEntry = booking.rooms.find((r: any) => r.roomId === room.id);
              if (roomEntry && roomEntry.cost) {
                ytdRevenue += roomEntry.cost;
              }
            }
          }
        });
        
        // Average revenue per booking
        const avgRevenuePerBooking = currentMonthBookings.length > 0 
          ? monthlyRevenue / currentMonthBookings.length 
          : 0;
        
        // Calculate utilization rate for the month (percentage)
        // Assuming rooms are available for 12 hours per day (adjust as needed)
        const hoursPerDay = 12;
        const daysInMonth = new Date(currentMonthEnd.getFullYear(), currentMonthEnd.getMonth() + 1, 0).getDate();
        const totalAvailableHours = daysInMonth * hoursPerDay;
        const utilization = (monthlyHours / totalAvailableHours) * 100;
        
        return {
          id: room.id,
          name: room.name,
          locationId: room.locationId,
          locationName: locations.find(l => l.id === room.locationId)?.name || 'Unknown Location',
          monthlyHours,
          monthlyRevenue,
          ytdRevenue,
          avgRevenuePerBooking,
          utilization,
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
          
        // Calculate location utilization - assuming same hours per day
        const hoursPerDay = 12;
        const daysInMonth = new Date(currentMonthEnd.getFullYear(), currentMonthEnd.getMonth() + 1, 0).getDate();
        // Total available hours for all rooms in the location
        const totalRoomsInLocation = locationRooms.length;
        const totalAvailableHours = totalRoomsInLocation > 0 
          ? daysInMonth * hoursPerDay * totalRoomsInLocation 
          : 1; // avoid division by zero
        const utilization = (monthlyHours / totalAvailableHours) * 100;
        
        return {
          id: location.id,
          name: location.name,
          monthlyHours,
          monthlyRevenue, 
          ytdRevenue,
          avgRevenuePerBooking,
          utilization,
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