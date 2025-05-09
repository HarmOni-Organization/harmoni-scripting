const fs = require("fs");
const path = require("path");

// Setup logger
const logger = require("./utils/logger").getLogger("series-grouping");

/**
 * Groups anime data into series based on relations
 * @returns {Promise<object>} Processing results
 */
async function groupAnimeIntoSeries() {
  logger.info("Starting anime series grouping process");

  try {
    // Paths for the files
    const RESULTS_DIR = path.join(process.cwd(), "results");
    const ANIME_DATA_PATH = path.join(
      RESULTS_DIR,
      "anilist_anime_data_complete.json"
    );
    const SERIES_OUTPUT_PATH = path.join(RESULTS_DIR, "main_series.json");
    const EDGE_CASES_PATH = path.join(RESULTS_DIR, "edge_cases.json");
    const UPDATED_ANIME_PATH = path.join(
      RESULTS_DIR,
      "anime_data_updated.json"
    );

    // Ensure results directory exists
    if (!fs.existsSync(RESULTS_DIR)) {
      fs.mkdirSync(RESULTS_DIR, { recursive: true });
      logger.info(`Created directory: ${RESULTS_DIR}`);
    }

    // Read anime data
    const animeData = readAnimeData(ANIME_DATA_PATH);
    logger.info(`Read ${animeData.length} anime records`);

    // Group anime into series
    const { series, edgeCases } = groupAnimeIntoSeries_internal(animeData);
    logger.info(`Created ${series.length} series groups`);
    logger.info(
      `Found ${edgeCases.animeInMultipleSeries.length} anime in multiple series`
    );
    logger.info(`Found ${edgeCases.orphanedAnime.length} orphaned anime`);
    logger.info(
      `Found ${edgeCases.circularRelations.length} circular relations`
    );

    // Update anime data with series IDs
    const updatedAnimeData = updateAnimeData(animeData, { series });

    // Save the results
    fs.writeFileSync(
      SERIES_OUTPUT_PATH,
      JSON.stringify({ series }, null, 2) + "\n"
    );
    logger.info(`Saved series data to ${SERIES_OUTPUT_PATH}`);

    fs.writeFileSync(
      EDGE_CASES_PATH,
      JSON.stringify(edgeCases, null, 2) + "\n"
    );
    logger.info(`Saved edge cases to ${EDGE_CASES_PATH}`);

    fs.writeFileSync(
      UPDATED_ANIME_PATH,
      JSON.stringify(updatedAnimeData, null, 2) + "\n"
    );
    logger.info(`Saved updated anime data to ${UPDATED_ANIME_PATH}`);

    // Copy to db directory for advanced split
    const DB_DIR = path.join(process.cwd(), "db");
    if (!fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true });
      logger.info(`Created directory: ${DB_DIR}`);
    }

    const DB_SERIES_PATH = path.join(DB_DIR, "series.json");
    fs.copyFileSync(SERIES_OUTPUT_PATH, DB_SERIES_PATH);
    logger.info(`Copied series data to ${DB_SERIES_PATH}`);

    // Log summary for important series
    logSeriesSummary(series);

    return {
      success: true,
      seriesCount: series.length,
      edgeCasesCount: {
        animeInMultipleSeries: edgeCases.animeInMultipleSeries.length,
        orphanedAnime: edgeCases.orphanedAnime.length,
        circularRelations: edgeCases.circularRelations.length,
      },
    };
  } catch (error) {
    logger.error(`Error in anime series grouping: ${error.message}`);
    logger.error(error.stack);
    return { success: false, error: error.message };
  }
}

/**
 * Read the anime data from JSON file
 * @param {string} dataPath - Path to the anime data file
 * @returns {Array} Anime data array
 */
function readAnimeData(dataPath) {
  try {
    const data = fs.readFileSync(dataPath, "utf8");
    return JSON.parse(data);
  } catch (error) {
    logger.error(`Error reading anime data: ${error.message}`);
    throw error;
  }
}

/**
 * Log summary information for important series
 * @param {Array} series - Array of series objects
 */
function logSeriesSummary(series) {
  logger.info("\nSeries Summary:");

  // Get top 5 series by anime count
  const topSeriesBySize = [...series]
    .sort((a, b) => b.animeIds.length - a.animeIds.length)
    .slice(0, 5);

  topSeriesBySize.forEach((series, index) => {
    logger.info(`Top Series #${index + 1}:`);
    logger.info(`- ID: ${series.seriesId}`);
    logger.info(`- Name: ${series.seriesName}`);
    logger.info(`- Contains ${series.animeIds.length} anime`);
    logger.info(
      `- Relation types: ${Object.keys(series.relationTypes).join(", ")}`
    );
  });
}

/**
 * Generate a unique series ID based on the first anime's title
 * @param {Array} animeDetails - Array of anime objects
 * @param {Set} existingIds - Set of existing series IDs
 * @returns {string} Unique series ID
 */
function generateSeriesId(animeDetails, existingIds = new Set()) {
  // Get the first anime in the group
  const firstAnime = animeDetails[0];

  if (!firstAnime || !firstAnime.title) {
    return `series_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  }

  // Create a slug from the title
  let slug = firstAnime.title
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");

  // Limit the length
  slug = slug.substring(0, 30);

  // Add a unique suffix if needed
  let seriesId = slug;
  let counter = 1;

  while (existingIds.has(seriesId)) {
    seriesId = `${slug}_${counter}`;
    counter++;
  }

  return seriesId;
}

/**
 * Find all related anime IDs recursively
 * @param {string} animeId - Anime ID to start from
 * @param {object} animeMap - Map of anime objects by ID
 * @param {Set} processedIds - Set of already processed anime IDs
 * @param {Map} relationChains - Map of relation chains for circular detection
 * @returns {Set} Set of related anime IDs
 */
function findAllRelatedIds(
  animeId,
  animeMap,
  processedIds = new Set(),
  relationChains = new Map()
) {
  if (processedIds.has(animeId)) return processedIds;

  processedIds.add(animeId);
  const anime = animeMap[animeId];

  if (!anime || !anime.relations) return processedIds;

  // Process all relations
  anime.relations.forEach((relation) => {
    const targetId = relation.targetAnimeId || relation.id;

    if (!targetId) return;

    // Track relation chain for circular detection
    const currentChain = relationChains.get(animeId) || [];
    const newChain = [...currentChain, animeId];

    // Check for circular relations
    if (currentChain.includes(targetId)) {
      logger.warn(
        `Circular relation detected: ${currentChain.join("->")}->${targetId}`
      );
      // This will be handled later in the edge cases
    }

    relationChains.set(targetId, newChain);

    if (!processedIds.has(targetId)) {
      findAllRelatedIds(targetId, animeMap, processedIds, relationChains);
    }
  });

  return processedIds;
}

/**
 * Internal function to group anime into series based on relations
 * @param {Array} animeData - Array of anime objects
 * @returns {object} Object containing series and edge cases
 */
function groupAnimeIntoSeries_internal(animeData) {
  const animeMap = {};
  const series = [];
  const processedIds = new Set();
  const seriesIds = new Set();
  const edgeCases = {
    animeInMultipleSeries: [],
    orphanedAnime: [],
    circularRelations: [],
  };

  // Track anime-to-series mapping
  const animeToSeries = new Map();

  // Create a map of anime by ID for quick lookup
  animeData.forEach((anime) => {
    // Parse string representations of arrays
    try {
      if (anime.relations && typeof anime.relations === "string") {
        anime.relations = JSON.parse(anime.relations);
      }
    } catch (error) {
      logger.warn(
        `Error parsing relations for anime ${anime.id}: ${error.message}`
      );
      anime.relations = [];
    }

    // Normalize relations if they exist
    if (anime.relations && Array.isArray(anime.relations)) {
      anime.relations = anime.relations.map((rel) => {
        // If relation is just an ID, convert it to object format
        if (typeof rel === "string" || typeof rel === "number") {
          return {
            targetAnimeId: rel.toString(),
            relationType: "UNKNOWN",
          };
        }

        // Handle special case where relation has node with ID
        if (rel.node && rel.node.id) {
          return {
            targetAnimeId: rel.node.id.toString(),
            relationType: rel.relationType || "UNKNOWN",
          };
        }

        // If relation has id but not targetAnimeId, standardize it
        if (rel.id && !rel.targetAnimeId) {
          return {
            ...rel,
            targetAnimeId: rel.id.toString(),
            relationType: rel.relationType || rel.type || "UNKNOWN",
          };
        }

        return rel;
      });
    } else {
      anime.relations = [];
    }

    animeMap[anime.id] = anime;
  });

  // Process each anime
  animeData.forEach((anime) => {
    // Skip if already processed
    if (processedIds.has(anime.id)) return;

    // Skip if no relations (handle as orphaned)
    if (!anime.relations || anime.relations.length === 0) {
      edgeCases.orphanedAnime.push({
        animeId: anime.id,
        title: anime.title,
        reason: "No relations found",
      });
      processedIds.add(anime.id);
      return;
    }

    // Find all related anime IDs
    const relationChains = new Map();
    const relatedIds = findAllRelatedIds(
      anime.id,
      animeMap,
      new Set(),
      relationChains
    );

    // Skip if only the anime itself is found
    if (relatedIds.size === 1) {
      edgeCases.orphanedAnime.push({
        animeId: anime.id,
        title: anime.title,
        reason: "No reciprocal relations found",
      });
      processedIds.add(anime.id);
      return;
    }

    // Check for conflicts (anime already in another series)
    const conflictingAnime = Array.from(relatedIds).filter((id) =>
      animeToSeries.has(id)
    );

    if (conflictingAnime.length > 0) {
      conflictingAnime.forEach((id) => {
        const existingSeries = animeToSeries.get(id);

        edgeCases.animeInMultipleSeries.push({
          animeId: id,
          title: animeMap[id]?.title || "Unknown",
          foundInSeries: [
            {
              seriesId: existingSeries,
              seriesName: existingSeries, // Could look up the actual name here
            },
            {
              seriesId: "proposed_new_series",
              seriesName: "Proposed New Series",
            },
          ],
        });
      });

      // Skip creating this series due to conflicts
      // Mark all as processed so we don't create redundant edge cases
      relatedIds.forEach((id) => processedIds.add(id));
      return;
    }

    // Get anime details for all related IDs
    const animeDetails = Array.from(relatedIds)
      .map((id) => animeMap[id])
      .filter(Boolean);

    // Generate a unique series ID
    const seriesId = generateSeriesId(animeDetails, seriesIds);
    seriesIds.add(seriesId);

    // Create a new series object
    const seriesGroup = {
      seriesId: seriesId,
      seriesName: animeDetails[0]?.title || `Series ${series.length + 1}`,
      animeIds: Array.from(relatedIds),
      animeDetails: {},
      relations: [],
      relationTypes: {},
    };

    // Add anime details to the series
    animeDetails.forEach((anime) => {
      // Add to animeDetails
      seriesGroup.animeDetails[anime.id] = {
        id: anime.id,
        title: anime.title_romaji || anime.title || "Unknown Title",
      };

      // Update the anime with seriesId
      anime.seriesId = seriesId;

      // Track which series this anime belongs to
      animeToSeries.set(anime.id, seriesId);

      // Process relations for each anime
      if (anime.relations) {
        anime.relations.forEach((relation) => {
          const targetId = relation.targetAnimeId || relation.id;
          const relationType =
            relation.relationType || relation.type || "UNKNOWN";

          // Add to relations array
          seriesGroup.relations.push({
            sourceAnimeId: anime.id,
            targetAnimeId: targetId,
            relationType: relationType,
            direction: "forward",
          });

          // Initialize relation type array if not exists
          if (!seriesGroup.relationTypes[relationType]) {
            seriesGroup.relationTypes[relationType] = [];
          }

          // Add to relationTypes if not already present
          const relationKey = `${anime.id}->${targetId}`;
          if (!seriesGroup.relationTypes[relationType].includes(relationKey)) {
            seriesGroup.relationTypes[relationType].push(relationKey);
          }
        });
      }
    });

    series.push(seriesGroup);
    relatedIds.forEach((id) => processedIds.add(id));
  });

  return { series, edgeCases };
}

/**
 * Update the anime data with series IDs
 * @param {Array} animeData - Array of anime objects
 * @param {object} seriesData - Object containing series data
 * @returns {Array} Updated anime data
 */
function updateAnimeData(animeData, seriesData) {
  const seriesMap = new Map();

  // Create a map of anime ID to series ID
  seriesData.series.forEach((series) => {
    series.animeIds.forEach((animeId) => {
      seriesMap.set(animeId.toString(), series.seriesId);
    });
  });

  // Update anime data with series IDs
  return animeData.map((anime) => {
    const seriesId = seriesMap.get(anime.id.toString());
    if (seriesId) {
      return { ...anime, seriesId };
    }
    return anime;
  });
}

// For standalone usage
if (require.main === module) {
  groupAnimeIntoSeries()
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

module.exports = { groupAnimeIntoSeries };
