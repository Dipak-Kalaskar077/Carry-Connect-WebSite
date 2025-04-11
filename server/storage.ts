import { users, deliveries, reviews, type User, type InsertUser, type Delivery, 
  type InsertDelivery, type Review, type InsertReview, type DeliveryWithUser } from "@shared/schema";
import { db } from "./db";
import { eq, and, or, desc, sql } from "drizzle-orm";
import createMemoryStore from "memorystore";
import session from "express-session";

const MemoryStore = createMemoryStore(session);

// Define storage interface
export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getUserProfile(userId: number): Promise<Partial<User> | undefined>;
  
  // Delivery methods
  getDeliveriesWithFilters(filters: Record<string, any>): Promise<DeliveryWithUser[]>;
  getDeliveryById(id: number): Promise<Delivery | undefined>;
  createDelivery(delivery: InsertDelivery): Promise<Delivery>;
  updateDeliveryStatus(id: number, status: string, carrierId?: number): Promise<Delivery | undefined>;
  getSenderDeliveries(userId: number): Promise<DeliveryWithUser[]>;
  getCarrierDeliveries(userId: number): Promise<DeliveryWithUser[]>;
  
  // Review methods
  createReview(review: InsertReview): Promise<Review>;
  getUserReviews(userId: number): Promise<(Review & { reviewer: Partial<User> })[]>;
  getReviewByDeliveryAndReviewer(deliveryId: number, reviewerId: number): Promise<Review | undefined>;
  
  // Session store
  sessionStore: session.Store;
}

export class DatabaseStorage implements IStorage {
  sessionStore: session.Store;
  
  constructor() {
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000, // prune expired entries every 24h
    });
  }
  
  // User methods
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
  
  async getUserProfile(userId: number): Promise<Partial<User> | undefined> {
    const [user] = await db
      .select({
        id: users.id,
        username: users.username,
        fullName: users.fullName,
        role: users.role,
        rating: users.rating,
        totalReviews: users.totalReviews,
      })
      .from(users)
      .where(eq(users.id, userId));
      
    return user;
  }
  
  // Delivery methods
  async getDeliveriesWithFilters(filters: Record<string, any>): Promise<DeliveryWithUser[]> {
    let query = db
      .select({
        delivery: deliveries,
        sender: {
          id: users.id,
          username: users.username,
          fullName: users.fullName,
          rating: users.rating,
          totalReviews: users.totalReviews,
        },
      })
      .from(deliveries)
      .leftJoin(users, eq(deliveries.senderId, users.id))
      .orderBy(desc(deliveries.createdAt));
    
    // Apply filters
    const conditions = [];
    
    if (filters.status) {
      conditions.push(eq(deliveries.status, filters.status));
    }
    
    if (filters.pickupLocation) {
      conditions.push(eq(deliveries.pickupLocation, filters.pickupLocation));
    }
    
    if (filters.dropLocation) {
      conditions.push(eq(deliveries.dropLocation, filters.dropLocation));
    }
    
    if (filters.packageSize) {
      conditions.push(eq(deliveries.packageSize, filters.packageSize));
    }
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }
    
    const results = await query;
    
    // Format results to match DeliveryWithUser type
    return results.map(({ delivery, sender }) => ({
      ...delivery,
      sender,
    }));
  }
  
  async getDeliveryById(id: number): Promise<Delivery | undefined> {
    const [delivery] = await db
      .select()
      .from(deliveries)
      .where(eq(deliveries.id, id));
      
    return delivery;
  }
  
  async createDelivery(delivery: InsertDelivery): Promise<Delivery> {
    const [createdDelivery] = await db
      .insert(deliveries)
      .values(delivery)
      .returning();
      
    return createdDelivery;
  }
  
  async updateDeliveryStatus(id: number, status: string, carrierId?: number): Promise<Delivery | undefined> {
    const updateValues: Partial<Delivery> = { status: status as any };
    
    if (carrierId) {
      updateValues.carrierId = carrierId;
    }
    
    const [updatedDelivery] = await db
      .update(deliveries)
      .set(updateValues)
      .where(eq(deliveries.id, id))
      .returning();
      
    return updatedDelivery;
  }
  
  async getSenderDeliveries(userId: number): Promise<DeliveryWithUser[]> {
    const results = await db
      .select({
        delivery: deliveries,
        carrier: {
          id: users.id,
          username: users.username,
          fullName: users.fullName,
          rating: users.rating,
          totalReviews: users.totalReviews,
        },
      })
      .from(deliveries)
      .leftJoin(users, eq(deliveries.carrierId, users.id))
      .where(eq(deliveries.senderId, userId))
      .orderBy(desc(deliveries.createdAt));
      
    // Sender deliveries already have the sender, so we just need to add the carrier
    return results.map(({ delivery, carrier }) => ({
      ...delivery,
      sender: { id: userId } as User, // Set minimal sender info
      carrier: carrier?.id ? carrier : undefined,
    }));
  }
  
  async getCarrierDeliveries(userId: number): Promise<DeliveryWithUser[]> {
    const results = await db
      .select({
        delivery: deliveries,
        sender: {
          id: users.id,
          username: users.username,
          fullName: users.fullName,
          rating: users.rating,
          totalReviews: users.totalReviews,
        },
      })
      .from(deliveries)
      .leftJoin(users, eq(deliveries.senderId, users.id))
      .where(eq(deliveries.carrierId, userId))
      .orderBy(desc(deliveries.createdAt));
      
    // Format results to match DeliveryWithUser type
    return results.map(({ delivery, sender }) => ({
      ...delivery,
      sender,
      carrier: { id: userId } as User, // Set minimal carrier info
    }));
  }
  
  // Review methods
  async createReview(review: InsertReview): Promise<Review> {
    // Start a transaction to create review and update user rating
    const [createdReview] = await db.transaction(async (tx) => {
      // Create the review
      const [newReview] = await tx
        .insert(reviews)
        .values(review)
        .returning();
      
      // Update the reviewee's rating
      await this.updateUserRating(tx, review.revieweeId);
      
      return [newReview];
    });
    
    return createdReview;
  }
  
  async getUserReviews(userId: number): Promise<(Review & { reviewer: Partial<User> })[]> {
    const reviewsWithReviewers = await db
      .select({
        review: reviews,
        reviewer: {
          id: users.id,
          username: users.username,
          fullName: users.fullName,
        },
      })
      .from(reviews)
      .leftJoin(users, eq(reviews.reviewerId, users.id))
      .where(eq(reviews.revieweeId, userId))
      .orderBy(desc(reviews.createdAt));
      
    return reviewsWithReviewers.map(({ review, reviewer }) => ({
      ...review,
      reviewer,
    }));
  }
  
  async getReviewByDeliveryAndReviewer(deliveryId: number, reviewerId: number): Promise<Review | undefined> {
    const [review] = await db
      .select()
      .from(reviews)
      .where(
        and(
          eq(reviews.deliveryId, deliveryId),
          eq(reviews.reviewerId, reviewerId)
        )
      );
      
    return review;
  }
  
  // Helper method to recalculate and update a user's rating
  private async updateUserRating(tx: any, userId: number) {
    // Calculate average rating
    const ratingResult = await tx
      .select({
        averageRating: sql`AVG(${reviews.rating})`,
        totalReviews: sql`COUNT(*)`,
      })
      .from(reviews)
      .where(eq(reviews.revieweeId, userId));
      
    if (ratingResult.length > 0) {
      const { averageRating, totalReviews } = ratingResult[0];
      
      // Update user's rating and totalReviews
      await tx
        .update(users)
        .set({
          rating: Math.round(averageRating),
          totalReviews,
        })
        .where(eq(users.id, userId));
    }
  }
}

export class MemStorage implements IStorage {
  private usersData: Map<number, User>;
  private deliveriesData: Map<number, Delivery>;
  private reviewsData: Map<number, Review>;
  sessionStore: session.Store;
  private userId: number;
  private deliveryId: number;
  private reviewId: number;
  
  constructor() {
    this.usersData = new Map();
    this.deliveriesData = new Map();
    this.reviewsData = new Map();
    this.userId = 1;
    this.deliveryId = 1;
    this.reviewId = 1;
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000, // prune expired entries every 24h
    });
    
    // Seed sample data
    this.seedData();
  }
  
  private seedData() {
    // Create some sample users
    const user1 = this.createUser({
      username: "john_sender",
      password: "password123",
      fullName: "John Sender",
      role: "sender",
    });
    
    const user2 = this.createUser({
      username: "alice_carrier",
      password: "password123",
      fullName: "Alice Carrier",
      role: "carrier",
    });
    
    const user3 = this.createUser({
      username: "bob_both",
      password: "password123",
      fullName: "Bob Both",
      role: "both",
    });
    
    // Create some sample deliveries
    const delivery1 = this.createDelivery({
      senderId: 1,
      pickupLocation: "Pune",
      dropLocation: "Mumbai",
      packageSize: "medium",
      packageWeight: 3500, // 3.5 kg
      description: "Electronics",
      specialInstructions: "Handle with care",
      preferredDeliveryDate: "2023-06-22",
      preferredDeliveryTime: "Before 6:00 PM",
      deliveryFee: 30000, // $300
    });
    
    const delivery2 = this.createDelivery({
      senderId: 3,
      pickupLocation: "Mumbai",
      dropLocation: "Bangalore",
      packageSize: "small",
      packageWeight: 1000, // 1 kg
      description: "Clothes",
      preferredDeliveryDate: "2023-06-24",
      preferredDeliveryTime: "Before 2:00 PM",
      deliveryFee: 50000, // $500
    });
    
    const delivery3 = this.createDelivery({
      senderId: 1,
      pickupLocation: "Bangalore",
      dropLocation: "Pune",
      packageSize: "large",
      packageWeight: 8000, // 8 kg
      description: "Books",
      preferredDeliveryDate: "2023-06-23",
      preferredDeliveryTime: "Before 8:00 PM",
      deliveryFee: 60000, // $600
    });
    
    // Update delivery1 to be picked by carrier
    this.updateDeliveryStatus(1, "accepted", 2);
    this.updateDeliveryStatus(1, "picked");
    
    // Update delivery2 to be accepted by carrier
    this.updateDeliveryStatus(2, "accepted", 2);
    
    // Create reviews
    this.createReview({
      deliveryId: 1,
      reviewerId: 1,
      revieweeId: 2,
      rating: 5,
      comment: "Excellent service!",
    });
  }
  
  // User methods
  async getUser(id: number): Promise<User | undefined> {
    return this.usersData.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.usersData.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.userId++;
    const user: User = { ...insertUser, id, rating: 0, totalReviews: 0 };
    this.usersData.set(id, user);
    return user;
  }
  
  async getUserProfile(userId: number): Promise<Partial<User> | undefined> {
    const user = this.usersData.get(userId);
    if (!user) return undefined;
    
    const { password, ...profile } = user;
    return profile;
  }
  
  // Delivery methods
  async getDeliveriesWithFilters(filters: Record<string, any>): Promise<DeliveryWithUser[]> {
    let deliveries = Array.from(this.deliveriesData.values());
    
    // Apply filters
    if (filters.status) {
      deliveries = deliveries.filter(d => d.status === filters.status);
    }
    
    if (filters.pickupLocation) {
      deliveries = deliveries.filter(d => d.pickupLocation === filters.pickupLocation);
    }
    
    if (filters.dropLocation) {
      deliveries = deliveries.filter(d => d.dropLocation === filters.dropLocation);
    }
    
    if (filters.packageSize) {
      deliveries = deliveries.filter(d => d.packageSize === filters.packageSize);
    }
    
    // Sort by creation date (most recent first)
    deliveries.sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateB - dateA;
    });
    
    // Add sender and carrier info
    return deliveries.map(delivery => {
      const sender = this.usersData.get(delivery.senderId);
      const carrier = delivery.carrierId ? this.usersData.get(delivery.carrierId) : undefined;
      
      // Remove sensitive info from users
      const senderSafe = sender ? {
        id: sender.id,
        username: sender.username,
        fullName: sender.fullName,
        rating: sender.rating,
        totalReviews: sender.totalReviews,
        role: sender.role,
      } : undefined;
      
      const carrierSafe = carrier ? {
        id: carrier.id,
        username: carrier.username,
        fullName: carrier.fullName,
        rating: carrier.rating,
        totalReviews: carrier.totalReviews,
        role: carrier.role,
      } : undefined;
      
      return {
        ...delivery,
        sender: senderSafe as User,
        ...(carrierSafe && { carrier: carrierSafe as User }),
      };
    });
  }
  
  async getDeliveryById(id: number): Promise<Delivery | undefined> {
    return this.deliveriesData.get(id);
  }
  
  async createDelivery(delivery: InsertDelivery): Promise<Delivery> {
    const id = this.deliveryId++;
    const now = new Date();
    const createdDelivery: Delivery = { 
      ...delivery, 
      id, 
      status: "requested", 
      createdAt: now.toISOString() 
    };
    this.deliveriesData.set(id, createdDelivery);
    return createdDelivery;
  }
  
  async updateDeliveryStatus(id: number, status: string, carrierId?: number): Promise<Delivery | undefined> {
    const delivery = this.deliveriesData.get(id);
    if (!delivery) return undefined;
    
    const updatedDelivery = { 
      ...delivery, 
      status: status as any,
      ...(carrierId && { carrierId }),
    };
    this.deliveriesData.set(id, updatedDelivery);
    return updatedDelivery;
  }
  
  async getSenderDeliveries(userId: number): Promise<DeliveryWithUser[]> {
    // Get all deliveries where the user is the sender
    const deliveries = Array.from(this.deliveriesData.values())
      .filter(d => d.senderId === userId)
      .sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      });
    
    // Add sender and carrier info
    return deliveries.map(delivery => {
      const sender = this.usersData.get(delivery.senderId);
      const carrier = delivery.carrierId ? this.usersData.get(delivery.carrierId) : undefined;
      
      // Remove sensitive info from users
      const senderSafe = sender ? {
        id: sender.id,
        username: sender.username,
        fullName: sender.fullName,
        rating: sender.rating,
        totalReviews: sender.totalReviews,
        role: sender.role,
      } : undefined;
      
      const carrierSafe = carrier ? {
        id: carrier.id,
        username: carrier.username,
        fullName: carrier.fullName,
        rating: carrier.rating,
        totalReviews: carrier.totalReviews,
        role: carrier.role,
      } : undefined;
      
      return {
        ...delivery,
        sender: senderSafe as User,
        ...(carrierSafe && { carrier: carrierSafe as User }),
      };
    });
  }
  
  async getCarrierDeliveries(userId: number): Promise<DeliveryWithUser[]> {
    // Get all deliveries where the user is the carrier
    const deliveries = Array.from(this.deliveriesData.values())
      .filter(d => d.carrierId === userId)
      .sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      });
    
    // Add sender and carrier info
    return deliveries.map(delivery => {
      const sender = this.usersData.get(delivery.senderId);
      const carrier = this.usersData.get(userId);
      
      // Remove sensitive info from users
      const senderSafe = sender ? {
        id: sender.id,
        username: sender.username,
        fullName: sender.fullName,
        rating: sender.rating,
        totalReviews: sender.totalReviews,
        role: sender.role,
      } : undefined;
      
      const carrierSafe = carrier ? {
        id: carrier.id,
        username: carrier.username,
        fullName: carrier.fullName,
        rating: carrier.rating,
        totalReviews: carrier.totalReviews,
        role: carrier.role,
      } : undefined;
      
      return {
        ...delivery,
        sender: senderSafe as User,
        ...(carrierSafe && { carrier: carrierSafe as User }),
      };
    });
  }
  
  // Review methods
  async createReview(review: InsertReview): Promise<Review> {
    const id = this.reviewId++;
    const now = new Date();
    const createdReview: Review = { 
      ...review, 
      id, 
      createdAt: now.toISOString() 
    };
    this.reviewsData.set(id, createdReview);
    
    // Update user's rating
    await this.updateUserRating(review.revieweeId);
    
    return createdReview;
  }
  
  async getUserReviews(userId: number): Promise<(Review & { reviewer: Partial<User> })[]> {
    // Get all reviews for the user
    const userReviews = Array.from(this.reviewsData.values())
      .filter(r => r.revieweeId === userId)
      .sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      });
    
    // Add reviewer info
    return userReviews.map(review => {
      const reviewer = this.usersData.get(review.reviewerId);
      
      // Safe reviewer info (without password)
      const reviewerSafe = reviewer ? {
        id: reviewer.id,
        username: reviewer.username,
        fullName: reviewer.fullName,
      } : undefined;
      
      return {
        ...review,
        reviewer: reviewerSafe as Partial<User>,
      };
    });
  }
  
  async getReviewByDeliveryAndReviewer(deliveryId: number, reviewerId: number): Promise<Review | undefined> {
    return Array.from(this.reviewsData.values()).find(
      r => r.deliveryId === deliveryId && r.reviewerId === reviewerId
    );
  }
  
  // Helper method to recalculate and update a user's rating
  private async updateUserRating(userId: number) {
    const user = this.usersData.get(userId);
    if (!user) return;
    
    // Get all reviews for the user
    const userReviews = Array.from(this.reviewsData.values())
      .filter(r => r.revieweeId === userId);
    
    if (userReviews.length === 0) return;
    
    // Calculate average rating
    const totalRating = userReviews.reduce((sum, review) => sum + review.rating, 0);
    const averageRating = Math.round(totalRating / userReviews.length);
    
    // Update user's rating and totalReviews
    const updatedUser = {
      ...user,
      rating: averageRating,
      totalReviews: userReviews.length,
    };
    
    this.usersData.set(userId, updatedUser);
  }
}

// Using in-memory storage can cause session persistence issues
// export const storage = new MemStorage();

// Using database storage for persistent sessions
export const storage = new DatabaseStorage();
