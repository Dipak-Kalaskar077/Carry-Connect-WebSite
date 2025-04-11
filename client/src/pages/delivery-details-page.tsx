import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Delivery, User, insertReviewSchema } from "@shared/schema";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { 
  Card, 
  CardContent,
  CardHeader,
  CardTitle 
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { 
  Textarea 
} from "@/components/ui/textarea";
import DeliveryStatusBadge from "@/components/deliveries/DeliveryStatusBadge";
import { Separator } from "@/components/ui/separator";
import ReviewList from "@/components/reviews/ReviewList";
import { Loader2, MapPin, Package, Clock, DollarSign, Map } from "lucide-react";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Type for DeliveryWithUsers
type DeliveryWithUsers = Delivery & {
  sender?: User;
  carrier?: User;
};

// Create review schema
const reviewSchema = z.object({
  rating: z.number().min(1).max(5),
  comment: z.string().min(3, "Comment must be at least 3 characters"),
});

type ReviewFormValues = z.infer<typeof reviewSchema>;

const DeliveryDetailsPage = () => {
  const { id } = useParams<{ id: string }>();
  const deliveryId = parseInt(id);
  const { user } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  // Fetch delivery details
  const { data: delivery, isLoading, error } = useQuery<DeliveryWithUsers>({
    queryKey: [`/api/deliveries/${deliveryId}`],
    enabled: !isNaN(deliveryId),
  });

  // Check roles
  const isSender = user?.id === delivery?.senderId;
  const isCarrier = user?.id === delivery?.carrierId;
  const isInvolved = isSender || isCarrier;

  // Review form
  const reviewForm = useForm<ReviewFormValues>({
    resolver: zodResolver(reviewSchema),
    defaultValues: {
      rating: 5,
      comment: "",
    },
  });

  // Determine who to review
  const revieweeId = isSender ? delivery?.carrierId : delivery?.senderId;

  // Update delivery status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async (status: string) => {
      const res = await apiRequest("PATCH", `/api/deliveries/${deliveryId}/status`, { status });
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Status updated",
        description: "Delivery status has been updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/deliveries/${deliveryId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/deliveries/sender"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/deliveries/carrier"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update delivery status",
        variant: "destructive",
      });
    },
  });

  // Create review mutation
  const createReviewMutation = useMutation({
    mutationFn: async (data: ReviewFormValues) => {
      if (!revieweeId) throw new Error("No recipient for review");
      
      const reviewData = {
        ...data,
        deliveryId,
        revieweeId,
      };
      
      const res = await apiRequest("POST", "/api/reviews", reviewData);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Review submitted",
        description: "Your review has been submitted successfully",
      });
      reviewForm.reset();
      // Refresh reviews
      queryClient.invalidateQueries({ queryKey: [`/api/users/${revieweeId}/reviews`] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to submit review",
        variant: "destructive",
      });
    },
  });

  // Handle form submission
  const onSubmitReview = (data: ReviewFormValues) => {
    createReviewMutation.mutate(data);
  };

  // Format currency from cents to dollars/rupees
  const formatCurrency = (amount: number) => {
    return `₹${(amount / 100).toFixed(2)}`;
  };

  // Format package size
  const formatPackageSize = (size: string, weight: number) => {
    const weightInKg = weight / 1000;
    return `${size.charAt(0).toUpperCase() + size.slice(1)} package (${weightInKg} kg)`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !delivery) {
    return (
      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="text-center py-12">
          <h2 className="text-xl font-semibold text-gray-900">Error</h2>
          <p className="mt-2 text-gray-500">
            {error?.message || "Delivery not found"}
          </p>
          <Button 
            className="mt-4" 
            variant="outline" 
            onClick={() => navigate("/available-deliveries")}
          >
            Back to Deliveries
          </Button>
        </div>
      </div>
    );
  }

  // Get next status based on current status
  const getNextStatus = () => {
    switch (delivery.status) {
      case "accepted":
        return "picked";
      case "picked":
        return "delivered";
      default:
        return null;
    }
  };

  const nextStatus = getNextStatus();
  const nextStatusLabel = nextStatus ? `Mark as ${nextStatus.charAt(0).toUpperCase() + nextStatus.slice(1)}` : null;

  return (
    <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
      <div className="pb-5 border-b border-gray-200 mb-6 flex flex-col md:flex-row md:justify-between md:items-center">
        <div>
          <h2 className="text-2xl font-bold leading-tight text-gray-900">Delivery Details</h2>
          <p className="mt-1 text-sm text-gray-500">Tracking ID: #{delivery.id}</p>
        </div>
        <div className="mt-4 md:mt-0">
          <DeliveryStatusBadge status={delivery.status} />
        </div>
      </div>

      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
            <div className="sm:col-span-3">
              <h3 className="text-lg leading-6 font-medium text-gray-900">Package Information</h3>
              <dl className="mt-2 text-sm text-gray-500">
                <div className="mt-3">
                  <dt className="font-medium text-gray-500">From</dt>
                  <dd className="mt-1 text-gray-900">{delivery.pickupLocation}</dd>
                </div>
                <div className="mt-3">
                  <dt className="font-medium text-gray-500">To</dt>
                  <dd className="mt-1 text-gray-900">{delivery.dropLocation}</dd>
                </div>
                <div className="mt-3">
                  <dt className="font-medium text-gray-500">Package Size</dt>
                  <dd className="mt-1 text-gray-900">{formatPackageSize(delivery.packageSize, delivery.packageWeight)}</dd>
                </div>
                <div className="mt-3">
                  <dt className="font-medium text-gray-500">Delivery Date/Time</dt>
                  <dd className="mt-1 text-gray-900">{delivery.preferredDeliveryDate}, {delivery.preferredDeliveryTime}</dd>
                </div>
                <div className="mt-3">
                  <dt className="font-medium text-gray-500">Delivery Fee</dt>
                  <dd className="mt-1 text-gray-900">{formatCurrency(delivery.deliveryFee)}</dd>
                </div>
                {delivery.description && (
                  <div className="mt-3">
                    <dt className="font-medium text-gray-500">Description</dt>
                    <dd className="mt-1 text-gray-900">{delivery.description}</dd>
                  </div>
                )}
                {delivery.specialInstructions && (
                  <div className="mt-3">
                    <dt className="font-medium text-gray-500">Special Instructions</dt>
                    <dd className="mt-1 text-gray-900">{delivery.specialInstructions}</dd>
                  </div>
                )}
              </dl>
            </div>
            
            <div className="sm:col-span-3">
              <h3 className="text-lg leading-6 font-medium text-gray-900">
                {delivery.carrierId ? "Carrier Information" : "Sender Information"}
              </h3>
              <dl className="mt-2 text-sm text-gray-500">
                {delivery.sender && (
                  <div className="mt-3 flex items-center">
                    <dt className="sr-only">Sender name</dt>
                    <dd className="flex items-center">
                      <Avatar className="h-8 w-8 mr-2">
                        <AvatarFallback>{delivery.sender.fullName.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-gray-900 font-medium">{delivery.sender.fullName}</p>
                        {delivery.sender.rating && (
                          <div className="flex items-center">
                            {[...Array(5)].map((_, i) => (
                              <svg 
                                key={i} 
                                className={`h-4 w-4 ${
                                  i < delivery.sender.rating! ? "text-yellow-400 fill-yellow-400" : "text-gray-300"
                                }`}
                                xmlns="http://www.w3.org/2000/svg" 
                                viewBox="0 0 24 24"
                              >
                                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                              </svg>
                            ))}
                            <span className="ml-1 text-xs">({delivery.sender.rating})</span>
                          </div>
                        )}
                      </div>
                    </dd>
                  </div>
                )}
                
                {delivery.carrier && (
                  <div className="mt-3 flex items-center">
                    <dt className="sr-only">Carrier name</dt>
                    <dd className="flex items-center">
                      <Avatar className="h-8 w-8 mr-2">
                        <AvatarFallback>{delivery.carrier.fullName.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-gray-900 font-medium">{delivery.carrier.fullName}</p>
                        {delivery.carrier.rating && (
                          <div className="flex items-center">
                            {[...Array(5)].map((_, i) => (
                              <svg 
                                key={i} 
                                className={`h-4 w-4 ${
                                  i < delivery.carrier.rating! ? "text-yellow-400 fill-yellow-400" : "text-gray-300"
                                }`}
                                xmlns="http://www.w3.org/2000/svg" 
                                viewBox="0 0 24 24"
                              >
                                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                              </svg>
                            ))}
                            <span className="ml-1 text-xs">({delivery.carrier.rating})</span>
                          </div>
                        )}
                      </div>
                    </dd>
                  </div>
                )}
                
                {delivery.createdAt && (
                  <div className="mt-3">
                    <dt className="font-medium text-gray-500">Created At</dt>
                    <dd className="mt-1 text-gray-900">
                      {new Date(delivery.createdAt).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </dd>
                  </div>
                )}
              </dl>
              
              {/* Actions for carrier */}
              {isCarrier && nextStatus && (
                <div className="mt-6">
                  <Button 
                    onClick={() => updateStatusMutation.mutate(nextStatus)}
                    disabled={updateStatusMutation.isPending}
                  >
                    {updateStatusMutation.isPending ? "Updating..." : nextStatusLabel}
                  </Button>
                </div>
              )}
            </div>
          </div>

          <div className="mt-8">
            <h3 className="text-lg leading-6 font-medium text-gray-900">Delivery Status</h3>
            <div className="mt-6 relative">
              {/* Status Timeline */}
              <div className="mt-6 sm:mt-5 sm:grid sm:grid-cols-4 sm:gap-4">
                <div className="flex flex-col items-center">
                  <div className={`flex items-center justify-center h-12 w-12 rounded-full ${
                    delivery.status === "requested" || delivery.status === "accepted" || delivery.status === "picked" || delivery.status === "delivered"
                      ? "bg-green-100 text-green-600"
                      : "bg-gray-100 text-gray-400"
                  }`}>
                    <svg 
                      xmlns="http://www.w3.org/2000/svg" 
                      className="h-6 w-6" 
                      fill="none" 
                      viewBox="0 0 24 24" 
                      stroke="currentColor"
                    >
                      {delivery.status === "requested" || delivery.status === "accepted" || delivery.status === "picked" || delivery.status === "delivered"
                        ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        : <circle cx="12" cy="12" r="10" strokeWidth={2} />
                      }
                    </svg>
                  </div>
                  <div className="text-center mt-3">
                    <h4 className="text-sm font-medium text-gray-900">Requested</h4>
                    <p className="text-xs text-gray-500">
                      {new Date(delivery.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                
                <div className="flex flex-col items-center">
                  <div className={`flex items-center justify-center h-12 w-12 rounded-full ${
                    delivery.status === "accepted" || delivery.status === "picked" || delivery.status === "delivered"
                      ? "bg-green-100 text-green-600"
                      : "bg-gray-100 text-gray-400"
                  }`}>
                    <svg 
                      xmlns="http://www.w3.org/2000/svg" 
                      className="h-6 w-6" 
                      fill="none" 
                      viewBox="0 0 24 24" 
                      stroke="currentColor"
                    >
                      {delivery.status === "accepted" || delivery.status === "picked" || delivery.status === "delivered"
                        ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        : <circle cx="12" cy="12" r="10" strokeWidth={2} />
                      }
                    </svg>
                  </div>
                  <div className="text-center mt-3">
                    <h4 className={`text-sm font-medium ${
                      delivery.status === "accepted" || delivery.status === "picked" || delivery.status === "delivered"
                        ? "text-gray-900"
                        : "text-gray-500"
                    }`}>Accepted</h4>
                    <p className="text-xs text-gray-500">
                      {delivery.status === "requested" ? "Pending" : "Completed"}
                    </p>
                  </div>
                </div>
                
                <div className="flex flex-col items-center">
                  <div className={`flex items-center justify-center h-12 w-12 rounded-full ${
                    delivery.status === "picked" || delivery.status === "delivered"
                      ? "bg-green-100 text-green-600"
                      : "bg-gray-100 text-gray-400"
                  }`}>
                    <svg 
                      xmlns="http://www.w3.org/2000/svg" 
                      className="h-6 w-6" 
                      fill="none" 
                      viewBox="0 0 24 24" 
                      stroke="currentColor"
                    >
                      {delivery.status === "picked" || delivery.status === "delivered"
                        ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        : <circle cx="12" cy="12" r="10" strokeWidth={2} />
                      }
                    </svg>
                  </div>
                  <div className="text-center mt-3">
                    <h4 className={`text-sm font-medium ${
                      delivery.status === "picked" || delivery.status === "delivered"
                        ? "text-gray-900"
                        : "text-gray-500"
                    }`}>Picked Up</h4>
                    <p className="text-xs text-gray-500">
                      {delivery.status === "requested" || delivery.status === "accepted" 
                        ? "Pending" 
                        : "Completed"}
                    </p>
                  </div>
                </div>
                
                <div className="flex flex-col items-center">
                  <div className={`flex items-center justify-center h-12 w-12 rounded-full ${
                    delivery.status === "delivered"
                      ? "bg-green-100 text-green-600"
                      : "bg-gray-100 text-gray-400"
                  }`}>
                    <svg 
                      xmlns="http://www.w3.org/2000/svg" 
                      className="h-6 w-6" 
                      fill="none" 
                      viewBox="0 0 24 24" 
                      stroke="currentColor"
                    >
                      {delivery.status === "delivered"
                        ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        : <circle cx="12" cy="12" r="10" strokeWidth={2} />
                      }
                    </svg>
                  </div>
                  <div className="text-center mt-3">
                    <h4 className={`text-sm font-medium ${
                      delivery.status === "delivered"
                        ? "text-gray-900"
                        : "text-gray-500"
                    }`}>Delivered</h4>
                    <p className="text-xs text-gray-500">
                      {delivery.status === "delivered" ? "Completed" : "Pending"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Map preview section */}
          <div className="mt-8">
            <div className="border border-gray-200 rounded-md">
              <div className="px-4 py-5 sm:p-6">
                <h3 className="text-lg leading-6 font-medium text-gray-900">Package Location</h3>
                <div className="mt-2 bg-gray-100 rounded-md overflow-hidden h-48">
                  {/* Map Placeholder */}
                  <div className="h-full flex flex-col items-center justify-center text-gray-500">
                    <Map className="h-12 w-12 text-gray-400 mb-2" />
                    <p className="font-medium">Route Preview</p>
                    <p className="text-sm mt-1">{delivery.pickupLocation} → {delivery.dropLocation}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Review section - visible when delivery is completed and user is involved */}
          {isInvolved && delivery.status === "delivered" && (
            <div className="mt-8">
              <Separator className="my-6" />
              
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                {/* Leave a review (if not already left) */}
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Leave a Review</h3>
                  
                  <Card>
                    <CardContent className="pt-6">
                      <Form {...reviewForm}>
                        <form onSubmit={reviewForm.handleSubmit(onSubmitReview)} className="space-y-4">
                          <FormField
                            control={reviewForm.control}
                            name="rating"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Rating</FormLabel>
                                <Select
                                  onValueChange={(value) => field.onChange(parseInt(value))}
                                  defaultValue={field.value.toString()}
                                >
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Select a rating" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="1">1 - Poor</SelectItem>
                                    <SelectItem value="2">2 - Fair</SelectItem>
                                    <SelectItem value="3">3 - Good</SelectItem>
                                    <SelectItem value="4">4 - Very Good</SelectItem>
                                    <SelectItem value="5">5 - Excellent</SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          
                          <FormField
                            control={reviewForm.control}
                            name="comment"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Comment</FormLabel>
                                <FormControl>
                                  <Textarea 
                                    placeholder="Share your experience..."
                                    rows={4}
                                    {...field}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          
                          <Button 
                            type="submit"
                            disabled={createReviewMutation.isPending}
                          >
                            {createReviewMutation.isPending ? "Submitting..." : "Submit Review"}
                          </Button>
                        </form>
                      </Form>
                    </CardContent>
                  </Card>
                </div>
                
                {/* Reviews list */}
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">
                    {isSender 
                      ? "Carrier Reviews" 
                      : "Sender Reviews"}
                  </h3>
                  
                  {revieweeId ? (
                    <ReviewList userId={revieweeId} />
                  ) : (
                    <p className="text-gray-500">No reviews available</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DeliveryDetailsPage;
