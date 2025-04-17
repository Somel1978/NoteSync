import type { Express, Request, Response } from "express";
import { storage } from "../storage";
import { isAdmin, isAuthenticated } from "./index";

export function registerUserRoutes(app: Express): void {
  // Get all users (admin only)
  app.get("/api/users", isAdmin, async (req: Request, res: Response, next: Function) => {
    try {
      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error) {
      next(error);
    }
  });
  
  // Get a specific user (admin or self)
  app.get("/api/users/:id", isAuthenticated, async (req: Request, res: Response, next: Function) => {
    try {
      const id = parseInt(req.params.id);
      
      // Users can only view their own profile unless they're an admin
      if (req.user?.id !== id && req.user?.role !== "admin") {
        return res.status(403).json({ message: "Forbidden - You can only view your own profile" });
      }
      
      const user = await storage.getUser(id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      res.json(user);
    } catch (error) {
      next(error);
    }
  });
  
  // Update user (admin or self)
  app.patch("/api/users/:id", isAuthenticated, async (req: Request, res: Response, next: Function) => {
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
  
  // Change password (self only)
  app.patch("/api/users/:id/password", isAuthenticated, async (req: Request, res: Response, next: Function) => {
    try {
      const id = parseInt(req.params.id);
      
      // Users can only change their own password
      if (req.user?.id !== id && req.user?.role !== "admin") {
        return res.status(403).json({ message: "Forbidden - You can only change your own password" });
      }
      
      // Check if currentPassword and newPassword are provided
      if (!req.body.currentPassword || !req.body.newPassword) {
        return res.status(400).json({ message: "Current password and new password are required" });
      }
      
      // Additional validation can be added here
      
      // Update password with or without admin override
      const isAdmin = req.user?.role === "admin" && req.user?.id !== id;
      const updated = await storage.updatePassword(
        id, 
        req.body.currentPassword, 
        req.body.newPassword,
        isAdmin // Admin override if admin is changing another user's password
      );
      
      if (!updated) {
        return res.status(400).json({ message: "Invalid current password" });
      }
      
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  });
  
  // Delete user (admin only)
  app.delete("/api/users/:id", isAuthenticated, async (req: Request, res: Response, next: Function) => {
    try {
      const id = parseInt(req.params.id);
      
      // Users can only delete their own account unless they're an admin
      if (req.user?.id !== id && req.user?.role !== "admin") {
        return res.status(403).json({ message: "Forbidden - You can only delete your own account" });
      }
      
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
}