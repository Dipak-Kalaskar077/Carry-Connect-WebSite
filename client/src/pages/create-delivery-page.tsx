import CreateDeliveryForm from "@/components/deliveries/CreateDeliveryForm";
import { useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { User } from "@shared/schema";
import { Loader2 } from "lucide-react";

const CreateDeliveryPage = () => {
  const [, navigate] = useLocation();
  
  // Check if user is authenticated
  const { data: user, isLoading, error } = useQuery<User>({
    queryKey: ["/api/user"],
  });
  
  useEffect(() => {
    // If there's an error (likely 401 unauthorized) or explicitly no user,
    // redirect to login page with a message
    if (error || (user === undefined && !isLoading)) {
      navigate("/auth");
    }
  }, [navigate, error, user, isLoading]);
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="pb-5 border-b border-gray-200 mb-6">
        <h2 className="text-2xl font-bold leading-tight text-gray-900">Create Delivery Request</h2>
        <p className="mt-1 text-sm text-gray-500">Provide details about your package and delivery requirements</p>
      </div>

      <CreateDeliveryForm />
    </div>
  );
};

export default CreateDeliveryPage;
