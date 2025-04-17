import type { Express, Request, Response } from "express";
import { storage } from "../storage";
import { isAdmin, isAdminOrDirector, isAuthenticated } from "./index";
import { insertLocationSchema } from "@shared/schema";

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
      const validationResult = insertLocationSchema.safeParse(req.body);
      
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Invalid location data", 
          errors: validationResult.error.errors 
        });
      }
      
      // Create the location
      const location = await storage.createLocation(validationResult.data);
      res.status(201).json(location);
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
      const updatedLocation = await storage.updateLocation(id, req.body);
      
      if (!updatedLocation) {
        return res.status(500).json({ message: "Failed to update location" });
      }
      
      res.json(updatedLocation);
    } catch (error) {
      next(error);
    }
  };
  
  // Register both PUT and PATCH to support different frontend frameworks
  app.put("/api/locations/:id", isAdminOrDirector, updateLocation);
  app.patch("/api/locations/:id", isAdminOrDirector, updateLocation);
  
  // Delete a location
  app.delete("/api/locations/:id", isAdmin, async (req: Request, res: Response, next: Function) => {
    try {
      const id = parseInt(req.params.id);
      const result = await storage.deleteLocation(id);
      
      if (!result) {
        return res.status(404).json({ message: "Location not found" });
      }
      
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  });
  
  // Get rooms for a location
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