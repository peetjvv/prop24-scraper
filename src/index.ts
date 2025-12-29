import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import {
  connectDB,
  closeDB,
  insertProperty,
  getPropertiesBySuburb,
} from "./database";
import { Property24Scraper } from "./scraper";
import type { Property } from "./types";

async function main(): Promise<void> {
  await yargs(hideBin(process.argv))
    .command(
      "scrape <suburb>",
      "Scrape property listings for a given suburb",
      (yargs_: any) => {
        return yargs_
          .positional("suburb", {
            describe: "Suburb name to scrape",
            type: "string",
          })
          .option("headless", {
            describe: "Run browser in headless mode",
            type: "boolean",
            default: true,
          })
          .option("timeout", {
            alias: "t",
            describe: "Page load timeout in milliseconds",
            type: "number",
            default: 30000,
          });
      },
      async (args: any) => {
        await scrapeSuburb(args.suburb, {
          headless: args.headless,
          timeout: args.timeout,
        });
      }
    )
    .command(
      "list <suburb>",
      "List properties for a given suburb from database",
      (yargs_: any) => {
        return yargs_.positional("suburb", {
          describe: "Suburb name",
          type: "string",
        });
      },
      async (args: any) => {
        await listProperties(args.suburb);
      }
    )
    .help()
    .alias("h", "help")
    .version()
    .alias("v", "version")
    .demandCommand(1, "Please provide a command")
    .parseAsync();
}

async function scrapeSuburb(
  suburb: string,
  options?: { headless?: boolean; timeout?: number }
): Promise<void> {
  try {
    console.log("\n📦 Prop24 Web Scraper");
    console.log("=".repeat(50));

    // Connect to database
    await connectDB();

    // Initialize scraper
    const scraper = new Property24Scraper({
      suburb,
      ...options,
    });

    await scraper.init();

    // Scrape properties
    const result = await scraper.scrapeSuburb();

    // Save properties to database
    let savedCount = 0;
    if (result.properties && result.properties.length > 0) {
      console.log("\n💾 Saving properties to database...");

      for (const property of result.properties) {
        try {
          await insertProperty(property);
          savedCount++;
        } catch (error) {
          console.warn(`⚠️  Failed to save property: ${property.property_url}`);
        }
      }
    }

    // Display results
    console.log("\n✅ Scraping completed");
    console.log("=".repeat(50));
    console.log(`📊 Results:`);
    console.log(`   Properties found: ${result.propertiesScraped}`);
    console.log(`   Properties saved: ${savedCount}`);
    if (result.errors.length > 0) {
      console.log(`   Errors: ${result.errors.join(", ")}`);
    }

    // Close browser
    await scraper.close();

    // Close database connection
    await closeDB();
  } catch (error) {
    console.error("\n❌ Fatal error:", error);
    process.exit(1);
  }
}

async function listProperties(suburb: string): Promise<void> {
  try {
    console.log("\n📦 Prop24 Properties Database");
    console.log("=".repeat(50));

    // Connect to database
    await connectDB();

    const properties = await getPropertiesBySuburb(suburb);

    if (properties.length === 0) {
      console.log(`\nNo properties found for suburb: ${suburb}`);
    } else {
      console.log(`\n📍 Properties in ${suburb} (${properties.length} total):`);
      console.log("=".repeat(50));

      properties.forEach((prop: Property, index: number) => {
        console.log(`\n${index + 1}. ${prop.street_address || "N/A"}`);
        console.log(`   Estate: ${prop.estate_complex || "N/A"}`);
        console.log(`   Suburb: ${prop.suburb}`);
        console.log(
          `   Price: R${prop.total_price?.toLocaleString() || "N/A"}`
        );
        console.log(
          `   Price/m²: R${prop.price_per_sqm?.toLocaleString() || "N/A"}`
        );
        console.log(`   Floor size: ${prop.floor_size_sqm || "N/A"} m²`);
        console.log(`   Type: ${prop.property_type || "N/A"}`);
        console.log(`   Bedrooms: ${prop.bedrooms || "N/A"}`);
        console.log(`   Bathrooms: ${prop.bathrooms || "N/A"}`);
        console.log(`   Status: ${prop.status || "N/A"}`);
        console.log(
          `   Listed: ${
            prop.listing_date
              ? new Date(prop.listing_date).toLocaleDateString()
              : "N/A"
          }`
        );
      });
    }

    // Close database connection
    await closeDB();
  } catch (error) {
    console.error("\n❌ Fatal error:", error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("❌ Unhandled error:", error);
  process.exit(1);
});
