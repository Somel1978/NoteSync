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
  
  // Get a specific user
  app.get("/api/users/:id", isAuthenticated, async (req: Request, res: Response, next: Function) => {
    try {
      const id = parseInt(req.params.id);
      
      // Regular users can only view their own profile
      if (req.user?.role !== 'admin' && req.user?.id !== id) {
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
  
  // Update a user
  app.patch("/api/users/:id", isAuthenticated, async (req: Request, res: Response, next: Function) => {
    try {
      const id = parseInt(req.params.id);
      
      // Regular users can only update their own profile
      if (req.user?.role !== 'admin' && req.user?.id !== id) {
        return res.status(403).json({ message: "Forbidden - You can only update your own profile" });
      }
      
      // For non-admin users, restrict what fields they can update
      if (req.user?.role !== 'admin') {
        const allowedFields = ['name', 'email'];
        const updates = Object.keys(req.body).reduce((filtered: any, key) => {
          if (allowedFields.includes(key)) {
            filtered[key] = req.body[key];
          }
          return filtered;
        }, {});
        
        const updatedUser = await storage.updateUser(id, updates);
        
        if (!updatedUser) {
          return res.status(404).json({ message: "User not found" });
        }
        
        return res.json(updatedUser);
      } else {
        // Admins can update any fields including role
        const updatedUser = await storage.updateUser(id, req.body);
        
        if (!updatedUser) {
          return res.status(404).json({ message: "User not found" });
        }
        
        res.json(updatedUser);
      }
    } catch (error) {
      next(error);
    }
  });
  
  // Update password
  app.patch("/api/users/:id/password", isAuthenticated, async (req: Request, res: Response, next: Function) => {
    try {
      const id = parseInt(req.params.id);
      
      // Regular users can only update their own password
      if (req.user?.role !== 'admin' && req.user?.id !== id) {
        return res.status(403).json({ message: "Forbidden - You can only update your own password" });
      }
      
      // Make sure both old and new password are provided for regular users
      if (req.user?.role !== 'admin' && (!req.body.oldPassword || !req.body.newPassword)) {
        return res.status(400).json({ message: "Both old and new password are required" });
      }
      
      // Admin can reset password without old password
      if (req.user?.role === 'admin' && !req.body.newPassword) {
        return res.status(400).json({ message: "New password is required" });
      }
      
      // Let the storage handle password update logic
      const result = await storage.updatePassword(
        id,
        req.body.oldPassword,
        req.body.newPassword,
        req.user?.role === 'admin'
      );
      
      if (!result) {
        return res.status(400).json({ message: "Password update failed. Old password might be incorrect." });
      }
      
      res.json({ message: "Password updated successfully" });
    } catch (error) {
      next(error);
    }
  });
  
  // Delete a user (mark for deletion)
  app.delete("/api/users/:id", isAuthenticated, async (req: Request, res: Response, next: Function) => {
    try {
      const id = parseInt(req.params.id);
      
      // Regular users can only delete their own account
      if (req.user?.role !== 'admin' && req.user?.id !== id) {
        return res.status(403).json({ message: "Forbidden - You can only delete your own account" });
      }
      
      // For non-admin users, mark account for deletion instead of actual deletion
      if (req.user?.role !== 'admin') {
        const updatedUser = await storage.updateUser(id, { deletionRequested: true });
        
        if (!updatedUser) {
          return res.status(404).json({ message: "User not found" });
        }
        
        // Log out the user if they requested their own deletion
        if (req.user?.id === id) {
          req.logout((err) => {
            if (err) return next(err);
          });
        }
        
        return res.json({ message: "Account marked for deletion and awaiting admin approval" });
      } else {
        // Admins can delete accounts immediately
        const result = await storage.deleteUser(id);
        
        if (!result) {
          return res.status(404).json({ message: "User not found" });
        }
        
        // Log out the user if they deleted their own account
        if (req.user?.id === id) {
          req.logout((err) => {
            if (err) return next(err);
          });
        }
        
        res.status(204).end();
      }
    } catch (error) {
      next(error);
    }
  });
}