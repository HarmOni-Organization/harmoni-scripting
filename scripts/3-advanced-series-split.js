const fs = require("fs");
const path = require("path");

// Setup logger
const logger = require("./utils/logger").getLogger("advanced-series-split");

/**
 * Split series into different categories based on relation types
 * @returns {Promise<object>} Processing results
 */
async function advancedSeriesSplit() {
  logger.info("Starting advanced series split process");

  try {
    // Constants
    const DB_DIR = path.join(process.cwd(), "db");
    const SERIES_DB_PATH = path.join(DB_DIR, "series.json");
    const OUTPUT_PATH = path.join(DB_DIR, "advanced_split_series.json");
    const ANIME_DATA_PATH = path.join(
      process.cwd(),
      "results",
      "anilist_anime_data_complete.json"
    );

    // Ensure db directory exists
    if (!fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true });
      logger.info(`Created directory: ${DB_DIR}`);
    }

    // Read the series database and anime data
    logger.info("Reading data files...");

    if (!fs.existsSync(SERIES_DB_PATH)) {
      throw new Error(`Series database file not found: ${SERIES_DB_PATH}`);
    }

    const seriesDb = JSON.parse(fs.readFileSync(SERIES_DB_PATH, "utf8"));
    logger.info(`Loaded ${seriesDb.series.length} series records`);

    let animeMap = {};

    try {
      if (!fs.existsSync(ANIME_DATA_PATH)) {
        logger.warn(`Anime data file not found: ${ANIME_DATA_PATH}`);
        logger.warn("Series names will use IDs instead of titles");
      } else {
        const animeData = JSON.parse(fs.readFileSync(ANIME_DATA_PATH, "utf8"));
        logger.info(`Loaded ${animeData.length} anime records`);

        // Create a map of anime by ID for quick lookup
        animeData.forEach((anime) => {
          animeMap[anime.id] = anime;
        });
      }
    } catch (error) {
      logger.warn(`Warning: Could not load anime data: ${error.message}`);
      logger.warn("Series names will use IDs instead of titles");
    }

    // Process all series
    logger.info("Processing series data...");
    const splitSeriesResults = {
      main: [],
      character: [],
      adaptation: [],
      spinOff: [],
      other: [],
      parent: [],
    };

    for (let i = 0; i < seriesDb.series.length; i++) {
      const series = seriesDb.series[i];
      logger.info(
        `Processing series ${i + 1}/${seriesDb.series.length}: ${
          series.seriesName
        }`
      );
      const results = processSeriesData(series, animeMap);

      splitSeriesResults.main.push(...results.main);
      splitSeriesResults.character.push(...results.character);
      splitSeriesResults.adaptation.push(...results.adaptation);
      splitSeriesResults.spinOff.push(...results.spinOff);
      splitSeriesResults.other.push(...results.other);
      splitSeriesResults.parent.push(...results.parent);
    }

    // Prepare output
    const output = {
      main: splitSeriesResults.main,
      character: splitSeriesResults.character,
      adaptation: splitSeriesResults.adaptation,
      spinOff: splitSeriesResults.spinOff,
      other: splitSeriesResults.other,
      parent: splitSeriesResults.parent,
    };

    // Write the results to the new file
    logger.info("Writing results to file...");
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2));
    logger.info(`Results written to: ${OUTPUT_PATH}`);

    // Print summary
    logger.info("\nSummary:");
    logger.info(`- Original series: ${seriesDb.series.length}`);
    logger.info(`- Main series groups: ${output.main.length}`);
    logger.info(`- Character relation groups: ${output.character.length}`);
    logger.info(`- Adaptation relation groups: ${output.adaptation.length}`);
    logger.info(`- Spin-off relation groups: ${output.spinOff.length}`);
    logger.info(`- Other relation groups: ${output.other.length}`);
    logger.info(`- Parent relation groups: ${output.parent.length}`);

    return {
      success: true,
      originalSeriesCount: seriesDb.series.length,
      splitResults: {
        main: output.main.length,
        character: output.character.length,
        adaptation: output.adaptation.length,
        spinOff: output.spinOff.length,
        other: output.other.length,
        parent: output.parent.length,
      },
    };
  } catch (error) {
    logger.error(`Error in advanced series split: ${error.message}`);
    logger.error(error.stack);
    return { success: false, error: error.message };
  }
}

/**
 * Graph utility class for finding connected components
 */
class Graph {
  constructor() {
    this.adjacencyList = new Map();
  }

  addVertex(vertex) {
    if (!this.adjacencyList.has(vertex)) {
      this.adjacencyList.set(vertex, []);
    }
  }

  addEdge(source, target) {
    this.addVertex(source);
    this.addVertex(target);
    this.adjacencyList.get(source).push(target);
    this.adjacencyList.get(target).push(source); // Undirected graph
  }

  dfs(start, visited = new Set()) {
    const group = new Set();
    const stack = [start];

    while (stack.length > 0) {
      const vertex = stack.pop();
      if (!visited.has(vertex)) {
        visited.add(vertex);
        group.add(vertex);

        const neighbors = this.adjacencyList.get(vertex) || [];
        for (const neighbor of neighbors) {
          if (!visited.has(neighbor)) {
            stack.push(neighbor);
          }
        }
      }
    }

    return group;
  }

  findConnectedGroups() {
    const visited = new Set();
    const groups = [];

    for (const vertex of this.adjacencyList.keys()) {
      if (!visited.has(vertex)) {
        const group = this.dfs(vertex, visited);
        groups.push(Array.from(group));
      }
    }

    return groups;
  }
}

/**
 * Helper function to find connected groups from relation maps
 * @param {Map} relationMap - Map of source IDs to Set of target IDs
 * @returns {Array} Array of connected groups (arrays of IDs)
 */
function findConnectedGroupsFromRelations(relationMap) {
  const graph = new Graph();
  for (const [sourceId, targets] of relationMap.entries()) {
    for (const targetId of targets) {
      graph.addEdge(sourceId, targetId);
    }
  }
  return graph.findConnectedGroups();
}

/**
 * Function to get series name from the oldest anime in the group
 * @param {Array} animeIds - Array of anime IDs
 * @param {object} animeMap - Map of anime objects by ID
 * @returns {string} Series name
 */
function getSeriesNameFromOldestAnime(animeIds, animeMap) {
  if (!animeIds || animeIds.length === 0) return "Unknown Series";

  // Sort by ID or start_date if available (assuming lower ID = older anime)
  const sortedIds = [...animeIds].sort((a, b) => {
    const animeA = animeMap[a];
    const animeB = animeMap[b];

    if (!animeA || !animeB) return Number(a) - Number(b);

    // If start_date is available, use it
    if (animeA.start_date && animeB.start_date) {
      const dateA = new Date(animeA.start_date);
      const dateB = new Date(animeB.start_date);

      if (!isNaN(dateA) && !isNaN(dateB)) {
        return dateA - dateB;
      }
    }

    // Otherwise sort by ID (assuming lower ID = older anime)
    return Number(a) - Number(b);
  });

  const oldestId = sortedIds[0];
  const oldestAnime = animeMap[oldestId];

  if (!oldestAnime) return `Series ${oldestId}`;

  // Use title_romaji if available, otherwise fallback to title
  return oldestAnime.title_romaji || oldestAnime.title || `Series ${oldestId}`;
}

/**
 * Process a single series to split it into different categories
 * @param {object} series - Series object
 * @param {object} animeMap - Map of anime objects by ID
 * @returns {object} Split series results
 */
function processSeriesData(series, animeMap) {
  const graph = new Graph();
  const characterRelations = new Map(); // Store CHARACTER relations
  const adaptationRelations = new Map(); // Store ADAPTATION relations
  const spinOffRelations = new Map(); // Store SPIN_OFF relations
  const otherRelations = new Map(); // Store OTHER relations
  const parentRelations = new Map(); // Store PARENT relations
  const allRelations = new Map(); // Store all relations for quick lookup

  // First pass: build the graph with non-special relations
  for (const relation of series.relations) {
    const { sourceAnimeId, targetAnimeId, relationType } = relation;

    // Store all relations for later reference
    const relationKey = `${sourceAnimeId}-${targetAnimeId}`;
    if (!allRelations.has(relationKey)) {
      allRelations.set(relationKey, relation);
    }

    // Handle special relation types
    if (relationType === "CHARACTER") {
      if (!characterRelations.has(sourceAnimeId)) {
        characterRelations.set(sourceAnimeId, new Set());
      }
      if (!characterRelations.has(targetAnimeId)) {
        characterRelations.set(targetAnimeId, new Set());
      }
      characterRelations.get(sourceAnimeId).add(targetAnimeId);
      characterRelations.get(targetAnimeId).add(sourceAnimeId);
    } else if (relationType === "ADAPTATION") {
      if (!adaptationRelations.has(sourceAnimeId)) {
        adaptationRelations.set(sourceAnimeId, new Set());
      }
      if (!adaptationRelations.has(targetAnimeId)) {
        adaptationRelations.set(targetAnimeId, new Set());
      }
      adaptationRelations.get(sourceAnimeId).add(targetAnimeId);
      adaptationRelations.get(targetAnimeId).add(sourceAnimeId);
    } else if (relationType === "SPIN_OFF") {
      if (!spinOffRelations.has(sourceAnimeId)) {
        spinOffRelations.set(sourceAnimeId, new Set());
      }
      if (!spinOffRelations.has(targetAnimeId)) {
        spinOffRelations.set(targetAnimeId, new Set());
      }
      spinOffRelations.get(sourceAnimeId).add(targetAnimeId);
      spinOffRelations.get(targetAnimeId).add(sourceAnimeId);
    } else if (relationType === "OTHER" || relationType === "PARENT") {
      if (!otherRelations.has(sourceAnimeId)) {
        otherRelations.set(sourceAnimeId, new Set());
      }
      if (!otherRelations.has(targetAnimeId)) {
        otherRelations.set(targetAnimeId, new Set());
      }
      otherRelations.get(sourceAnimeId).add(targetAnimeId);
      otherRelations.get(targetAnimeId).add(sourceAnimeId);

      // Also handle PARENT relations in a separate map
      if (relationType === "PARENT") {
        if (!parentRelations.has(sourceAnimeId)) {
          parentRelations.set(sourceAnimeId, new Set());
        }
        if (!parentRelations.has(targetAnimeId)) {
          parentRelations.set(targetAnimeId, new Set());
        }
        parentRelations.get(sourceAnimeId).add(targetAnimeId);
        parentRelations.get(targetAnimeId).add(sourceAnimeId);
      }
    } else {
      // Add other relations to the graph
      graph.addEdge(sourceAnimeId, targetAnimeId);
    }
  }

  // Find connected components (groups)
  const connectedGroups = graph.findConnectedGroups();

  // Process all results together
  const results = {
    main: [],
    character: [],
    adaptation: [],
    spinOff: [],
    other: [],
    parent: [],
  };

  // Process each main group
  connectedGroups.forEach((group, index) => {
    const groupSet = new Set(group);
    const otherIds = new Set();
    const characterIds = new Set();
    const adaptationIds = new Set();
    const spinOffIds = new Set();
    const uniqueRelations = new Map();

    // Collect relations and IDs
    for (const animeId of group) {
      // Check all relations involving this anime
      series.relations.forEach((relation) => {
        const { sourceAnimeId, targetAnimeId, relationType } = relation;

        if (sourceAnimeId === animeId || targetAnimeId === animeId) {
          const otherId =
            sourceAnimeId === animeId ? targetAnimeId : sourceAnimeId;

          if (relationType === "CHARACTER") {
            if (!groupSet.has(otherId)) {
              characterIds.add(otherId);
            }
          } else if (relationType === "ADAPTATION") {
            if (!groupSet.has(otherId)) {
              adaptationIds.add(otherId);
            }
          } else if (relationType === "SPIN_OFF") {
            if (!groupSet.has(otherId)) {
              spinOffIds.add(otherId);
            }
          } else {
            // Add non-special relations if at least one end is in the group
            if (groupSet.has(sourceAnimeId) && groupSet.has(targetAnimeId)) {
              // Internal relation
              const relationKey = `${sourceAnimeId}-${targetAnimeId}-${relationType}`;
              uniqueRelations.set(relationKey, relation);
            } else {
              // External relation
              otherIds.add(otherId);
            }
          }
        }
      });
    }

    // Get series name from oldest anime
    const seriesName = getSeriesNameFromOldestAnime(group, animeMap);
    const seriesId = `series_${series.seriesId}_${index + 1}`;

    // Create main series entry
    results.main.push({
      seriesId,
      seriesName,
      originalSeriesId: series.seriesId,
      animeIds: Array.from(group).sort((a, b) => Number(a) - Number(b)),
      otherIds: Array.from(otherIds).sort((a, b) => Number(a) - Number(b)),
      characterIds: Array.from(characterIds).sort(
        (a, b) => Number(a) - Number(b)
      ),
      adaptationIds: Array.from(adaptationIds).sort(
        (a, b) => Number(a) - Number(b)
      ),
      spinOffIds: Array.from(spinOffIds).sort((a, b) => Number(a) - Number(b)),
      relations: Array.from(uniqueRelations.values()).sort(
        (a, b) =>
          Number(a.sourceAnimeId) - Number(b.sourceAnimeId) ||
          Number(a.targetAnimeId) - Number(b.targetAnimeId)
      ),
    });
  });

  // Create character relation groups
  const characterGroups = findConnectedGroupsFromRelations(characterRelations);
  characterGroups.forEach((group, index) => {
    // Filter out any IDs that are already in a main group
    const mainAnimeIds = new Set(
      results.main.flatMap((mainSeries) => mainSeries.animeIds)
    );

    const filteredGroup = group.filter((id) => !mainAnimeIds.has(id));
    if (filteredGroup.length < 2) return; // Skip single-anime groups

    const uniqueRelations = new Map();

    // Collect character relations for this group
    filteredGroup.forEach((animeId) => {
      series.relations.forEach((relation) => {
        const { sourceAnimeId, targetAnimeId, relationType } = relation;

        if (
          relationType === "CHARACTER" &&
          filteredGroup.includes(sourceAnimeId) &&
          filteredGroup.includes(targetAnimeId)
        ) {
          const relationKey = `${sourceAnimeId}-${targetAnimeId}-${relationType}`;
          uniqueRelations.set(relationKey, relation);
        }
      });
    });

    const seriesName = getSeriesNameFromOldestAnime(filteredGroup, animeMap);
    results.character.push({
      seriesId: `character_${series.seriesId}_${index + 1}`,
      seriesName: `${seriesName} (Character)`,
      originalSeriesId: series.seriesId,
      animeIds: filteredGroup.sort((a, b) => Number(a) - Number(b)),
      seriesType: "CHARACTER",
      relations: Array.from(uniqueRelations.values()).sort(
        (a, b) =>
          Number(a.sourceAnimeId) - Number(b.sourceAnimeId) ||
          Number(a.targetAnimeId) - Number(b.targetAnimeId)
      ),
    });
  });

  // Process other relation types similarly...
  // The rest of the function is similar patterns for each relation type
  // Create adaptation relation groups
  const adaptationGroups =
    findConnectedGroupsFromRelations(adaptationRelations);
  processRelationGroups(
    adaptationGroups,
    "ADAPTATION",
    series,
    results,
    animeMap
  );

  // Create spin-off relation groups
  const spinOffGroups = findConnectedGroupsFromRelations(spinOffRelations);
  processRelationGroups(spinOffGroups, "SPIN_OFF", series, results, animeMap);

  // Create other relation groups
  const otherGroups = findConnectedGroupsFromRelations(otherRelations);
  processRelationGroups(otherGroups, "OTHER", series, results, animeMap);

  // Create parent relation groups
  const parentGroups = findConnectedGroupsFromRelations(parentRelations);
  processRelationGroups(parentGroups, "PARENT", series, results, animeMap);

  return results;
}

/**
 * Process relation groups for a specific relation type
 * @param {Array} groups - Array of connected groups
 * @param {string} relationType - Type of relation
 * @param {object} series - Original series object
 * @param {object} results - Results object to update
 * @param {object} animeMap - Map of anime objects by ID
 */
function processRelationGroups(
  groups,
  relationType,
  series,
  results,
  animeMap
) {
  const resultKey = relationType.toLowerCase();
  // Ensure the results array exists for this type
  if (!results[resultKey]) {
    results[resultKey] = [];
    logger.warn(`Created missing results array for type: ${resultKey}`);
  }

  const mainAnimeIds = new Set(
    results.main.flatMap((mainSeries) => mainSeries.animeIds)
  );

  groups.forEach((group, index) => {
    const filteredGroup = group.filter((id) => !mainAnimeIds.has(id));
    if (filteredGroup.length < 2) return; // Skip single-anime groups

    const uniqueRelations = new Map();

    // Collect relations for this group
    filteredGroup.forEach((animeId) => {
      series.relations.forEach((relation) => {
        const {
          sourceAnimeId,
          targetAnimeId,
          relationType: relType,
        } = relation;

        if (
          relType === relationType &&
          filteredGroup.includes(sourceAnimeId) &&
          filteredGroup.includes(targetAnimeId)
        ) {
          const relationKey = `${sourceAnimeId}-${targetAnimeId}-${relType}`;
          uniqueRelations.set(relationKey, relation);
        }
      });
    });

    const seriesName = getSeriesNameFromOldestAnime(filteredGroup, animeMap);
    results[resultKey].push({
      seriesId: `${resultKey}_${series.seriesId}_${index + 1}`,
      seriesName: `${seriesName} (${
        relationType.charAt(0) + relationType.slice(1).toLowerCase()
      })`,
      originalSeriesId: series.seriesId,
      animeIds: filteredGroup.sort((a, b) => Number(a) - Number(b)),
      seriesType: relationType,
      relations: Array.from(uniqueRelations.values()).sort(
        (a, b) =>
          Number(a.sourceAnimeId) - Number(b.sourceAnimeId) ||
          Number(a.targetAnimeId) - Number(b.targetAnimeId)
      ),
    });
  });
}

// For standalone usage
if (require.main === module) {
  advancedSeriesSplit()
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

module.exports = { advancedSeriesSplit };
