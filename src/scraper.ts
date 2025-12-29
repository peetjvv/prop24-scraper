import * as cheerio from "cheerio";
import fs from "fs";
import path from "path";
import type { Browser, Page } from "puppeteer";
import puppeteer from "puppeteer";
import type { Property, ScraperOptions, ScraperResult } from "./types";

const BASE_URL = "https://www.property24.com";

export class Property24Scraper {
  private browser: Browser | null = null;
  private options: ScraperOptions;
  private screenshotCounter: number = 0;
  private tmpDir: string;

  constructor(options: ScraperOptions) {
    this.options = {
      headless: true,
      timeout: 30000,
      ...options,
    };
    // Initialize tmp folder with date-time and suburb subfolder for screenshots
    const now = new Date();
    const dateTime = now.toISOString().replace(/[:.]/g, "-").slice(0, 19); // YYYY-MM-DDTHH-mm-ss
    const sanitizedSuburb = options.suburb.replace(/[^a-zA-Z0-9-]/g, "-");
    const folderName = `${dateTime}_${sanitizedSuburb}`;
    this.tmpDir = path.join(process.cwd(), "tmp", "screenshots", folderName);
    if (!fs.existsSync(this.tmpDir)) {
      fs.mkdirSync(this.tmpDir, { recursive: true });
    }
    console.log(`📸 Screenshots will be saved to: ${this.tmpDir}`);
  }

  async init(): Promise<void> {
    try {
      const launchHeadless = this.options.headless ?? true;
      this.browser = await puppeteer.launch({
        headless: launchHeadless ? true : false,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      });
      console.log("✓ Browser launched");
    } catch (error) {
      console.error(
        "✗ Failed to launch browser:",
        error instanceof Error ? error.message : String(error)
      );
      throw error;
    }
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      console.log("✓ Browser closed");
    }
  }

  async scrapeSuburb(): Promise<ScraperResult> {
    const errors: string[] = [];
    let propertiesScraped = 0;

    try {
      if (!this.browser) {
        throw new Error("Browser not initialized");
      }

      console.log(`🔍 Scraping properties for: ${this.options.suburb}`);

      const page = await this.browser.newPage();

      // Determine the correct listing URL by performing an on-site search for the suburb.
      // Property24 often requires a specific encoded path for suburbs; attempting search reduces 404s.
      const searchUrl = await this.findListingUrlForSuburb(
        page,
        this.options.suburb
      );

      console.log(`📍 Resolved URL: ${searchUrl}`);

      try {
        await page.goto(searchUrl, {
          waitUntil: "networkidle2",
          timeout: this.options.timeout ?? 30000,
        });
        await this.takeScreenshot(page, "listing-page-loaded");

        // Wait for property listings to load
        await page
          .waitForSelector('[data-test-id="property-card"]', { timeout: 10000 })
          .catch(() => {
            console.warn(
              "⚠️  Property cards not found, attempting alternative selectors"
            );
          });

        // Scrape all pages with pagination
        const properties = await this.extractPropertiesWithPagination(page);
        propertiesScraped = properties.length;
        await this.takeScreenshot(page, "properties-extracted");

        console.log(`✓ Found ${propertiesScraped} properties`);

        return {
          success: true,
          propertiesScraped,
          propertiesSaved: 0,
          errors,
          message: `Successfully scraped ${propertiesScraped} properties from ${this.options.suburb}`,
          properties,
        };
      } finally {
        await page.close();
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      errors.push(errorMessage);
      console.error("✗ Scraping error:", errorMessage);

      return {
        success: false,
        propertiesScraped: 0,
        propertiesSaved: 0,
        errors,
        message: `Failed to scrape properties: ${errorMessage}`,
        properties: [],
      };
    }
  }

  private async extractPropertiesWithPagination(
    page: Page
  ): Promise<Property[]> {
    const allProperties: Property[] = [];
    let pageNumber = 1;
    const maxPages = 100; // safety limit

    while (pageNumber <= maxPages) {
      console.log(`📄 Extracting properties from page ${pageNumber}...`);

      // Extract properties from current page
      const pageProperties = await this.extractProperties(page);
      allProperties.push(...pageProperties);
      console.log(
        `  Found ${pageProperties.length} properties on page ${pageNumber}`
      );

      // Try to find and click next page button
      const nextPageFound = await this.goToNextPage(page, pageNumber);
      if (!nextPageFound) {
        console.log(`📄 Reached last page (${pageNumber} total pages)`);
        break;
      }

      pageNumber++;
    }

    return allProperties;
  }

  private async goToNextPage(
    page: Page,
    currentPageNum: number
  ): Promise<boolean> {
    try {
      // Look for next page button using common selectors
      const nextPageSelectors = [
        'a[rel="next"]',
        'button:has-text("Next")',
        '[class*="next"] a',
        'a[aria-label*="next"]',
        'a[title*="next"]',
      ];

      for (const selector of nextPageSelectors) {
        const nextButton = await page.$(selector);
        if (nextButton) {
          await nextButton.click();
          // Wait for page to load
          try {
            await page.waitForNavigation({
              waitUntil: "networkidle2",
              timeout: 10000,
            });
          } catch {
            // navigation may happen via AJAX; wait for cards to update
            try {
              await page.waitForSelector('[data-test-id="property-card"]', {
                timeout: 5000,
              });
            } catch {
              // cards may not appear; continue anyway
            }
          }
          await this.takeScreenshot(
            page,
            `pagination-page-${currentPageNum + 1}`
          );
          return true;
        }
      }

      return false;
    } catch (error) {
      console.warn(
        "⚠️  Error navigating to next page:",
        error instanceof Error ? error.message : String(error)
      );
      return false;
    }
  }

  private async extractProperties(page: Page): Promise<Property[]> {
    const properties: Property[] = [];

    const htmlContent = await page.content();
    const $ = cheerio.load(htmlContent);

    // Try multiple selectors as Property24 may have different layouts
    const propertyElements = $(
      '[data-test-id="property-card"], .property-card, [class*="property"], article'
    );

    if (propertyElements.length === 0) {
      console.warn(
        "⚠️  No property elements found, page structure may have changed"
      );
      return [];
    }

    propertyElements.each((_index: any, element: any) => {
      const $element = $(element);

      try {
        // Extract property listing URL (should start with /for-sale/)
        // Look for links within the property card
        let propertyUrl: string | undefined;

        // First, try to find a link that matches /for-sale/ pattern
        $element.find('a[href*="/for-sale/"]').each((_i: any, el: any) => {
          const href = $(el).attr("href");
          if (href && !propertyUrl) {
            propertyUrl = href;
          }
        });

        // If not found, try generic title/header links
        if (!propertyUrl) {
          const titleEl = $element.find('h2, [class*="title"], a[href*="/p/"]');
          const linkEl = titleEl.find("a").length
            ? titleEl.find("a")
            : titleEl.closest("a");
          propertyUrl = linkEl.attr("href");
        }

        if (!propertyUrl) {
          return; // Skip if no URL found
        }

        const fullUrl = propertyUrl.startsWith("http")
          ? propertyUrl
          : `https://www.property24.com${propertyUrl}`;

        // Extract address components
        const addressText = $element
          .find('[class*="address"], .address, span')
          .text();
        const addressParts = this.parseAddress(addressText);

        // Extract price information
        const priceText = $element
          .find('[class*="price"], .price')
          .first()
          .text();
        const { totalPrice, pricePerSqm } = this.parsePrice(priceText);

        // Extract property details
        const propertyTypeEl = $element
          .find('[class*="property-type"], span')
          .filter((_: any, el: any) => {
            const text = $(el).text().toLowerCase();
            return (
              text.includes("house") ||
              text.includes("apartment") ||
              text.includes("townhouse") ||
              text.includes("land")
            );
          })
          .first();
        const propertyType = propertyTypeEl.text().trim() || undefined;

        // Extract bedrooms and bathrooms
        const features = $element.find('[class*="feature"], li').text();
        const bedrooms = this.extractNumber(
          features,
          /(\d+)\s*(?:bed|bedroom)/i
        );
        const bathrooms = this.extractNumber(
          features,
          /(\d+)\s*(?:bath|bathroom)/i
        );

        // Extract floor size
        const floorSizeMatch = features.match(/(\d+)\s*(?:m²|sqm|m2)/i);
        const floorSizeSqm = floorSizeMatch
          ? parseFloat(floorSizeMatch[1] ?? "0")
          : undefined;

        // Extract status
        const statusEl = $element
          .find('[class*="status"], span')
          .filter((_: any, el: any) => {
            const text = $(el).text().toLowerCase();
            return (
              text.includes("sold") ||
              text.includes("offer") ||
              text.includes("listed")
            );
          })
          .first();
        const statusText = statusEl.text().toLowerCase();
        let status: "sold" | "under_offer" | "no_offer" | undefined;
        if (statusText.includes("sold")) {
          status = "sold";
        } else if (statusText.includes("offer")) {
          status = "under_offer";
        }

        // Extract listing date
        const listingDateText =
          $element.find('[class*="date"], time').attr("datetime") ||
          $element.find('[class*="listed"]').text();
        const listingDate = this.parseDate(listingDateText);

        const property = {
          property_url: fullUrl,
          street_address: addressParts.street,
          estate_complex: addressParts.estate,
          suburb: addressParts.suburb || this.options.suburb,
          city: addressParts.city,
          postal_code: addressParts.postalCode,
          floor_size_sqm: floorSizeSqm,
          total_price: totalPrice,
          price_per_sqm: pricePerSqm,
          property_type: propertyType,
          bedrooms,
          bathrooms,
          status,
          listing_date: listingDate,
        } as unknown as Property;

        properties.push(property);
      } catch (error) {
        console.warn(
          "⚠️  Failed to parse property element:",
          error instanceof Error ? error.message : String(error)
        );
      }
    });

    return properties;
  }

  private parseAddress(addressText: string): {
    street?: string;
    estate?: string;
    suburb?: string;
    city?: string;
    postalCode?: string;
  } {
    const parts = addressText.split(",").map((p) => p.trim());

    return {
      street: parts[0] || undefined,
      estate: parts[1] || undefined,
      suburb: parts[2] || undefined,
      city: parts[3] || undefined,
      postalCode: parts[4] || undefined,
    } as {
      street?: string;
      estate?: string;
      suburb?: string;
      city?: string;
      postalCode?: string;
    };
  }

  private parsePrice(priceText: string): {
    totalPrice: number | undefined;
    pricePerSqm: number | undefined;
  } {
    const totalPriceMatch = priceText.match(/R[\s,\d.]+/);
    const totalPrice = totalPriceMatch
      ? parseFloat(totalPriceMatch[0].replace(/[R\s,]/g, ""))
      : undefined;

    const pricePerSqmMatch = priceText.match(/R[\s,\d.]+\s*per\s*m²/i);
    const pricePerSqm = pricePerSqmMatch
      ? parseFloat(pricePerSqmMatch[0].replace(/[R\s,\/m²]/gi, ""))
      : undefined;

    return { totalPrice: totalPrice, pricePerSqm: pricePerSqm };
  }

  private extractNumber(text: string, pattern: RegExp): number | undefined {
    const match = text.match(pattern);
    return match ? parseInt(match[1] ?? "0", 10) : undefined;
  }

  private parseDate(dateText: string | undefined): Date | undefined {
    if (!dateText) return undefined;

    // Try parsing ISO format first
    if (dateText.includes("T")) {
      const date = new Date(dateText);
      if (!isNaN(date.getTime())) {
        return date;
      }
    }

    // Try common South African date formats
    const dateMatch = dateText.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
    if (dateMatch) {
      return new Date(`${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`);
    }

    return undefined;
  }

  private listingUrlForSuburb: string | null = null;
  private async findListingUrlForSuburb(
    page: Page,
    suburb: string
  ): Promise<string> {
    if (this.listingUrlForSuburb) {
      return this.listingUrlForSuburb;
    }

    // Navigate to homepage and attempt to use the search box
    try {
      await page.goto(BASE_URL, { waitUntil: "networkidle2", timeout: 15000 });
      await this.takeScreenshot(page, "homepage-loaded");
    } catch {
      throw new Error("Failed to load Property24 homepage");
    }

    // close cookie consent if present
    await this.closeCookieBanner(page);

    const searchInputSelectors = [
      'input[id*="token-input-AutoCompleteItems"]',
      'input[placeholder*="Search for a City, Suburb or Web Reference"]',
    ];

    for (const sel of searchInputSelectors) {
      // check if search selector exists
      const exists = await page.$(sel);
      if (!exists) continue;

      try {
        // typing search term
        await page.focus(sel);
        await page.click(sel, { clickCount: 1 }).catch(() => {});
        await page.type(sel, suburb, { delay: 500 });
        await this.takeScreenshot(page, "search-input-filled");

        // delay to wait for suggestions to load
        await Promise.resolve().then(() => setTimeout(() => {}, 5000));

        // selecting top result
        await page.keyboard
          .press("Enter", {
            delay: 5000, // delay to wait for suggestion to be selected
          })
          .catch(() => {
            throw new Error("Failed to press enter key to submit search");
          });
        await this.takeScreenshot(page, "search-submitted");

        // click on search button
        await page.focus('button[class="btn btn-danger"]');
        await page.click('button[class="btn btn-danger"]').catch(() => {
          throw new Error("No search button found");
        });
        await this.takeScreenshot(page, "search-button-clicked");

        // wait for navigation to complete
        try {
          await page.waitForNavigation({
            waitUntil: "networkidle2",
            timeout: 30000,
          });
          await this.takeScreenshot(page, "after-navigation");
        } catch {
          // ignore navigation timeout
          console.log("⚠️  Navigation timeout after search submission");
          await this.takeScreenshot(page, "navigation-timeout");
        }

        // grab the resulting URL
        const resolved = page.url();
        // Heuristic: listing pages often contain '/property' or '/properties' or '/for-sale'
        if (
          /\/properties\//i.test(resolved) ||
          /for-sale/i.test(resolved) ||
          /\/p\//i.test(resolved)
        ) {
          return resolved;
        }
      } catch {
        // try next search selector
      }
    }

    throw new Error(`Could not resolve listing URL for suburb: ${suburb}`);
  }

  private async takeScreenshot(page: Page, label: string): Promise<void> {
    try {
      this.screenshotCounter++;
      const timestamp = new Date()
        .toISOString()
        .replace(/[:.]/g, "-")
        .slice(0, -5);
      const filename = `${this.screenshotCounter
        .toString()
        .padStart(3, "0")}_${label}_${timestamp}.png`;
      const filepath = path.join(this.tmpDir, filename);
      await page.screenshot({ path: filepath, fullPage: true });
      console.log(`📸 Screenshot saved: ${filename}`);
    } catch (error) {
      console.warn(
        `⚠️  Failed to take screenshot:`,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  private async closeCookieBanner(page: Page): Promise<void> {
    const cookieButton = await page.$('button[id="cookieBannerClose"]');
    if (cookieButton) {
      await cookieButton.click();
      await this.takeScreenshot(page, "cookie-consent-closed");
    }
  }
}
