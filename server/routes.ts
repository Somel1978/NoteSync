import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import { insertRoomSchema, insertLocationSchema, insertAppointmentSchema, EmailSettings } from "@shared/schema";
import { EmailNotificationService } from "./utils/email";
import { z } from "zod";

// Middleware to check if user is authenticated
const isAuthenticated = (req: Request, res: Response, next: Function) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ message: "Unauthorized" });
};

// Middleware to check if user is an admin
const isAdmin = (req: Request, res: Response, next: Function) => {
  if (req.isAuthenticated() && req.user?.role === "admin") {
    return next();
  }
  res.status(403).json({ message: "Forbidden - Admin access required" });
};

// Middleware to check if user is an admin or director
const isAdminOrDirector = (req: Request, res: Response, next: Function) => {
  if (req.isAuthenticated() && (req.user?.role === "admin" || req.user?.role === "director")) {
    return next();
  }
  res.status(403).json({ message: "Forbidden - Admin or Director access required" });
};

export function registerRoutes(app: Express): Server {
  // Setup authentication routes
  setupAuth(app);
  
  // Public API Endpoints
  app.get("/api/public/locations", async (req, res, next) => {
    try {
      const locations = await storage.getAllLocations();
      res.json(locations);
    } catch (error) {
      next(error);
    }
  });
  
  app.get("/api/public/rooms", async (req, res, next) => {
    try {
      const rooms = await storage.getAllRooms();
      res.json(rooms);
    } catch (error) {
      next(error);
    }
  });
  
  app.get("/api/public/appointments", async (req, res, next) => {
    try {
      const appointments = await storage.getAllAppointments();
      res.json(appointments);
    } catch (error) {
      next(error);
    }
  });
  
  // Protected API Endpoints
  
  // User endpoints
  app.get("/api/users", isAdmin, async (req, res, next) => {
    try {
      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error) {
      next(error);
    }
  });
  
  app.get("/api/users/:id", isAdmin, async (req, res, next) => {
    try {
      const id = parseInt(req.params.id);
      const user = await storage.getUser(id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json(user);
    } catch (error) {
      next(error);
    }
  });
  
  app.patch("/api/users/:id", isAuthenticated, async (req, res, next) => {
    try {
      const id = parseInt(req.params.id);
      
      // Users can only update their own profile unless they're an admin
      if (req.user?.id !== id && req.user?.role !== "admin") {
        return res.status(403).json({ message: "Forbidden - You can only update your own profile" });
      }
      
      // Don't allow role changes unless the user is an admin
      if (req.body.role && req.user?.role !== "admin") {
        delete req.body.role;
      }
      
      const user = await storage.updateUser(id, req.body);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json(user);
    } catch (error) {
      next(error);
    }
  });
  
  app.delete("/api/users/:id", isAdmin, async (req, res, next) => {
    try {
      const id = parseInt(req.params.id);
      
      // Don't allow deleting the last admin user
      if (req.user?.id === id && req.user?.role === "admin") {
        const admins = (await storage.getAllUsers()).filter(u => u.role === "admin");
        if (admins.length <= 1) {
          return res.status(400).json({ message: "Cannot delete the last admin user" });
        }
      }
      
      const result = await storage.deleteUser(id);
      if (!result) {
        return res.status(404).json({ message: "User not found" });
      }
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  });
  
  app.post("/api/users/:id/change-password", isAuthenticated, async (req, res, next) => {
    try {
      const id = parseInt(req.params.id);
      
      // Users can only change their own password
      if (req.user?.id !== id) {
        return res.status(403).json({ message: "Forbidden - You can only change your own password" });
      }
      
      // Check if currentPassword and newPassword are provided
      if (!req.body.currentPassword || !req.body.newPassword) {
        return res.status(400).json({ message: "Current password and new password are required" });
      }
      
      // Additional validation can be added here
      
      // This endpoint relies on the storage implementation to verify the current password
      // and update with the new one
      const updated = await storage.updatePassword(
        id, 
        req.body.currentPassword, 
        req.body.newPassword
      );
      
      if (!updated) {
        return res.status(400).json({ message: "Invalid current password" });
      }
      
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  });
  
  app.post("/api/users/:id/request-deletion", isAuthenticated, async (req, res, next) => {
    try {
      const id = parseInt(req.params.id);
      
      // Users can only request deletion for their own account
      if (req.user?.id !== id) {
        return res.status(403).json({ message: "Forbidden - You can only request deletion for your own account" });
      }
      
      // Don't allow the last admin to request deletion
      if (req.user?.role === "admin") {
        const admins = (await storage.getAllUsers()).filter(u => u.role === "admin");
        if (admins.length <= 1) {
          return res.status(400).json({ message: "Cannot delete the last admin user" });
        }
      }
      
      const user = await storage.updateUser(id, { deletionRequested: true });
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      res.json(user);
    } catch (error) {
      next(error);
    }
  });
  
  // Location endpoints
  app.get("/api/locations", isAdminOrDirector, async (req, res, next) => {
    try {
      const locations = await storage.getAllLocations();
      res.json(locations);
    } catch (error) {
      next(error);
    }
  });
  
  app.post("/api/locations", isAdmin, async (req, res, next) => {
    try {
      const validatedData = insertLocationSchema.parse(req.body);
      const location = await storage.createLocation(validatedData);
      res.status(201).json(location);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ errors: error.errors });
      }
      next(error);
    }
  });
  
  app.get("/api/locations/:id", isAdminOrDirector, async (req, res, next) => {
    try {
      const id = parseInt(req.params.id);
      const location = await storage.getLocation(id);
      if (!location) {
        return res.status(404).json({ message: "Location not found" });
      }
      res.json(location);
    } catch (error) {
      next(error);
    }
  });
  
  app.patch("/api/locations/:id", isAdmin, async (req, res, next) => {
    try {
      const id = parseInt(req.params.id);
      const location = await storage.updateLocation(id, req.body);
      if (!location) {
        return res.status(404).json({ message: "Location not found" });
      }
      res.json(location);
    } catch (error) {
      next(error);
    }
  });
  
  app.delete("/api/locations/:id", isAdmin, async (req, res, next) => {
    try {
      const id = parseInt(req.params.id);
      
      // Check if there are rooms associated with this location
      const rooms = await storage.getRoomsByLocation(id);
      if (rooms.length > 0) {
        return res.status(400).json({ 
          message: "Cannot delete location with associated rooms. Delete the rooms first."
        });
      }
      
      const result = await storage.deleteLocation(id);
      if (!result) {
        return res.status(404).json({ message: "Location not found" });
      }
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  });
  
  // Room endpoints
  app.get("/api/rooms", isAdminOrDirector, async (req, res, next) => {
    try {
      const rooms = await storage.getAllRooms();
      res.json(rooms);
    } catch (error) {
      next(error);
    }
  });
  
  app.post("/api/rooms", isAdmin, async (req, res, next) => {
    try {
      const validatedData = insertRoomSchema.parse(req.body);
      const room = await storage.createRoom(validatedData);
      res.status(201).json(room);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ errors: error.errors });
      }
      next(error);
    }
  });
  
  app.get("/api/rooms/:id", isAdminOrDirector, async (req, res, next) => {
    try {
      const id = parseInt(req.params.id);
      const room = await storage.getRoom(id);
      if (!room) {
        return res.status(404).json({ message: "Room not found" });
      }
      res.json(room);
    } catch (error) {
      next(error);
    }
  });
  
  app.patch("/api/rooms/:id", isAdmin, async (req, res, next) => {
    try {
      const id = parseInt(req.params.id);
      const room = await storage.updateRoom(id, req.body);
      if (!room) {
        return res.status(404).json({ message: "Room not found" });
      }
      res.json(room);
    } catch (error) {
      next(error);
    }
  });
  
  app.delete("/api/rooms/:id", isAdmin, async (req, res, next) => {
    try {
      const id = parseInt(req.params.id);
      
      // Check if there are appointments using this room
      const appointments = await storage.getAppointmentsByRoom(id);
      if (appointments.length > 0) {
        return res.status(400).json({ 
          message: "Cannot delete room with associated appointments. Delete or reassign the appointments first."
        });
      }
      
      const result = await storage.deleteRoom(id);
      if (!result) {
        return res.status(404).json({ message: "Room not found" });
      }
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  });
  
  // Appointment endpoints
  app.get("/api/appointments", isAuthenticated, async (req, res, next) => {
    try {
      let appointments;
      
      // Filter by user if specified
      if (req.query.userId) {
        appointments = await storage.getAppointmentsByUser(parseInt(req.query.userId as string));
      } 
      // Filter by room if specified
      else if (req.query.roomId) {
        appointments = await storage.getAppointmentsByRoom(parseInt(req.query.roomId as string));
      }
      // Filter by date range if specified
      else if (req.query.startDate && req.query.endDate) {
        appointments = await storage.getAppointmentsByDateRange(
          new Date(req.query.startDate as string),
          new Date(req.query.endDate as string)
        );
      }
      // Filter by status if specified
      else if (req.query.status) {
        appointments = await storage.getAppointmentsByStatus(req.query.status as string);
      }
      // Otherwise get all appointments
      else {
        appointments = await storage.getAllAppointments();
      }
      
      // If the user is not an admin or director, only return their own appointments
      if (req.user?.role !== "admin" && req.user?.role !== "director") {
        appointments = appointments.filter(a => a.userId === req.user?.id);
      }
      
      res.json(appointments);
    } catch (error) {
      next(error);
    }
  });
  
  app.post("/api/appointments", isAuthenticated, async (req, res, next) => {
    try {
      // Merge in the current user ID
      const appointmentData = {
        ...req.body,
        userId: req.user?.id,
        orderNumber: await storage.getNextAppointmentOrderNumber()
      };
      
      const validatedData = insertAppointmentSchema.parse(appointmentData);
      const appointment = await storage.createAppointment(validatedData);
      
      // Create audit log entry
      await storage.createAuditLog({
        appointmentId: appointment.id,
        userId: req.user?.id as number,
        action: "created",
        details: "Appointment created"
      });
      
      // Send email notification
      await EmailNotificationService.appointmentCreated(appointment, req.user!);
      
      res.status(201).json(appointment);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ errors: error.errors });
      }
      next(error);
    }
  });
  
  app.get("/api/appointments/:id", isAuthenticated, async (req, res, next) => {
    try {
      const id = parseInt(req.params.id);
      const appointment = await storage.getAppointment(id);
      
      if (!appointment) {
        return res.status(404).json({ message: "Appointment not found" });
      }
      
      // If not admin/director and not the owner, don't allow access
      if (req.user?.role !== "admin" && req.user?.role !== "director" && appointment.userId !== req.user?.id) {
        return res.status(403).json({ message: "Forbidden - You can only view your own appointments" });
      }
      
      res.json(appointment);
    } catch (error) {
      next(error);
    }
  });
  
  app.patch("/api/appointments/:id", isAuthenticated, async (req, res, next) => {
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
      
      // Check if status is being changed
      const statusChanged = req.body.status && req.body.status !== appointment.status;
      const oldAppointment = { ...appointment };
      
      // Update the appointment
      const updatedAppointment = await storage.updateAppointment(id, req.body);
      
      // Create audit log entry
      await storage.createAuditLog({
        appointmentId: id,
        userId: req.user?.id as number,
        action: statusChanged ? `status-changed-to-${req.body.status}` : "updated",
        details: statusChanged 
          ? `Status changed from ${oldAppointment.status} to ${req.body.status}`
          : "Appointment details updated"
      });
      
      // Send appropriate email notification
      if (statusChanged) {
        await EmailNotificationService.appointmentStatusChanged(updatedAppointment!, req.user!, oldAppointment.status);
      } else {
        await EmailNotificationService.appointmentUpdated(updatedAppointment!, req.user!, oldAppointment);
      }
      
      res.json(updatedAppointment);
    } catch (error) {
      next(error);
    }
  });
  
  app.delete("/api/appointments/:id", isAuthenticated, async (req, res, next) => {
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
  
  // Statistics endpoint
  app.get("/api/stats", isAdminOrDirector, async (req, res, next) => {
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

  // Email settings endpoints
  app.get("/api/settings/email", isAdmin, async (req, res, next) => {
    try {
      const emailSetting = await storage.getSetting('email');
      console.log("Retrieved email settings:", JSON.stringify(emailSetting));
      
      // Return default settings if none exist
      if (!emailSetting || !emailSetting.value || Object.keys(emailSetting.value).length === 0) {
        return res.json({
          enabled: false,
          mailjetApiKey: "",
          mailjetSecretKey: "",
          systemEmail: "",
          systemName: "ACRDSC Reservas",
          notifyOnCreate: true,
          notifyOnUpdate: true,
          notifyOnStatusChange: true,
          emailTemplateBookingCreated: "",
          emailTemplateBookingUpdated: "",
          emailTemplateBookingStatusChanged: ""
        });
      }
      
      res.json(emailSetting.value);
    } catch (error) {
      console.error("Error retrieving email settings:", error);
      next(error);
    }
  });

  app.post("/api/settings/email", isAdmin, async (req, res, next) => {
    try {
      // Log the body in different formats to debug
      console.log("API ROUTE: Received POST to /api/settings/email");
      console.log("Body as received:", req.body);
      console.log("Body type:", typeof req.body);
      console.log("Body stringified:", JSON.stringify(req.body));
      console.log("Body keys:", Object.keys(req.body));
      
      // We'll now pass the data directly to storage
      const setting = await storage.createOrUpdateSetting('email', req.body);
      console.log("Setting saved to database:", JSON.stringify(setting));
      
      // Return the setting value (the email settings)
      if (setting && setting.value) {
        res.json(setting.value);
      } else {
        // Fallback to default values if something went wrong
        res.json({
          enabled: false,
          mailjetApiKey: "",
          mailjetSecretKey: "",
          systemEmail: "",
          systemName: "ACRDSC Reservas",
          notifyOnCreate: true,
          notifyOnUpdate: true,
          notifyOnStatusChange: true,
          emailTemplateBookingCreated: "",
          emailTemplateBookingUpdated: "",
          emailTemplateBookingStatusChanged: ""
        });
      }
    } catch (error) {
      console.error("Error saving email settings:", error);
      next(error);
    }
  });

  app.post("/api/settings/email/test", isAdmin, async (req, res, next) => {
    try {
      // Get email settings
      const emailSetting = await storage.getSetting('email');
      
      if (!emailSetting) {
        return res.status(400).json({ error: "Email settings not found" });
      }
      
      console.log("Testing with email settings:", JSON.stringify(emailSetting));
      
      // Check if value is an empty object
      if (emailSetting.value && Object.keys(emailSetting.value).length === 0) {
        return res.status(400).json({ error: "Email settings are not configured" });
      }
      
      const settings = emailSetting.value as EmailSettings;
      
      if (!settings || !settings.enabled) {
        return res.status(400).json({ error: "Email notifications are not enabled" });
      }
      
      // Import Mailjet
      const mailjetModule = await import('node-mailjet');
      console.log("Mailjet module keys:", Object.keys(mailjetModule));
      
      // Access the Client constructor from the imported module
      const Client = mailjetModule.Client || mailjetModule.default;
      console.log("Client type:", typeof Client);
      
      if (typeof Client !== 'function') {
        return res.status(500).json({ 
          error: "Failed to initialize Mailjet", 
          details: "Invalid client constructor" 
        });
      }
      
      // Create a client instance
      const mailjet = new Client({
        apiKey: settings.mailjetApiKey,
        apiSecret: settings.mailjetSecretKey
      });
      
      // Send test email
      const user = req.user!;
      
      const response = await mailjet.post('send', { version: 'v3.1' }).request({
        Messages: [
          {
            From: {
              Email: settings.systemEmail,
              Name: settings.systemName
            },
            To: [
              {
                Email: user.email,
                Name: user.name
              }
            ],
            Subject: "Test Email from ACRDSC Reservas",
            HTMLPart: `
              <h3>Test Email</h3>
              <p>This is a test email from your ACRDSC Reservas system.</p>
              <p>If you received this email, your email notification settings are working correctly.</p>
              <p>Best regards,<br>${settings.systemName}</p>
            `
          }
        ]
      });
      
      console.log("Email sent successfully:", response.body);
      res.json({ success: true, message: "Test email sent successfully" });
    } catch (error: any) {
      console.error("Error sending test email:", error);
      
      // Check for Mailjet specific errors
      if (error.statusCode) {
        return res.status(error.statusCode).json({ 
          error: "Mailjet API error", 
          details: error.message || "Failed to send test email" 
        });
      }
      
      next(error);
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}