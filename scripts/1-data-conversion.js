const fs = require("fs");
const csvParser = require("csv-parser");
const path = require("path");

// Setup logger
const logger = require("./utils/logger").getLogger("data-conversion");

/**
 * Converts CSV files from the data directory to JSON files in the results directory
 * @returns {Promise<object>} Processing results
 */
async function convertCsvToJson() {
  logger.info("Starting CSV to JSON conversion");

  // Create directories if they don't exist
  const RESULTS_DIR = path.join(process.cwd(), "results");
  const DATA_DIR = path.join(process.cwd(), "data");

  try {
    if (!fs.existsSync(RESULTS_DIR)) {
      fs.mkdirSync(RESULTS_DIR, { recursive: true });
      logger.info(`Created directory: ${RESULTS_DIR}`);
    }

    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      logger.info(`Created directory: ${DATA_DIR}`);
    }

    // Get all CSV files from the data directory
    const csvFiles = fs
      .readdirSync(DATA_DIR)
      .filter((file) => file.endsWith(".csv"));

    if (csvFiles.length === 0) {
      logger.warn("No CSV files found in the data directory.");
      return { success: false, error: "No CSV files found" };
    }

    logger.info(`Found ${csvFiles.length} CSV files to process`);

    // Process each CSV file
    const results = await Promise.all(
      csvFiles.map((csvFile) => processFile(csvFile, DATA_DIR, RESULTS_DIR))
    );

    const processedCount = results.reduce(
      (count, result) => count + (result.success ? 1 : 0),
      0
    );

    logger.info(
      `CSV conversion complete: ${processedCount}/${csvFiles.length} files processed successfully`
    );

    return {
      success: processedCount > 0,
      processed: processedCount,
      total: csvFiles.length,
      results: results,
    };
  } catch (error) {
    logger.error(`Error in CSV to JSON conversion: ${error.message}`);
    logger.error(error.stack);
    return { success: false, error: error.message };
  }
}

/**
 * Process a single CSV file and convert it to JSON
 * @param {string} csvFile - Filename of the CSV file to process
 * @param {string} dataDir - Data directory path
 * @param {string} resultsDir - Results directory path
 * @returns {Promise<object>} Processing result
 */
function processFile(csvFile, dataDir, resultsDir) {
  return new Promise((resolve) => {
    const csvFilePath = path.join(dataDir, csvFile);
    const jsonFileName = csvFile.replace(".csv", ".json");
    const outputFilePath = path.join(resultsDir, jsonFileName);

    logger.info(`Processing ${csvFile}...`);

    const finalData = [];
    let processedCount = 0;

    fs.createReadStream(csvFilePath)
      .pipe(csvParser())
      .on("data", (data) => {
        finalData.push(data);
        processedCount++;
      })
      .on("end", () => {
        try {
          // Save data with proper JSON formatting
          const jsonData = JSON.stringify(finalData, null, 2) + "\n";
          fs.writeFileSync(outputFilePath, jsonData);
          logger.info(`Saved ${finalData.length} records to ${outputFilePath}`);

          // Verify JSON is valid
          const readBack = fs.readFileSync(outputFilePath, "utf8");
          JSON.parse(readBack); // Will throw if invalid

          resolve({
            success: true,
            file: csvFile,
            recordCount: finalData.length,
            outputPath: outputFilePath,
          });
        } catch (err) {
          logger.error(
            `Error saving JSON file ${outputFilePath}: ${err.message}`
          );
          resolve({ success: false, file: csvFile, error: err.message });
        }
      })
      .on("error", (err) => {
        logger.error(
          `Error processing CSV file ${csvFilePath}: ${err.message}`
        );
        resolve({ success: false, file: csvFile, error: err.message });
      });
  });
}

// For standalone usage
if (require.main === module) {
  convertCsvToJson()
    .then((result) => {
      if (!result.success) {
        process.exit(1);
      }
    })
    .catch((err) => {
      logger.error(`Fatal error: ${err.message}`);
      process.exit(1);
    });
}

module.exports = { convertCsvToJson };
