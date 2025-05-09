#!/usr/bin/env node

/**
 * Anime Data Processing Pipeline
 *
 * This script orchestrates the execution of multiple data processing stages:
 * 1. Data Conversion: Converting CSV data to JSON
 * 2. Series Grouping: Grouping anime into series based on relations
 * 3. Advanced Series Split: Further splitting series based on relation types
 *
 * Each stage is monitored for performance and logs are generated.
 */

const path = require("path");
const fs = require("fs");

// Import utilities
const logger = require("./utils/logger").getLogger("pipeline");
const monitor = require("./utils/monitor");

// Import pipeline stages
const dataConversion = require("./1-data-conversion");
const seriesGrouping = require("./2-series-grouping");
const advancedSeriesSplit = require("./3-advanced-series-split");

/**
 * Main pipeline function
 * @param {Object} options - Pipeline options
 * @returns {Promise<Object>} Pipeline results
 */
async function runPipeline(options = {}) {
  logger.info("Starting anime data processing pipeline");

  try {
    // Ensure required directories exist
    ensureDirectories();

    // Stage 1: Data Conversion (CSV to JSON)
    monitor.startStage("data-conversion");
    let conversionResult;
    try {
      conversionResult = await dataConversion.convertCsvToJson();
      if (!conversionResult.success) {
        logger.error(`Data conversion failed: ${conversionResult.error}`);
        monitor.endStage(
          "data-conversion",
          false,
          new Error(conversionResult.error)
        );
        return { success: false, error: conversionResult.error };
      }
      monitor.endStage("data-conversion", true);
    } catch (error) {
      logger.error(`Error in data conversion stage: ${error.message}`);
      monitor.endStage("data-conversion", false, error);
      return { success: false, error: error.message };
    }

    // Stage 2: Series Grouping
    monitor.startStage("series-grouping");
    let groupingResult;
    try {
      groupingResult = await seriesGrouping.groupAnimeIntoSeries();
      if (!groupingResult.success) {
        logger.error(`Series grouping failed: ${groupingResult.error}`);
        monitor.endStage(
          "series-grouping",
          false,
          new Error(groupingResult.error)
        );
        return { success: false, error: groupingResult.error };
      }
      monitor.endStage("series-grouping", true);
    } catch (error) {
      logger.error(`Error in series grouping stage: ${error.message}`);
      monitor.endStage("series-grouping", false, error);
      return { success: false, error: error.message };
    }

    // Stage 3: Advanced Series Split
    monitor.startStage("advanced-series-split");
    let splitResult;
    try {
      splitResult = await advancedSeriesSplit.advancedSeriesSplit();
      if (!splitResult.success) {
        logger.error(`Advanced series split failed: ${splitResult.error}`);
        monitor.endStage(
          "advanced-series-split",
          false,
          new Error(splitResult.error)
        );
        return { success: false, error: splitResult.error };
      }
      monitor.endStage("advanced-series-split", true);
    } catch (error) {
      logger.error(`Error in advanced series split stage: ${error.message}`);
      monitor.endStage("advanced-series-split", false, error);
      return { success: false, error: error.message };
    }

    // Complete monitoring and generate report
    const metrics = monitor.completeMonitoring();

    // Generate summary
    const summary = {
      success: true,
      processedFiles: conversionResult.processed,
      seriesCreated: groupingResult.seriesCount,
      advancedSplitGroups: {
        main: splitResult.splitResults.main,
        character: splitResult.splitResults.character,
        adaptation: splitResult.splitResults.adaptation,
        spinOff: splitResult.splitResults.spinOff,
        other: splitResult.splitResults.other,
        parent: splitResult.splitResults.parent,
      },
      executionTime: `${Math.round(metrics.totalDuration / 1000)}s`,
    };

    logger.info("Pipeline completed successfully");
    logger.object("Summary", summary);

    return {
      success: true,
      summary,
    };
  } catch (error) {
    logger.error(`Pipeline execution failed: ${error.message}`);
    logger.error(error.stack);

    // Complete monitoring even in case of error
    monitor.completeMonitoring();

    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Ensure required directories exist
 */
function ensureDirectories() {
  const requiredDirs = [
    path.join(process.cwd(), "data"),
    path.join(process.cwd(), "results"),
    path.join(process.cwd(), "db"),
    path.join(process.cwd(), "logs"),
  ];

  requiredDirs.forEach((dir) => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      logger.info(`Created directory: ${dir}`);
    }
  });
}

// Run the pipeline if called directly
if (require.main === module) {
  runPipeline()
    .then((result) => {
      if (!result.success) {
        process.exit(1);
      }
    })
    .catch((error) => {
      logger.error(`Unhandled error in pipeline: ${error.message}`);
      process.exit(1);
    });
}

module.exports = { runPipeline };
