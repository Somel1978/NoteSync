import { Appointment, EmailSettings } from '@shared/schema';
import { storage } from '../storage';
import { User } from '@shared/schema';
import { log } from '../vite';

/**
 * Class to handle email notifications
 */
export class EmailNotificationService {
  private static async getEmailSettings(): Promise<EmailSettings | null> {
    const emailSettingsRecord = await storage.getSetting('email_settings');
    if (!emailSettingsRecord || !emailSettingsRecord.value.enabled) {
      return null;
    }
    return emailSettingsRecord.value as EmailSettings;
  }

  private static async sendEmail(
    from: { email: string; name: string },
    to: { email: string; name: string }[],
    subject: string,
    html: string,
    settings: EmailSettings
  ): Promise<boolean> {
    try {
      // Import Mailjet
      const { Client } = await import('node-mailjet');
      const mailjet = new Client({
        apiKey: settings.mailjetApiKey,
        apiSecret: settings.mailjetSecretKey
      });
      
      // Send email
      await mailjet.post('send', { version: 'v3.1' }).request({
        Messages: [
          {
            From: {
              Email: from.email,
              Name: from.name
            },
            To: to.map(recipient => ({
              Email: recipient.email,
              Name: recipient.name
            })),
            Subject: subject,
            HTMLPart: html
          }
        ]
      });
      
      return true;
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
          </ul>
          <p>Customer Details:</p>
          <ul>
            <li><strong>Name:</strong> {customerName}</li>
            <li><strong>Email:</strong> {customerEmail}</li>
            <li><strong>Phone:</strong> {customerPhone}</li>
            <li><strong>Organization:</strong> {customerOrganization}</li>
          </ul>
          <p>For more details, please log in to the system.</p>
          <p>Best regards,<br>{systemName}</p>
        `;
      }
      
      // Replace placeholders with actual data
      const htmlContent = emailTemplate
        .replace(/{eventTitle}/g, appointment.title)
        .replace(/{roomName}/g, room.name)
        .replace(/{locationName}/g, location.name)
        .replace(/{startTime}/g, startDate)
        .replace(/{endTime}/g, endDate)
        .replace(/{status}/g, appointment.status)
        .replace(/{cost}/g, `$${(appointment.agreedCost / 100).toFixed(2)}`)
        .replace(/{customerName}/g, appointment.customerName)
        .replace(/{customerEmail}/g, appointment.customerEmail)
        .replace(/{customerPhone}/g, appointment.customerPhone || 'N/A')
        .replace(/{customerOrganization}/g, appointment.customerOrganization || 'N/A')
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
          <ul>
            <li><strong>Event:</strong> {eventTitle}</li>
            <li><strong>Room:</strong> {roomName}</li>
            <li><strong>Location:</strong> {locationName}</li>
            <li><strong>Start:</strong> {startTime}</li>
            <li><strong>End:</strong> {endTime}</li>
            <li><strong>Status:</strong> {status}</li>
            <li><strong>Cost:</strong> {cost}</li>
          </ul>
          <p>Customer Details:</p>
          <ul>
            <li><strong>Name:</strong> {customerName}</li>
            <li><strong>Email:</strong> {customerEmail}</li>
            <li><strong>Phone:</strong> {customerPhone}</li>
            <li><strong>Organization:</strong> {customerOrganization}</li>
          </ul>
          <p>For more details, please log in to the system.</p>
          <p>Best regards,<br>{systemName}</p>
        `;
      }
      
      // Replace placeholders with actual data
      const htmlContent = emailTemplate
        .replace(/{eventTitle}/g, appointment.title)
        .replace(/{roomName}/g, room.name)
        .replace(/{locationName}/g, location.name)
        .replace(/{startTime}/g, startDate)
        .replace(/{endTime}/g, endDate)
        .replace(/{status}/g, appointment.status)
        .replace(/{cost}/g, `$${(appointment.agreedCost / 100).toFixed(2)}`)
        .replace(/{customerName}/g, appointment.customerName)
        .replace(/{customerEmail}/g, appointment.customerEmail)
        .replace(/{customerPhone}/g, appointment.customerPhone || 'N/A')
        .replace(/{customerOrganization}/g, appointment.customerOrganization || 'N/A')
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
          </ul>
          <p>Customer Details:</p>
          <ul>
            <li><strong>Name:</strong> {customerName}</li>
            <li><strong>Email:</strong> {customerEmail}</li>
            <li><strong>Phone:</strong> {customerPhone}</li>
            <li><strong>Organization:</strong> {customerOrganization}</li>
          </ul>
          <p>For more details, please log in to the system.</p>
          <p>Best regards,<br>{systemName}</p>
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
        .replace(/{cost}/g, `$${(appointment.agreedCost / 100).toFixed(2)}`)
        .replace(/{customerName}/g, appointment.customerName)
        .replace(/{customerEmail}/g, appointment.customerEmail)
        .replace(/{customerPhone}/g, appointment.customerPhone || 'N/A')
        .replace(/{customerOrganization}/g, appointment.customerOrganization || 'N/A')
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
}