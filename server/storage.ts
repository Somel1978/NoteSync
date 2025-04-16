import { users, rooms, locations, appointments, auditLogs, settings, type User, type InsertUser, type Room, type InsertRoom, type Location, type InsertLocation, type Appointment, type InsertAppointment, type AuditLog, type InsertAuditLog, type Setting, type InsertSetting } from "@shared/schema";
import { db } from "./db";
import { eq, and, gte, lte, desc, sql } from "drizzle-orm";
import connectPg from "connect-pg-simple";
import session from "express-session";
import { pool } from "./db";

const PostgresSessionStore = connectPg(session);

export interface IStorage {
  // User Operations
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, updates: Partial<User>): Promise<User | undefined>;
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
  deleteAppointment(id: number): Promise<boolean>;
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
  sessionStore: session.SessionStore;
}

export class DatabaseStorage implements IStorage {
  sessionStore: session.SessionStore;

  constructor() {
    this.sessionStore = new PostgresSessionStore({ 
      pool, 
      createTableIfMissing: true,
      tableName: 'session' 
    });
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
    const [appointment] = await db.select().from(appointments).where(eq(appointments.id, id));
    return appointment;
  }

  async createAppointment(insertAppointment: InsertAppointment): Promise<Appointment> {
    const [appointment] = await db
      .insert(appointments)
      .values(insertAppointment)
      .returning();
    return appointment;
  }

  async updateAppointment(id: number, updates: Partial<Appointment>): Promise<Appointment | undefined> {
    const [updatedAppointment] = await db
      .update(appointments)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(appointments.id, id))
      .returning();
    return updatedAppointment;
  }

  async deleteAppointment(id: number): Promise<boolean> {
    const result = await db
      .delete(appointments)
      .where(eq(appointments.id, id))
      .returning({ id: appointments.id });
    return result.length > 0;
  }

  async getAppointmentsByUser(userId: number): Promise<Appointment[]> {
    return db.select().from(appointments).where(eq(appointments.userId, userId));
  }

  async getAppointmentsByRoom(roomId: number): Promise<Appointment[]> {
    return db.select().from(appointments).where(eq(appointments.roomId, roomId));
  }

  async getAppointmentsByDateRange(startDate: Date, endDate: Date): Promise<Appointment[]> {
    return db.select().from(appointments).where(
      and(
        gte(appointments.startTime, startDate),
        lte(appointments.startTime, endDate)
      )
    );
  }

  async getAppointmentsByStatus(status: string): Promise<Appointment[]> {
    return db.select().from(appointments).where(eq(appointments.status, status));
  }

  async getAllAppointments(): Promise<Appointment[]> {
    return db.select().from(appointments).orderBy(desc(appointments.startTime));
  }

  async getRecentAppointments(limit: number): Promise<Appointment[]> {
    return db.select().from(appointments)
      .orderBy(desc(appointments.createdAt))
      .limit(limit);
  }

  async getNextAppointmentOrderNumber(): Promise<number> {
    const result = await db.select({
      maxOrderNumber: sql<number>`COALESCE(MAX(${appointments.orderNumber}), 0)`
    }).from(appointments);
    
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
    return db.select().from(auditLogs)
      .where(eq(auditLogs.appointmentId, appointmentId))
      .orderBy(desc(auditLogs.createdAt));
  }

  // Settings Operations
  async getSetting(key: string): Promise<Setting | undefined> {
    const [setting] = await db.select().from(settings).where(eq(settings.key, key));
    return setting;
  }

  async createOrUpdateSetting(key: string, value: any): Promise<Setting> {
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
  }

  async getAllSettings(): Promise<Setting[]> {
    return db.select().from(settings);
  }

  // Room Utilization
  async getRoomUtilization(roomId: number, startDate: Date, endDate: Date): Promise<number> {
    // Get all approved appointments for this room in date range
    const roomAppointments = await db.select({
      startTime: appointments.startTime,
      endTime: appointments.endTime
    }).from(appointments).where(
      and(
        eq(appointments.roomId, roomId),
        eq(appointments.status, 'approved'),
        gte(appointments.startTime, startDate),
        lte(appointments.endTime, endDate)
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
