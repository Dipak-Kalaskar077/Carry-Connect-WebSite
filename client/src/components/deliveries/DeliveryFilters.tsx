import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Search } from "lucide-react";

interface DeliveryFiltersProps {
  onFilterChange: (filters: Record<string, string>) => void;
}

const DeliveryFilters = ({ onFilterChange }: DeliveryFiltersProps) => {
  const [location, setLocation] = useLocation();
  
  // Parse query parameters from the URL
  const getParamsFromUrl = () => {
    if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search);
      return {
        pickupLocation: searchParams.get("pickupLocation") || "any",
        dropLocation: searchParams.get("dropLocation") || "any",
        packageSize: searchParams.get("packageSize") || "any",
      };
    }
    return { pickupLocation: "any", dropLocation: "any", packageSize: "any" };
  };
  
  const [filters, setFilters] = useState(getParamsFromUrl());

  useEffect(() => {
    // Apply initial filters from URL if present
    if (Object.values(filters).some(value => value)) {
      onFilterChange(filters);
    }
  }, []);

  const locations = [
    { value: "any", label: "Any location" },
    { value: "Pune", label: "Pune" },
    { value: "Mumbai", label: "Mumbai" },
    { value: "Bangalore", label: "Bangalore" },
    { value: "Delhi", label: "Delhi" },
    { value: "Chennai", label: "Chennai" },
    { value: "Hyderabad", label: "Hyderabad" }
  ];
  
  const packageSizes = [
    { value: "any", label: "Any size" },
    { value: "small", label: "Small" },
    { value: "medium", label: "Medium" },
    { value: "large", label: "Large" },
  ];

  const handleFilterChange = (field: string, value: string) => {
    setFilters(prev => ({ ...prev, [field]: value }));
  };

  const applyFilters = () => {
    // Update the URL with the filter parameters
    const newParams = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      // Only add non-"any" values to the URL
      if (value && value !== "any") newParams.set(key, value);
    });
    
    // Update the browser URL without navigation
    const newUrl = newParams.toString() ? `${location.split('?')[0]}?${newParams.toString()}` : location.split('?')[0];
    window.history.pushState({}, '', newUrl);
    
    // For backend filters, remove "any" values entirely
    const backendFilters: Record<string, string> = {};
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== "any") {
        backendFilters[key] = value;
      }
    });
    
    // Notify parent component
    onFilterChange(backendFilters);
  };

  return (
    <Card className="p-4 mb-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label htmlFor="from-location" className="block text-sm font-medium text-gray-700">
            From
          </label>
          <Select
            value={filters.pickupLocation}
            onValueChange={(value) => handleFilterChange("pickupLocation", value)}
          >
            <SelectTrigger id="from-location" className="mt-1">
              <SelectValue placeholder="Any location" />
            </SelectTrigger>
            <SelectContent>
              {locations.map((loc) => (
                <SelectItem key={loc.value} value={loc.value}>
                  {loc.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div>
          <label htmlFor="to-location" className="block text-sm font-medium text-gray-700">
            To
          </label>
          <Select
            value={filters.dropLocation}
            onValueChange={(value) => handleFilterChange("dropLocation", value)}
          >
            <SelectTrigger id="to-location" className="mt-1">
              <SelectValue placeholder="Any location" />
            </SelectTrigger>
            <SelectContent>
              {locations.map((loc) => (
                <SelectItem key={loc.value} value={loc.value}>
                  {loc.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div>
          <label htmlFor="package-size" className="block text-sm font-medium text-gray-700">
            Package Size
          </label>
          <Select
            value={filters.packageSize}
            onValueChange={(value) => handleFilterChange("packageSize", value)}
          >
            <SelectTrigger id="package-size" className="mt-1">
              <SelectValue placeholder="Any size" />
            </SelectTrigger>
            <SelectContent>
              {packageSizes.map((size) => (
                <SelectItem key={size.value} value={size.value}>
                  {size.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div className="flex items-end">
          <Button 
            className="w-full flex items-center justify-center"
            onClick={applyFilters}
          >
            <Search className="h-4 w-4 mr-2" />
            Filter
          </Button>
        </div>
      </div>
    </Card>
  );
};

export default DeliveryFilters;
