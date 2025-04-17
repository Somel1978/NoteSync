import type { Express, Request, Response } from "express";
import { storage } from "../storage";

export function registerPublicRoutes(app: Express): void {
  // Public API endpoints for locations
  app.get("/api/public/locations", async (req: Request, res: Response, next: Function) => {
    try {
      const locations = await storage.getAllLocations();
      res.json(locations);
    } catch (error) {
      next(error);
    }
  });
  
  // Public API endpoints for rooms
  app.get("/api/public/rooms", async (req: Request, res: Response, next: Function) => {
    try {
      // Filter by location if specified
      if (req.query.locationId) {
        const locationId = parseInt(req.query.locationId as string);
        const rooms = await storage.getRoomsByLocation(locationId);
        return res.json(rooms);
      }
      
      // Otherwise return all rooms
      const rooms = await storage.getAllRooms();
      res.json(rooms);
    } catch (error) {
      next(error);
    }
  });
  
  // Public API endpoints for appointments
  app.get("/api/public/appointments", async (req: Request, res: Response, next: Function) => {
    try {
      // Filter by date range if specified
      if (req.query.startDate && req.query.endDate) {
        const appointments = await storage.getAppointmentsByDateRange(
          new Date(req.query.startDate as string),
          new Date(req.query.endDate as string)
        );
        
        // Only return approved appointments
        const approvedAppointments = appointments.filter(a => a.status === 'approved');
        return res.json(approvedAppointments);
      }
      
      // Filter by room if specified
      if (req.query.roomId) {
        const roomId = parseInt(req.query.roomId as string);
        const appointments = await storage.getAppointmentsByRoom(roomId);
        
        // Only return approved appointments
        const approvedAppointments = appointments.filter(a => a.status === 'approved');
        return res.json(approvedAppointments);
      }
      
      // Return only approved appointments
      const allAppointments = await storage.getAllAppointments();
      const approvedAppointments = allAppointments.filter(a => a.status === 'approved');
      
      res.json(approvedAppointments);
    } catch (error) {
      next(error);
    }
  });
}