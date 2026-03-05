# SwiftLogix Shipments Table Setup

## Overview
This SQL script creates a comprehensive shipments tracking system for SwiftLogix Logistics with the following features:

- **Main Table**: `logistics_shipments` - Stores all shipment information
- **History Table**: `logistics_shipment_history` - Tracks status changes
- **View**: `shipment_tracking` - Easy tracking interface
- **Sample Data**: Pre-populated test shipments

## How to Run

### Option 1: Supabase Dashboard
1. Go to your Supabase project dashboard
2. Navigate to the SQL Editor
3. Copy and paste the entire `create_shipments_table.sql` content
4. Click "Run" to execute the script

### Option 2: Command Line (if you have psql)
```bash
psql -h [your-db-host] -U [your-username] -d [your-database] -f create_shipments_table.sql
```

## Table Structure

### logistics_shipments
- **id**: Primary key (auto-generated)
- **tracking_number**: Unique shipment identifier (auto-generated as SLX + timestamp)
- **status**: Current shipment status (pending, in_transit, delivered, cancelled, returned)
- **sender_* & recipient_***: Complete address information
- **package_***: Package details (type, weight, dimensions, description, value)
- **shipping_***: Service type and cost information
- **location_***: Origin, current, and destination locations
- **dates**: Created, updated, estimated delivery, actual delivery
- **user_email**: Associated user account

### logistics_shipment_history
- Tracks all status changes with timestamps
- Links to shipments via foreign key
- Records who made changes and when

## API Endpoints Available

After running the SQL and starting the server:

- `GET /api/shipments` - List all shipments
- `GET /api/shipments/:trackingNumber` - Get specific shipment
- `POST /api/shipments` - Create new shipment
- `PUT /api/shipments/:trackingNumber/status` - Update shipment status

## Sample Data Included

The script includes 4 sample shipments with different statuses:
- SLX001234567: In transit (Lagos → Abuja)
- SLX001234568: Delivered (Port Harcourt → Kano)
- SLX001234569: Pending (Ibadan → Lagos)
- SLX001234570: In transit (Enugu → Lagos)

## Features

✅ **Auto-generated tracking numbers**
✅ **Status history tracking**
✅ **Complete address management**
✅ **Multi-service support** (express, freight, warehousing)
✅ **Real-time status updates**
✅ **User association**
✅ **Performance indexes**
✅ **Sample data for testing**

## Next Steps

1. Run the SQL script in Supabase
2. Restart your logistics server
3. Check the admin dashboard - shipments should now display real data
4. Test creating new shipments via the API
5. Test updating shipment statuses

The shipments system is now fully integrated with your existing notification system!