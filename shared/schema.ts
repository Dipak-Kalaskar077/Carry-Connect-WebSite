import { pgTable, text, serial, integer, boolean, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Define package size enum
export const packageSizeEnum = pgEnum('package_size', ['small', 'medium', 'large']);

// Define delivery status enum
export const deliveryStatusEnum = pgEnum('delivery_status', ['requested', 'accepted', 'picked', 'delivered']);

// Define user roles enum
export const userRoleEnum = pgEnum('user_role', ['sender', 'carrier', 'both']);

// Users table
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  fullName: text("full_name").notNull(),
  role: userRoleEnum("role").notNull().default('both'),
  rating: integer("rating"),
  totalReviews: integer("total_reviews").default(0),
});

// Deliveries table
export const deliveries = pgTable("deliveries", {
  id: serial("id").primaryKey(),
  senderId: integer("sender_id").references(() => users.id).notNull(),
  carrierId: integer("carrier_id").references(() => users.id),
  pickupLocation: text("pickup_location").notNull(),
  dropLocation: text("drop_location").notNull(),
  packageSize: packageSizeEnum("package_size").notNull(),
  packageWeight: integer("package_weight").notNull(), // weight in grams
  description: text("description"),
  specialInstructions: text("special_instructions"),
  preferredDeliveryDate: text("preferred_delivery_date").notNull(),
  preferredDeliveryTime: text("preferred_delivery_time").notNull(),
  status: deliveryStatusEnum("status").notNull().default('requested'),
  deliveryFee: integer("delivery_fee").notNull(), // fee in cents
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Reviews table
export const reviews = pgTable("reviews", {
  id: serial("id").primaryKey(),
  deliveryId: integer("delivery_id").references(() => deliveries.id).notNull(),
  reviewerId: integer("reviewer_id").references(() => users.id).notNull(),
  revieweeId: integer("reviewee_id").references(() => users.id).notNull(),
  rating: integer("rating").notNull(),
  comment: text("comment"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Create Zod schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  rating: true,
  totalReviews: true,
});

export const insertDeliverySchema = createInsertSchema(deliveries).omit({
  id: true,
  carrierId: true,
  status: true,
  createdAt: true,
});

export const insertReviewSchema = createInsertSchema(reviews).omit({
  id: true,
  createdAt: true,
});

// Location schema for form validation
export const locationSchema = z.object({
  name: z.string().min(1, "Location is required"),
});

// Extended schema for create delivery form
export const createDeliverySchema = insertDeliverySchema.extend({
  packageWeight: z.number().min(1, "Weight must be at least 1 gram"),
  deliveryFee: z.number().min(1, "Fee must be at least 1 cent"),
  pickupLocation: z.string().min(1, "Pickup location is required"),
  dropLocation: z.string().min(1, "Drop location is required"),
  packageSize: z.enum(["small", "medium", "large"]),
});

// Define types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Delivery = typeof deliveries.$inferSelect;
export type InsertDelivery = z.infer<typeof insertDeliverySchema>;
export type Review = typeof reviews.$inferSelect;
export type InsertReview = z.infer<typeof insertReviewSchema>;

// Define new types for delivery with sender/carrier info
export type DeliveryWithUser = Delivery & {
  sender: User;
  carrier?: User;
};

export type CreateDeliveryInput = z.infer<typeof createDeliverySchema>;
