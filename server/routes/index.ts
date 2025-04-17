import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "../auth";

// Import route modules
import { registerUserRoutes } from "./user-routes";
import { registerLocationRoutes } from "./location-routes";
import { registerRoomRoutes } from "./room-routes";
import { registerAppointmentRoutes } from "./appointment-routes";
import { registerSettingsRoutes } from "./settings-routes";
import { registerPublicRoutes } from "./public-routes";

// Middleware to check if user is authenticated
export const isAuthenticated = (req: Request, res: Response, next: Function) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ message: "Unauthorized" });
};

// Middleware to check if user is an admin
export const isAdmin = (req: Request, res: Response, next: Function) => {
  if (req.isAuthenticated() && req.user?.role === "admin") {
    return next();
  }
  res.status(403).json({ message: "Forbidden - Admin access required" });
};

// Middleware to check if user is an admin or director
export const isAdminOrDirector = (req: Request, res: Response, next: Function) => {
  if (req.isAuthenticated() && (req.user?.role === "admin" || req.user?.role === "director")) {
    return next();
  }
  res.status(403).json({ message: "Forbidden - Admin or Director access required" });
};

export function registerRoutes(app: Express): Server {
  // Setup authentication routes
  setupAuth(app);
  
  // Create HTTP server
  const server = createServer(app);
  
  // Register API routes
  registerPublicRoutes(app);
  registerUserRoutes(app);
  registerLocationRoutes(app);
  registerRoomRoutes(app);
  registerAppointmentRoutes(app);
  registerSettingsRoutes(app);
  
  return server;
}