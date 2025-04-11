import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import { 
  createDeliverySchema, 
  insertReviewSchema,
  deliveryStatusEnum
} from "@shared/schema";
import { ZodError } from "zod";

// Middleware to check if user is authenticated
const isAuthenticated = (req: Request, res: Response, next: Function) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ message: "Unauthorized" });
};

// Helper to format zod errors
const formatZodError = (error: ZodError) => {
  return error.errors.map(err => ({
    path: err.path.join('.'),
    message: err.message
  }));
};

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication routes (/api/register, /api/login, /api/logout, /api/user)
  setupAuth(app);

  // Deliveries routes
  // Get all deliveries (public route for available deliveries)
  app.get("/api/deliveries", async (req, res) => {
    try {
      const { status, pickupLocation, dropLocation, packageSize } = req.query;
      
      const filters: Record<string, any> = {};
      
      if (status) filters.status = status;
      if (pickupLocation) filters.pickupLocation = pickupLocation;
      if (dropLocation) filters.dropLocation = dropLocation;
      if (packageSize) filters.packageSize = packageSize;
      
      const deliveries = await storage.getDeliveriesWithFilters(filters);
      res.json(deliveries);
    } catch (error) {
      console.error("Error fetching deliveries:", error);
      res.status(500).json({ message: "Failed to fetch deliveries" });
    }
  });

  // Get delivery by ID
  app.get("/api/deliveries/:id", async (req, res) => {
    try {
      const deliveryId = parseInt(req.params.id);
      if (isNaN(deliveryId)) {
        return res.status(400).json({ message: "Invalid delivery ID" });
      }
      
      const delivery = await storage.getDeliveryById(deliveryId);
      if (!delivery) {
        return res.status(404).json({ message: "Delivery not found" });
      }
      
      res.json(delivery);
    } catch (error) {
      console.error("Error fetching delivery:", error);
      res.status(500).json({ message: "Failed to fetch delivery" });
    }
  });

  // Create a new delivery
  app.post("/api/deliveries", isAuthenticated, async (req, res) => {
    try {
      const deliveryData = createDeliverySchema.parse({
        ...req.body,
        senderId: req.user!.id,
      });
      
      const delivery = await storage.createDelivery(deliveryData);
      res.status(201).json(delivery);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ 
          message: "Validation error", 
          errors: formatZodError(error) 
        });
      }
      
      console.error("Error creating delivery:", error);
      res.status(500).json({ message: "Failed to create delivery" });
    }
  });

  // Update delivery status
  app.patch("/api/deliveries/:id/status", isAuthenticated, async (req, res) => {
    try {
      const deliveryId = parseInt(req.params.id);
      if (isNaN(deliveryId)) {
        return res.status(400).json({ message: "Invalid delivery ID" });
      }
      
      const { status } = req.body;
      if (!Object.values(deliveryStatusEnum.enumValues).includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }
      
      const delivery = await storage.getDeliveryById(deliveryId);
      if (!delivery) {
        return res.status(404).json({ message: "Delivery not found" });
      }
      
      // Check permissions based on user role and delivery state
      const isCarrier = req.user!.id === delivery.carrierId;
      const isSender = req.user!.id === delivery.senderId;
      
      if (!isCarrier && !isSender) {
        return res.status(403).json({ message: "Forbidden: Not associated with this delivery" });
      }
      
      // Status transition rules
      if (status === 'accepted') {
        if (delivery.status !== 'requested') {
          return res.status(400).json({ message: "Can only accept deliveries with 'requested' status" });
        }
        if (!isCarrier) {
          return res.status(403).json({ message: "Only carriers can accept deliveries" });
        }
      } else if (status === 'picked') {
        if (delivery.status !== 'accepted') {
          return res.status(400).json({ message: "Can only mark as picked when delivery is accepted" });
        }
        if (!isCarrier) {
          return res.status(403).json({ message: "Only carriers can mark as picked" });
        }
      } else if (status === 'delivered') {
        if (delivery.status !== 'picked') {
          return res.status(400).json({ message: "Can only mark as delivered when package is picked" });
        }
        if (!isCarrier) {
          return res.status(403).json({ message: "Only carriers can mark as delivered" });
        }
      }
      
      const updatedDelivery = await storage.updateDeliveryStatus(deliveryId, status, 
        status === 'accepted' ? req.user!.id : undefined);
      res.json(updatedDelivery);
    } catch (error) {
      console.error("Error updating delivery status:", error);
      res.status(500).json({ message: "Failed to update delivery status" });
    }
  });

  // Get user deliveries (as sender)
  app.get("/api/user/deliveries/sender", isAuthenticated, async (req, res) => {
    try {
      const deliveries = await storage.getSenderDeliveries(req.user!.id);
      res.json(deliveries);
    } catch (error) {
      console.error("Error fetching sender deliveries:", error);
      res.status(500).json({ message: "Failed to fetch sender deliveries" });
    }
  });

  // Get user deliveries (as carrier)
  app.get("/api/user/deliveries/carrier", isAuthenticated, async (req, res) => {
    try {
      const deliveries = await storage.getCarrierDeliveries(req.user!.id);
      res.json(deliveries);
    } catch (error) {
      console.error("Error fetching carrier deliveries:", error);
      res.status(500).json({ message: "Failed to fetch carrier deliveries" });
    }
  });

  // Reviews routes
  // Create a review
  app.post("/api/reviews", isAuthenticated, async (req, res) => {
    try {
      const reviewData = insertReviewSchema.parse({
        ...req.body,
        reviewerId: req.user!.id,
      });
      
      // Check if the delivery exists and is delivered
      const delivery = await storage.getDeliveryById(reviewData.deliveryId);
      if (!delivery) {
        return res.status(404).json({ message: "Delivery not found" });
      }
      
      if (delivery.status !== 'delivered') {
        return res.status(400).json({ message: "Can only review completed deliveries" });
      }
      
      // Check if user is associated with the delivery
      const isCarrier = req.user!.id === delivery.carrierId;
      const isSender = req.user!.id === delivery.senderId;
      
      if (!isCarrier && !isSender) {
        return res.status(403).json({ message: "Only participants in the delivery can leave reviews" });
      }
      
      // Check if the reviewee is the other party in the delivery
      if (reviewData.revieweeId !== (isSender ? delivery.carrierId : delivery.senderId)) {
        return res.status(400).json({ message: "Invalid reviewee" });
      }
      
      // Check if already reviewed
      const existingReview = await storage.getReviewByDeliveryAndReviewer(
        reviewData.deliveryId, req.user!.id
      );
      
      if (existingReview) {
        return res.status(400).json({ message: "You have already reviewed this delivery" });
      }
      
      const review = await storage.createReview(reviewData);
      res.status(201).json(review);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ 
          message: "Validation error", 
          errors: formatZodError(error) 
        });
      }
      
      console.error("Error creating review:", error);
      res.status(500).json({ message: "Failed to create review" });
    }
  });

  // Get reviews for a user
  app.get("/api/users/:id/reviews", async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      if (isNaN(userId)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }
      
      const reviews = await storage.getUserReviews(userId);
      res.json(reviews);
    } catch (error) {
      console.error("Error fetching user reviews:", error);
      res.status(500).json({ message: "Failed to fetch user reviews" });
    }
  });

  // Get user profile (public)
  app.get("/api/users/:id/profile", async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      if (isNaN(userId)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }
      
      const user = await storage.getUserProfile(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      res.json(user);
    } catch (error) {
      console.error("Error fetching user profile:", error);
      res.status(500).json({ message: "Failed to fetch user profile" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
