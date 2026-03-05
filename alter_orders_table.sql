-- Add columns to logistics_orders table based on the required fields
-- Run this in Supabase SQL Editor

ALTER TABLE logistics_orders
ADD COLUMN IF NOT EXISTS id SERIAL PRIMARY KEY,
ADD COLUMN IF NOT EXISTS user_email VARCHAR(255),
ADD COLUMN IF NOT EXISTS service VARCHAR(50),
ADD COLUMN IF NOT EXISTS service_label VARCHAR(255),
ADD COLUMN IF NOT EXISTS route VARCHAR(255),
ADD COLUMN IF NOT EXISTS speed_label VARCHAR(255),
ADD COLUMN IF NOT EXISTS price DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS contact_phone VARCHAR(50),
ADD COLUMN IF NOT EXISTS receiver_phone VARCHAR(50),
ADD COLUMN IF NOT EXISTS image_url TEXT,
ADD COLUMN IF NOT EXISTS email VARCHAR(255),
ADD COLUMN IF NOT EXISTS tracking_id VARCHAR(50) UNIQUE;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_orders_tracking ON logistics_orders(tracking_id);
CREATE INDEX IF NOT EXISTS idx_orders_user_email ON logistics_orders(user_email);
CREATE INDEX IF NOT EXISTS idx_orders_status ON logistics_orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created ON logistics_orders(created_at DESC);