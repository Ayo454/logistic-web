-- Create shipments table for SwiftLogix Logistics
CREATE TABLE IF NOT EXISTS logistics_shipments (
    id SERIAL PRIMARY KEY,
    tracking_number VARCHAR(50) UNIQUE NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'in_transit', 'delivered', 'cancelled', 'returned')),

    -- Sender Information
    sender_name VARCHAR(255) NOT NULL,
    sender_email VARCHAR(255),
    sender_phone VARCHAR(50),
    sender_address TEXT,
    sender_city VARCHAR(100),
    sender_state VARCHAR(100),
    sender_country VARCHAR(100),
    sender_postal_code VARCHAR(20),

    -- Recipient Information
    recipient_name VARCHAR(255) NOT NULL,
    recipient_email VARCHAR(255),
    recipient_phone VARCHAR(50),
    recipient_address TEXT,
    recipient_city VARCHAR(100),
    recipient_state VARCHAR(100),
    recipient_country VARCHAR(100),
    recipient_postal_code VARCHAR(20),

    -- Package Details
    package_type VARCHAR(50), -- express, freight, warehousing
    package_weight DECIMAL(10,2), -- in kg
    package_dimensions VARCHAR(50), -- LxWxH format
    package_description TEXT,
    declared_value DECIMAL(12,2),

    -- Shipping Details
    service_type VARCHAR(50), -- express, freight, warehousing
    shipping_cost DECIMAL(10,2),
    currency VARCHAR(3) DEFAULT 'NGN',

    -- Location Tracking
    origin_location VARCHAR(255),
    current_location VARCHAR(255),
    destination_location VARCHAR(255),

    -- Dates
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    estimated_delivery TIMESTAMP WITH TIME ZONE,
    actual_delivery TIMESTAMP WITH TIME ZONE,

    -- Additional Fields
    priority VARCHAR(20) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    notes TEXT,
    internal_notes TEXT,

    -- User association (if applicable)
    user_email VARCHAR(255)
);

-- Create shipment_status_history table to track status changes
CREATE TABLE IF NOT EXISTS logistics_shipment_history (
    id SERIAL PRIMARY KEY,
    shipment_id INTEGER REFERENCES logistics_shipments(id) ON DELETE CASCADE,
    old_status VARCHAR(20),
    new_status VARCHAR(20) NOT NULL,
    location VARCHAR(255),
    notes TEXT,
    changed_by VARCHAR(255), -- could be user email or 'system'
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_shipments_tracking ON logistics_shipments(tracking_number);
CREATE INDEX IF NOT EXISTS idx_shipments_status ON logistics_shipments(status);
CREATE INDEX IF NOT EXISTS idx_shipments_created ON logistics_shipments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_shipments_user ON logistics_shipments(user_email);
CREATE INDEX IF NOT EXISTS idx_shipments_service ON logistics_shipments(service_type);

CREATE INDEX IF NOT EXISTS idx_history_shipment ON logistics_shipment_history(shipment_id);
CREATE INDEX IF NOT EXISTS idx_history_changed ON logistics_shipment_history(changed_at DESC);

-- Insert some sample data for testing
INSERT INTO logistics_shipments (
    tracking_number, status, sender_name, sender_email, sender_phone,
    recipient_name, recipient_email, recipient_phone, package_type,
    service_type, shipping_cost, origin_location, destination_location,
    estimated_delivery, user_email
) VALUES
('SLX001234567', 'in_transit', 'John Doe', 'john@example.com', '+2348012345678',
 'Jane Smith', 'jane@example.com', '+2348098765432', 'express',
 'express', 2500.00, 'Lagos, Nigeria', 'Abuja, Nigeria',
 NOW() + INTERVAL '2 days', 'john@example.com'),

('SLX001234568', 'delivered', 'Alice Johnson', 'alice@company.com', '+2348034567890',
 'Bob Wilson', 'bob@business.com', '+2348076543210', 'freight',
 'freight', 15000.00, 'Port Harcourt, Nigeria', 'Kano, Nigeria',
 NOW() - INTERVAL '1 day', 'alice@company.com'),

('SLX001234569', 'pending', 'Mike Brown', 'mike@store.com', '+2348024681357',
 'Sarah Davis', 'sarah@retail.com', '+2348069753124', 'warehousing',
 'warehousing', 5000.00, 'Ibadan, Nigeria', 'Lagos, Nigeria',
 NOW() + INTERVAL '5 days', 'mike@store.com'),

('SLX001234570', 'in_transit', 'Emma White', 'emma@logistics.ng', '+2348045678901',
 'David Black', 'david@shipping.com', '+2348087654321', 'express',
 'express', 3200.00, 'Enugu, Nigeria', 'Lagos, Nigeria',
 NOW() + INTERVAL '1 day', 'emma@logistics.ng');

-- Insert sample history data
INSERT INTO logistics_shipment_history (shipment_id, old_status, new_status, location, notes, changed_by) VALUES
(1, NULL, 'pending', 'Lagos, Nigeria', 'Shipment created and received at origin facility', 'system'),
(1, 'pending', 'in_transit', 'Lagos, Nigeria', 'Shipment picked up and en route to Abuja', 'system'),
(2, NULL, 'pending', 'Port Harcourt, Nigeria', 'Freight shipment booked', 'system'),
(2, 'pending', 'in_transit', 'Port Harcourt, Nigeria', 'Freight loaded onto truck', 'system'),
(2, 'in_transit', 'delivered', 'Kano, Nigeria', 'Successfully delivered to recipient', 'system');

-- Create a view for easy shipment tracking
CREATE OR REPLACE VIEW shipment_tracking AS
SELECT
    s.id,
    s.tracking_number,
    s.status,
    s.sender_name,
    s.recipient_name,
    s.service_type,
    s.origin_location,
    s.current_location,
    s.destination_location,
    s.created_at,
    s.estimated_delivery,
    s.actual_delivery,
    s.shipping_cost,
    s.user_email,
    h.changed_at as last_update,
    h.location as last_location,
    h.notes as last_notes
FROM logistics_shipments s
LEFT JOIN logistics_shipment_history h ON s.id = h.shipment_id
WHERE h.changed_at = (
    SELECT MAX(changed_at)
    FROM logistics_shipment_history
    WHERE shipment_id = s.id
);