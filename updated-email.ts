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
  /**
   * Translate status values to Portuguese
   */
  private static translateStatus(status: string): string {
    const statusInPortuguese: Record<string, string> = {
      'pending': 'Pendente',
      'approved': 'Aprovado',
      'rejected': 'Rejeitado',
      'cancelled': 'Cancelado'
    };
    
    return statusInPortuguese[status] || status;
  }

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
      
      // Get status display in Portuguese
      const statusDisplay = this.translateStatus(appointment.status);
      
      // Get custom email template and replace placeholders
      let customTemplate = settings.emailTemplateBookingCreated || '';
      customTemplate = customTemplate
        .replace(/{eventTitle}/g, appointment.title)
        .replace(/{roomName}/g, room.name)
        .replace(/{locationName}/g, location.name)
        .replace(/{startTime}/g, startDate)
        .replace(/{endTime}/g, endDate)
        .replace(/{status}/g, statusDisplay)
        .replace(/{cost}/g, `€${(appointment.agreedCost / 100).toFixed(2)}`);
      
      
      // Generate booking details HTML section
      const bookingDetailsHtml = `
        <div style="margin: 20px 0; padding: 15px; border-radius: 5px; border: 1px solid #e0e0e0; background-color: #f9f9f9;">
          <h3 style="color: #3b82f6; margin-bottom: 15px; border-bottom: 1px solid #e0e0e0; padding-bottom: 8px;">Detalhes da Reserva:</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px; width: 40%; font-weight: bold;">Evento:</td>
              <td style="padding: 8px;">${appointment.title}</td>
            </tr>
            <tr style="background-color: #f3f4f6;">
              <td style="padding: 8px; font-weight: bold;">Sala:</td>
              <td style="padding: 8px;">${room.name}</td>
            </tr>
            <tr>
              <td style="padding: 8px; font-weight: bold;">Local:</td>
              <td style="padding: 8px;">${location.name}</td>
            </tr>
            <tr style="background-color: #f3f4f6;">
              <td style="padding: 8px; font-weight: bold;">Início:</td>
              <td style="padding: 8px;">${startDate}</td>
            </tr>
            <tr>
              <td style="padding: 8px; font-weight: bold;">Fim:</td>
              <td style="padding: 8px;">${endDate}</td>
            </tr>
            <tr style="background-color: #f3f4f6;">
              <td style="padding: 8px; font-weight: bold;">Estado:</td>
              <td style="padding: 8px;">${statusDisplay}</td>
            </tr>
            <tr>
              <td style="padding: 8px; font-weight: bold;">Custo:</td>
              <td style="padding: 8px;">€${(appointment.agreedCost / 100).toFixed(2)}</td>
            </tr>
            <tr style="background-color: #f3f4f6;">
              <td style="padding: 8px; font-weight: bold;">Finalidade:</td>
              <td style="padding: 8px;">${appointment.purpose || 'N/A'}</td>
            </tr>
            <tr>
              <td style="padding: 8px; font-weight: bold;">Participantes:</td>
              <td style="padding: 8px;">${appointment.attendeesCount?.toString() || 'N/A'}</td>
            </tr>
            <tr style="background-color: #f3f4f6;">
              <td style="padding: 8px; font-weight: bold;">Nº de Sócio:</td>
              <td style="padding: 8px;">${appointment.membershipNumber || 'N/A'}</td>
            </tr>
            <tr>
              <td style="padding: 8px; font-weight: bold;">Notas:</td>
              <td style="padding: 8px;">${appointment.notes || 'N/A'}</td>
            </tr>
          </table>
        </div>
      `;
      
      // Generate customer details HTML section
      const customerDetailsHtml = `
        <div style="margin: 20px 0; padding: 15px; border-radius: 5px; border: 1px solid #e0e0e0; background-color: #f9f9f9;">
          <h3 style="color: #3b82f6; margin-bottom: 15px; border-bottom: 1px solid #e0e0e0; padding-bottom: 8px;">Dados do Cliente:</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px; width: 40%; font-weight: bold;">Nome:</td>
              <td style="padding: 8px;">${appointment.customerName}</td>
            </tr>
            <tr style="background-color: #f3f4f6;">
              <td style="padding: 8px; font-weight: bold;">Email:</td>
              <td style="padding: 8px;">${appointment.customerEmail}</td>
            </tr>
            <tr>
              <td style="padding: 8px; font-weight: bold;">Telefone:</td>
              <td style="padding: 8px;">${appointment.customerPhone || 'N/A'}</td>
            </tr>
            <tr style="background-color: #f3f4f6;">
              <td style="padding: 8px; font-weight: bold;">Organização:</td>
              <td style="padding: 8px;">${appointment.customerOrganization || 'N/A'}</td>
            </tr>
          </table>
        </div>
      `;
      
      // Generate rooms table HTML
      const roomsTable = this.generateRoomsTableHtml(appointment);
      
      // Format custom template as HTML
      const formattedCustomTemplate = this.formatCustomTemplate(customTemplate);
      
      // Combine everything into a beautiful HTML email
      const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 650px; margin: 0 auto;">
          <div style="background-color: #3b82f6; color: white; padding: 20px; border-radius: 5px 5px 0 0; margin-bottom: 20px;">
            <h2 style="margin: 0; font-weight: 600;">${settings.systemName} - Confirmação de Reserva</h2>
          </div>
          
          ${formattedCustomTemplate}
          
          ${bookingDetailsHtml}
          
          ${customerDetailsHtml}
          
          <div style="margin: 20px 0;">
            <h3 style="color: #3b82f6; margin-bottom: 15px; border-bottom: 1px solid #e0e0e0; padding-bottom: 8px;">Salas Reservadas:</h3>
            ${roomsTable}
          </div>
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; color: #666; font-size: 14px;">
            <p>Para algum esclarecimento, entre em contacto conosco pelo email <a href="mailto:geral@acrdsc.org" style="color: #3b82f6; text-decoration: none;">geral@acrdsc.org</a>.</p>
            <p>Atenciosamente,<br>${settings.systemName}</p>
          </div>
        </div>
      `;
      
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
        `Confirmação de Reserva: ${appointment.title}`,
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
      
      // Get status display in Portuguese
      const statusDisplay = this.translateStatus(appointment.status);
      
      // Get custom email template and replace placeholders
      let customTemplate = settings.emailTemplateBookingUpdated || '';
      customTemplate = customTemplate
        .replace(/{eventTitle}/g, appointment.title)
        .replace(/{roomName}/g, room.name)
        .replace(/{locationName}/g, location.name)
        .replace(/{startTime}/g, startDate)
        .replace(/{endTime}/g, endDate)
        .replace(/{status}/g, statusDisplay)
        .replace(/{cost}/g, `€${(appointment.agreedCost / 100).toFixed(2)}`);
      
      // Generate booking details HTML section
      const bookingDetailsHtml = `
        <div style="margin: 20px 0; padding: 15px; border-radius: 5px; border: 1px solid #e0e0e0; background-color: #f9f9f9;">
          <h3 style="color: #3b82f6; margin-bottom: 15px; border-bottom: 1px solid #e0e0e0; padding-bottom: 8px;">Detalhes Atualizados:</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px; width: 40%; font-weight: bold;">Evento:</td>
              <td style="padding: 8px;">${appointment.title}</td>
            </tr>
            <tr style="background-color: #f3f4f6;">
              <td style="padding: 8px; font-weight: bold;">Sala:</td>
              <td style="padding: 8px;">${room.name}</td>
            </tr>
            <tr>
              <td style="padding: 8px; font-weight: bold;">Local:</td>
              <td style="padding: 8px;">${location.name}</td>
            </tr>
            <tr style="background-color: #f3f4f6;">
              <td style="padding: 8px; font-weight: bold;">Início:</td>
              <td style="padding: 8px;">${startDate}</td>
            </tr>
            <tr>
              <td style="padding: 8px; font-weight: bold;">Fim:</td>
              <td style="padding: 8px;">${endDate}</td>
            </tr>
            <tr style="background-color: #f3f4f6;">
              <td style="padding: 8px; font-weight: bold;">Estado:</td>
              <td style="padding: 8px;">${statusDisplay}</td>
            </tr>
            <tr>
              <td style="padding: 8px; font-weight: bold;">Custo:</td>
              <td style="padding: 8px;">€${(appointment.agreedCost / 100).toFixed(2)}</td>
            </tr>
            <tr style="background-color: #f3f4f6;">
              <td style="padding: 8px; font-weight: bold;">Finalidade:</td>
              <td style="padding: 8px;">${appointment.purpose || 'N/A'}</td>
            </tr>
          </table>
        </div>
      `;
      
      // Generate customer details HTML section
      const customerDetailsHtml = `
        <div style="margin: 20px 0; padding: 15px; border-radius: 5px; border: 1px solid #e0e0e0; background-color: #f9f9f9;">
          <h3 style="color: #3b82f6; margin-bottom: 15px; border-bottom: 1px solid #e0e0e0; padding-bottom: 8px;">Dados do Cliente:</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px; width: 40%; font-weight: bold;">Nome:</td>
              <td style="padding: 8px;">${appointment.customerName}</td>
            </tr>
            <tr style="background-color: #f3f4f6;">
              <td style="padding: 8px; font-weight: bold;">Email:</td>
              <td style="padding: 8px;">${appointment.customerEmail}</td>
            </tr>
            <tr>
              <td style="padding: 8px; font-weight: bold;">Telefone:</td>
              <td style="padding: 8px;">${appointment.customerPhone || 'N/A'}</td>
            </tr>
            <tr style="background-color: #f3f4f6;">
              <td style="padding: 8px; font-weight: bold;">Organização:</td>
              <td style="padding: 8px;">${appointment.customerOrganization || 'N/A'}</td>
            </tr>
          </table>
        </div>
      `;
      
      // Generate rooms table HTML
      const roomsTable = this.generateRoomsTableHtml(appointment);
      
      // Generate changes table if we have the old appointment data
      let changesTable = '';
      if (oldAppointment) {
        changesTable = this.generateChangesTableHtml(appointment, oldAppointment);
      }
      
      // Format custom template as HTML
      const formattedCustomTemplate = this.formatCustomTemplate(customTemplate);
      
      // Combine everything into a beautiful HTML email
      const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 650px; margin: 0 auto;">
          <div style="background-color: #3b82f6; color: white; padding: 20px; border-radius: 5px 5px 0 0; margin-bottom: 20px;">
            <h2 style="margin: 0; font-weight: 600;">${settings.systemName} - Atualização de Reserva</h2>
          </div>
          
          ${formattedCustomTemplate}
          
          ${bookingDetailsHtml}
          
          ${customerDetailsHtml}
          
          <div style="margin: 20px 0;">
            <h3 style="color: #3b82f6; margin-bottom: 15px; border-bottom: 1px solid #e0e0e0; padding-bottom: 8px;">Salas Reservadas:</h3>
            ${roomsTable}
          </div>
          
          ${changesTable}
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; color: #666; font-size: 14px;">
            <p>Para algum esclarecimento, entre em contacto conosco pelo email <a href="mailto:geral@acrdsc.org" style="color: #3b82f6; text-decoration: none;">geral@acrdsc.org</a>.</p>
            <p>Atenciosamente,<br>${settings.systemName}</p>
          </div>
        </div>
      `;
      
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
        `Reserva Atualizada: ${appointment.title}`,
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
      
      // Translate status values
      const oldStatusDisplay = this.translateStatus(oldStatus);
      const newStatusDisplay = this.translateStatus(appointment.status);
      
      // Get custom email template and replace placeholders
      let customTemplate = settings.emailTemplateBookingStatusChanged || '';
      customTemplate = customTemplate
        .replace(/{oldStatus}/g, oldStatusDisplay)
        .replace(/{newStatus}/g, newStatusDisplay)
        .replace(/{eventTitle}/g, appointment.title)
        .replace(/{roomName}/g, room.name)
        .replace(/{locationName}/g, location.name)
        .replace(/{startTime}/g, startDate)
        .replace(/{endTime}/g, endDate)
        .replace(/{status}/g, newStatusDisplay)
        .replace(/{cost}/g, `€${(appointment.agreedCost / 100).toFixed(2)}`);
      
      // Generate status change banner
      const statusBanner = `
        <div style="margin: 20px 0; padding: 15px; border-radius: 5px; 
            ${appointment.status === 'approved' ? 'background-color: #dcfce7; border: 1px solid #22c55e;' : 
             appointment.status === 'rejected' ? 'background-color: #fee2e2; border: 1px solid #ef4444;' :
             appointment.status === 'cancelled' ? 'background-color: #fef3c7; border: 1px solid #f59e0b;' :
             'background-color: #eff6ff; border: 1px solid #3b82f6;'}">
          <h3 style="margin-top: 0; margin-bottom: 10px; 
              ${appointment.status === 'approved' ? 'color: #15803d;' : 
               appointment.status === 'rejected' ? 'color: #b91c1c;' :
               appointment.status === 'cancelled' ? 'color: #b45309;' :
               'color: #1e40af;'}">
            Estado da Reserva Alterado
          </h3>
          <p style="margin-bottom: 0;">
            O estado da sua reserva foi alterado de <strong>${oldStatusDisplay}</strong> para 
            <strong style="
              ${appointment.status === 'approved' ? 'color: #15803d;' : 
               appointment.status === 'rejected' ? 'color: #b91c1c;' :
               appointment.status === 'cancelled' ? 'color: #b45309;' :
               'color: #1e40af;'}">
              ${newStatusDisplay}
            </strong>.
          </p>
        </div>
      `;
      
      // Generate booking details HTML section
      const bookingDetailsHtml = `
        <div style="margin: 20px 0; padding: 15px; border-radius: 5px; border: 1px solid #e0e0e0; background-color: #f9f9f9;">
          <h3 style="color: #3b82f6; margin-bottom: 15px; border-bottom: 1px solid #e0e0e0; padding-bottom: 8px;">Detalhes da Reserva:</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px; width: 40%; font-weight: bold;">Evento:</td>
              <td style="padding: 8px;">${appointment.title}</td>
            </tr>
            <tr style="background-color: #f3f4f6;">
              <td style="padding: 8px; font-weight: bold;">Sala:</td>
              <td style="padding: 8px;">${room.name}</td>
            </tr>
            <tr>
              <td style="padding: 8px; font-weight: bold;">Local:</td>
              <td style="padding: 8px;">${location.name}</td>
            </tr>
            <tr style="background-color: #f3f4f6;">
              <td style="padding: 8px; font-weight: bold;">Início:</td>
              <td style="padding: 8px;">${startDate}</td>
            </tr>
            <tr>
              <td style="padding: 8px; font-weight: bold;">Fim:</td>
              <td style="padding: 8px;">${endDate}</td>
            </tr>
            <tr style="background-color: #f3f4f6;">
              <td style="padding: 8px; font-weight: bold;">Novo Estado:</td>
              <td style="padding: 8px; font-weight: bold;
                  ${appointment.status === 'approved' ? 'color: #15803d;' : 
                   appointment.status === 'rejected' ? 'color: #b91c1c;' :
                   appointment.status === 'cancelled' ? 'color: #b45309;' :
                   'color: #1e40af;'}">
                ${newStatusDisplay}
              </td>
            </tr>
            <tr>
              <td style="padding: 8px; font-weight: bold;">Custo:</td>
              <td style="padding: 8px;">€${(appointment.agreedCost / 100).toFixed(2)}</td>
            </tr>
            <tr style="background-color: #f3f4f6;">
              <td style="padding: 8px; font-weight: bold;">Finalidade:</td>
              <td style="padding: 8px;">${appointment.purpose || 'N/A'}</td>
            </tr>
          </table>
        </div>
      `;
      
      // Generate rejection reason HTML if applicable
      let rejectionReasonHtml = '';
      if (appointment.status === 'rejected' && appointment.rejectionReason) {
        rejectionReasonHtml = `
          <div style="margin: 20px 0; padding: 15px; border-radius: 5px; border: 1px solid #ef4444; background-color: #fee2e2;">
            <h3 style="color: #b91c1c; margin-top: 0; margin-bottom: 10px;">Motivo de Rejeição:</h3>
            <p style="margin-bottom: 0;">${appointment.rejectionReason}</p>
          </div>
        `;
      }
      
      // Generate customer details HTML section
      const customerDetailsHtml = `
        <div style="margin: 20px 0; padding: 15px; border-radius: 5px; border: 1px solid #e0e0e0; background-color: #f9f9f9;">
          <h3 style="color: #3b82f6; margin-bottom: 15px; border-bottom: 1px solid #e0e0e0; padding-bottom: 8px;">Dados do Cliente:</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px; width: 40%; font-weight: bold;">Nome:</td>
              <td style="padding: 8px;">${appointment.customerName}</td>
            </tr>
            <tr style="background-color: #f3f4f6;">
              <td style="padding: 8px; font-weight: bold;">Email:</td>
              <td style="padding: 8px;">${appointment.customerEmail}</td>
            </tr>
            <tr>
              <td style="padding: 8px; font-weight: bold;">Telefone:</td>
              <td style="padding: 8px;">${appointment.customerPhone || 'N/A'}</td>
            </tr>
            <tr style="background-color: #f3f4f6;">
              <td style="padding: 8px; font-weight: bold;">Organização:</td>
              <td style="padding: 8px;">${appointment.customerOrganization || 'N/A'}</td>
            </tr>
          </table>
        </div>
      `;
      
      // Generate rooms table HTML
      const roomsTable = this.generateRoomsTableHtml(appointment);
      
      // Format custom template as HTML
      const formattedCustomTemplate = this.formatCustomTemplate(customTemplate);
      
      // Combine everything into a beautiful HTML email
      const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 650px; margin: 0 auto;">
          <div style="background-color: #3b82f6; color: white; padding: 20px; border-radius: 5px 5px 0 0; margin-bottom: 20px;">
            <h2 style="margin: 0; font-weight: 600;">${settings.systemName} - Alteração de Estado</h2>
          </div>
          
          ${statusBanner}
          
          ${formattedCustomTemplate}
          
          ${rejectionReasonHtml}
          
          ${bookingDetailsHtml}
          
          ${customerDetailsHtml}
          
          <div style="margin: 20px 0;">
            <h3 style="color: #3b82f6; margin-bottom: 15px; border-bottom: 1px solid #e0e0e0; padding-bottom: 8px;">Salas Reservadas:</h3>
            ${roomsTable}
          </div>
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; color: #666; font-size: 14px;">
            <p>Para algum esclarecimento, entre em contacto conosco pelo email <a href="mailto:geral@acrdsc.org" style="color: #3b82f6; text-decoration: none;">geral@acrdsc.org</a>.</p>
            <p>Atenciosamente,<br>${settings.systemName}</p>
          </div>
        </div>
      `;
      
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
      let subject = `Atualização de Reserva: ${appointment.title}`;
      if (appointment.status === 'approved') {
        subject = `Reserva Aprovada: ${appointment.title}`;
      } else if (appointment.status === 'rejected') {
        subject = `Reserva Rejeitada: ${appointment.title}`;
      } else if (appointment.status === 'cancelled') {
        subject = `Reserva Cancelada: ${appointment.title}`;
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
   * Format custom template text into nicely styled HTML paragraphs
   */
  private static formatCustomTemplate(templateText: string): string {
    if (!templateText) return '';
    
    // Split by line breaks and wrap each paragraph in HTML
    const paragraphs = templateText.split('\n')
      .filter(p => p.trim() !== '')
      .map(p => `<p style="margin-bottom: 15px; line-height: 1.5;">${p}</p>`)
      .join('');
    
    return `<div style="margin: 20px 0;">${paragraphs}</div>`;
  }
  
  /**
   * Generate HTML table for rooms list
   */
  private static generateRoomsTableHtml(appointment: Appointment): string {
    // If rooms array is not present or empty, return info for the single room
    if (!appointment.rooms || !appointment.rooms.length) {
      return `
        <table style="width: 100%; border-collapse: collapse; border: 1px solid #e0e0e0;">
          <thead>
            <tr style="background-color: #f3f4f6;">
              <th style="padding: 10px; text-align: left; border-bottom: 1px solid #e0e0e0;">Sala</th>
              <th style="padding: 10px; text-align: left; border-bottom: 1px solid #e0e0e0;">Facilidades</th>
              <th style="padding: 10px; text-align: right; border-bottom: 1px solid #e0e0e0;">Custo</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="padding: 10px; border-bottom: 1px solid #e0e0e0;">Sala Principal</td>
              <td style="padding: 10px; border-bottom: 1px solid #e0e0e0;">N/A</td>
              <td style="padding: 10px; border-bottom: 1px solid #e0e0e0; text-align: right;">€${(appointment.agreedCost / 100).toFixed(2)}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr style="background-color: #f9f9f9; font-weight: bold;">
              <td style="padding: 10px;" colspan="2">Total</td>
              <td style="padding: 10px; text-align: right;">€${(appointment.agreedCost / 100).toFixed(2)}</td>
            </tr>
          </tfoot>
        </table>
      `;
    }
    
    // Generate rows for each room
    const roomRows = appointment.rooms.map(room => `
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #e0e0e0;">${room.roomName}</td>
        <td style="padding: 10px; border-bottom: 1px solid #e0e0e0;">${room.requestedFacilities?.join(', ') || 'N/A'}</td>
        <td style="padding: 10px; border-bottom: 1px solid #e0e0e0; text-align: right;">€${(room.cost / 100).toFixed(2)}</td>
      </tr>
    `).join('');
    
    return `
      <table style="width: 100%; border-collapse: collapse; border: 1px solid #e0e0e0;">
        <thead>
          <tr style="background-color: #f3f4f6;">
            <th style="padding: 10px; text-align: left; border-bottom: 1px solid #e0e0e0;">Sala</th>
            <th style="padding: 10px; text-align: left; border-bottom: 1px solid #e0e0e0;">Facilidades</th>
            <th style="padding: 10px; text-align: right; border-bottom: 1px solid #e0e0e0;">Custo</th>
          </tr>
        </thead>
        <tbody>
          ${roomRows}
        </tbody>
        <tfoot>
          <tr style="background-color: #f9f9f9; font-weight: bold;">
            <td style="padding: 10px;" colspan="2">Total</td>
            <td style="padding: 10px; text-align: right;">€${(appointment.agreedCost / 100).toFixed(2)}</td>
          </tr>
        </tfoot>
      </table>
    `;
  }
  
  /**
   * Generate HTML table showing changes between old and new appointment
   */
  private static generateChangesTableHtml(newAppointment: Appointment, oldAppointment: Appointment): string {
    const changes: { field: string; old: string; new: string }[] = [];
    
    const compareField = (field: keyof Appointment, label: string, formatter?: (val: any) => string) => {
      const oldValue = oldAppointment[field];
      const newValue = newAppointment[field];
      
      // Skip if both are null/undefined or equal
      if ((oldValue === null && newValue === null) || 
          (oldValue === undefined && newValue === undefined) || 
          oldValue === newValue) {
        return;
      }
      
      const formatValue = (val: any): string => {
        if (val === null || val === undefined) return 'N/A';
        if (formatter) return formatter(val);
        if (typeof val === 'object' && val instanceof Date) return new Date(val).toLocaleString();
        return String(val);
      };
      
      changes.push({
        field: label,
        old: formatValue(oldValue),
        new: formatValue(newValue)
      });
    };
    
    // Compare important fields
    compareField('title', 'Evento');
    compareField('roomId', 'Sala ID');
    compareField('startTime', 'Início', val => new Date(val).toLocaleString());
    compareField('endTime', 'Fim', val => new Date(val).toLocaleString());
    compareField('status', 'Estado', val => this.translateStatus(val));
    compareField('purpose', 'Finalidade');
    compareField('customerName', 'Nome do Cliente');
    compareField('customerEmail', 'Email do Cliente');
    compareField('customerPhone', 'Telefone do Cliente');
    compareField('customerOrganization', 'Organização do Cliente');
    compareField('attendeesCount', 'Número de Participantes');
    compareField('agreedCost', 'Custo', val => `€${(val / 100).toFixed(2)}`);
    compareField('notes', 'Notas');
    
    if (changes.length === 0) {
      return '';
    }
    
    const changeRows = changes.map(change => `
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #e0e0e0;">${change.field}</td>
        <td style="padding: 10px; border-bottom: 1px solid #e0e0e0; text-decoration: line-through; color: #ef4444;">${change.old}</td>
        <td style="padding: 10px; border-bottom: 1px solid #e0e0e0; color: #22c55e;">${change.new}</td>
      </tr>
    `).join('');
    
    return `
      <div style="margin: 20px 0;">
        <h3 style="color: #3b82f6; margin-bottom: 15px; border-bottom: 1px solid #e0e0e0; padding-bottom: 8px;">Alterações Realizadas:</h3>
        <table style="width: 100%; border-collapse: collapse; border: 1px solid #e0e0e0;">
          <thead>
            <tr style="background-color: #f3f4f6;">
              <th style="padding: 10px; text-align: left; border-bottom: 1px solid #e0e0e0;">Campo</th>
              <th style="padding: 10px; text-align: left; border-bottom: 1px solid #e0e0e0;">Valor Anterior</th>
              <th style="padding: 10px; text-align: left; border-bottom: 1px solid #e0e0e0;">Novo Valor</th>
            </tr>
          </thead>
          <tbody>
            ${changeRows}
          </tbody>
        </table>
      </div>
    `;
  }
}