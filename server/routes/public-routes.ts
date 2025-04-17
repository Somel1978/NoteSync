import type { Express, Request, Response } from "express";
import { storage } from "../storage";

export function registerPublicRoutes(app: Express): void {
  // Public locations endpoint
  app.get("/api/public/locations", async (req: Request, res: Response, next: Function) => {
    try {
      const locations = await storage.getAllLocations();
      res.json(locations);
    } catch (error) {
      next(error);
    }
  });
  
  // Public rooms endpoint
  app.get("/api/public/rooms", async (req: Request, res: Response, next: Function) => {
    try {
      const rooms = await storage.getAllRooms();
      res.json(rooms);
    } catch (error) {
      next(error);
    }
  });
  
  // Public appointments endpoint
  app.get("/api/public/appointments", async (req: Request, res: Response, next: Function) => {
    try {
      // For public access, only return minimal info about appointments
      // This is for displaying on calendar views without showing private details
      const allAppointments = await storage.getAllAppointments();
      
      // Convert to safer public format removing sensitive data
      const publicAppointments = await Promise.all(
        allAppointments.map(async (appointment) => {
          // Get all rooms in this appointment
          const rooms = [];
          if (appointment.rooms && Array.isArray(appointment.rooms)) {
            for (const roomBooking of appointment.rooms) {
              rooms.push({
                roomId: roomBooking.roomId,
                roomName: roomBooking.roomName,
                requestedFacilities: roomBooking.requestedFacilities,
                costType: roomBooking.costType,
                cost: roomBooking.cost
              });
            }
          }
          
          // Return only the necessary public information
          return {
            id: appointment.id,
            title: appointment.title,
            roomId: appointment.roomId,
            rooms,
            userId: appointment.userId,
            startTime: appointment.startTime,
            endTime: appointment.endTime,
            status: appointment.status
          };
        })
      );
      
      res.json(publicAppointments);
    } catch (error) {
      next(error);
    }
  });
}