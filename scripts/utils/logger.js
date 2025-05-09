const fs = require("fs");
const path = require("path");
const util = require("util");

// Create logs directory if it doesn't exist
const logsDir = path.join(process.cwd(), "logs");
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

/**
 * Formatted timestamp for logs
 * @returns {string} Formatted timestamp
 */
function getTimestamp() {
  const now = new Date();
  return now.toISOString();
}

/**
 * Create a logger instance for a specific component
 * @param {string} component - Component name for the logger
 * @returns {object} Logger object with logging methods
 */
function getLogger(component) {
  const logFile = path.join(logsDir, `${component}.log`);
  const errorFile = path.join(logsDir, `${component}.error.log`);

  // Create or append to log files
  if (!fs.existsSync(logFile)) {
    fs.writeFileSync(logFile, "");
  }

  if (!fs.existsSync(errorFile)) {
    fs.writeFileSync(errorFile, "");
  }

  /**
   * Write to log file
   * @param {string} level - Log level
   * @param {string} message - Log message
   * @param {boolean} isError - Whether to write to error log
   */
  function writeToLog(level, message, isError = false) {
    const timestamp = getTimestamp();
    const logEntry = `[${timestamp}] [${level}] [${component}] ${message}\n`;

    // Write to console
    const consoleMethod = isError ? "error" : level === "WARN" ? "warn" : "log";
    console[consoleMethod](logEntry.trim());

    // Write to file
    fs.appendFileSync(logFile, logEntry);

    // Also write to error log if it's an error
    if (isError) {
      fs.appendFileSync(errorFile, logEntry);
    }
  }

  return {
    /**
     * Log info message
     * @param {string} message - Log message
     */
    info: (message) => {
      writeToLog("INFO", message);
    },

    /**
     * Log warning message
     * @param {string} message - Log message
     */
    warn: (message) => {
      writeToLog("WARN", message);
    },

    /**
     * Log error message
     * @param {string} message - Log message
     */
    error: (message) => {
      writeToLog("ERROR", message, true);
    },

    /**
     * Log debug message
     * @param {string} message - Log message
     */
    debug: (message) => {
      writeToLog("DEBUG", message);
    },

    /**
     * Log object with pretty formatting
     * @param {string} message - Message prefix
     * @param {object} obj - Object to log
     */
    object: (message, obj) => {
      const objString = util.inspect(obj, { depth: null, colors: false });
      writeToLog("INFO", `${message}: ${objString}`);
    },
  };
}

module.exports = { getLogger };
