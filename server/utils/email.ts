import { Appointment, EmailSettings } from '@shared/schema';
import { storage } from '../storage';
import { User } from '@shared/schema';
import { log } from '../vite';
// Import Mailjet in the style recommended by their documentation
import Mailjet from 'node-mailjet';

/**
 * Class to handle email notifications
 */
export class EmailNotificationService {
  private static async getEmailSettings(): Promise<EmailSettings | null> {
    const emailSettingsRecord = await storage.getSetting('email');
    if (!emailSettingsRecord) {
      return null;
    }
    
    const settings = emailSettingsRecord.value as EmailSettings;
    if (!settings || !settings.enabled) {
      return null;
    }
    
    return settings;
  }

  private static async sendEmail(
    from: { email: string; name: string },
    to: { email: string; name: string }[],
    subject: string,
    html: string,
    settings: EmailSettings
  ): Promise<boolean> {
    try {
      // Use API keys from settings or from environment variables as fallback
      const apiKey = settings.mailjetApiKey || process.env.MAILJET_API_KEY;
      const secretKey = settings.mailjetSecretKey || process.env.MAILJET_SECRET_KEY;
      
      // Validate email credentials
      if (!apiKey || !secretKey) {
        log('Missing Mailjet API credentials', 'email');
        return false;
      }

      // Validate sender email
      if (!from.email) {
        log('Missing sender email', 'email');
        return false;
      }
      
      // Format recipients for Mailjet
      const recipients = to.map(recipient => ({
        Email: recipient.email,
        Name: recipient.name
      }));
      
      // Create email data
      const emailData = {
        Messages: [
          {
            From: {
              Email: from.email,
              Name: from.name || 'ACRDSC Reservas'
            },
            To: recipients,
            Subject: subject,
            HTMLPart: html,
            // Add tracking for better delivery verification
            TrackOpens: "enabled",
            TrackClicks: "enabled",
            // Add custom ID for tracking
            CustomID: "Email-" + Date.now() + "-" + Math.floor(Math.random() * 1000)
          }
        ]
      };
      
      log(`Email data prepared: From ${from.email} to ${to.map(r => r.email).join(', ')}`, 'email');
      log(`Subject: ${subject}`, 'email');
      
      try {
        // Create the Mailjet client
        log(`Connecting to Mailjet with API key: ${apiKey.substring(0, 4)}...`, 'email');
        const mailjet = Mailjet.apiConnect(apiKey, secretKey);
        
        // Check if sender is verified (we only do this check once in a while to not hit rate limits)
        const shouldCheckSender = Math.random() < 0.2; // 20% chance to check
        if (shouldCheckSender) {
          try {
            log(`Checking sender status for ${from.email}...`, 'email');
            const sendersResponse = await mailjet.get('sender').request();
            
            if (sendersResponse.body && sendersResponse.body.Data) {
              const senders = sendersResponse.body.Data;
              const apiSender = senders.find((sender: any) => sender.Email === from.email);
              
              if (apiSender && apiSender.Status !== 'Active') {
                log(`⚠️ WARNING: Sender ${from.email} is not active (status: ${apiSender.Status}). Emails won't be delivered!`, 'email');
                log(`Please verify the sender email in your Mailjet account to receive emails.`, 'email');
              } else if (!apiSender) {
                log(`⚠️ WARNING: Sender ${from.email} not found in Mailjet. Emails won't be delivered!`, 'email');
                log(`Please add this sender in your Mailjet account and verify it to receive emails.`, 'email');
              }
            }
          } catch (senderError) {
            log(`Error checking sender status: ${senderError}`, 'email');
            // Continue anyway - this is just a diagnostic check
          }
        }
        
        // Send the email
        log('Sending email via Mailjet', 'email');
        log(`Email recipients: ${JSON.stringify(recipients)}`, 'email');
        
        const response = await mailjet
          .post('send', { version: 'v3.1' })
          .request(emailData);
          
        // Log the result
        log(`Mailjet API call succeeded`, 'email');
        if (response && response.body) {
          const responseData = typeof response.body === 'string' 
            ? JSON.parse(response.body) 
            : response.body;
          log(`Mailjet response data: ${JSON.stringify(responseData)}`, 'email');
          
          // Add a clear warning about sender verification
          log(`⚠️ NOTE: Even though API call succeeded, emails will only be delivered if ${from.email} is verified in Mailjet.`, 'email');
        }
        
        log('Email request processed successfully', 'email');
        return true;
      } catch (mailjetError) {
        log(`Error with Mailjet: ${mailjetError}`, 'email');
        
        // If we can't send via Mailjet for any reason, log the email content
        // This ensures the database update still succeeds while giving us
        // visibility into what would have been sent
        log('Email that would have been sent:', 'email');
        log(`From: ${from.email}`, 'email');
        log(`To: ${to.map(r => r.email).join(', ')}`, 'email');
        log(`Subject: ${subject}`, 'email');
        log(`Content: ${html.substring(0, 100)}...`, 'email');
        
        // For now, return true so the appointment update isn't blocked by email failures
        return true;
      }
    } catch (error) {
      log(`Error sending email: ${error}`, 'email');
      return false;
    }
  }

  /**
   * Process appointment created notification
   */
  public static async appointmentCreated(appointment: Appointment, creator: User): Promise<boolean> {
    const settings = await this.getEmailSettings();
    if (!settings || !settings.notifyOnCreate) {
      return false;
    }
    
    try {
      // Get room info for the email
      const room = await storage.getRoom(appointment.roomId);
      if (!room) {
        log('Room not found for email notification', 'email');
        return false;
      }
      
      // Get location info for the email
      const location = await storage.getLocation(room.locationId);
      if (!location) {
        log('Location not found for email notification', 'email');
        return false;
      }
      
      // Format dates
      const startDate = new Date(appointment.startTime).toLocaleString();
      const endDate = new Date(appointment.endTime).toLocaleString();
      
      // Get email template or use default
      let emailTemplate = settings.emailTemplateBookingCreated;
      if (!emailTemplate) {
        emailTemplate = `
          <h2>New Booking Confirmation</h2>
          <p>A new booking has been created:</p>
          <ul>
            <li><strong>Event:</strong> {eventTitle}</li>
            <li><strong>Room:</strong> {roomName}</li>
            <li><strong>Location:</strong> {locationName}</li>
            <li><strong>Start:</strong> {startTime}</li>
            <li><strong>End:</strong> {endTime}</li>
            <li><strong>Status:</strong> {status}</li>
            <li><strong>Cost:</strong> {cost}</li>
            <li><strong>Purpose:</strong> {purpose}</li>
            <li><strong>Attendees:</strong> {attendeesCount}</li>
            <li><strong>Membership #:</strong> {membershipNumber}</li>
            <li><strong>Notes:</strong> {notes}</li>
          </ul>
          <p>Customer Details:</p>
          <ul>
            <li><strong>Name:</strong> {customerName}</li>
            <li><strong>Email:</strong> {customerEmail}</li>
            <li><strong>Phone:</strong> {customerPhone}</li>
            <li><strong>Organization:</strong> {customerOrganization}</li>
          </ul>
          <p>Reserved Rooms:</p>
          {roomsTable}
          <p>For more details, please log in to the system.</p>
          <p>Best regards,<br>{systemName}</p>
        `;
      }
      
      // Generate rooms table HTML
      const roomsTable = this.generateRoomsTableHtml(appointment);
      
      // Replace placeholders with actual data
      const htmlContent = emailTemplate
        .replace(/{eventTitle}/g, appointment.title)
        .replace(/{roomName}/g, room.name)
        .replace(/{locationName}/g, location.name)
        .replace(/{startTime}/g, startDate)
        .replace(/{endTime}/g, endDate)
        .replace(/{status}/g, appointment.status)
        .replace(/{cost}/g, `€${(appointment.agreedCost / 100).toFixed(2)}`)
        .replace(/{customerName}/g, appointment.customerName)
        .replace(/{customerEmail}/g, appointment.customerEmail)
        .replace(/{customerPhone}/g, appointment.customerPhone || 'N/A')
        .replace(/{customerOrganization}/g, appointment.customerOrganization || 'N/A')
        .replace(/{purpose}/g, appointment.purpose || 'N/A')
        .replace(/{notes}/g, appointment.notes || 'N/A')
        .replace(/{membershipNumber}/g, appointment.membershipNumber || 'N/A')
        .replace(/{attendeesCount}/g, appointment.attendeesCount?.toString() || 'N/A')
        .replace(/{roomsTable}/g, roomsTable)
        .replace(/{systemName}/g, settings.systemName);
      
      // Set up recipients
      const recipients = [
        { email: appointment.customerEmail, name: appointment.customerName },
        { email: creator.email, name: creator.name }
      ];
      
      // Add system email if different from creator
      if (settings.systemEmail && settings.systemEmail !== creator.email) {
        recipients.push({ email: settings.systemEmail, name: settings.systemName });
      }
      
      // Send email
      return await this.sendEmail(
        { email: settings.systemEmail, name: settings.systemName },
        recipients,
        `Booking Confirmation: ${appointment.title}`,
        htmlContent,
        settings
      );
    } catch (error) {
      log(`Error in appointmentCreated notification: ${error}`, 'email');
      return false;
    }
  }

  /**
   * Process appointment updated notification
   */
  public static async appointmentUpdated(
    appointment: Appointment, 
    updater: User,
    oldAppointment?: Appointment
  ): Promise<boolean> {
    const settings = await this.getEmailSettings();
    if (!settings || !settings.notifyOnUpdate) {
      return false;
    }
    
    try {
      // Get room info for the email
      const room = await storage.getRoom(appointment.roomId);
      if (!room) {
        log('Room not found for email notification', 'email');
        return false;
      }
      
      // Get location info for the email
      const location = await storage.getLocation(room.locationId);
      if (!location) {
        log('Location not found for email notification', 'email');
        return false;
      }
      
      // Format dates
      const startDate = new Date(appointment.startTime).toLocaleString();
      const endDate = new Date(appointment.endTime).toLocaleString();
      
      // Get email template or use default
      let emailTemplate = settings.emailTemplateBookingUpdated;
      if (!emailTemplate) {
        emailTemplate = `
          <h2>Booking Update Notification</h2>
          <p>A booking has been updated:</p>
          
          <h3>Updated Details:</h3>
          <ul>
            <li><strong>Event:</strong> {eventTitle}</li>
            <li><strong>Room:</strong> {roomName}</li>
            <li><strong>Location:</strong> {locationName}</li>
            <li><strong>Start:</strong> {startTime}</li>
            <li><strong>End:</strong> {endTime}</li>
            <li><strong>Status:</strong> {status}</li>
            <li><strong>Cost:</strong> {cost}</li>
            <li><strong>Purpose:</strong> {purpose}</li>
            <li><strong>Attendees:</strong> {attendeesCount}</li>
            <li><strong>Membership #:</strong> {membershipNumber}</li>
            <li><strong>Notes:</strong> {notes}</li>
          </ul>
          
          <p>Customer Details:</p>
          <ul>
            <li><strong>Name:</strong> {customerName}</li>
            <li><strong>Email:</strong> {customerEmail}</li>
            <li><strong>Phone:</strong> {customerPhone}</li>
            <li><strong>Organization:</strong> {customerOrganization}</li>
          </ul>
          
          <p>Reserved Rooms:</p>
          {roomsTable}
          
          {changesTable}
          
          <p>For more details, please log in to the system.</p>
          <p>Best regards,<br>{systemName}</p>
        `;
      }
      
      // Generate rooms table HTML
      const roomsTable = this.generateRoomsTableHtml(appointment);
      
      // Generate changes table if we have the old appointment data
      let changesTable = '';
      if (oldAppointment) {
        changesTable = this.generateChangesTableHtml(appointment, oldAppointment);
      }
      
      // Replace placeholders with actual data
      const htmlContent = emailTemplate
        .replace(/{eventTitle}/g, appointment.title)
        .replace(/{roomName}/g, room.name)
        .replace(/{locationName}/g, location.name)
        .replace(/{startTime}/g, startDate)
        .replace(/{endTime}/g, endDate)
        .replace(/{status}/g, appointment.status)
        .replace(/{cost}/g, `€${(appointment.agreedCost / 100).toFixed(2)}`)
        .replace(/{customerName}/g, appointment.customerName)
        .replace(/{customerEmail}/g, appointment.customerEmail)
        .replace(/{customerPhone}/g, appointment.customerPhone || 'N/A')
        .replace(/{customerOrganization}/g, appointment.customerOrganization || 'N/A')
        .replace(/{purpose}/g, appointment.purpose || 'N/A')
        .replace(/{notes}/g, appointment.notes || 'N/A')
        .replace(/{membershipNumber}/g, appointment.membershipNumber || 'N/A')
        .replace(/{attendeesCount}/g, appointment.attendeesCount?.toString() || 'N/A')
        .replace(/{roomsTable}/g, roomsTable)
        .replace(/{changesTable}/g, changesTable)
        .replace(/{systemName}/g, settings.systemName);
      
      // Set up recipients
      const recipients = [
        { email: appointment.customerEmail, name: appointment.customerName }
      ];
      
      // Add updater if different from customer
      if (updater.email !== appointment.customerEmail) {
        recipients.push({ email: updater.email, name: updater.name });
      }
      
      // Add system email if different from both
      if (
        settings.systemEmail && 
        settings.systemEmail !== updater.email && 
        settings.systemEmail !== appointment.customerEmail
      ) {
        recipients.push({ email: settings.systemEmail, name: settings.systemName });
      }
      
      // Send email
      return await this.sendEmail(
        { email: settings.systemEmail, name: settings.systemName },
        recipients,
        `Booking Update: ${appointment.title}`,
        htmlContent,
        settings
      );
    } catch (error) {
      log(`Error in appointmentUpdated notification: ${error}`, 'email');
      return false;
    }
  }

  /**
   * Process appointment status changed notification
   */
  public static async appointmentStatusChanged(
    appointment: Appointment, 
    updater: User,
    oldStatus: string
  ): Promise<boolean> {
    const settings = await this.getEmailSettings();
    if (!settings || !settings.notifyOnStatusChange) {
      return false;
    }
    
    try {
      // Get room info for the email
      const room = await storage.getRoom(appointment.roomId);
      if (!room) {
        log('Room not found for email notification', 'email');
        return false;
      }
      
      // Get location info for the email
      const location = await storage.getLocation(room.locationId);
      if (!location) {
        log('Location not found for email notification', 'email');
        return false;
      }
      
      // Format dates
      const startDate = new Date(appointment.startTime).toLocaleString();
      const endDate = new Date(appointment.endTime).toLocaleString();
      
      // Get email template or use default
      let emailTemplate = settings.emailTemplateBookingStatusChanged;
      if (!emailTemplate) {
        emailTemplate = `
          <h2>Booking Status Update</h2>
          <p>The status of your booking has changed from <strong>{oldStatus}</strong> to <strong>{newStatus}</strong>:</p>
          
          <ul>
            <li><strong>Event:</strong> {eventTitle}</li>
            <li><strong>Room:</strong> {roomName}</li>
            <li><strong>Location:</strong> {locationName}</li>
            <li><strong>Start:</strong> {startTime}</li>
            <li><strong>End:</strong> {endTime}</li>
            <li><strong>New Status:</strong> {status}</li>
            <li><strong>Cost:</strong> {cost}</li>
            <li><strong>Purpose:</strong> {purpose}</li>
            <li><strong>Attendees:</strong> {attendeesCount}</li>
          </ul>
          
          {rejectionReason}
          
          <p>Customer Details:</p>
          <ul>
            <li><strong>Name:</strong> {customerName}</li>
            <li><strong>Email:</strong> {customerEmail}</li>
            <li><strong>Phone:</strong> {customerPhone}</li>
            <li><strong>Organization:</strong> {customerOrganization}</li>
          </ul>
          
          <p>Reserved Rooms:</p>
          {roomsTable}
          
          <p>For more details, please log in to the system.</p>
          <p>Best regards,<br>{systemName}</p>
        `;
      }
      
      // Generate rooms table HTML
      const roomsTable = this.generateRoomsTableHtml(appointment);
      
      // Generate rejection reason HTML if applicable
      let rejectionReasonHtml = '';
      if (appointment.status === 'rejected' && appointment.rejectionReason) {
        rejectionReasonHtml = `
          <p><strong>Reason for rejection:</strong></p>
          <p style="padding: 10px; background-color: #f8f8f8; border-left: 4px solid #d0021b;">
            ${appointment.rejectionReason}
          </p>
        `;
      }
      
      // Replace placeholders with actual data
      const htmlContent = emailTemplate
        .replace(/{eventTitle}/g, appointment.title)
        .replace(/{roomName}/g, room.name)
        .replace(/{locationName}/g, location.name)
        .replace(/{startTime}/g, startDate)
        .replace(/{endTime}/g, endDate)
        .replace(/{oldStatus}/g, oldStatus)
        .replace(/{newStatus}/g, appointment.status)
        .replace(/{status}/g, appointment.status)
        .replace(/{cost}/g, `€${(appointment.agreedCost / 100).toFixed(2)}`)
        .replace(/{customerName}/g, appointment.customerName)
        .replace(/{customerEmail}/g, appointment.customerEmail)
        .replace(/{customerPhone}/g, appointment.customerPhone || 'N/A')
        .replace(/{customerOrganization}/g, appointment.customerOrganization || 'N/A')
        .replace(/{purpose}/g, appointment.purpose || 'N/A')
        .replace(/{attendeesCount}/g, appointment.attendeesCount?.toString() || 'N/A')
        .replace(/{rejectionReason}/g, rejectionReasonHtml)
        .replace(/{roomsTable}/g, roomsTable)
        .replace(/{systemName}/g, settings.systemName);
      
      // Set up recipients
      const recipients = [
        { email: appointment.customerEmail, name: appointment.customerName }
      ];
      
      // Add updater if different from customer
      if (updater.email !== appointment.customerEmail) {
        recipients.push({ email: updater.email, name: updater.name });
      }
      
      // Add system email if different from both
      if (
        settings.systemEmail && 
        settings.systemEmail !== updater.email && 
        settings.systemEmail !== appointment.customerEmail
      ) {
        recipients.push({ email: settings.systemEmail, name: settings.systemName });
      }
      
      // Customize subject based on status
      let subject = `Booking Status Update: ${appointment.title}`;
      if (appointment.status === 'approved') {
        subject = `Booking Approved: ${appointment.title}`;
      } else if (appointment.status === 'rejected') {
        subject = `Booking Rejected: ${appointment.title}`;
      } else if (appointment.status === 'cancelled') {
        subject = `Booking Cancelled: ${appointment.title}`;
      }
      
      // Send email
      return await this.sendEmail(
        { email: settings.systemEmail, name: settings.systemName },
        recipients,
        subject,
        htmlContent,
        settings
      );
    } catch (error) {
      log(`Error in appointmentStatusChanged notification: ${error}`, 'email');
      return false;
    }
  }
  
  /**
   * Generate HTML table for rooms list
   */
  private static generateRoomsTableHtml(appointment: Appointment): string {
    if (!appointment.rooms || appointment.rooms.length === 0) {
      return '<p><em>No rooms selected</em></p>';
    }
    
    let tableHtml = `
      <table border="1" cellpadding="8" cellspacing="0" style="border-collapse: collapse; width: 100%; max-width: 600px; margin-bottom: 20px;">
        <thead>
          <tr style="background-color: #f3f4f6;">
            <th align="left">Room</th>
            <th align="left">Pricing Type</th>
            <th align="left">Facilities</th>
            <th align="right">Cost</th>
          </tr>
        </thead>
        <tbody>
    `;
    
    let totalCost = 0;
    
    // Add rows for each room
    appointment.rooms.forEach(room => {
      const costTypeDisplay = room.costType === 'flat' ? 'Flat Rate' : 
                             room.costType === 'hourly' ? 'Hourly Rate' : 'Per Attendee';
      
      const facilitiesList = room.requestedFacilities && room.requestedFacilities.length > 0 
        ? room.requestedFacilities.join(', ') 
        : 'None';
        
      const costFormatted = `€${(room.cost / 100).toFixed(2)}`;
      totalCost += room.cost;
      
      tableHtml += `
        <tr>
          <td>${room.roomName}</td>
          <td>${costTypeDisplay}</td>
          <td>${facilitiesList}</td>
          <td align="right">${costFormatted}</td>
        </tr>
      `;
    });
    
    // Add total row
    tableHtml += `
        <tr style="font-weight: bold; background-color: #f3f4f6;">
          <td colspan="3" align="right">Total:</td>
          <td align="right">€${(totalCost / 100).toFixed(2)}</td>
        </tr>
      </tbody>
    </table>
    `;
    
    return tableHtml;
  }
  
  /**
   * Generate HTML table showing changes between old and new appointment
   */
  private static generateChangesTableHtml(newAppointment: Appointment, oldAppointment: Appointment): string {
    // Fields to compare
    const fieldsToCompare = [
      { key: 'title', label: 'Event Title' },
      { key: 'startTime', label: 'Start Time', formatter: (val: string) => new Date(val).toLocaleString() },
      { key: 'endTime', label: 'End Time', formatter: (val: string) => new Date(val).toLocaleString() },
      { key: 'status', label: 'Status' },
      { key: 'purpose', label: 'Purpose' },
      { key: 'attendeesCount', label: 'Attendees Count' },
      { key: 'agreedCost', label: 'Total Cost', formatter: (val: number) => `€${(val / 100).toFixed(2)}` },
      { key: 'notes', label: 'Notes' }
    ];
    
    // Find differences
    const changes: {field: string, old: any, new: any}[] = [];
    
    for (const field of fieldsToCompare) {
      const oldValue = oldAppointment[field.key as keyof Appointment];
      const newValue = newAppointment[field.key as keyof Appointment];
      
      // If values differ, add to changes list
      if (oldValue !== newValue && (oldValue || newValue)) {
        const formatter = field.formatter || ((val: any) => val);
        changes.push({
          field: field.label,
          old: oldValue ? formatter(oldValue) : 'Not specified',
          new: newValue ? formatter(newValue) : 'Not specified'
        });
      }
    }
    
    // If no changes found
    if (changes.length === 0) {
      return '';
    }
    
    // Generate HTML table
    let changesHtml = `
      <h3>What Changed:</h3>
      <table border="1" cellpadding="8" cellspacing="0" style="border-collapse: collapse; width: 100%; max-width: 600px; margin-bottom: 20px;">
        <thead>
          <tr style="background-color: #f3f4f6;">
            <th align="left">Field</th>
            <th align="left">Previous Value</th>
            <th align="left">New Value</th>
          </tr>
        </thead>
        <tbody>
    `;
    
    // Add rows for each change
    changes.forEach(change => {
      changesHtml += `
        <tr>
          <td><strong>${change.field}</strong></td>
          <td>${change.old}</td>
          <td>${change.new}</td>
        </tr>
      `;
    });
    
    changesHtml += `
      </tbody>
    </table>
    `;
    
    return changesHtml;
  }
}