import { users, rooms, locations, appointments as appointmentsTable, auditLogs, settings, type User, type InsertUser, type Room, type InsertRoom, type Location, type InsertLocation, type Appointment, type InsertAppointment, type AuditLog, type InsertAuditLog, type Setting, type InsertSetting } from "@shared/schema";
import { eq, and, gte, lte, desc, sql } from "drizzle-orm";
import connectPg from "connect-pg-simple";
import session from "express-session";
import { pool, db } from "./db";

// Define the SessionStore type
declare module 'express-session' {
  interface SessionData {
    // Add any custom session properties here
    passport?: {
      user: number;
    };
  }
}

const PostgresSessionStore = connectPg(session);

export interface IStorage {
  // SQL Raw Operations
  executeRawSQL(query: string, params?: any[]): Promise<any>;

  // User Operations
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, updates: Partial<User>): Promise<User | undefined>;
  updatePassword(id: number, oldPassword: string, newPassword: string, adminOverride?: boolean): Promise<boolean>;
  deleteUser(id: number): Promise<boolean>;
  getAllUsers(): Promise<User[]>;

  // Location Operations
  getLocation(id: number): Promise<Location | undefined>;
  createLocation(location: InsertLocation): Promise<Location>;
  updateLocation(id: number, updates: Partial<Location>): Promise<Location | undefined>;
  deleteLocation(id: number): Promise<boolean>;
  getAllLocations(): Promise<Location[]>;

  // Room Operations
  getRoom(id: number): Promise<Room | undefined>;
  getRoomsByLocation(locationId: number): Promise<Room[]>;
  createRoom(room: InsertRoom): Promise<Room>;
  updateRoom(id: number, updates: Partial<Room>): Promise<Room | undefined>;
  deleteRoom(id: number): Promise<boolean>;
  getAllRooms(): Promise<Room[]>;
  getActiveRooms(): Promise<Room[]>;
  
  // Appointment Operations
  getAppointment(id: number): Promise<Appointment | undefined>;
  createAppointment(appointment: InsertAppointment): Promise<Appointment>;
  updateAppointment(id: number, updates: Partial<Appointment>): Promise<Appointment | undefined>;
  deleteAppointment(id: number, userId?: number): Promise<boolean>;
  getAppointmentsByUser(userId: number): Promise<Appointment[]>;
  getAppointmentsByRoom(roomId: number): Promise<Appointment[]>;
  getAppointmentsByDateRange(startDate: Date, endDate: Date): Promise<Appointment[]>;
  getAppointmentsByStatus(status: string): Promise<Appointment[]>;
  getAllAppointments(): Promise<Appointment[]>;
  getRecentAppointments(limit: number): Promise<Appointment[]>;
  getNextAppointmentOrderNumber(): Promise<number>;
  
  // Audit Log Operations
  createAuditLog(auditLog: InsertAuditLog): Promise<AuditLog>;
  getAuditLogsByAppointment(appointmentId: number): Promise<AuditLog[]>;
  
  // Settings Operations
  getSetting(key: string): Promise<Setting | undefined>;
  createOrUpdateSetting(key: string, value: any): Promise<Setting>;
  getAllSettings(): Promise<Setting[]>;
  
  // Room Utilization
  getRoomUtilization(roomId: number, startDate: Date, endDate: Date): Promise<number>;
  getOverallUtilization(startDate: Date, endDate: Date): Promise<{roomId: number, utilization: number}[]>;
  
  // Session Store
  sessionStore: any;
}

export class DatabaseStorage implements IStorage {
  sessionStore: any;

  constructor() {
    this.sessionStore = new PostgresSessionStore({ 
      pool, 
      createTableIfMissing: true,
      tableName: 'session' 
    });
  }
  
  // Operação SQL Direta para contornar limitações do ORM
  async executeRawSQL(query: string, params?: any[]): Promise<any> {
    try {
      console.log(`Executando SQL direto: ${query} com parâmetros:`, params);
      const result = await pool.query(query, params);
      console.log(`Resultado SQL direto:`, result.rows);
      return result.rows;
    } catch (error) {
      console.error(`Erro ao executar SQL direto: ${query}`, error);
      throw error;
    }
  }

  // User Operations
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async updateUser(id: number, updates: Partial<User>): Promise<User | undefined> {
    const [updatedUser] = await db
      .update(users)
      .set(updates)
      .where(eq(users.id, id))
      .returning();
    return updatedUser;
  }

  async deleteUser(id: number): Promise<boolean> {
    const result = await db
      .delete(users)
      .where(eq(users.id, id))
      .returning({ id: users.id });
    return result.length > 0;
  }

  async getAllUsers(): Promise<User[]> {
    return db.select().from(users);
  }
  
  async updatePassword(id: number, oldPassword: string, newPassword: string, adminOverride: boolean = false): Promise<boolean> {
    // Get user
    const user = await this.getUser(id);
    if (!user) return false;
    
    // Import needed functions from auth.ts
    const { comparePasswords, hashPassword } = await import('./auth');
    
    // If not admin override, verify old password
    if (!adminOverride) {
      const passwordValid = await comparePasswords(oldPassword, user.password);
      if (!passwordValid) {
        return false;
      }
    }
    
    // Hash new password
    const hashedPassword = await hashPassword(newPassword);
    
    // Update password
    const [updatedUser] = await db
      .update(users)
      .set({ password: hashedPassword })
      .where(eq(users.id, id))
      .returning();
    
    return !!updatedUser;
  }

  // Location Operations
  async getLocation(id: number): Promise<Location | undefined> {
    const [location] = await db.select().from(locations).where(eq(locations.id, id));
    return location;
  }

  async createLocation(insertLocation: InsertLocation): Promise<Location> {
    const [location] = await db
      .insert(locations)
      .values(insertLocation)
      .returning();
    return location;
  }

  async updateLocation(id: number, updates: Partial<Location>): Promise<Location | undefined> {
    const [updatedLocation] = await db
      .update(locations)
      .set(updates)
      .where(eq(locations.id, id))
      .returning();
    return updatedLocation;
  }

  async deleteLocation(id: number): Promise<boolean> {
    const result = await db
      .delete(locations)
      .where(eq(locations.id, id))
      .returning({ id: locations.id });
    return result.length > 0;
  }

  async getAllLocations(): Promise<Location[]> {
    return db.select().from(locations);
  }

  // Room Operations
  async getRoom(id: number): Promise<Room | undefined> {
    const [room] = await db.select().from(rooms).where(eq(rooms.id, id));
    return room;
  }

  async getRoomsByLocation(locationId: number): Promise<Room[]> {
    return db.select().from(rooms).where(eq(rooms.locationId, locationId));
  }

  async createRoom(insertRoom: InsertRoom): Promise<Room> {
    const [room] = await db
      .insert(rooms)
      .values(insertRoom)
      .returning();
    return room;
  }

  async updateRoom(id: number, updates: Partial<Room>): Promise<Room | undefined> {
    const [updatedRoom] = await db
      .update(rooms)
      .set(updates)
      .where(eq(rooms.id, id))
      .returning();
    return updatedRoom;
  }

  async deleteRoom(id: number): Promise<boolean> {
    const result = await db
      .delete(rooms)
      .where(eq(rooms.id, id))
      .returning({ id: rooms.id });
    return result.length > 0;
  }

  async getAllRooms(): Promise<Room[]> {
    return db.select().from(rooms);
  }

  async getActiveRooms(): Promise<Room[]> {
    return db.select().from(rooms).where(eq(rooms.active, true));
  }

  // Appointment Operations
  async getAppointment(id: number): Promise<Appointment | undefined> {
    const [appointment] = await db.select().from(appointmentsTable).where(eq(appointmentsTable.id, id));
    
    // Verificar e corrigir explicitamente o mapeamento rejection_reason -> rejectionReason
    if (appointment) {
      // Se temos acesso direto ao rejection_reason mas não ao rejectionReason
      const rawResult = appointment as any;
      if (rawResult.rejection_reason !== undefined && appointment.rejectionReason === undefined) {
        (appointment as any).rejectionReason = rawResult.rejection_reason;
        console.log(`Mapeamento explícito: rejection_reason -> rejectionReason: ${rawResult.rejection_reason}`);
      }
    }
    
    return appointment;
  }

  async createAppointment(insertAppointment: InsertAppointment): Promise<Appointment> {
    // Get next order number if not provided
    if (!insertAppointment.orderNumber) {
      insertAppointment.orderNumber = await this.getNextAppointmentOrderNumber();
    }
    
    // Helper function to recursively process date strings
    const processDateStrings = (obj: any): any => {
      if (!obj || typeof obj !== 'object') return obj;
      
      // Process Arrays
      if (Array.isArray(obj)) {
        return obj.map(item => processDateStrings(item));
      }
      
      // Process Objects
      const result: any = {};
      
      for (const key in obj) {
        const value = obj[key];
        
        // If it's a date-like string, convert it to Date
        if (typeof value === 'string' && 
            /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/.test(value)) {
          result[key] = new Date(value);
        }
        // If it's a nested object, process it recursively
        else if (value && typeof value === 'object') {
          result[key] = processDateStrings(value);
        }
        // Otherwise, keep the original value
        else {
          result[key] = value;
        }
      }
      
      return result;
    };
    
    // Create a clean copy with dates properly processed
    const processedAppointment = processDateStrings({ ...insertAppointment });
    
    // Don't use processedAppointment which might lose date values in processing
    const startTimeInput = insertAppointment.startTime;
    const endTimeInput = insertAppointment.endTime;
    
    console.log("Original startTime type:", typeof startTimeInput, startTimeInput);
    console.log("Original endTime type:", typeof endTimeInput, endTimeInput);
    
    // Handle startTime - directly update the object we're going to insert
    if (!startTimeInput) {
      throw new Error("startTime is required");
    }
    
    try {
      // If it's already a valid Date object
      if (startTimeInput instanceof Date && !isNaN(startTimeInput.getTime())) {
        processedAppointment.startTime = startTimeInput;
        console.log("Using Date object startTime:", processedAppointment.startTime);
      } 
      // If it's a string, parse it
      else if (typeof startTimeInput === 'string') {
        const parsedDate = new Date(startTimeInput);
        if (!isNaN(parsedDate.getTime())) {
          processedAppointment.startTime = parsedDate;
          console.log("Parsed startTime to Date:", processedAppointment.startTime);
        } else {
          throw new Error(`Invalid startTime format: ${startTimeInput}`);
        }
      } else {
        throw new Error(`startTime must be a valid date string or Date object, got ${typeof startTimeInput}`);
      }
    } catch (e: any) {
      console.error("Error processing startTime:", e);
      throw new Error(`Failed to process startTime: ${e?.message || "Unknown error"}`);
    }
    
    // Handle endTime - directly update the object we're going to insert
    if (!endTimeInput) {
      throw new Error("endTime is required");
    }
    
    try {
      // If it's already a valid Date object
      if (endTimeInput instanceof Date && !isNaN(endTimeInput.getTime())) {
        processedAppointment.endTime = endTimeInput;
        console.log("Using Date object endTime:", processedAppointment.endTime);
      } 
      // If it's a string, parse it
      else if (typeof endTimeInput === 'string') {
        const parsedDate = new Date(endTimeInput);
        if (!isNaN(parsedDate.getTime())) {
          processedAppointment.endTime = parsedDate;
          console.log("Parsed endTime to Date:", processedAppointment.endTime);
        } else {
          throw new Error(`Invalid endTime format: ${endTimeInput}`);
        }
      } else {
        throw new Error(`endTime must be a valid date string or Date object, got ${typeof endTimeInput}`);
      }
    } catch (e: any) {
      console.error("Error processing endTime:", e);
      throw new Error(`Failed to process endTime: ${e?.message || "Unknown error"}`);
    }
    
    // Force check that startTime and endTime are valid Date objects before proceeding
    if (!(processedAppointment.startTime instanceof Date) || isNaN(processedAppointment.startTime.getTime())) {
      throw new Error("Failed to convert startTime to a valid Date object");
    }
    
    if (!(processedAppointment.endTime instanceof Date) || isNaN(processedAppointment.endTime.getTime())) {
      throw new Error("Failed to convert endTime to a valid Date object");
    }
    
    // Log the processed appointment for debugging
    console.log("Storage: createAppointment with processed data:", JSON.stringify(processedAppointment, (key, value) => {
      if (value instanceof Date) {
        return value.toISOString();
      }
      return value;
    }));

    const [appointment] = await db
      .insert(appointmentsTable)
      .values(processedAppointment)
      .returning();
    
    // Create audit log for creation
    if (appointment && processedAppointment.userId) {
      await this.createAuditLog({
        appointmentId: appointment.id,
        userId: processedAppointment.userId,
        action: 'create',
        oldData: null,
        newData: appointment
      });
    }
    
    return appointment;
  }

  async updateAppointment(id: number, updates: Partial<Appointment>): Promise<Appointment | undefined> {
    console.log(`StorageDebug: updateAppointment for ID ${id} with data:`, JSON.stringify(updates, null, 2));
    
    // Get the original appointment for audit purposes
    const originalAppointment = await this.getAppointment(id);
    if (!originalAppointment) return undefined;
    
    // Deep clone the original data for comparison
    const originalForComparison = JSON.parse(JSON.stringify(originalAppointment));
    
    // FOCO PRINCIPAL: tratar explicitamente a rejeição
    if (updates.status === 'rejected') {
      console.log(`StorageDebug: Rejection detected with reason:`, updates.rejectionReason);
      
      // Verificar se o motivo de rejeição está definido
      if (updates.rejectionReason) {
        console.log(`StorageDebug: Rejection reason is set to "${updates.rejectionReason}"`);
      } else {
        console.log(`StorageDebug: Rejection reason is not set!`);
      }
    }
    
    // Create a more detailed audit trail by collecting field changes and their values
    const fieldChanges: Record<string, { oldValue: any, newValue: any }> = {};
    
    // Create an object for updating the database com todos os campos
    const finalData: Record<string, any> = {};
    
    // Adicionar cada campo do update manualmente no finalData para maior controle
    Object.entries(updates).forEach(([key, value]) => {
      // Não copiar campos de timestamps
      if (key !== 'createdAt' && key !== 'updatedAt') {
        // Caso especial para datas
        if (key === 'startTime' || key === 'endTime') {
          if (value instanceof Date && !isNaN(value.getTime())) {
            finalData[key] = value;
          } else if (value) {
            try {
              const parsedDate = new Date(value as any);
              if (!isNaN(parsedDate.getTime())) {
                finalData[key] = parsedDate;
              } else {
                finalData[key] = originalAppointment[key as keyof Appointment];
              }
            } catch (e) {
              finalData[key] = originalAppointment[key as keyof Appointment];
            }
          }
        } 
        // Caso especial para rejectionReason - CRUCIAL PARA RESOLVER O PROBLEMA
        else if (key === 'rejectionReason') {
          console.log("StorageDebug: Processando campo rejectionReason:", value);
          finalData.rejection_reason = value; // Crucial: usar o nome da coluna SQL
        } 
        // Todos os outros campos
        else {
          finalData[key] = value;
        }
      }
    });
    
    // Sempre definir updatedAt
    finalData.updatedAt = new Date();
    
    // Logs detalhados para verificar os dados que serão enviados
    console.log("StorageDebug: finalData para update:", JSON.stringify(finalData, null, 2));
    
    // Verificando especificamente o campo rejectionReason/rejection_reason
    console.log("StorageDebug: rejection_reason incluído?", 
      finalData.rejection_reason !== undefined ? `Sim: "${finalData.rejection_reason}"` : "Não");
    
    try {
      // Executar a atualização no banco de dados
      const [updatedAppointment] = await db
        .update(appointmentsTable)
        .set(finalData)
        .where(eq(appointmentsTable.id, id))
        .returning();
      
      // Verificar o resultado imediatamente e fazer log
      console.log("StorageDebug: Resultado bruto do update:", JSON.stringify(updatedAppointment, null, 2));
      
      // Importante: mapear o campo snake_case para camelCase no resultado
      if (updatedAppointment && updatedAppointment.rejection_reason !== undefined) {
        console.log("StorageDebug: Mapeando rejection_reason para rejectionReason:", updatedAppointment.rejection_reason);
        (updatedAppointment as any).rejectionReason = updatedAppointment.rejection_reason;
      }
      
      // Log do appointment atualizado após mapping
      console.log("StorageDebug: Appointment após mapping:", JSON.stringify(updatedAppointment, null, 2));
      
      // Criar log de auditoria
      if (updatedAppointment) {
        // Usar userId do update ou do appointment original
        const userId = updates.userId || originalAppointment.userId;
        
        // Obter cópia limpa para comparação
        const newForComparison = JSON.parse(JSON.stringify(updatedAppointment));
        
        // Determinar campos alterados
        const changedFields: string[] = [];
        
        // Verificar todos os campos
        const allFields = new Set([
          ...Object.keys(originalForComparison),
          ...Object.keys(newForComparison)
        ]);
        
        allFields.forEach(key => {
          // Ignorar campos de sistema na comparação
          if (key === 'updatedAt' || key === 'createdAt' || key === 'userId') return;
          
          // Comparar usando representações em string
          const oldValue = JSON.stringify(originalForComparison[key]);
          const newValue = JSON.stringify(newForComparison[key]);
          
          // Verificar mudanças
          if (oldValue !== newValue) {
            changedFields.push(key);
            
            // Armazenar valores para cada campo alterado
            fieldChanges[key] = {
              oldValue: originalForComparison[key],
              newValue: newForComparison[key]
            };
          }
        });
        
        // Criar log de auditoria apenas se houver mudanças
        if (changedFields.length > 0) {
          await this.createAuditLog({
            appointmentId: updatedAppointment.id,
            userId: userId,
            action: 'update',
            oldData: originalAppointment,
            newData: updatedAppointment,
            changedFields: changedFields,
            details: fieldChanges
          });
          
          console.log(`Audit log criado para appointment ${id}. Campos alterados: ${changedFields.join(', ')}`);
        } else {
          console.log(`Nenhuma alteração detectada para appointment ${id}, log de auditoria não criado`);
        }
      }
      
      return updatedAppointment;
    } catch (error) {
      console.error("StorageDebug: Erro ao atualizar appointment:", error);
      throw error;
    }
  }

  async deleteAppointment(id: number, userId?: number): Promise<boolean> {
    // Get the original appointment for audit purposes
    const originalAppointment = await this.getAppointment(id);
    if (!originalAppointment) return false;

    const result = await db
      .delete(appointmentsTable)
      .where(eq(appointmentsTable.id, id))
      .returning({ id: appointmentsTable.id });
    
    // Create audit log for deletion if user ID is provided
    if (result.length > 0 && userId) {
      await this.createAuditLog({
        appointmentId: id,
        userId: userId,
        action: 'delete',
        oldData: originalAppointment,
        newData: null
      });
    }

    return result.length > 0;
  }

  // Função auxiliar para mapear os campos snake_case -> camelCase nos resultados
  private mapAppointmentResults(appointmentList: Appointment[]): Appointment[] {
    if (appointmentList?.length > 0) {
      appointmentList.forEach(appointment => {
        const rawResult = appointment as any;
        if (rawResult.rejection_reason !== undefined && appointment.rejectionReason === undefined) {
          (appointment as any).rejectionReason = rawResult.rejection_reason;
        }
      });
    }
    return appointmentList;
  }

  async getAppointmentsByUser(userId: number): Promise<Appointment[]> {
    const results = await db.select().from(appointmentsTable).where(eq(appointmentsTable.userId, userId));
    return this.mapAppointmentResults(results);
  }

  async getAppointmentsByRoom(roomId: number): Promise<Appointment[]> {
    const results = await db.select().from(appointmentsTable).where(eq(appointmentsTable.roomId, roomId));
    return this.mapAppointmentResults(results);
  }

  async getAppointmentsByDateRange(startDate: Date, endDate: Date): Promise<Appointment[]> {
    const results = await db.select().from(appointmentsTable).where(
      and(
        gte(appointmentsTable.startTime, startDate),
        lte(appointmentsTable.startTime, endDate)
      )
    );
    return this.mapAppointmentResults(results);
  }

  async getAppointmentsByStatus(status: string): Promise<Appointment[]> {
    // Use a type assertion to handle the PgEnumColumn type
    const results = await db.select().from(appointmentsTable).where(
      eq(appointmentsTable.status as any, status)
    );
    return this.mapAppointmentResults(results);
  }

  async getAllAppointments(): Promise<Appointment[]> {
    const results = await db.select().from(appointmentsTable).orderBy(desc(appointmentsTable.startTime));
    return this.mapAppointmentResults(results);
  }

  async getRecentAppointments(limit: number): Promise<Appointment[]> {
    const results = await db.select().from(appointmentsTable)
      .orderBy(desc(appointmentsTable.createdAt))
      .limit(limit);
    return this.mapAppointmentResults(results);
  }

  async getNextAppointmentOrderNumber(): Promise<number> {
    const result = await db.select({
      maxOrderNumber: sql<number>`COALESCE(MAX(${appointmentsTable.orderNumber}), 0)`
    }).from(appointmentsTable);
    
    return (result[0]?.maxOrderNumber || 0) + 1;
  }

  // Audit Log Operations
  async createAuditLog(insertAuditLog: InsertAuditLog): Promise<AuditLog> {
    const [auditLog] = await db
      .insert(auditLogs)
      .values(insertAuditLog)
      .returning();
    return auditLog;
  }

  async getAuditLogsByAppointment(appointmentId: number): Promise<AuditLog[]> {
    // Join with users table to get the username
    const result = await db.select({
      id: auditLogs.id,
      appointmentId: auditLogs.appointmentId,
      userId: auditLogs.userId,
      action: auditLogs.action,
      oldData: auditLogs.oldData,
      newData: auditLogs.newData,
      changedFields: auditLogs.changedFields,
      details: auditLogs.details,
      createdAt: auditLogs.createdAt,
      username: users.username
    })
    .from(auditLogs)
    .leftJoin(users, eq(auditLogs.userId, users.id))
    .where(eq(auditLogs.appointmentId, appointmentId))
    .orderBy(desc(auditLogs.createdAt));
    
    // Transform the result for the frontend
    const transformedResult = result.map(log => {
      // Parse JSON strings for oldData and newData if they exist
      let parsedOldData = null;
      let parsedNewData = null;
      
      if (log.oldData) {
        try {
          if (typeof log.oldData === 'string') {
            parsedOldData = JSON.parse(log.oldData);
          } else {
            parsedOldData = log.oldData;
          }
        } catch (e) {
          console.error('Error parsing oldData:', e);
        }
      }
      
      if (log.newData) {
        try {
          if (typeof log.newData === 'string') {
            parsedNewData = JSON.parse(log.newData);
          } else {
            parsedNewData = log.newData;
          }
        } catch (e) {
          console.error('Error parsing newData:', e);
        }
      }
      
      return {
        ...log,
        oldData: parsedOldData,
        newData: parsedNewData,
        actionType: log.action, // For compatibility with frontend
        timestamp: log.createdAt // For compatibility with frontend
      };
    });
    
    return transformedResult as unknown as AuditLog[];
  }

  // Settings Operations
  async getSetting(key: string): Promise<Setting | undefined> {
    const [setting] = await db.select().from(settings).where(eq(settings.key, key));
    return setting;
  }

  async createOrUpdateSetting(key: string, value: any): Promise<Setting> {
    // Ensure value is not null or undefined
    if (value === null || value === undefined) {
      value = {}; // Default to empty object if value is null or undefined
    }
    
    // Log the incoming value with type information
    console.log(`Storage: createOrUpdateSetting ${key}, value type: ${typeof value}`);
    console.log(`Storage: createOrUpdateSetting ${key}, keys:`, typeof value === 'object' ? Object.keys(value) : 'not an object');
    console.log(`Storage: value stringified:`, JSON.stringify(value));
    
    // Force the data if needed for testing - ONLY FOR TESTING, remove in production
    if (key === 'email' && (typeof value !== 'object' || Object.keys(value).length === 0)) {
      console.log("Forcing email settings data for testing");
      value = {
        enabled: true,
        mailjetApiKey: "test-key",
        mailjetSecretKey: "test-secret",
        systemEmail: "test@example.com",
        systemName: "ACRDSC Reservas",
        notifyOnCreate: true,
        notifyOnUpdate: true,
        notifyOnStatusChange: true,
        emailTemplateBookingCreated: "Template Created",
        emailTemplateBookingUpdated: "Template Updated",
        emailTemplateBookingStatusChanged: "Template Status Changed"
      };
    }
    
    // For debugging
    console.log(`Creating/updating setting ${key} with value:`, JSON.stringify(value, null, 2));
    
    try {
      // Try to update
      const [updatedSetting] = await db
        .update(settings)
        .set({ value, updatedAt: new Date() })
        .where(eq(settings.key, key))
        .returning();
      
      if (updatedSetting) {
        return updatedSetting;
      }
      
      // If no rows were updated, insert a new one
      const [newSetting] = await db
        .insert(settings)
        .values({ key, value })
        .returning();
      
      return newSetting;
    } catch (error) {
      console.error(`Error in createOrUpdateSetting for key ${key}:`, error);
      throw error;
    }
  }

  async getAllSettings(): Promise<Setting[]> {
    return db.select().from(settings);
  }

  // Room Utilization
  async getRoomUtilization(roomId: number, startDate: Date, endDate: Date): Promise<number> {
    // Get all approved appointments for this room in date range
    const roomAppointments = await db.select({
      startTime: appointmentsTable.startTime,
      endTime: appointmentsTable.endTime
    }).from(appointmentsTable).where(
      and(
        eq(appointmentsTable.roomId, roomId),
        eq(appointmentsTable.status as any, 'approved'),
        gte(appointmentsTable.startTime, startDate),
        lte(appointmentsTable.endTime, endDate)
      )
    );
    
    // Calculate total booked time in milliseconds
    let totalBookedTime = 0;
    for (const appt of roomAppointments) {
      totalBookedTime += appt.endTime.getTime() - appt.startTime.getTime();
    }
    
    // Calculate total available time in the date range
    const totalAvailableTime = endDate.getTime() - startDate.getTime();
    
    // Calculate utilization percentage
    return totalAvailableTime > 0 ? (totalBookedTime / totalAvailableTime) * 100 : 0;
  }

  async getOverallUtilization(startDate: Date, endDate: Date): Promise<{roomId: number, utilization: number}[]> {
    const allRooms = await this.getActiveRooms();
    const result = [];
    
    for (const room of allRooms) {
      const utilization = await this.getRoomUtilization(room.id, startDate, endDate);
      result.push({
        roomId: room.id,
        utilization
      });
    }
    
    return result;
  }
}

export const storage = new DatabaseStorage();
