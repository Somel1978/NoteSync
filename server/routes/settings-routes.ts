import type { Express, Request, Response } from "express";
import { storage } from "../storage";
import { isAdmin } from "./index";
import { EmailSettings } from "@shared/schema";

export function registerSettingsRoutes(app: Express): void {
  // Get email settings
  app.get("/api/settings/email", isAdmin, async (req: Request, res: Response, next: Function) => {
    try {
      const emailSetting = await storage.getSetting('email');
      console.log("Retrieved email settings:", JSON.stringify(emailSetting));
      
      // Return default settings if none exist
      if (!emailSetting || !emailSetting.value || Object.keys(emailSetting.value).length === 0) {
        return res.json({
          enabled: false,
          mailjetApiKey: "",
          mailjetSecretKey: "",
          systemEmail: "",
          systemName: "ACRDSC Reservas",
          notifyOnCreate: true,
          notifyOnUpdate: true,
          notifyOnStatusChange: true,
          emailTemplateBookingCreated: "",
          emailTemplateBookingUpdated: "",
          emailTemplateBookingStatusChanged: ""
        });
      }
      
      res.json(emailSetting.value);
    } catch (error) {
      console.error("Error retrieving email settings:", error);
      next(error);
    }
  });
  
  // Update email settings
  app.post("/api/settings/email", isAdmin, async (req: Request, res: Response, next: Function) => {
    try {
      // Log the body in different formats to debug
      console.log("API ROUTE: Received POST to /api/settings/email");
      console.log("Body as received:", req.body);
      console.log("Body type:", typeof req.body);
      console.log("Body stringified:", JSON.stringify(req.body));
      console.log("Body keys:", Object.keys(req.body));
      
      // We'll now pass the data directly to storage
      const setting = await storage.createOrUpdateSetting('email', req.body);
      console.log("Setting saved to database:", JSON.stringify(setting));
      
      // Return the setting value (the email settings)
      if (setting && setting.value) {
        res.json(setting.value);
      } else {
        // Fallback to default values if something went wrong
        res.json({
          enabled: false,
          mailjetApiKey: "",
          mailjetSecretKey: "",
          systemEmail: "",
          systemName: "ACRDSC Reservas",
          notifyOnCreate: true,
          notifyOnUpdate: true,
          notifyOnStatusChange: true,
          emailTemplateBookingCreated: "",
          emailTemplateBookingUpdated: "",
          emailTemplateBookingStatusChanged: ""
        });
      }
    } catch (error) {
      console.error("Error saving email settings:", error);
      next(error);
    }
  });
  
  // Test email settings
  app.post("/api/settings/email/test", isAdmin, async (req: Request, res: Response, next: Function) => {
    try {
      // Get email settings
      const emailSetting = await storage.getSetting('email');
      
      if (!emailSetting) {
        return res.status(400).json({ error: "Email settings not found" });
      }
      
      console.log("Testing with email settings:", JSON.stringify(emailSetting));
      
      // Check if value is an empty object
      if (emailSetting.value && Object.keys(emailSetting.value).length === 0) {
        return res.status(400).json({ error: "Email settings are not configured" });
      }
      
      const settings = emailSetting.value as EmailSettings;
      
      if (!settings || !settings.enabled) {
        return res.status(400).json({ error: "Email notifications are not enabled" });
      }
      
      // Import Mailjet
      const mailjetModule = await import('node-mailjet');
      console.log("Mailjet module keys:", Object.keys(mailjetModule));
      
      // Access the Client constructor from the imported module
      const Client = mailjetModule.Client || mailjetModule.default;
      console.log("Client type:", typeof Client);
      
      if (typeof Client !== 'function') {
        return res.status(500).json({ 
          error: "Failed to initialize Mailjet", 
          details: "Invalid client constructor" 
        });
      }
      
      // Make sure we have a sender email
      if (!settings.systemEmail) {
        return res.status(400).json({ 
          error: "Missing sender email", 
          details: "A valid sender email must be configured in email settings" 
        });
      }
      
      // Check if systemEmail is verified in Mailjet
      console.log(`Using sender email: ${settings.systemEmail}`);

      // Create a client instance
      const mailjet = new Client({
        apiKey: settings.mailjetApiKey,
        apiSecret: settings.mailjetSecretKey
      });
      
      // Send test email
      const user = req.user!;
      
      // Prepare email data using v3.1 API format
      const emailData = {
        Messages: [
          {
            From: {
              Email: settings.systemEmail,
              Name: settings.systemName || "ACRDSC Reservas"
            },
            To: [
              {
                Email: user.email,
                Name: user.name
              }
            ],
            Subject: "Test Email from ACRDSC Reservas",
            HTMLPart: `
              <h3>Test Email</h3>
              <p>This is a test email from your ACRDSC Reservas system.</p>
              <p>If you received this email, your email notification settings are working correctly.</p>
              <p>Best regards,<br>${settings.systemName || "ACRDSC Reservas"}</p>
            `,
            // Add tracking for better delivery verification
            TrackOpens: "enabled",
            TrackClicks: "enabled",
            // Add custom ID for tracking
            CustomID: "EmailTest-" + Date.now()
          }
        ]
      };
      
      console.log("Sending email with data:", JSON.stringify(emailData));
      
      // Send the email using Mailjet
      const response = await mailjet.post('send', { version: 'v3.1' })
        .request(emailData);
      
      // Log response in detail
      console.log("Full Mailjet response:", JSON.stringify(response.body));
      
      // Verify the response for complete success
      if (response.body && response.body.Messages) {
        const messages = response.body.Messages;
        
        const allSuccessful = messages.every((msg: any) => 
          msg.Status === 'success' && 
          msg.To && 
          msg.To.length > 0 && 
          msg.To.every((recipient: any) => recipient.MessageID)
        );
        
        if (allSuccessful) {
          // Return detailed success response with message IDs
          res.json({ 
            success: true, 
            message: "Test email sent successfully",
            details: response.body
          });
        } else {
          // API call succeeded but message might not be delivered
          res.status(202).json({
            success: false,
            message: "Email API call succeeded but delivery not confirmed",
            details: response.body
          });
        }
      } else {
        // Unexpected response format
        res.status(500).json({
          success: false,
          message: "Unexpected response format from email service",
          details: response.body
        });
      }
    } catch (error: any) {
      console.error("Error sending test email:", error);
      
      // Check for Mailjet specific errors
      if (error.statusCode) {
        return res.status(error.statusCode).json({ 
          error: "Mailjet API error", 
          details: error.message || "Failed to send test email" 
        });
      }
      
      next(error);
    }
  });
  
  // Get general settings
  app.get("/api/settings/general", isAdmin, async (req: Request, res: Response, next: Function) => {
    try {
      const generalSetting = await storage.getSetting('general');
      
      // Return default settings if none exist
      if (!generalSetting || !generalSetting.value) {
        return res.json({
          siteName: "ACRDSC Reservas",
          timeZone: "Europe/Lisbon",
          currency: "EUR",
          maintenanceMode: false
        });
      }
      
      res.json(generalSetting.value);
    } catch (error) {
      next(error);
    }
  });
  
  // Update general settings
  app.post("/api/settings/general", isAdmin, async (req: Request, res: Response, next: Function) => {
    try {
      const setting = await storage.createOrUpdateSetting('general', req.body);
      
      if (setting && setting.value) {
        res.json(setting.value);
      } else {
        res.status(500).json({ message: "Failed to update general settings" });
      }
    } catch (error) {
      next(error);
    }
  });
}