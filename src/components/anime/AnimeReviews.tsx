import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Star, Trash2, Edit2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

interface Review {
  id: string;
  anime_id: string;
  user_id: string;
  rating: number;
  review_text: string | null;
  created_at: string;
  updated_at: string;
  username?: string;
  avatar_url?: string | null;
}

interface AnimeReviewsProps {
  animeId: string;
}

export function AnimeReviews({ animeId }: AnimeReviewsProps) {
  const { user } = useAuth();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [userReview, setUserReview] = useState<Review | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchReviews();
  }, [animeId, user]);

  const fetchReviews = async () => {
    setIsLoading(true);
    
    // Fetch all reviews
    const { data: reviewsData, error } = await supabase
      .from('anime_reviews')
      .select('*')
      .eq('anime_id', animeId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching reviews:', error);
      setIsLoading(false);
      return;
    }

    // Fetch usernames and avatars for reviews
    const userIds = [...new Set(reviewsData.map(r => r.user_id))];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username, avatar_url')
      .in('id', userIds);

    const profileMap = new Map(profiles?.map(p => [p.id, { username: p.username, avatar_url: p.avatar_url }]) || []);
    
    const enrichedReviews = reviewsData.map(review => ({
      ...review,
      username: profileMap.get(review.user_id)?.username || 'Anonymous',
      avatar_url: profileMap.get(review.user_id)?.avatar_url || null
    }));

    setReviews(enrichedReviews);
    
    // Check if user has existing review
    if (user) {
      const existingReview = enrichedReviews.find(r => r.user_id === user.id);
      if (existingReview) {
        setUserReview(existingReview);
        setRating(existingReview.rating);
        setReviewText(existingReview.review_text || '');
      }
    }

    setIsLoading(false);
  };

  const handleSubmitReview = async () => {
    if (!user) {
      toast.error('Please sign in to leave a review');
      return;
    }

    if (rating === 0) {
      toast.error('Please select a rating');
      return;
    }

    setIsSubmitting(true);

    if (userReview) {
      // Update existing review
      const { error } = await supabase
        .from('anime_reviews')
        .update({
          rating,
          review_text: reviewText.trim() || null,
        })
        .eq('id', userReview.id);

      if (error) {
        toast.error('Failed to update review');
      } else {
        toast.success('Review updated!');
        setIsEditing(false);
        fetchReviews();
      }
    } else {
      // Create new review
      const { error } = await supabase
        .from('anime_reviews')
        .insert({
          anime_id: animeId,
          user_id: user.id,
          rating,
          review_text: reviewText.trim() || null,
        });

      if (error) {
        toast.error('Failed to submit review');
      } else {
        toast.success('Review submitted!');
        fetchReviews();
      }
    }

    setIsSubmitting(false);
  };

  const handleDeleteReview = async () => {
    if (!userReview) return;

    if (!confirm('Are you sure you want to delete your review?')) return;

    const { error } = await supabase
      .from('anime_reviews')
      .delete()
      .eq('id', userReview.id);

    if (error) {
      toast.error('Failed to delete review');
    } else {
      toast.success('Review deleted');
      setUserReview(null);
      setRating(0);
      setReviewText('');
      setIsEditing(false);
      fetchReviews();
    }
  };

  const averageRating = reviews.length > 0 
    ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length 
    : 0;

  const StarRating = ({ value, interactive = false, size = 'md' }: { value: number; interactive?: boolean; size?: 'sm' | 'md' }) => {
    const displayValue = interactive ? (hoverRating || rating) : value;
    const starSize = size === 'sm' ? 'h-4 w-4' : 'h-6 w-6';
    
    return (
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            disabled={!interactive}
            className={cn(
              "transition-all",
              interactive && "cursor-pointer hover:scale-110"
            )}
            onMouseEnter={() => interactive && setHoverRating(star)}
            onMouseLeave={() => interactive && setHoverRating(0)}
            onClick={() => interactive && setRating(star)}
          >
            <Star
              className={cn(
                starSize,
                "transition-colors",
                star <= displayValue 
                  ? "fill-yellow-400 text-yellow-400" 
                  : "text-muted-foreground/30"
              )}
            />
          </button>
        ))}
      </div>
    );
  };

  return (
    <Card className="mt-8 overflow-hidden">
      <CardHeader className="px-3 sm:px-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Star className="h-5 w-5 text-yellow-400 fill-yellow-400 shrink-0" />
            Reviews & Ratings
          </CardTitle>
          {reviews.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <StarRating value={Math.round(averageRating)} size="sm" />
              <span className="text-lg font-semibold">{averageRating.toFixed(1)}</span>
              <span className="text-muted-foreground text-sm">({reviews.length} reviews)</span>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6 px-3 sm:px-6">
        {/* User's Review Section */}
        {user && (
          <div className="p-3 sm:p-4 bg-muted/50 rounded-xl border border-border/50 overflow-hidden">
            {userReview && !isEditing ? (
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">Your Review</span>
                    <StarRating value={userReview.rating} size="sm" />
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsEditing(true)}
                    >
                      <Edit2 className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={handleDeleteReview}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                {userReview.review_text && (
                  <p className="text-foreground/80">{userReview.review_text}</p>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium">Your Rating:</span>
                  <StarRating value={rating} interactive />
                </div>
                <Textarea
                  placeholder="Write your review (optional)..."
                  value={reviewText}
                  onChange={(e) => setReviewText(e.target.value)}
                  className="min-h-[100px] bg-background"
                />
                <div className="flex gap-2">
                  <Button
                    onClick={handleSubmitReview}
                    disabled={isSubmitting || rating === 0}
                    className="anime-button"
                  >
                    {isSubmitting ? 'Submitting...' : userReview ? 'Update Review' : 'Submit Review'}
                  </Button>
                  {isEditing && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setIsEditing(false);
                        setRating(userReview?.rating || 0);
                        setReviewText(userReview?.review_text || '');
                      }}
                    >
                      Cancel
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {!user && (
          <div className="text-center py-4 text-muted-foreground">
            <p>Sign in to leave a review</p>
          </div>
        )}

        {/* Other Reviews */}
        <div className="space-y-4">
          {reviews.filter(r => r.user_id !== user?.id).map((review) => (
            <div
              key={review.id}
              className="p-3 sm:p-4 bg-card/50 rounded-xl border border-border/30 overflow-hidden"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1">
                <StarRating value={review.rating} size="sm" />
                <span className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(review.created_at), { addSuffix: true })}
                </span>
              </div>
              {review.review_text && (
                <p className="text-foreground/80 text-sm break-words mt-2">{review.review_text}</p>
              )}
            </div>
          ))}

          {reviews.length === 0 && !isLoading && (
            <p className="text-center text-muted-foreground py-4">
              No reviews yet. Be the first to review!
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
