import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import { insertRoomSchema, insertLocationSchema, insertAppointmentSchema } from "@shared/schema";
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
  // Set up authentication routes
  setupAuth(app);

  // Public API endpoints
  app.get("/api/public/appointments", async (req, res, next) => {
    try {
      const appointments = await storage.getAllAppointments();
      
      // Only return certain fields for public view
      const publicAppointments = appointments.map(appointment => ({
        id: appointment.id,
        title: appointment.title,
        roomId: appointment.roomId,
        startTime: appointment.startTime,
        endTime: appointment.endTime,
        status: appointment.status,
        orderNumber: appointment.orderNumber,
        customerName: appointment.customerName,
        // Only include contact details for approved appointments
        customerEmail: appointment.status === 'approved' ? appointment.customerEmail : undefined,
        customerPhone: appointment.status === 'approved' ? appointment.customerPhone : undefined,
      }));
      
      res.json(publicAppointments);
    } catch (error) {
      next(error);
    }
  });

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
      // By default, only return active rooms for public view
      const rooms = await storage.getActiveRooms();
      res.json(rooms);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/public/room/:id/availability", async (req, res, next) => {
    try {
      const roomId = parseInt(req.params.id);
      const room = await storage.getRoom(roomId);
      
      if (!room) {
        return res.status(404).json({ message: "Room not found" });
      }
      
      // Get date range for next 90 days
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 90);
      
      // Get appointments for this room in the date range
      const appointments = await storage.getAppointmentsByRoom(roomId);
      const rangeAppointments = appointments.filter(appointment => {
        const appointmentDate = new Date(appointment.startTime);
        return appointmentDate >= startDate && appointmentDate <= endDate;
      });
      
      res.json({
        room,
        appointments: rangeAppointments.map(appointment => ({
          id: appointment.id,
          title: appointment.title,
          startTime: appointment.startTime,
          endTime: appointment.endTime,
          status: appointment.status
        }))
      });
    } catch (error) {
      next(error);
    }
  });

  // Location routes
  app.get("/api/locations", async (req, res, next) => {
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
      next(error);
    }
  });

  app.get("/api/locations/:id", async (req, res, next) => {
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

  app.put("/api/locations/:id", isAdmin, async (req, res, next) => {
    try {
      const id = parseInt(req.params.id);
      const validatedData = insertLocationSchema.partial().parse(req.body);
      const updatedLocation = await storage.updateLocation(id, validatedData);
      if (!updatedLocation) {
        return res.status(404).json({ message: "Location not found" });
      }
      res.json(updatedLocation);
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/locations/:id", isAdmin, async (req, res, next) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deleteLocation(id);
      if (!success) {
        return res.status(404).json({ message: "Location not found" });
      }
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  // Room routes
  app.get("/api/rooms", async (req, res, next) => {
    try {
      const rooms = await storage.getAllRooms();
      
      // If location query param is provided, filter by location
      const locationId = req.query.locationId ? parseInt(req.query.locationId as string) : null;
      if (locationId) {
        const filteredRooms = rooms.filter(room => room.locationId === locationId);
        return res.json(filteredRooms);
      }
      
      // If active query param is provided, filter by active status
      const activeParam = req.query.active;
      if (activeParam === 'true') {
        const activeRooms = rooms.filter(room => room.active);
        return res.json(activeRooms);
      }
      
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
      next(error);
    }
  });

  app.get("/api/rooms/:id", async (req, res, next) => {
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

  app.put("/api/rooms/:id", isAdmin, async (req, res, next) => {
    try {
      const id = parseInt(req.params.id);
      const validatedData = insertRoomSchema.partial().parse(req.body);
      const updatedRoom = await storage.updateRoom(id, validatedData);
      if (!updatedRoom) {
        return res.status(404).json({ message: "Room not found" });
      }
      res.json(updatedRoom);
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/rooms/:id", isAdmin, async (req, res, next) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deleteRoom(id);
      if (!success) {
        return res.status(404).json({ message: "Room not found" });
      }
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  // Appointment routes
  app.get("/api/appointments", isAuthenticated, async (req, res, next) => {
    try {
      const appointments = await storage.getAllAppointments();
      
      // Filter by status if provided
      const status = req.query.status as string;
      if (status) {
        const filteredAppointments = appointments.filter(appt => appt.status === status);
        return res.json(filteredAppointments);
      }
      
      // Filter by date range if provided
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : null;
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : null;
      if (startDate && endDate) {
        const rangeAppointments = await storage.getAppointmentsByDateRange(startDate, endDate);
        return res.json(rangeAppointments);
      }
      
      // Filter by room if provided
      const roomId = req.query.roomId ? parseInt(req.query.roomId as string) : null;
      if (roomId) {
        const roomAppointments = await storage.getAppointmentsByRoom(roomId);
        return res.json(roomAppointments);
      }
      
      res.json(appointments);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/appointments", isAuthenticated, async (req, res, next) => {
    try {
      const userId = req.user!.id;
      const validatedData = insertAppointmentSchema.parse({
        ...req.body,
        userId
        // No need to set orderNumber here as storage.createAppointment now handles this
      });
      
      // Storage method now includes audit logging internally
      const appointment = await storage.createAppointment(validatedData);
      
      res.status(201).json(appointment);
    } catch (error) {
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
      res.json(appointment);
    } catch (error) {
      next(error);
    }
  });

  app.put("/api/appointments/:id", isAuthenticated, async (req, res, next) => {
    try {
      const id = parseInt(req.params.id);
      const userId = req.user!.id;
      
      // Check if appointment exists
      const originalAppointment = await storage.getAppointment(id);
      if (!originalAppointment) {
        return res.status(404).json({ message: "Appointment not found" });
      }
      
      const validatedData = insertAppointmentSchema.partial().parse({
        ...req.body,
        userId // Include userId for audit logging
      });
      
      // Storage method now handles audit logging internally
      const updatedAppointment = await storage.updateAppointment(id, validatedData);
      if (!updatedAppointment) {
        return res.status(404).json({ message: "Failed to update appointment" });
      }
      
      res.json(updatedAppointment);
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/appointments/:id", isAuthenticated, async (req, res, next) => {
    try {
      const id = parseInt(req.params.id);
      const userId = req.user!.id;
      
      // Check if appointment exists
      const originalAppointment = await storage.getAppointment(id);
      if (!originalAppointment) {
        return res.status(404).json({ message: "Appointment not found" });
      }
      
      // The storage method now handles audit logging internally
      const success = await storage.deleteAppointment(id, userId);
      if (!success) {
        return res.status(500).json({ message: "Failed to delete appointment" });
      }
      
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  // Appointment audit logs
  app.get("/api/appointments/:id/audit", isAuthenticated, async (req, res, next) => {
    try {
      const id = parseInt(req.params.id);
      const logs = await storage.getAuditLogsByAppointment(id);
      res.json(logs);
    } catch (error) {
      next(error);
    }
  });

  // Dashboard statistics
  app.get("/api/stats", isAuthenticated, async (req, res, next) => {
    try {
      // Get recent date range (30 days)
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);
      
      // Get counts
      const allAppointments = await storage.getAllAppointments();
      const recentAppointments = await storage.getAppointmentsByDateRange(startDate, endDate);
      const activeRooms = await storage.getActiveRooms();
      const allUsers = await storage.getAllUsers();
      
      // Get utilization rates
      const roomUtilization = await storage.getOverallUtilization(startDate, endDate);
      const averageUtilization = roomUtilization.length > 0 
        ? roomUtilization.reduce((sum, item) => sum + item.utilization, 0) / roomUtilization.length 
        : 0;
      
      // Get popular rooms based on booking count
      const roomCounts = allAppointments.reduce((counts, appt) => {
        counts[appt.roomId] = (counts[appt.roomId] || 0) + 1;
        return counts;
      }, {} as Record<number, number>);
      
      const popularRooms = activeRooms.map(room => ({
        room,
        bookings: roomCounts[room.id] || 0,
        utilization: roomUtilization.find(u => u.roomId === room.id)?.utilization || 0
      })).sort((a, b) => b.bookings - a.bookings);
      
      res.json({
        totalAppointments: allAppointments.length,
        recentAppointments: recentAppointments.length,
        activeRooms: activeRooms.length,
        totalUsers: allUsers.length,
        utilization: averageUtilization,
        popularRooms,
        recentBookings: await storage.getRecentAppointments(5)
      });
    } catch (error) {
      next(error);
    }
  });

  // Users administration (all authenticated users can view)
  app.get("/api/users", isAuthenticated, async (req, res, next) => {
    try {
      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error) {
      next(error);
    }
  });

  app.put("/api/users/:id", isAdmin, async (req, res, next) => {
    try {
      const id = parseInt(req.params.id);
      
      // Don't allow password updates through this endpoint
      const { password, ...updates } = req.body;
      
      const updatedUser = await storage.updateUser(id, updates);
      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json(updatedUser);
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/users/:id", isAdmin, async (req, res, next) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deleteUser(id);
      if (!success) {
        return res.status(404).json({ message: "User not found" });
      }
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  });
  
  // User updating themselves
  app.patch("/api/users/:id", isAuthenticated, async (req, res, next) => {
    try {
      const id = parseInt(req.params.id);
      const currentUserId = req.user!.id;
      
      // Check authorization - users can only update themselves unless they're admin
      if (id !== currentUserId && req.user!.role !== 'admin') {
        return res.status(403).json({ message: "You can only update your own account" });
      }
      
      // Don't allow password or role updates through this endpoint
      const { password, role, ...updates } = req.body;
      
      const updatedUser = await storage.updateUser(id, updates);
      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json(updatedUser);
    } catch (error) {
      next(error);
    }
  });

  // Request account deletion
  app.post("/api/users/:id/request-deletion", isAuthenticated, async (req, res, next) => {
    try {
      const id = parseInt(req.params.id);
      const currentUserId = req.user!.id;
      
      // Check if this is the user's own account
      if (id !== currentUserId) {
        return res.status(403).json({ message: "You can only request deletion for your own account" });
      }
      
      const user = await storage.getUser(id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Mark for deletion
      const updatedUser = await storage.updateUser(id, { deletionRequested: true });
      res.json(updatedUser);
    } catch (error) {
      next(error);
    }
  });
  
  // Approve account deletion (admin only)
  app.post("/api/users/:id/approve-deletion", isAdmin, async (req, res, next) => {
    try {
      const id = parseInt(req.params.id);
      
      const user = await storage.getUser(id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      if (!user.deletionRequested) {
        return res.status(400).json({ message: "This user has not requested deletion" });
      }
      
      // Actually delete the user
      const success = await storage.deleteUser(id);
      if (!success) {
        return res.status(500).json({ message: "Failed to delete user" });
      }
      
      res.json({ success: true, message: "User deleted successfully" });
    } catch (error) {
      next(error);
    }
  });
  
  // Cancel deletion request
  app.post("/api/users/:id/cancel-deletion-request", isAuthenticated, async (req, res, next) => {
    try {
      const id = parseInt(req.params.id);
      const currentUserId = req.user!.id;
      
      // Check if this is the user's own account or admin
      if (id !== currentUserId && req.user!.role !== 'admin') {
        return res.status(403).json({ message: "You can only cancel deletion of your own account" });
      }
      
      const updatedUser = await storage.updateUser(id, { deletionRequested: false });
      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json({ message: "Deletion request canceled successfully" });
    } catch (error) {
      next(error);
    }
  });
  
  // Change password (for authenticated user)
  app.post("/api/users/:id/change-password", isAuthenticated, async (req, res, next) => {
    try {
      const id = parseInt(req.params.id);
      const currentUserId = req.user!.id;
      
      // Check if this is the user's own account or admin
      if (id !== currentUserId && req.user!.role !== 'admin') {
        return res.status(403).json({ message: "You can only change your own password" });
      }
      
      const { currentPassword, newPassword } = req.body;
      
      // Get the user
      const user = await storage.getUser(id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Import comparePasswords from auth module
      const { comparePasswords, hashPassword } = require('./auth');
      
      // Verify current password
      const isPasswordValid = await comparePasswords(currentPassword, user.password);
      if (!isPasswordValid) {
        return res.status(400).json({ message: "Current password is incorrect" });
      }
      
      // Hash the new password
      const hashedPassword = await hashPassword(newPassword);
      
      // Update the user's password
      const updatedUser = await storage.updateUser(id, { password: hashedPassword });
      if (!updatedUser) {
        return res.status(404).json({ message: "Failed to update password" });
      }
      
      res.json({ message: "Password changed successfully" });
    } catch (error) {
      next(error);
    }
  });

  // Settings
  app.get("/api/settings", isAdmin, async (req, res, next) => {
    try {
      const settings = await storage.getAllSettings();
      res.json(settings);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/settings/:key", isAdmin, async (req, res, next) => {
    try {
      const key = req.params.key;
      const value = req.body.value;
      
      const setting = await storage.createOrUpdateSetting(key, value);
      res.json(setting);
    } catch (error) {
      next(error);
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
