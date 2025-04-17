import type { Express, Request, Response } from "express";
import { storage } from "../storage";
import { isAdmin, isAdminOrDirector, isAuthenticated } from "./index";
import { insertAppointmentSchema } from "@shared/schema";
import { EmailNotificationService } from "../utils/email";

export function registerAppointmentRoutes(app: Express): void {
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
        console.log("Original startTime:", processedData.startTime);
        if (processedData.startTime) {
          const startDate = new Date(processedData.startTime);
          // Verify it's a valid date
          if (!isNaN(startDate.getTime())) {
            formattedData.startTime = startDate;
            console.log("Parsed startTime:", startDate.toISOString());
          } else {
            throw new Error(`Invalid startTime value: ${processedData.startTime}`);
          }
        } else {
          throw new Error("Missing required startTime field");
        }
        
        // Handle endTime
        console.log("Original endTime:", processedData.endTime);
        if (processedData.endTime) {
          const endDate = new Date(processedData.endTime);
          // Verify it's a valid date
          if (!isNaN(endDate.getTime())) {
            formattedData.endTime = endDate;
            console.log("Parsed endTime:", endDate.toISOString());
          } else {
            throw new Error(`Invalid endTime value: ${processedData.endTime}`);
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
  
  // Get audit logs for an appointment
  app.get("/api/appointments/:id/auditlogs", isAuthenticated, async (req: Request, res: Response, next: Function) => {
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
  });
  
  // Statistics endpoint
  app.get("/api/stats", isAdminOrDirector, async (req: Request, res: Response, next: Function) => {
    try {
      // Get basic stats
      const totalAppointments = (await storage.getAllAppointments()).length;
      const recentAppointments = (await storage.getRecentAppointments(10)).length;
      const activeRooms = (await storage.getActiveRooms()).length;
      const totalUsers = (await storage.getAllUsers()).length;
      
      // Get room utilization for the past month
      const now = new Date();
      const startDate = new Date(now);
      startDate.setMonth(now.getMonth() - 1);
      
      const roomUtilization = await storage.getOverallUtilization(startDate, now);
      const utilization = roomUtilization.reduce((total, curr) => total + curr.utilization, 0) / 
                          (roomUtilization.length || 1);
      
      // Get popular rooms (by booking count)
      const rooms = await storage.getAllRooms();
      const popularRooms = [];
      
      for (const room of rooms) {
        const bookings = await storage.getAppointmentsByRoom(room.id);
        const roomUtilization = await storage.getRoomUtilization(room.id, startDate, now);
        popularRooms.push({
          room,
          bookings: bookings.length,
          utilization: roomUtilization
        });
      }
      
      // Sort by booking count descending
      popularRooms.sort((a, b) => b.bookings - a.bookings);
      
      // Get recent bookings
      const recentBookingsList = await storage.getRecentAppointments(5);
      
      res.json({
        totalAppointments,
        recentAppointments,
        activeRooms,
        totalUsers,
        utilization,
        popularRooms,
        recentBookings: recentBookingsList
      });
    } catch (error) {
      next(error);
    }
  });
}