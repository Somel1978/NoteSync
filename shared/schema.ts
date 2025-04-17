import { pgTable, text, serial, integer, boolean, timestamp, json, pgEnum, doublePrecision } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// User roles enum
export const userRoleEnum = pgEnum('user_role', ['admin', 'director', 'guest']);

// Users and Authentication
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email").notNull(),
  name: text("name").notNull(),
  role: text("role").notNull().default("guest"), // Default to guest role
  deletionRequested: boolean("deletion_requested").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  email: true,
  name: true,
  role: true,
});

// Locations (buildings or areas)
export const locations = pgTable("locations", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  latitude: doublePrecision("latitude"),
  longitude: doublePrecision("longitude"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertLocationSchema = createInsertSchema(locations).pick({
  name: true,
  description: true,
  latitude: true,
  longitude: true,
});

// Rooms
export const rooms = pgTable("rooms", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  locationId: integer("location_id").notNull(),
  description: text("description"),
  capacity: integer("capacity").notNull(),
  flatRate: integer("flat_rate"),  // Stored in cents
  hourlyRate: integer("hourly_rate"),  // Stored in cents
  attendeeRate: integer("attendee_rate"),  // Stored in cents
  facilities: json("facilities").notNull().default([]),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertRoomSchema = createInsertSchema(rooms).pick({
  name: true,
  locationId: true,
  description: true,
  capacity: true,
  flatRate: true,
  hourlyRate: true,
  attendeeRate: true,
  facilities: true,
  active: true,
});

// Statuses for appointments
export const appointmentStatusEnum = pgEnum('appointment_status', ['pending', 'approved', 'rejected', 'cancelled']);

// Appointments/Bookings
export const appointments = pgTable("appointments", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(), // Event Name
  roomId: integer("room_id").notNull(), // Primary room ID (kept for backwards compatibility)
  rooms: json("rooms").notNull().default([]), // Array of rooms with their specific settings
  userId: integer("user_id").notNull(),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time").notNull(),
  status: appointmentStatusEnum("status").notNull().default('pending'),
  purpose: text("purpose"),
  description: text("description"), // Detailed description of the appointment
  customerName: text("customer_name").notNull(),
  customerEmail: text("customer_email").notNull(),
  customerPhone: text("customer_phone"),
  customerOrganization: text("customer_organization"), // Customer's organization/company
  notes: text("notes"), // Additional notes about the customer or booking
  membershipNumber: text("membership_number"), // Added membership number
  attendeesCount: integer("attendees_count").notNull(),
  requestedFacilities: json("requested_facilities").notNull().default([]),
  costType: text("cost_type").notNull(), // flat, hourly, or per_attendee
  agreedCost: integer("agreed_cost").notNull(), // Stored in cents
  costBreakdown: json("cost_breakdown").notNull().default({}),
  orderNumber: integer("order_number").notNull(),
  rejectionReason: text("rejection_reason"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertAppointmentSchema = createInsertSchema(appointments).pick({
  title: true,
  roomId: true,
  rooms: true,
  userId: true,
  startTime: true,
  endTime: true,
  status: true,
  purpose: true,
  description: true,
  customerName: true,
  customerEmail: true,
  customerPhone: true,
  customerOrganization: true,
  notes: true,
  membershipNumber: true,
  attendeesCount: true,
  requestedFacilities: true,
  costType: true,
  agreedCost: true,
  costBreakdown: true,
  orderNumber: true,
  rejectionReason: true,
});

// Appointment Audit Logs
export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  appointmentId: integer("appointment_id").notNull(),
  userId: integer("user_id").notNull(),
  action: text("action").notNull(),
  oldData: json("old_data"),
  newData: json("new_data"),
  changedFields: json("changed_fields").default([]),
  details: json("details").default({}),  // Add a details field to store each field's change info
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertAuditLogSchema = createInsertSchema(auditLogs).pick({
  appointmentId: true,
  userId: true,
  action: true,
  oldData: true,
  newData: true,
  changedFields: true,
  details: true,
});

// Settings
export const settings = pgTable("settings", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: json("value").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertSettingSchema = createInsertSchema(settings).pick({
  key: true,
  value: true,
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Location = typeof locations.$inferSelect;
export type InsertLocation = z.infer<typeof insertLocationSchema>;

export type Room = typeof rooms.$inferSelect;
export type InsertRoom = z.infer<typeof insertRoomSchema>;

export type Appointment = typeof appointments.$inferSelect;
export type InsertAppointment = z.infer<typeof insertAppointmentSchema>;

export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;

export type Setting = typeof settings.$inferSelect;
export type InsertSetting = z.infer<typeof insertSettingSchema>;

// Facility type
export type Facility = {
  id: string;
  name: string;
  cost: number;
};

// Room booking type for storing room-specific details in appointments
export type RoomBooking = {
  roomId: number;
  roomName: string;
  requestedFacilities: string[];
  costType: 'flat' | 'hourly' | 'per_attendee';
  cost: number; // In cents
};
