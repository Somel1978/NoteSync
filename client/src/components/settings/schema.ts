import { z } from "zod";

// Form schemas
export const profileSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  username: z.string().min(3, "Username must be at least 3 characters"),
  email: z.string().email("Please enter a valid email address"),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(6, "Password must be at least 6 characters"),
  newPassword: z.string().min(6, "Password must be at least 6 characters"),
  confirmNewPassword: z.string(),
}).refine(data => data.newPassword === data.confirmNewPassword, {
  message: "Passwords do not match",
  path: ["confirmNewPassword"],
});

export const newUserSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  username: z.string().min(3, "Username must be at least 3 characters"),
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.enum(["admin", "director", "guest"])
});

export const emailSettingsSchema = z.object({
  enabled: z.boolean().default(false),
  mailjetApiKey: z.string().min(1, "API Key is required"),
  mailjetSecretKey: z.string().min(1, "Secret Key is required"),
  systemEmail: z.string().email("Please enter a valid email address"),
  systemName: z.string().min(1, "System Name is required"),
  notifyOnCreate: z.boolean().default(true),
  notifyOnUpdate: z.boolean().default(true),
  notifyOnStatusChange: z.boolean().default(true),
  emailTemplateBookingCreated: z.string().optional(),
  emailTemplateBookingUpdated: z.string().optional(),
  emailTemplateBookingStatusChanged: z.string().optional()
});

export const appearanceSettingsSchema = z.object({
  logoText: z.string().min(1, "Logo text is required").max(2, "Logo text must be at most 2 characters"),
  logoUrl: z.string().nullable(),
  useLogoImage: z.boolean().default(false),
  title: z.string().min(1, "Title is required").max(20, "Title must be at most 20 characters"),
  subtitle: z.string().min(1, "Subtitle is required").max(20, "Subtitle must be at most 20 characters")
});

export type ProfileFormValues = z.infer<typeof profileSchema>;
export type ChangePasswordFormValues = z.infer<typeof changePasswordSchema>;
export type NewUserFormValues = z.infer<typeof newUserSchema>;
export type EmailSettingsFormValues = z.infer<typeof emailSettingsSchema>;
export type AppearanceSettingsFormValues = z.infer<typeof appearanceSettingsSchema>;