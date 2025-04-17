import type { Express, Request, Response } from "express";
import { isAdmin } from "./index";
import { log } from "../vite";
import Mailjet from 'node-mailjet';

export function registerDebugRoutes(app: Express): void {
  // Email debug route - only accessible to admin users
  app.get("/api/debug/email", isAdmin, async (req: Request, res: Response) => {
    try {
      log("Running email diagnostics", "debug");
      const results: any = {
        success: true,
        timestamp: new Date().toISOString(),
        api_keys: { present: false },
        sender_status: null,
        test_email: null
      };
      
      // 1. Check API Keys
      const apiKey = process.env.MAILJET_API_KEY;
      const secretKey = process.env.MAILJET_SECRET_KEY;
      
      if (!apiKey || !secretKey) {
        results.api_keys.present = false;
        results.api_keys.message = "Missing Mailjet API keys";
        results.success = false;
        return res.json(results);
      }
      
      results.api_keys.present = true;
      results.api_keys.message = "API keys are present";
      
      try {
        // 2. Create Mailjet client
        const mailjet = Mailjet.apiConnect(apiKey, secretKey);
        
        // 3. Check sender status
        const sendersResponse = await mailjet
          .get('sender')
          .request();
        
        const senders = sendersResponse.body.Data || [];
        const apiSender = senders.find((sender: any) => sender.Email === 'api@acrdsc.org');
        
        results.senders = {
          total: senders.length,
          active_senders: senders.filter((s: any) => s.Status === 'Active').length
        };
        
        if (apiSender) {
          results.sender_status = {
            found: true,
            email: 'api@acrdsc.org',
            status: apiSender.Status,
            is_active: apiSender.Status === 'Active',
            created_at: apiSender.CreatedAt,
            id: apiSender.ID
          };
          
          if (apiSender.Status !== 'Active') {
            results.sender_status.warning = "The sender is not active according to the API. This will prevent email delivery.";
          }
        } else {
          results.sender_status = {
            found: false,
            warning: "The sender api@acrdsc.org was not found in the sender list."
          };
          results.success = false;
        }
        
        // 4. Send a test email if requested
        if (req.query.test === 'true' && req.user) {
          const testResponse = await sendTestEmail(mailjet, req.user.email);
          results.test_email = testResponse;
        }
      } catch (error: any) {
        results.error = {
          message: error.message,
          stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        };
        results.success = false;
      }
      
      res.json(results);
    } catch (error: any) {
      log(`Error in email debug route: ${error.message}`, "debug");
      res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  });
}

async function sendTestEmail(mailjet: any, recipientEmail: string) {
  try {
    // Prepare email data
    const emailData = {
      Messages: [
        {
          From: {
            Email: 'api@acrdsc.org',
            Name: 'ACRDSC Reservas Debug'
          },
          To: [
            {
              Email: recipientEmail,
              Name: recipientEmail.split('@')[0]
            }
          ],
          Subject: 'Mailjet Debug Test',
          TextPart: `This is a debug test email sent at ${new Date().toISOString()}`,
          HTMLPart: `<h3>Mailjet Debug Test</h3><p>This is a debug test email sent at ${new Date().toISOString()}</p>`,
          CustomID: `Debug-${Date.now()}`
        }
      ]
    };
    
    // Send the email
    const response = await mailjet
      .post('send', { version: 'v3.1' })
      .request(emailData);
    
    // Return the response
    return {
      success: true,
      api_response: response.body,
      timestamp: new Date().toISOString(),
      message: "Test email sent - check if you receive it"
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}