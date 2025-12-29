import { Pool } from "pg";
import type { QueryResult } from "pg";
import type { Property } from "./types";

const pool = new Pool({
  user: process.env.DB_USER || "scraper",
  password: process.env.DB_PASSWORD || "scraper_password",
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT ?? "5432", 10),
  database: process.env.DB_NAME || "prop24",
});

pool.on("error", (err: Error) => {
  console.error("Unexpected error on idle client", err.message ?? err);
});

export async function connectDB(): Promise<void> {
  try {
    const client = await pool.connect();
    console.log("✓ Connected to database");
    client.release();
  } catch (error: unknown) {
    console.error(
      "✗ Failed to connect to database:",
      error instanceof Error ? error.message : String(error)
    );
    throw error;
  }
}

export async function closeDB(): Promise<void> {
  await pool.end();
}

export async function insertProperty(
  property: Property
): Promise<Property | null> {
  const query = `
    INSERT INTO properties (
      property_url, street_address, estate_complex, suburb, city, postal_code,
      floor_size_sqm, total_price, price_per_sqm, rates_and_taxes, levies,
      status, property_type, bedrooms, bathrooms, listing_date
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16
    )
    ON CONFLICT (property_url) DO UPDATE SET
      street_address = EXCLUDED.street_address,
      estate_complex = EXCLUDED.estate_complex,
      suburb = EXCLUDED.suburb,
      city = EXCLUDED.city,
      postal_code = EXCLUDED.postal_code,
      floor_size_sqm = EXCLUDED.floor_size_sqm,
      total_price = EXCLUDED.total_price,
      price_per_sqm = EXCLUDED.price_per_sqm,
      rates_and_taxes = EXCLUDED.rates_and_taxes,
      levies = EXCLUDED.levies,
      status = EXCLUDED.status,
      property_type = EXCLUDED.property_type,
      bedrooms = EXCLUDED.bedrooms,
      bathrooms = EXCLUDED.bathrooms,
      listing_date = EXCLUDED.listing_date,
      updated_at = CURRENT_TIMESTAMP
    RETURNING *;
  `;

  const values = [
    property.property_url,
    property.street_address,
    property.estate_complex,
    property.suburb,
    property.city,
    property.postal_code,
    property.floor_size_sqm,
    property.total_price,
    property.price_per_sqm,
    property.rates_and_taxes,
    property.levies,
    property.status,
    property.property_type,
    property.bedrooms,
    property.bathrooms,
    property.listing_date,
  ];

  try {
    const result: QueryResult<Property> = await pool.query(query, values);
    return result.rows[0] || null;
  } catch (error: unknown) {
    console.error(
      "Error inserting property:",
      error instanceof Error ? error.message : String(error)
    );
    throw error;
  }
}

export async function getPropertiesBySuburb(
  suburb: string
): Promise<Property[]> {
  const query =
    "SELECT * FROM properties WHERE suburb = $1 ORDER BY listing_date DESC;";

  try {
    const result: QueryResult<Property> = await pool.query(query, [suburb]);
    return result.rows;
  } catch (error: unknown) {
    console.error(
      "Error fetching properties:",
      error instanceof Error ? error.message : String(error)
    );
    throw error;
  }
}

export async function getPropertyCount(): Promise<number> {
  const query = "SELECT COUNT(*) as count FROM properties;";

  try {
    const result: QueryResult<{ count: string }> = await pool.query(query);
    const countStr = result.rows[0]?.count ?? "0";
    return parseInt(countStr, 10);
  } catch (error) {
    console.error(
      "Error getting property count:",
      error instanceof Error ? error.message : String(error)
    );
    throw error;
  }
}
