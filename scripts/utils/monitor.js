const os = require("os");
const path = require("path");
const fs = require("fs");

// Setup monitoring
const startTime = new Date();
const metrics = {
  startTime,
  endTime: null,
  stages: {},
  memory: {},
  cpu: {},
  errors: [],
};

/**
 * Get the logger instance
 */
const logger = require("./logger").getLogger("monitor");

/**
 * Start monitoring a stage
 * @param {string} stageName - Name of the stage
 */
function startStage(stageName) {
  logger.info(`Starting stage: ${stageName}`);
  metrics.stages[stageName] = {
    startTime: new Date(),
    endTime: null,
    duration: null,
    success: null,
    error: null,
  };

  // Track memory and CPU at start
  trackResources(stageName, "start");
}

/**
 * End monitoring for a stage
 * @param {string} stageName - Name of the stage
 * @param {boolean} success - Whether the stage was successful
 * @param {Error} error - Error object if the stage failed
 */
function endStage(stageName, success, error = null) {
  const now = new Date();

  if (!metrics.stages[stageName]) {
    logger.warn(`Trying to end a stage that wasn't started: ${stageName}`);
    return;
  }

  metrics.stages[stageName].endTime = now;
  metrics.stages[stageName].duration =
    now - metrics.stages[stageName].startTime;
  metrics.stages[stageName].success = success;

  if (error) {
    metrics.stages[stageName].error = {
      message: error.message,
      stack: error.stack,
    };
    metrics.errors.push({
      stage: stageName,
      time: now,
      error: error.message,
      stack: error.stack,
    });

    logger.error(`Stage ${stageName} failed: ${error.message}`);
  } else {
    logger.info(
      `Stage ${stageName} completed in ${metrics.stages[stageName].duration}ms`
    );
  }

  // Track memory and CPU at end
  trackResources(stageName, "end");
}

/**
 * Track system resources
 * @param {string} stageName - Name of the stage
 * @param {string} marker - Marker for the resource snapshot ('start' or 'end')
 */
function trackResources(stageName, marker) {
  const memoryUsage = process.memoryUsage();
  const cpuUsage = os.loadavg();

  // Initialize objects if needed
  if (!metrics.memory[stageName]) {
    metrics.memory[stageName] = {};
  }

  if (!metrics.cpu[stageName]) {
    metrics.cpu[stageName] = {};
  }

  // Store memory metrics
  metrics.memory[stageName][marker] = {
    rss: memoryUsage.rss / 1024 / 1024, // RSS in MB
    heapTotal: memoryUsage.heapTotal / 1024 / 1024, // Heap total in MB
    heapUsed: memoryUsage.heapUsed / 1024 / 1024, // Heap used in MB
    external: memoryUsage.external / 1024 / 1024, // External in MB
  };

  // Store CPU metrics
  metrics.cpu[stageName][marker] = {
    loadAvg1: cpuUsage[0],
    loadAvg5: cpuUsage[1],
    loadAvg15: cpuUsage[2],
    cpuCount: os.cpus().length,
  };
}

/**
 * Complete the monitoring process and generate a report
 * @returns {object} Monitoring report
 */
function completeMonitoring() {
  metrics.endTime = new Date();
  metrics.totalDuration = metrics.endTime - metrics.startTime;

  logger.info(`Pipeline completed in ${metrics.totalDuration}ms`);

  // Calculate success rate
  const stageNames = Object.keys(metrics.stages);
  const stageCount = stageNames.length;
  const successCount = stageNames.filter(
    (stage) => metrics.stages[stage].success
  ).length;
  metrics.successRate = stageCount > 0 ? (successCount / stageCount) * 100 : 0;

  // Save metrics to file
  const metricsFile = path.join(
    process.cwd(),
    "logs",
    `pipeline-metrics-${new Date().toISOString().replace(/:/g, "-")}.json`
  );
  fs.writeFileSync(metricsFile, JSON.stringify(metrics, null, 2));

  logger.info(`Monitoring metrics saved to ${metricsFile}`);

  return metrics;
}

/**
 * Get the current monitoring metrics
 * @returns {object} Current monitoring metrics
 */
function getMetrics() {
  return { ...metrics };
}

module.exports = {
  startStage,
  endStage,
  completeMonitoring,
  getMetrics,
};
