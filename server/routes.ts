import type { Express } from "express";
import { createServer, type Server } from "http";
import { registerRoutes as registerRoutesModular } from "./routes/index";

// This file is now just a wrapper for backwards compatibility
// The actual route implementation is in the routes/ directory
export function registerRoutes(app: Express): Server {
  // Use the new modular routing system
  return registerRoutesModular(app);
}
