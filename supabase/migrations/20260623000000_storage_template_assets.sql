-- Create a public storage bucket for template assets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'template-assets',
  'template-assets',
  true,
  52428800, -- 50MB
  ARRAY['image/png', 'image/jpeg', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Set up RLS policies for the public bucket
-- 1. Allow public read access to all objects in template-assets
CREATE POLICY "Public Read Access" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'template-assets');

-- 2. Allow authenticated users to upload objects to template-assets
CREATE POLICY "Authenticated Upload" ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'template-assets');

-- 3. Allow authenticated users to delete/update their objects
CREATE POLICY "Authenticated Update/Delete" ON storage.objects
  FOR ALL
  TO authenticated
  USING (bucket_id = 'template-assets');
