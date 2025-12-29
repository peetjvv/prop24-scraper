export interface Property {
  id?: number;
  property_url: string;

  // Address fields
  street_address?: string;
  estate_complex?: string;
  suburb: string;
  city?: string;
  postal_code?: string;

  // Property measurements
  floor_size_sqm?: number;

  // Price information
  total_price?: number;
  price_per_sqm?: number;
  rates_and_taxes?: number;
  levies?: number;

  // Property status
  status?: "sold" | "under_offer" | "no_offer";

  // Property details
  property_type?: string;
  bedrooms?: number;
  bathrooms?: number;

  // Listing information
  listing_date?: Date;
  scrape_date?: Date;

  // Timestamps
  created_at?: Date;
  updated_at?: Date;
}

export interface ScraperOptions {
  suburb: string;
  headless?: boolean;
  timeout?: number;
}

export interface ScraperResult {
  success: boolean;
  propertiesScraped: number;
  propertiesSaved: number;
  errors: string[];
  message: string;
  properties?: Property[];
}
