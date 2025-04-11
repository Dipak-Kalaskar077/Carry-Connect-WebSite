import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createDeliverySchema, CreateDeliveryInput } from "@shared/schema";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";

const CreateDeliveryForm = () => {
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const locations = ["Pune", "Mumbai", "Bangalore", "Delhi", "Chennai", "Hyderabad"];
  const packageSizes = [
    { value: "small", label: "Small (up to 2 kg)" },
    { value: "medium", label: "Medium (2-5 kg)" },
    { value: "large", label: "Large (5-10 kg)" },
  ];
  const deliveryTimes = [
    "Before 12:00 PM",
    "Before 2:00 PM",
    "Before 6:00 PM",
    "Before 9:00 PM",
  ];

  const form = useForm<CreateDeliveryInput>({
    resolver: zodResolver(createDeliverySchema),
    defaultValues: {
      pickupLocation: "Bangalore",
      dropLocation: "Mumbai",
      packageSize: "medium",
      packageWeight: 1000, // 1 kg in grams
      preferredDeliveryDate: new Date().toISOString().split("T")[0],
      preferredDeliveryTime: "Before 6:00 PM",
      deliveryFee: 30000, // $300 in cents
      description: "",
      specialInstructions: "",
    },
  });

  const createDeliveryMutation = useMutation({
    mutationFn: async (data: CreateDeliveryInput) => {
      const res = await apiRequest("POST", "/api/deliveries", data);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Delivery request created successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/user/deliveries/sender"] });
      navigate("/dashboard");
    },
    onError: (error: Error) => {
      // Check if the error is due to being unauthorized
      if (error.message.includes("401") || error.message.includes("Unauthorized")) {
        toast({
          title: "Authentication Required",
          description: "You need to be logged in to create a delivery. Please login or register first.",
          variant: "destructive",
        });
        navigate("/auth");
      } else {
        toast({
          title: "Error",
          description: error.message || "Failed to create delivery request",
          variant: "destructive",
        });
      }
    },
  });

  const onSubmit = (data: CreateDeliveryInput) => {
    createDeliveryMutation.mutate(data);
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              {/* Pickup Location */}
              <FormField
                control={form.control}
                name="pickupLocation"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Pickup Location</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select pickup location" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {locations.map((location) => (
                          <SelectItem key={location} value={location}>
                            {location}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Drop Location */}
              <FormField
                control={form.control}
                name="dropLocation"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Drop Location</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select drop location" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {locations.map((location) => (
                          <SelectItem key={location} value={location}>
                            {location}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Package Size */}
              <FormField
                control={form.control}
                name="packageSize"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Package Size</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select package size" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {packageSizes.map((size) => (
                          <SelectItem key={size.value} value={size.value}>
                            {size.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Package Weight */}
              <FormField
                control={form.control}
                name="packageWeight"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Package Weight (grams)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="1"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value))}
                      />
                    </FormControl>
                    <FormDescription>
                      Weight in grams (1kg = 1000g)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Delivery Date */}
              <FormField
                control={form.control}
                name="preferredDeliveryDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Delivery Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Delivery Time */}
              <FormField
                control={form.control}
                name="preferredDeliveryTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Delivery Time</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select delivery time" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {deliveryTimes.map((time) => (
                          <SelectItem key={time} value={time}>
                            {time}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Delivery Fee */}
              <FormField
                control={form.control}
                name="deliveryFee"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Delivery Fee (₹)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="1"
                        {...field}
                        value={field.value / 100}
                        onChange={(e) => field.onChange(parseInt(e.target.value) * 100)}
                      />
                    </FormControl>
                    <FormDescription>
                      Enter amount in Rupees
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Package Description */}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Package Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Brief description of your package contents (optional)"
                      value={field.value || ""}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      ref={field.ref}
                      name={field.name}
                    />
                  </FormControl>
                  <FormDescription>
                    Brief description to help carriers identify your package.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Special Instructions */}
            <FormField
              control={form.control}
              name="specialInstructions"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Special Instructions</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Any special handling instructions (optional)"
                      value={field.value || ""}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      ref={field.ref}
                      name={field.name}
                    />
                  </FormControl>
                  <FormDescription>
                    Any handling instructions or delivery preferences.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end space-x-3">
              <Button 
                type="button" 
                variant="outline"
                onClick={() => navigate("/dashboard")}
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={createDeliveryMutation.isPending}
              >
                Create Delivery Request
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
};

export default CreateDeliveryForm;
