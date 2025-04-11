import { useQuery } from "@tanstack/react-query";
import ReviewItem from "./ReviewItem";
import { Review, User } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";

interface ReviewListProps {
  userId: number;
}

const ReviewList = ({ userId }: ReviewListProps) => {
  const { data: reviews, isLoading, error } = useQuery<
    (Review & { reviewer: Partial<User> })[]
  >({
    queryKey: [`/api/users/${userId}/reviews`],
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="bg-gray-50 p-4 rounded-md">
            <div className="flex items-start">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="ml-3">
                <Skeleton className="h-4 w-32 mb-2" />
                <Skeleton className="h-3 w-20 mb-3" />
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-3/4 mb-2" />
                <Skeleton className="h-3 w-24 mt-2" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return <div className="text-red-500">Error loading reviews: {error.message}</div>;
  }

  if (!reviews || reviews.length === 0) {
    return (
      <div className="text-center py-4">
        <p className="text-gray-500">No reviews yet</p>
      </div>
    );
  }

  return (
    <ul className="space-y-6">
      {reviews.map((review) => (
        <ReviewItem key={review.id} review={review} />
      ))}
    </ul>
  );
};

export default ReviewList;
