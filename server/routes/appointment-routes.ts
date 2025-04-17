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
      // Helper function to recursively process date strings in the object
      const processDateFields = (obj: any): any => {
        // Skip null/undefined values
        if (!obj) return obj;
        
        // Handle arrays
        if (Array.isArray(obj)) {
          return obj.map(item => processDateFields(item));
        }
        
        // Handle objects
        if (typeof obj === 'object' && !(obj instanceof Date)) {
          const newObj: Record<string, any> = {};
          
          for (const key in obj) {
            // Process nested objects and arrays recursively
            if (obj[key] && typeof obj[key] === 'object') {
              newObj[key] = processDateFields(obj[key]);
            } 
            // Convert ISO date strings to Date objects
            else if (typeof obj[key] === 'string' && 
                     /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/.test(obj[key])) {
              try {
                newObj[key] = new Date(obj[key]);
              } catch (e) {
                console.warn(`Failed to convert date string: ${obj[key]}`, e);
                newObj[key] = obj[key]; // Keep original value if conversion fails
              }
            } 
            // Keep other values as is
            else {
              newObj[key] = obj[key];
            }
          }
          return newObj;
        }
        
        // Return primitives and already processed values as is
        return obj;
      };
      
      // Process the entire create object, including any nested structures
      const processedData = processDateFields({ ...req.body });
      
      // Extra safety for main date fields
      if (processedData.startTime && !(processedData.startTime instanceof Date)) {
        processedData.startTime = new Date(processedData.startTime);
      }
      
      if (processedData.endTime && !(processedData.endTime instanceof Date)) {
        processedData.endTime = new Date(processedData.endTime);
      }
      
      // Add the user ID
      processedData.userId = req.user?.id;
      
      // Log what we're attempting to create
      console.log("Creating appointment with processed data:", JSON.stringify(processedData, (key, value) => {
        if (value instanceof Date) {
          return value.toISOString();
        }
        return value;
      }));
      
      try {
        // Process the appointment including custom fields
        const appointment = await storage.createAppointment(processedData);
        
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
      
      // Helper function to recursively process date strings in the object
      const processDateFields = (obj: any): any => {
        // Skip null/undefined values
        if (!obj) return obj;
        
        // Handle arrays
        if (Array.isArray(obj)) {
          return obj.map(item => processDateFields(item));
        }
        
        // Handle objects
        if (typeof obj === 'object' && !(obj instanceof Date)) {
          const newObj: Record<string, any> = {};
          
          for (const key in obj) {
            // Process nested objects and arrays recursively
            if (obj[key] && typeof obj[key] === 'object') {
              newObj[key] = processDateFields(obj[key]);
            } 
            // Convert ISO date strings to Date objects
            else if (typeof obj[key] === 'string' && 
                     /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/.test(obj[key])) {
              try {
                newObj[key] = new Date(obj[key]);
              } catch (e) {
                console.warn(`Failed to convert date string: ${obj[key]}`, e);
                newObj[key] = obj[key]; // Keep original value if conversion fails
              }
            } 
            // Keep other values as is
            else {
              newObj[key] = obj[key];
            }
          }
          return newObj;
        }
        
        // Return primitives and already processed values as is
        return obj;
      };
      
      // Process the entire update object, including nested structures
      const updateData = processDateFields({ ...req.body });
      
      // Force convert startTime and endTime to Date objects, even if they're null/undefined
      try {
        console.log("Original startTime:", req.body.startTime, "Type:", typeof req.body.startTime);
        console.log("Original endTime:", req.body.endTime, "Type:", typeof req.body.endTime);
        
        // Always attempt to parse startTime and endTime from the original request body
        if (req.body.startTime) {
          updateData.startTime = new Date(req.body.startTime);
          console.log("Converted startTime:", updateData.startTime);
        }
        
        if (req.body.endTime) {
          updateData.endTime = new Date(req.body.endTime);
          console.log("Converted endTime:", updateData.endTime);
        }
      } catch (e) {
        console.error("Error converting dates:", e);
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