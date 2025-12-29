-- Create properties table
CREATE TABLE
    IF NOT EXISTS properties (
        id SERIAL PRIMARY KEY,
        property_url VARCHAR(500) UNIQUE NOT NULL,
        -- Address fields
        street_address VARCHAR(255),
        estate_complex VARCHAR(255),
        suburb VARCHAR(255) NOT NULL,
        city VARCHAR(255),
        postal_code VARCHAR(10),
        -- Property measurements
        floor_size_sqm DECIMAL(10, 2),
        -- Price information
        total_price DECIMAL(15, 2),
        price_per_sqm DECIMAL(10, 2),
        rates_and_taxes DECIMAL(10, 2),
        levies DECIMAL(10, 2),
        -- Property status
        status VARCHAR(50), -- 'sold', 'under_offer', 'no_offer'
        -- Property details
        property_type VARCHAR(100), -- 'house', 'apartment', 'townhouse', 'vacant_land', etc.
        bedrooms INT,
        bathrooms INT,
        -- Listing information
        listing_date DATE,
        scrape_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        -- Timestamps
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP -- ON UPDATE CURRENT_TIMESTAMP
    );

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_properties_suburb ON properties (suburb);

CREATE INDEX IF NOT EXISTS idx_properties_status ON properties (status);

CREATE INDEX IF NOT EXISTS idx_properties_listing_date ON properties (listing_date);

CREATE INDEX IF NOT EXISTS idx_properties_property_type ON properties (property_type);

CREATE INDEX IF NOT EXISTS idx_properties_property_url ON properties (property_url);