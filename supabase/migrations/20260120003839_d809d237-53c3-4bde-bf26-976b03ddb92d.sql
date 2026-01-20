-- Create comment_reports table for reporting inappropriate comments
CREATE TABLE public.comment_reports (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    comment_id UUID NOT NULL REFERENCES public.comments(id) ON DELETE CASCADE,
    reporter_id UUID NOT NULL,
    reason TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    admin_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.comment_reports ENABLE ROW LEVEL SECURITY;

-- RLS Policies for comment_reports
CREATE POLICY "Users can create reports"
ON public.comment_reports
FOR INSERT
WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY "Users can view their own reports"
ON public.comment_reports
FOR SELECT
USING (auth.uid() = reporter_id);

CREATE POLICY "Admins can view all reports"
ON public.comment_reports
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update reports"
ON public.comment_reports
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete reports"
ON public.comment_reports
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create comment_notifications table for reply notifications
CREATE TABLE public.comment_notifications (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    comment_id UUID NOT NULL REFERENCES public.comments(id) ON DELETE CASCADE,
    reply_id UUID NOT NULL REFERENCES public.comments(id) ON DELETE CASCADE,
    replier_id UUID NOT NULL,
    episode_id UUID NOT NULL REFERENCES public.episodes(id) ON DELETE CASCADE,
    is_read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.comment_notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies for comment_notifications
CREATE POLICY "Users can view their own notifications"
ON public.comment_notifications
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications"
ON public.comment_notifications
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "System can insert notifications"
ON public.comment_notifications
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Users can delete their own notifications"
ON public.comment_notifications
FOR DELETE
USING (auth.uid() = user_id);

-- Create trigger to auto-create notification when a reply is added
CREATE OR REPLACE FUNCTION public.create_reply_notification()
RETURNS TRIGGER AS $$
DECLARE
    parent_comment RECORD;
BEGIN
    -- Only create notification if this is a reply (has parent_id)
    IF NEW.parent_id IS NOT NULL THEN
        -- Get the parent comment info
        SELECT user_id, episode_id INTO parent_comment
        FROM public.comments
        WHERE id = NEW.parent_id;
        
        -- Don't notify if replying to own comment
        IF parent_comment.user_id != NEW.user_id THEN
            INSERT INTO public.comment_notifications (
                user_id,
                comment_id,
                reply_id,
                replier_id,
                episode_id
            ) VALUES (
                parent_comment.user_id,
                NEW.parent_id,
                NEW.id,
                NEW.user_id,
                NEW.episode_id
            );
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create the trigger
CREATE TRIGGER on_comment_reply
AFTER INSERT ON public.comments
FOR EACH ROW
EXECUTE FUNCTION public.create_reply_notification();

-- Add indexes for better performance
CREATE INDEX idx_comment_reports_comment_id ON public.comment_reports(comment_id);
CREATE INDEX idx_comment_reports_status ON public.comment_reports(status);
CREATE INDEX idx_comment_notifications_user_id ON public.comment_notifications(user_id);
CREATE INDEX idx_comment_notifications_is_read ON public.comment_notifications(is_read);