import type { Express, Request, Response } from "express";
import { storage } from "../storage";
import { isAdmin, isAdminOrDirector, isAuthenticated } from "./index";
import { insertLocationSchema } from "@shared/schema";
import { z } from "zod";

export function registerLocationRoutes(app: Express): void {
  // Get all locations
  app.get("/api/locations", isAuthenticated, async (req: Request, res: Response, next: Function) => {
    try {
      const locations = await storage.getAllLocations();
      res.json(locations);
    } catch (error) {
      next(error);
    }
  });
  
  // Get a specific location
  app.get("/api/locations/:id", isAuthenticated, async (req: Request, res: Response, next: Function) => {
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
  
  // Create a new location
  app.post("/api/locations", isAdminOrDirector, async (req: Request, res: Response, next: Function) => {
    try {
      // Validate request body
      try {
        const validatedData = insertLocationSchema.parse(req.body);
        const location = await storage.createLocation(validatedData);
        res.status(201).json(location);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ errors: error.errors });
        }
        throw error;
      }
    } catch (error) {
      next(error);
    }
  });
  
  // Update a location (supports both PUT and PATCH)
  const updateLocation = async (req: Request, res: Response, next: Function) => {
    try {
      const id = parseInt(req.params.id);
      const location = await storage.getLocation(id);
      
      if (!location) {
        return res.status(404).json({ message: "Location not found" });
      }
      
      // Update the location
      try {
        const updatedLocation = await storage.updateLocation(id, req.body);
        
        if (!updatedLocation) {
          return res.status(500).json({ message: "Failed to update location" });
        }
        
        res.json(updatedLocation);
      } catch (updateError) {
        console.error("Error updating location:", updateError);
        return res.status(500).json({ 
          message: "Error updating location", 
          error: updateError instanceof Error ? updateError.message : String(updateError) 
        });
      }
    } catch (error) {
      next(error);
    }
  };
  
  // Register both PUT and PATCH to support different frontend frameworks
  app.put("/api/locations/:id", isAdmin, updateLocation);
  app.patch("/api/locations/:id", isAdmin, updateLocation);
  
  // Delete a location
  app.delete("/api/locations/:id", isAdmin, async (req: Request, res: Response, next: Function) => {
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
  
  // Get rooms in a location
  app.get("/api/locations/:id/rooms", isAuthenticated, async (req: Request, res: Response, next: Function) => {
    try {
      const locationId = parseInt(req.params.id);
      const rooms = await storage.getRoomsByLocation(locationId);
      res.json(rooms);
    } catch (error) {
      next(error);
    }
  });
}