# Anime Data Processing Pipeline

A production-ready data processing pipeline for anime relationship data. This pipeline converts CSV data to JSON, groups anime into series based on relations, and performs advanced series splitting.

## Features

- **Modular Processing Stages**: Each processing step is contained in its own module
- **Performance Monitoring**: Pipeline tracks runtime performance metrics for each stage
- **Comprehensive Logging**: Detailed logs for each processing stage and error tracking
- **Production-Ready**: Can be run as a cron job or microservice
- **Error Handling**: Graceful error handling and recovery

## Pipeline Stages

1. **Data Conversion** - Converts CSV data files to JSON format
2. **Series Grouping** - Groups anime into series based on their relationships
3. **Advanced Series Split** - Further splits series into specialized categories based on relation types

## Directory Structure

```
.
├── data/                  # Directory for input CSV files
├── db/                    # Database directory for reference files
├── logs/                  # Log files directory
├── results/               # Results directory for JSON output
├── scripts/
│   ├── utils/             # Utility functions
│   │   ├── logger.js      # Logging utility
│   │   ├── monitor.js     # Performance monitoring utility
│   │   └── cli.js         # Command-line interface
│   ├── 1-data-conversion.js   # Convert CSV to JSON
│   ├── 2-series-grouping.js   # Group anime into series
│   ├── 3-advanced-series-split.js  # Advanced series splitting
│   └── pipeline.js        # Main pipeline orchestration
└── package.json
```

## Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/anime-data-pipeline.git
cd anime-data-pipeline

# Install dependencies
npm install

# Make pipeline script executable
chmod +x scripts/pipeline.js scripts/utils/cli.js
```

## Usage

### Running the Complete Pipeline

```bash
# Run the entire pipeline
npm run pipeline

# Or run directly
./scripts/pipeline.js
```

### Using the CLI

The pipeline comes with a CLI for easier operation:

```bash
# Run the entire pipeline
npm run cli -- run

# Run only the data conversion stage
npm run cli -- convert

# Run only the series grouping stage
npm run cli -- group

# Run only the advanced series split stage
npm run cli -- split

# Check pipeline status
npm run cli -- status

# Clean up output directories
npm run cli -- clean --all
```

### Running Individual Stages

```bash
# Run only the data conversion stage
npm run data-conversion

# Run only the series grouping stage
npm run series-grouping

# Run only the advanced series split stage
npm run advanced-split
```

### Cleaning Up

```bash
# Clean log files
npm run clean-logs

# Clean results directory
npm run clean-results

# Clean database directory
npm run clean-db
```

## Preparing Input Data

The pipeline expects CSV files with anime data to be placed in the `data/` directory.

### CSV Format Requirements

Your CSV file should include the following fields:

- `id`: A unique identifier for each anime
- `title` or `title_romaji`: The title of the anime
- `relations`: An array or string representation of relations to other anime

Example CSV structure:

```
id,title,relations
1,"My Anime Title","[{""targetAnimeId"":2,""relationType"":""SEQUEL""},{""targetAnimeId"":3,""relationType"":""SPIN_OFF""}]"
2,"My Anime Sequel","[{""targetAnimeId"":1,""relationType"":""PREQUEL""}]"
3,"My Anime Spin-off","[{""targetAnimeId"":1,""relationType"":""PARENT""}]"
```

### Processing New Data

1. Place your CSV file in the `data/` directory
2. Run the pipeline with `npm run pipeline`
3. Check the `results/` directory for the processed data

## Output Format

The pipeline produces several output files:

1. **results/anilist_anime_data_complete.json** - Converted anime data
2. **results/main_series.json** - Series groups
3. **results/edge_cases.json** - Problematic series relationships
4. **results/anime_data_updated.json** - Anime data with series IDs
5. **db/advanced_split_series.json** - Advanced split series data

## Monitoring and Logs

- Performance metrics are saved to `logs/pipeline-metrics-[timestamp].json`
- Each component has its own log file in the `logs/` directory
- Errors are also logged to component-specific error logs

## Running as a Cron Job

Add the following to your crontab:

```
# Run the anime data pipeline daily at 2 AM
0 2 * * * cd /path/to/anime-data-pipeline && npm run pipeline
```

## Running as a Microservice

The pipeline can be integrated into a microservice architecture by importing the module:

```javascript
const { runPipeline } = require("./scripts/pipeline");

// Run the pipeline with custom options
runPipeline(options)
  .then((result) => {
    console.log("Pipeline completed:", result.success);
  })
  .catch((error) => {
    console.error("Pipeline error:", error);
  });
```

## Contributing

Contributions to this project are welcome! Here's how you can contribute:

1. **Fork the repository** - Create your own fork of the project
2. **Create a feature branch** - `git checkout -b feature/amazing-feature`
3. **Commit your changes** - `git commit -m 'Add some amazing feature'`
4. **Push to the branch** - `git push origin feature/amazing-feature`
5. **Open a Pull Request** - Go to your fork on GitHub and click the "New Pull Request" button

Before submitting your code, please:

- Make sure your code follows the existing code style
- Add tests if applicable
- Update documentation if needed
- Make sure all tests pass

## License

ISC

## Author

Alaa Shurrab - [@AlaaShurrab](https://github.com/AlaaShurrab)

## Acknowledgments

- [AniList](https://anilist.co/) for providing the anime data API
- [CSV Parser](https://www.npmjs.com/package/csv-parser) for CSV parsing functionality
