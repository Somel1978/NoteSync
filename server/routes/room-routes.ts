import type { Express, Request, Response } from "express";
import { storage } from "../storage";
import { isAdmin, isAdminOrDirector, isAuthenticated } from "./index";
import { insertRoomSchema } from "@shared/schema";

export function registerRoomRoutes(app: Express): void {
  // Get all rooms
  app.get("/api/rooms", isAuthenticated, async (req: Request, res: Response, next: Function) => {
    try {
      const rooms = await storage.getAllRooms();
      res.json(rooms);
    } catch (error) {
      next(error);
    }
  });
  
  // Get a specific room
  app.get("/api/rooms/:id", isAuthenticated, async (req: Request, res: Response, next: Function) => {
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
  
  // Create a new room
  app.post("/api/rooms", isAdminOrDirector, async (req: Request, res: Response, next: Function) => {
    try {
      // Validate request body
      const validationResult = insertRoomSchema.safeParse(req.body);
      
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Invalid room data", 
          errors: validationResult.error.errors 
        });
      }
      
      // Create the room
      const room = await storage.createRoom(validationResult.data);
      res.status(201).json(room);
    } catch (error) {
      next(error);
    }
  });
  
  // Update a room (supports both PUT and PATCH)
  const updateRoom = async (req: Request, res: Response, next: Function) => {
    try {
      const id = parseInt(req.params.id);
      const room = await storage.getRoom(id);
      
      if (!room) {
        return res.status(404).json({ message: "Room not found" });
      }
      
      // Update the room
      try {
        const updatedRoom = await storage.updateRoom(id, req.body);
        
        if (!updatedRoom) {
          return res.status(500).json({ message: "Failed to update room" });
        }
        
        res.json(updatedRoom);
      } catch (updateError) {
        console.error("Error updating room:", updateError);
        return res.status(500).json({ 
          message: "Error updating room", 
          error: updateError instanceof Error ? updateError.message : String(updateError) 
        });
      }
    } catch (error) {
      next(error);
    }
  };
  
  // Register both PUT and PATCH to support different frontend frameworks
  app.put("/api/rooms/:id", isAdminOrDirector, updateRoom);
  app.patch("/api/rooms/:id", isAdminOrDirector, updateRoom);
  
  // Delete a room
  app.delete("/api/rooms/:id", isAdminOrDirector, async (req: Request, res: Response, next: Function) => {
    try {
      const id = parseInt(req.params.id);
      const result = await storage.deleteRoom(id);
      
      if (!result) {
        return res.status(404).json({ message: "Room not found" });
      }
      
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  });
  
  // Get appointments for a room
  app.get("/api/rooms/:id/appointments", isAuthenticated, async (req: Request, res: Response, next: Function) => {
    try {
      const roomId = parseInt(req.params.id);
      const appointments = await storage.getAppointmentsByRoom(roomId);
      res.json(appointments);
    } catch (error) {
      next(error);
    }
  });
}