
-- Create storage bucket for statement uploads
INSERT INTO storage.buckets (id, name, public) VALUES ('statements', 'statements', true);

-- Allow anyone to upload (no auth for prototype)
CREATE POLICY "Anyone can upload statements"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'statements');

-- Allow anyone to read statements
CREATE POLICY "Anyone can read statements"
ON storage.objects FOR SELECT
USING (bucket_id = 'statements');

-- Allow anyone to delete statements
CREATE POLICY "Anyone can delete statements"
ON storage.objects FOR DELETE
USING (bucket_id = 'statements');
