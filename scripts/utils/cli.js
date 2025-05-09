#!/usr/bin/env node

/**
 * Command-line interface for the anime data pipeline
 */

const { program } = require("commander");
const path = require("path");
const fs = require("fs");

// Import pipeline modules
const { runPipeline } = require("../pipeline");
const dataConversion = require("../1-data-conversion");
const seriesGrouping = require("../2-series-grouping");
const advancedSeriesSplit = require("../3-advanced-series-split");

// Import utility
const logger = require("./logger").getLogger("cli");

// Setup CLI program
program
  .name("anime-pipeline")
  .description("Anime Data Processing Pipeline")
  .version("1.0.0");

// Full pipeline command
program
  .command("run")
  .description("Run the complete pipeline")
  .option("-v, --verbose", "Enable verbose output")
  .action(async (options) => {
    logger.info("Running complete pipeline");
    try {
      const result = await runPipeline(options);
      if (result.success) {
        logger.info("Pipeline completed successfully");
        process.exit(0);
      } else {
        logger.error(`Pipeline failed: ${result.error}`);
        process.exit(1);
      }
    } catch (error) {
      logger.error(`Unhandled error: ${error.message}`);
      process.exit(1);
    }
  });

// Single stage commands
program
  .command("convert")
  .description("Run only the data conversion stage")
  .option("-v, --verbose", "Enable verbose output")
  .action(async (options) => {
    logger.info("Running data conversion stage");
    try {
      const result = await dataConversion.convertCsvToJson();
      if (result.success) {
        logger.info("Data conversion completed successfully");
        process.exit(0);
      } else {
        logger.error(`Data conversion failed: ${result.error}`);
        process.exit(1);
      }
    } catch (error) {
      logger.error(`Unhandled error: ${error.message}`);
      process.exit(1);
    }
  });

program
  .command("group")
  .description("Run only the series grouping stage")
  .option("-v, --verbose", "Enable verbose output")
  .action(async (options) => {
    logger.info("Running series grouping stage");
    try {
      const result = await seriesGrouping.groupAnimeIntoSeries();
      if (result.success) {
        logger.info("Series grouping completed successfully");
        process.exit(0);
      } else {
        logger.error(`Series grouping failed: ${result.error}`);
        process.exit(1);
      }
    } catch (error) {
      logger.error(`Unhandled error: ${error.message}`);
      process.exit(1);
    }
  });

program
  .command("split")
  .description("Run only the advanced series split stage")
  .option("-v, --verbose", "Enable verbose output")
  .action(async (options) => {
    logger.info("Running advanced series split stage");
    try {
      const result = await advancedSeriesSplit.advancedSeriesSplit();
      if (result.success) {
        logger.info("Advanced series split completed successfully");
        process.exit(0);
      } else {
        logger.error(`Advanced series split failed: ${result.error}`);
        process.exit(1);
      }
    } catch (error) {
      logger.error(`Unhandled error: ${error.message}`);
      process.exit(1);
    }
  });

// Utility commands
program
  .command("clean")
  .description("Clean output directories")
  .option("-a, --all", "Clean all directories (logs, results, db)")
  .option("-l, --logs", "Clean logs directory")
  .option("-r, --results", "Clean results directory")
  .option("-d, --db", "Clean db directory")
  .action((options) => {
    if (options.all || options.logs) {
      const logsDir = path.join(process.cwd(), "logs");
      if (fs.existsSync(logsDir)) {
        fs.readdirSync(logsDir)
          .filter((file) => file.endsWith(".log") || file.endsWith(".json"))
          .forEach((file) => {
            fs.unlinkSync(path.join(logsDir, file));
          });
        logger.info("Cleaned logs directory");
      }
    }

    if (options.all || options.results) {
      const resultsDir = path.join(process.cwd(), "results");
      if (fs.existsSync(resultsDir)) {
        fs.readdirSync(resultsDir)
          .filter((file) => file.endsWith(".json"))
          .forEach((file) => {
            fs.unlinkSync(path.join(resultsDir, file));
          });
        logger.info("Cleaned results directory");
      }
    }

    if (options.all || options.db) {
      const dbDir = path.join(process.cwd(), "db");
      if (fs.existsSync(dbDir)) {
        fs.readdirSync(dbDir)
          .filter((file) => file.endsWith(".json"))
          .forEach((file) => {
            fs.unlinkSync(path.join(dbDir, file));
          });
        logger.info("Cleaned db directory");
      }
    }

    if (!options.all && !options.logs && !options.results && !options.db) {
      logger.info(
        "No directories specified for cleaning. Use --all, --logs, --results, or --db options."
      );
    }
  });

program
  .command("status")
  .description("Show status of the pipeline data")
  .action(() => {
    const status = {
      data: {
        exists: false,
        files: [],
        count: 0,
      },
      results: {
        exists: false,
        files: [],
        count: 0,
      },
      db: {
        exists: false,
        files: [],
        count: 0,
      },
    };

    // Check data directory
    const dataDir = path.join(process.cwd(), "data");
    if (fs.existsSync(dataDir)) {
      status.data.exists = true;
      status.data.files = fs
        .readdirSync(dataDir)
        .filter((file) => file.endsWith(".csv"));
      status.data.count = status.data.files.length;
    }

    // Check results directory
    const resultsDir = path.join(process.cwd(), "results");
    if (fs.existsSync(resultsDir)) {
      status.results.exists = true;
      status.results.files = fs
        .readdirSync(resultsDir)
        .filter((file) => file.endsWith(".json"));
      status.results.count = status.results.files.length;
    }

    // Check db directory
    const dbDir = path.join(process.cwd(), "db");
    if (fs.existsSync(dbDir)) {
      status.db.exists = true;
      status.db.files = fs
        .readdirSync(dbDir)
        .filter((file) => file.endsWith(".json"));
      status.db.count = status.db.files.length;
    }

    // Log status
    logger.info("Pipeline Status:");
    logger.info(
      `Data directory: ${status.data.exists ? "Exists" : "Missing"}, ${
        status.data.count
      } CSV files`
    );
    if (status.data.count > 0) {
      status.data.files.forEach((file) => logger.info(`  - ${file}`));
    }

    logger.info(
      `Results directory: ${status.results.exists ? "Exists" : "Missing"}, ${
        status.results.count
      } JSON files`
    );
    if (status.results.count > 0) {
      status.results.files.forEach((file) => logger.info(`  - ${file}`));
    }

    logger.info(
      `DB directory: ${status.db.exists ? "Exists" : "Missing"}, ${
        status.db.count
      } JSON files`
    );
    if (status.db.count > 0) {
      status.db.files.forEach((file) => logger.info(`  - ${file}`));
    }
  });

// Parse command line arguments
program.parse(process.argv);

// If no arguments provided, show help
if (process.argv.length <= 2) {
  program.help();
}
