# Property24 Web Scraper

A TypeScript-based web scraper for Property24.com that extracts property listings and stores them in a PostgreSQL database running in Docker.

## Features

- 🕷️ Web scraping of Property24.com listings
- 📊 Comprehensive property data extraction
- 💾 PostgreSQL database integration
- 🐳 Docker Compose setup for easy database management
- 🔄 Duplicate detection and automatic updates
- 📈 CLI interface for easy usage

## Data Extracted

The scraper collects the following information for each property:

- **Address Information**

  - Street address
  - Estate/Complex name
  - Suburb
  - City
  - Postal code

- **Property Measurements**

  - Floor size (square meters)

- **Pricing**

  - Total price
  - Price per square meter
  - Rates and taxes
  - Levies

- **Property Details**

  - Property type (house, apartment, townhouse, vacant land, etc.)
  - Number of bedrooms
  - Number of bathrooms

- **Listing Status**
  - Status (Sold, Under Offer, No Offer)
  - Listing date

## Prerequisites

- Node.js 18+
- Docker and Docker Compose
- npm or yarn

## Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/yourusername/prop24-scraper.git
   cd prop24-scraper
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Set up environment variables**

   ```bash
   cp .env.example .env
   ```

   Edit `.env` if you want to customize database connection details:

   ```env
   DB_HOST=localhost
   DB_PORT=5432
   DB_USER=scraper
   DB_PASSWORD=scraper_password
   DB_NAME=prop24
   ```

4. **Start PostgreSQL with Docker Compose**

   ```bash
   npm prestart
   ```

5. **Verify database connection**

   ```bash
   npm start -- list Johannesburg
   ```

   (This will fail to list properties initially, but confirms database connectivity)

## Usage

### Build the project

```bash
npm run build
```

### Scrape properties from a suburb

```bash
npm start -- scrape "Johannesburg"
```

### Scrape with options

```bash
# Specify province
npm start -- scrape "Johannesburg" --province "Gauteng"

# Run with browser visible (not headless)
npm start -- scrape "Johannesburg" --headless false

# Custom timeout (in milliseconds)
npm start -- scrape "Johannesburg" --timeout 60000
```

### List scraped properties from database

```bash
npm start -- list "Johannesburg"
```

## Project Structure

```ascii
prop24-scraper/
├── src/
│   ├── index.ts           # Main entry point and CLI commands
│   ├── scraper.ts         # Web scraping logic
│   ├── database.ts        # Database connection and queries
│   └── types.ts           # TypeScript interfaces and types
├── migrations/
│   └── 001_create_properties_table.sql  # Database schema
├── docker-compose.yml     # Docker Compose configuration
├── tsconfig.json          # TypeScript configuration
├── package.json           # Dependencies and scripts
├── .env.example           # Environment variables template
└── README.md              # This file
```

## Database Schema

### properties table

| Column          | Type                | Description                          |
| --------------- | ------------------- | ------------------------------------ |
| id              | SERIAL PRIMARY KEY  | Unique identifier                    |
| property_url    | VARCHAR(500) UNIQUE | Property listing URL                 |
| street_address  | VARCHAR(255)        | Street address                       |
| estate_complex  | VARCHAR(255)        | Estate or complex name               |
| suburb          | VARCHAR(255)        | Suburb name                          |
| city            | VARCHAR(255)        | City name                            |
| postal_code     | VARCHAR(10)         | Postal code                          |
| floor_size_sqm  | DECIMAL(10,2)       | Floor size in square meters          |
| total_price     | DECIMAL(15,2)       | Total price in Rands                 |
| price_per_sqm   | DECIMAL(10,2)       | Price per square meter               |
| rates_and_taxes | DECIMAL(10,2)       | Annual rates and taxes               |
| levies          | DECIMAL(10,2)       | Monthly levies                       |
| status          | VARCHAR(50)         | 'sold', 'under_offer', or 'no_offer' |
| property_type   | VARCHAR(100)        | House, apartment, townhouse, etc.    |
| bedrooms        | INT                 | Number of bedrooms                   |
| bathrooms       | INT                 | Number of bathrooms                  |
| listing_date    | DATE                | Date property was listed             |
| scrape_date     | TIMESTAMP           | When property was scraped            |
| created_at      | TIMESTAMP           | Record creation timestamp            |
| updated_at      | TIMESTAMP           | Record update timestamp              |

## Docker Commands

### Start the database

```bash
docker-compose up -d
```

### Stop the database

```bash
docker-compose down
```

### View logs

```bash
docker-compose logs -f postgres
```

### Access PostgreSQL CLI

```bash
docker exec -it prop24-postgres psql -U scraper -d prop24
```

### Useful PostgreSQL queries

```sql
-- Count total properties
SELECT COUNT(*) FROM properties;

-- Count properties by suburb
SELECT suburb, COUNT(*) as count FROM properties GROUP BY suburb ORDER BY count DESC;

-- Find properties above a certain price
SELECT * FROM properties WHERE total_price > 1000000 ORDER BY total_price DESC;

-- Find recently listed properties
SELECT * FROM properties ORDER BY listing_date DESC LIMIT 10;

-- Find sold properties
SELECT * FROM properties WHERE status = 'sold';
```

## Troubleshooting

### "Failed to connect to database"

- Ensure Docker Compose is running: `docker-compose up -d`
- Check database is healthy: `docker-compose ps`
- Verify .env file has correct credentials

### "Browser not launched"

- Ensure Puppeteer dependencies are installed
- On Linux, you may need: `sudo apt-get install -y chromium-browser`
- Try running with `--headless false` to see browser window

### "No properties found"

- Website structure may have changed
- Try with `--headless false` to manually inspect page
- Check browser console in visible mode for JavaScript errors
- Property24 may have anti-scraping measures; consider adding delays

### "Property parsing errors"

- Website HTML structure may vary
- Scraper uses multiple selector strategies; some parsing may still fail
- Check warning messages for which elements aren't being found

## Performance Tips

- Start with a small suburb to test
- Scraping typically takes 1-5 minutes per suburb depending on listing count
- The scraper respects the website and uses reasonable delays
- Database indexes improve query performance significantly

## Limitations & Considerations

1. **Legal/Ethical**: Always review the website's terms of service and robots.txt before scraping
2. **Rate Limiting**: Property24 may block excessive requests; consider adding delays between requests
3. **Dynamic Content**: Some property details load dynamically with JavaScript
4. **Data Accuracy**: Scraped data accuracy depends on website consistency
5. **Duplication**: URLs are unique, so re-scraping updates existing records

## Future Enhancements

- [ ] Add scheduling for automatic periodic scrapes
- [ ] Implement proxy rotation for rate limit avoidance
- [ ] Add more granular location filtering
- [ ] Create web dashboard for viewing scraped data
- [ ] Add price trend analysis
- [ ] Export to CSV/Excel
- [ ] Add caching layer for better performance

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Support

For issues or questions, please open an GitHub issue or contact the maintainers.
