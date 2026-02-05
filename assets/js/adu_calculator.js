// assets/js/adu_calculator.js
// Allowance ADU Calculator — Selection + Screenshot Analysis + Cost Calculation
(function () {
  "use strict";

  // ------------------------------------------
  // RULES: allowed stories per ADU type
  // ------------------------------------------
  var STORY_RULES = {
    attached:           [1, 2],
    detached:           [1, 2],
    above_garage:       [1],
    garage_conversion:  [1],
    multifamily:        [1, 2, 4, 5],
  };

  var TYPE_LABELS = {
    attached:           "Attached",
    detached:           "Detached",
    above_garage:       "Above the Garage",
    garage_conversion:  "Garage Conversion",
    multifamily:        "Multifamily",
  };

  var CONSTRUCTION_LABELS = {
    stick_build:        "Stick Build",
    energy_efficient:   "Energy Efficient",
    renovation:         "Renovation",
    manufactured:       "Manufactured",
  };

  var DESIGN_PACKAGE_LABELS = {
    basic:      "Basic",
    standard:   "Standard",
    high_end:   "High End",
    custom:     "Custom",
  };

  var FOUNDATION_LABELS = {
    slab_on_grade:          "Slab on Grade",
    raised_foundation:      "Raised Foundation",
    reinforced_foundation:  "Reinforced Foundation",
  };

  var LAND_SURFACE_LABELS = {
    flat_land:  "Flat Land",
    hill_side:  "Hill Side",
  };

  // ------------------------------------------
  // PRICING MATRIX (v2.0)
  // Extensible configuration for cost calculations
  // Now with density, cross-interactions, design curves, and efficiency factors
  // ------------------------------------------
  var PRICING_MATRIX = {

    // Base rates: $/sqft by [adu_type][construction_type]
    // These are the foundation of all calculations
    base_rates: {
      attached: {
        stick_build: 175, energy_efficient: 215, renovation: 145, manufactured: 135
      },
      detached: {
        stick_build: 195, energy_efficient: 240, renovation: 160, manufactured: 150
      },
      above_garage: {
        stick_build: 210, energy_efficient: 255, renovation: 180, manufactured: null
      },
      garage_conversion: {
        stick_build: 140, energy_efficient: 175, renovation: 120, manufactured: null
      },
      multifamily: {
        stick_build: 165, energy_efficient: 200, renovation: 140, manufactured: 130
      }
    },

    // SQFT curves: optimal ranges per adu_type
    // Outside optimal range = price adjustments
    sqft_curves: {
      attached:          { min: 400, optimal_min: 600,  optimal_max: 1200, max: 1600 },
      detached:          { min: 350, optimal_min: 500,  optimal_max: 1000, max: 1400 },
      above_garage:      { min: 300, optimal_min: 400,  optimal_max: 800,  max: 1000 },
      garage_conversion: { min: 200, optimal_min: 300,  optimal_max: 600,  max: 800  },
      multifamily:       { min: 800, optimal_min: 1200, optimal_max: 4000, max: 6000 }
    },

    // SQFT modifiers when outside optimal range
    sqft_modifiers: {
      below_min_penalty: 1.25,      // +25% if below minimum
      below_optimal_penalty: 1.12,  // +12% if between min and optimal_min
      optimal: 1.0,                 // No change in optimal range
      above_optimal_discount: 0.94, // -6% if between optimal_max and max
      above_max_floor: 0.85         // Never goes below -15% even if huge
    },

    // Stories multipliers
    stories_multipliers: {
      1: 1.0,
      2: 1.35,
      4: 1.65,  // multifamily
      5: 1.80   // multifamily
    },

    // ------------------------------------------
    // DENSITY CONFIGURATION (bed/bath per sqft)
    // Optimal sqft per bedroom for proper layout
    // ------------------------------------------
    density_config: {
      // Studio (0 bedrooms) has different rules
      studio_optimal_sqft: { min: 300, max: 500 },
      // Per-bedroom optimal sqft ranges
      sqft_per_bedroom: {
        optimal_min: 350,   // Below this = very cramped (+15%)
        optimal_max: 550,   // Above this = spacious, efficient (-3%)
        cramped_threshold: 280  // Below this = severely cramped (+20%)
      },
      // Bathroom density (sqft per bathroom)
      sqft_per_bathroom: {
        optimal_min: 250,
        cramped_threshold: 180  // Too many bathrooms for size
      }
    },

    // ------------------------------------------
    // DESIGN CURVES (non-linear quality scaling)
    // Quality index drives exponential cost increase
    // ------------------------------------------
    design_curves: {
      basic:    { base: 0.85, quality_index: 1 },
      standard: { base: 1.00, quality_index: 2 },
      high_end: { base: 1.28, quality_index: 3 },
      custom:   { base: 1.65, quality_index: 4 }
    },

    // ------------------------------------------
    // CROSS-VARIABLE INTERACTIONS
    // When specific combinations occur, apply additional adjustment
    // ------------------------------------------
    cross_interactions: [
      {
        id: "highend_2story",
        vars: { design: "high_end", stories: 2 },
        adjustment: 1.08,
        reason: "High-end finishes on multi-story (stairs, railings, double-height)"
      },
      {
        id: "custom_2story",
        vars: { design: "custom", stories: 2 },
        adjustment: 1.12,
        reason: "Custom design on 2-story requires specialized detailing"
      },
      {
        id: "raised_hillside",
        vars: { foundation: "raised_foundation", land_surface: "hill_side" },
        adjustment: 1.15,
        reason: "Raised foundation on slope requires complex engineering"
      },
      {
        id: "detached_hillside",
        vars: { adu_type: "detached", land_surface: "hill_side" },
        adjustment: 1.10,
        reason: "Detached unit on slope: separate access, grading, utilities"
      },
      {
        id: "energy_custom",
        vars: { construction: "energy_efficient", design: "custom" },
        adjustment: 1.06,
        reason: "Custom energy-efficient requires specialized materials sourcing"
      },
      {
        id: "multifamily_highend",
        vars: { adu_type: "multifamily", design: "high_end" },
        adjustment: 1.10,
        reason: "High-end finishes across multiple units increases coordination"
      }
    ],

    // ------------------------------------------
    // CONVERSION/RENOVATION EFFICIENCY
    // How much existing structure can be reused
    // ------------------------------------------
    conversion_efficiency: {
      // Garage conversion efficiency by size
      garage_conversion: {
        excellent: { max_sqft: 400, modifier: 0.72, label: "Excellent reuse" },
        good:      { max_sqft: 550, modifier: 0.82, label: "Good reuse" },
        moderate:  { max_sqft: 700, modifier: 0.92, label: "Moderate reuse" },
        poor:      { max_sqft: 9999, modifier: 1.05, label: "Expansion needed" }
      },
      // Renovation efficiency (manual input for now: 0-100%)
      renovation_base_efficiency: 0.85,  // Default 85% if not specified
      // Above garage uses some existing structure
      above_garage: {
        base_efficiency: 0.90  // 10% savings from existing garage structure
      }
    },

    // Foundation multipliers
    foundation_multipliers: {
      slab_on_grade:         1.0,
      raised_foundation:     1.18,
      reinforced_foundation: 1.32
    },

    // Land surface multipliers
    land_multipliers: {
      flat_land: 1.0,
      hill_side: 1.28
    },

    // Fixed/semi-fixed additions
    additions: {
      bedroom_cost_first: 2500,       // First bedroom
      bedroom_cost_additional: 2000,  // Each additional bedroom (shared walls)
      bathroom_cost_first: 8500,      // First bathroom (main plumbing runs)
      bathroom_cost_additional: 6000, // Additional bathrooms (plumbing exists)
      plans_permits: 18000,           // fixed
      solar_panels_per_sqft: 14,      // $/sqft
      fire_sprinklers_per_sqft: 7,    // $/sqft
      appliances: 6500                // fixed (basic package)
    },

    // ------------------------------------------
    // OPTIONAL MEASURABLE FEATURES
    // These are manual inputs for now, later can be calculated
    // ------------------------------------------
    optional_features: {
      // Retaining wall (hillside sites)
      retaining_wall: {
        cost_per_linear_ft: 185,      // $/linear ft (avg 4ft height)
        height_multiplier: {          // Adjust for wall height
          low: { max_height: 3, multiplier: 0.75 },    // Under 3ft
          medium: { max_height: 5, multiplier: 1.0 },  // 3-5ft
          high: { max_height: 8, multiplier: 1.45 },   // 5-8ft
          extreme: { max_height: 99, multiplier: 2.1 } // Over 8ft (requires engineering)
        }
      },
      // Kitchen - linear feet of countertops/cabinets
      kitchen_linear: {
        cost_per_linear_ft: {
          basic: 280,      // Laminate, stock cabinets
          standard: 420,   // Granite, semi-custom cabinets
          high_end: 680,   // Quartz, custom cabinets
          custom: 950      // Premium materials, fully custom
        },
        min_linear_ft: 8,  // Minimum practical kitchen
        max_linear_ft: 40  // Large kitchen upper bound
      },
      // Kitchen island
      kitchen_island: {
        base_cost: {
          none: 0,
          small: 3500,     // 3-4ft island, no plumbing
          medium: 6500,    // 5-6ft island, optional sink
          large: 12000,    // 7-8ft+ island with appliances
          custom: 18000    // Custom built with premium features
        },
        has_plumbing_addon: 2800,  // Add sink to island
        has_seating_addon: 1200    // Extended counter for seating
      },
      // Rooftop deck/access
      rooftop_deck: {
        cost_per_sqft: {
          basic: 55,       // Simple access hatch + basic decking
          standard: 85,    // Proper deck with railing
          premium: 140     // Premium finishes, built-in features
        },
        min_sqft: 60,
        structural_addon: 8500  // If roof needs reinforcement
      },
      // Exterior deck (ground level or attached)
      exterior_deck: {
        cost_per_sqft: {
          wood: 35,        // Pressure-treated wood
          composite: 55,   // Composite decking
          premium: 85      // Ipe, exotic hardwoods
        },
        railing_per_linear_ft: 65,
        stairs_per_step: 180,
        covered_addon_per_sqft: 45  // Add roof/pergola
      },
      // Landscaping
      landscape: {
        cost_per_sqft: {
          minimal: 8,      // Basic grading, seed
          standard: 18,    // Sod, basic plants, irrigation
          enhanced: 35,    // Mature plants, hardscape elements
          premium: 65      // Full landscape design, water features
        },
        hardscape_per_sqft: 25,    // Pavers, concrete work
        irrigation_per_sqft: 4,    // Sprinkler system
        fence_per_linear_ft: 45    // Privacy fencing
      }
    },

    // Compatibility rules (warnings, adjustments, invalids)
    compatibility_rules: [
      {
        id: "hillside_slab",
        conditions: { land_surface: "hill_side", foundation: "slab_on_grade" },
        type: "warning",
        message: "Slab on grade is not recommended for hillside terrain. Engineering costs added.",
        cost_adjustment: 1.35
      },
      {
        id: "2story_slab",
        conditions: { stories: 2, foundation: "slab_on_grade" },
        type: "adjustment",
        message: "2-story construction requires reinforced slab foundation.",
        cost_adjustment: 1.12
      },
      {
        id: "above_garage_manufactured",
        conditions: { adu_type: "above_garage", construction: "manufactured" },
        type: "invalid",
        message: "Manufactured/prefab is not available for above-garage ADUs."
      },
      {
        id: "garage_conversion_manufactured",
        conditions: { adu_type: "garage_conversion", construction: "manufactured" },
        type: "invalid",
        message: "Manufactured/prefab is not available for garage conversions."
      },
      {
        id: "multifamily_hillside",
        conditions: { adu_type: "multifamily", land_surface: "hill_side", stories: 4 },
        type: "warning",
        message: "4+ story multifamily on hillside requires special engineering.",
        cost_adjustment: 1.25
      }
    ]
  };

  // ------------------------------------------
  // STATE
  // ------------------------------------------
  var selectedType         = null;
  var selectedStories      = null;
  var selectedConstruction = null;
  var enteredSqft          = null;
  var selectedDesignPackage = null;
  var enteredBedrooms      = null;
  var enteredBathrooms     = null;
  var selectedFoundation   = null;
  var selectedLandSurface  = null;
  var additionalOptions    = {
    plans_permits:   false,
    solar_panels:    false,
    fire_sprinklers: false,
    appliances:      false,
  };

  // Optional measurable features state
  var optionalFeatures = {
    retaining_wall: {
      enabled: false,
      linear_ft: 0,
      height: "medium"  // low, medium, high, extreme
    },
    kitchen_linear: {
      enabled: false,
      linear_ft: 0
      // tier derived from selectedDesignPackage
    },
    kitchen_island: {
      enabled: false,
      size: "none",     // none, small, medium, large, custom
      has_plumbing: false,
      has_seating: false
    },
    rooftop_deck: {
      enabled: false,
      sqft: 0,
      tier: "standard",  // basic, standard, premium
      needs_structural: false
    },
    exterior_deck: {
      enabled: false,
      sqft: 0,
      material: "composite",  // wood, composite, premium
      railing_linear_ft: 0,
      stairs_steps: 0,
      is_covered: false
    },
    landscape: {
      enabled: false,
      sqft: 0,
      tier: "standard",      // minimal, standard, enhanced, premium
      hardscape_sqft: 0,
      has_irrigation: false,
      fence_linear_ft: 0
    }
  };

  // Screenshot & analysis state
  var screenshotFiles   = { floor1: null, floor2: null };
  var screenshotBlobUrls = { floor1: null, floor2: null };
  var analysisResults   = { floor1: null, floor2: null };
  var analysisLoading   = { floor1: false, floor2: false };
  var screenshotSkipped = false;

  // Cost estimate state
  var costEstimate = null;
  var costLoading  = false;

  // ------------------------------------------
  // DOM refs
  // ------------------------------------------
  var gridType             = document.getElementById("gridAduType");
  var gridStories          = document.getElementById("gridStories");
  var gridConstruction     = document.getElementById("gridConstruction");
  var sectionStories       = document.getElementById("sectionStories");
  var sectionConstruction  = document.getElementById("sectionConstruction");
  var stepType             = document.getElementById("stepAduType");
  var stepStories          = document.getElementById("stepStories");
  var stepConstruction     = document.getElementById("stepConstruction");
  var sectionSqft          = document.getElementById("sectionSqft");
  var stepSqft             = document.getElementById("stepSqft");
  var inputSqft            = document.getElementById("inputSqft");
  var sectionDesignPackage = document.getElementById("sectionDesignPackage");
  var stepDesignPackage    = document.getElementById("stepDesignPackage");
  var selectDesignPackage  = document.getElementById("selectDesignPackage");
  var sectionConfiguration = document.getElementById("sectionConfiguration");
  var stepConfiguration    = document.getElementById("stepConfiguration");
  var inputBedrooms        = document.getElementById("inputBedrooms");
  var inputBathrooms       = document.getElementById("inputBathrooms");
  var sectionFoundation    = document.getElementById("sectionFoundation");
  var stepFoundation       = document.getElementById("stepFoundation");
  var selectFoundation     = document.getElementById("selectFoundation");
  var sectionLandSurface   = document.getElementById("sectionLandSurface");
  var stepLandSurface      = document.getElementById("stepLandSurface");
  var selectLandSurface    = document.getElementById("selectLandSurface");
  var sectionAdditionalOptions = document.getElementById("sectionAdditionalOptions");
  var stepAdditionalOptions    = document.getElementById("stepAdditionalOptions");
  var chkPlansPermits      = document.getElementById("chkPlansPermits");
  var chkSolarPanels       = document.getElementById("chkSolarPanels");
  var chkFireSprinklers    = document.getElementById("chkFireSprinklers");
  var chkAppliances        = document.getElementById("chkAppliances");
  var sectionScreenshot    = document.getElementById("sectionScreenshot");
  var stepScreenshot       = document.getElementById("stepScreenshot");
  var screenshotUploads    = document.getElementById("screenshotUploads");
  var analysisResultsDiv   = document.getElementById("analysisResults");
  var btnSkipScreenshot    = document.getElementById("btnSkipScreenshot");
  var btnAnalyzeAll        = document.getElementById("btnAnalyzeAll");
  var sectionResults       = document.getElementById("sectionResults");
  var stepResults          = document.getElementById("stepResults");
  var resultsContainer     = document.getElementById("resultsContainer");
  var summaryTags          = document.getElementById("summaryTags");
  var btnReset             = document.getElementById("btnReset");

  // Algorithm visualization panel
  var algoPanel            = document.getElementById("algoPanel");
  var algoPanelToggle      = document.getElementById("algoPanelToggle");
  var algoPanelArrow       = document.getElementById("algoPanelArrow");
  var algoPanelContent     = document.getElementById("algoPanelContent");
  var algoGraphContainer   = document.getElementById("algoGraphContainer");
  var algoLegend           = document.getElementById("algoLegend");
  var algoNodeDetails      = document.getElementById("algoNodeDetails");

  // Optional features section
  var sectionOptionalFeatures = document.getElementById("sectionOptionalFeatures");
  var stepOptionalFeatures = document.getElementById("stepOptionalFeatures");

  // Optional feature checkboxes and inputs
  var chkRetainingWall     = document.getElementById("chkRetainingWall");
  var inputRetainingWallFt = document.getElementById("inputRetainingWallFt");
  var selectRetainingWallHeight = document.getElementById("selectRetainingWallHeight");
  var chkKitchenLinear     = document.getElementById("chkKitchenLinear");
  var inputKitchenLinearFt = document.getElementById("inputKitchenLinearFt");
  var chkKitchenIsland     = document.getElementById("chkKitchenIsland");
  var selectKitchenIslandSize = document.getElementById("selectKitchenIslandSize");
  var chkIslandPlumbing    = document.getElementById("chkIslandPlumbing");
  var chkIslandSeating     = document.getElementById("chkIslandSeating");
  var chkRooftopDeck       = document.getElementById("chkRooftopDeck");
  var inputRooftopDeckSqft = document.getElementById("inputRooftopDeckSqft");
  var selectRooftopDeckTier = document.getElementById("selectRooftopDeckTier");
  var chkRooftopStructural = document.getElementById("chkRooftopStructural");
  var chkExteriorDeck      = document.getElementById("chkExteriorDeck");
  var inputExteriorDeckSqft = document.getElementById("inputExteriorDeckSqft");
  var selectExteriorDeckMaterial = document.getElementById("selectExteriorDeckMaterial");
  var inputDeckRailingFt   = document.getElementById("inputDeckRailingFt");
  var inputDeckStairs      = document.getElementById("inputDeckStairs");
  var chkDeckCovered       = document.getElementById("chkDeckCovered");
  var chkLandscape         = document.getElementById("chkLandscape");
  var inputLandscapeSqft   = document.getElementById("inputLandscapeSqft");
  var selectLandscapeTier  = document.getElementById("selectLandscapeTier");
  var inputHardscapeSqft   = document.getElementById("inputHardscapeSqft");
  var inputFenceFt         = document.getElementById("inputFenceFt");
  var chkIrrigation        = document.getElementById("chkIrrigation");

  if (!gridType || !gridStories) return;

  // ------------------------------------------
  // API HELPERS
  // ------------------------------------------

  function getApiBase() {
    return (window.API_BASE || "").replace(/\/+$/, "");
  }

  function getAuthHeaders() {
    var token = localStorage.getItem("ngmToken");
    return token ? { "Authorization": "Bearer " + token } : {};
  }

  // ------------------------------------------
  // CARD SELECTION HELPERS
  // ------------------------------------------

  function selectCard(grid, dataAttr, value) {
    grid.querySelectorAll(".adu-option-card").forEach(function (card) {
      card.classList.toggle("selected", card.dataset[dataAttr] === value);
    });
  }

  function updateStoryAvailability() {
    var allowed = selectedType ? (STORY_RULES[selectedType] || []) : [];
    gridStories.querySelectorAll(".adu-option-card").forEach(function (card) {
      var storyVal = parseInt(card.dataset.stories, 10);
      var isAllowed = allowed.indexOf(storyVal) !== -1;
      card.classList.toggle("disabled", !isAllowed);
      if (!isAllowed && card.classList.contains("selected")) {
        card.classList.remove("selected");
        selectedStories = null;
      }
    });

    // Auto-select if only 1 option available
    if (allowed.length === 1) {
      selectedStories = allowed[0];
      selectCard(gridStories, "stories", String(selectedStories));
    }
  }

  // ------------------------------------------
  // SECTION STATE MANAGEMENT
  // ------------------------------------------

  function updateSections() {
    // Step 1: ADU Type
    stepType.classList.toggle("completed", !!selectedType);
    sectionStories.classList.toggle("locked", !selectedType);

    // Step 2: Stories
    stepStories.classList.toggle("completed", !!selectedStories);
    sectionConstruction.classList.toggle("locked", !selectedStories);

    // Step 3: Construction
    stepConstruction.classList.toggle("completed", !!selectedConstruction);
    sectionSqft.classList.toggle("locked", !selectedConstruction);

    // Step 4: Sqft
    var sqftDone = enteredSqft && enteredSqft > 0;
    stepSqft.classList.toggle("completed", !!sqftDone);
    sectionDesignPackage.classList.toggle("locked", !sqftDone);

    // Step 5: Design Package
    var designDone = !!selectedDesignPackage;
    stepDesignPackage.classList.toggle("completed", designDone);
    sectionConfiguration.classList.toggle("locked", !designDone);

    // Step 6: Configuration (bedrooms & bathrooms)
    var configDone = (enteredBedrooms !== null && enteredBedrooms >= 0) && (enteredBathrooms !== null && enteredBathrooms >= 0);
    stepConfiguration.classList.toggle("completed", configDone);
    sectionFoundation.classList.toggle("locked", !configDone);

    // Step 7: Foundation
    var foundationDone = !!selectedFoundation;
    stepFoundation.classList.toggle("completed", foundationDone);
    sectionLandSurface.classList.toggle("locked", !foundationDone);

    // Step 8: Land Surface
    var landDone = !!selectedLandSurface;
    stepLandSurface.classList.toggle("completed", landDone);
    sectionAdditionalOptions.classList.toggle("locked", !landDone);

    // Step 9: Additional Options (always complete once land surface is selected, checkboxes are optional)
    stepAdditionalOptions.classList.toggle("completed", landDone);
    if (sectionOptionalFeatures) sectionOptionalFeatures.classList.toggle("locked", !landDone);

    // Step 10: Optional Features (always complete once unlocked, features are optional)
    if (stepOptionalFeatures) stepOptionalFeatures.classList.toggle("completed", landDone);
    sectionScreenshot.classList.toggle("locked", !landDone);

    // Step 11: Screenshot
    var hasAnyAnalysis = analysisResults.floor1 || analysisResults.floor2;
    var screenshotDone = screenshotSkipped || hasAnyAnalysis;
    stepScreenshot.classList.toggle("completed", !!screenshotDone);

    // Step 12: Results
    sectionResults.classList.toggle("locked", !costEstimate);
    stepResults.classList.toggle("completed", !!costEstimate);

    // Render upload zones when screenshot section is unlocked
    if (landDone) {
      renderUploadZones();
    }

    // Show/hide buttons
    updateScreenshotButtons();
  }

  function updateScreenshotButtons() {
    var hasFiles = screenshotFiles.floor1 || screenshotFiles.floor2;
    var anyLoading = analysisLoading.floor1 || analysisLoading.floor2;
    var hasAnalysis = analysisResults.floor1 || analysisResults.floor2;

    if (hasFiles && !anyLoading && !hasAnalysis && !screenshotSkipped) {
      btnAnalyzeAll.classList.remove("hidden");
    } else {
      btnAnalyzeAll.classList.add("hidden");
    }

    if (screenshotSkipped || hasAnalysis || costEstimate) {
      btnSkipScreenshot.classList.add("hidden");
    } else {
      btnSkipScreenshot.classList.remove("hidden");
    }
  }

  // ------------------------------------------
  // SUMMARY BAR
  // ------------------------------------------

  function updateSummary() {
    var html = "";

    if (selectedType) {
      html += '<span class="adu-summary-tag">'
            + '<span class="tag-key">Type:</span> '
            + TYPE_LABELS[selectedType]
            + '</span>';
    }

    if (selectedStories) {
      html += '<span class="adu-summary-tag">'
            + '<span class="tag-key">Stories:</span> '
            + selectedStories
            + '</span>';
    }

    if (selectedConstruction) {
      html += '<span class="adu-summary-tag">'
            + '<span class="tag-key">Construction:</span> '
            + CONSTRUCTION_LABELS[selectedConstruction]
            + '</span>';
    }

    if (enteredSqft && enteredSqft > 0) {
      html += '<span class="adu-summary-tag">'
            + '<span class="tag-key">Size:</span> '
            + enteredSqft.toLocaleString() + ' sq ft'
            + '</span>';
    }

    if (selectedDesignPackage) {
      html += '<span class="adu-summary-tag">'
            + '<span class="tag-key">Design:</span> '
            + DESIGN_PACKAGE_LABELS[selectedDesignPackage]
            + '</span>';
    }

    if (enteredBedrooms !== null && enteredBathrooms !== null) {
      html += '<span class="adu-summary-tag">'
            + '<span class="tag-key">Config:</span> '
            + enteredBedrooms + ' bd / ' + enteredBathrooms + ' ba'
            + '</span>';
    }

    if (selectedFoundation) {
      html += '<span class="adu-summary-tag">'
            + '<span class="tag-key">Foundation:</span> '
            + FOUNDATION_LABELS[selectedFoundation]
            + '</span>';
    }

    if (selectedLandSurface) {
      html += '<span class="adu-summary-tag">'
            + '<span class="tag-key">Land:</span> '
            + LAND_SURFACE_LABELS[selectedLandSurface]
            + '</span>';
    }

    // Count selected additional options
    var optionsCount = 0;
    if (additionalOptions.plans_permits) optionsCount++;
    if (additionalOptions.solar_panels) optionsCount++;
    if (additionalOptions.fire_sprinklers) optionsCount++;
    if (additionalOptions.appliances) optionsCount++;
    if (optionsCount > 0) {
      html += '<span class="adu-summary-tag">'
            + '<span class="tag-key">Options:</span> '
            + optionsCount + ' selected'
            + '</span>';
    }

    if (analysisResults.floor1 || analysisResults.floor2) {
      html += '<span class="adu-summary-tag">'
            + '<span class="tag-key">Screenshot:</span> Analyzed'
            + '</span>';
    } else if (screenshotSkipped) {
      html += '<span class="adu-summary-tag">'
            + '<span class="tag-key">Screenshot:</span> Skipped'
            + '</span>';
    }

    if (costEstimate) {
      html += '<span class="adu-summary-tag">'
            + '<span class="tag-key">Estimate:</span> $'
            + costEstimate.total_estimated_cost.toLocaleString()
            + '</span>';
    }

    if (!html) {
      html = '<span class="adu-summary-placeholder">Select ADU type to begin</span>';
    }

    summaryTags.innerHTML = html;
  }

  // ------------------------------------------
  // MAIN REFRESH
  // ------------------------------------------

  function refresh() {
    updateStoryAvailability();
    updateSections();
    updateSummary();
  }

  // ------------------------------------------
  // SCREENSHOT UPLOAD ZONES
  // ------------------------------------------

  var uploadZonesRendered = false;

  function renderUploadZones() {
    if (!selectedStories || !enteredSqft) return;

    var floorCount = selectedStories > 1 ? 2 : 1;
    var html = "";

    for (var i = 1; i <= floorCount; i++) {
      var key = "floor" + i;
      var label = floorCount === 1 ? "Floor Plan" : "Floor " + i;

      if (screenshotFiles[key]) {
        // Preview state
        var statusClass = "status-ready";
        var statusText = "Ready to analyze";
        if (analysisLoading[key]) {
          statusClass = "status-analyzing";
          statusText = '<span class="adu-analysis-spinner"></span> Analyzing...';
        } else if (analysisResults[key]) {
          statusClass = "status-done";
          statusText = "Analysis complete";
        }

        var previewClass = "";
        if (analysisLoading[key]) previewClass = " analyzing";
        if (analysisResults[key]) previewClass = " analyzed";

        html += '<div class="adu-upload-preview' + previewClass + '" data-floor="' + key + '">'
              + '<img src="' + (screenshotBlobUrls[key] || "") + '" alt="' + label + '" />'
              + '<div class="preview-info">'
              + '<span class="preview-name">' + label + ' - ' + screenshotFiles[key].name + '</span>'
              + '<span class="preview-status ' + statusClass + '">' + statusText + '</span>'
              + '</div>'
              + '<div class="preview-actions">'
              + '<button type="button" class="btn-preview-remove" data-floor="' + key + '">Remove</button>'
              + '</div>'
              + '</div>';
      } else {
        // Upload zone
        html += '<div class="adu-upload-zone" data-floor="' + key + '">'
              + '<span class="upload-icon">+</span>'
              + '<span class="upload-label">' + label + '</span>'
              + '<span class="upload-hint">Click or drag image here<br>JPG, PNG, WebP (max 10MB)</span>'
              + '<input type="file" accept="image/jpeg,image/png,image/webp" data-floor="' + key + '" />'
              + '</div>';
      }
    }

    screenshotUploads.innerHTML = html;
    bindUploadEvents();
    renderAnalysisResults();
  }

  function bindUploadEvents() {
    // Click to upload
    screenshotUploads.querySelectorAll(".adu-upload-zone").forEach(function (zone) {
      var input = zone.querySelector('input[type="file"]');

      zone.addEventListener("click", function () { input.click(); });

      zone.addEventListener("dragover", function (e) {
        e.preventDefault();
        zone.classList.add("dragover");
      });

      zone.addEventListener("dragleave", function () {
        zone.classList.remove("dragover");
      });

      zone.addEventListener("drop", function (e) {
        e.preventDefault();
        zone.classList.remove("dragover");
        var file = e.dataTransfer.files[0];
        if (file) handleFileSelected(zone.dataset.floor, file);
      });

      input.addEventListener("change", function () {
        var file = input.files[0];
        if (file) handleFileSelected(zone.dataset.floor, file);
      });
    });

    // Remove buttons
    screenshotUploads.querySelectorAll(".btn-preview-remove").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var key = btn.dataset.floor;
        removeScreenshot(key);
      });
    });
  }

  function handleFileSelected(floorKey, file) {
    // Validate type
    var allowed = ["image/jpeg", "image/png", "image/webp"];
    if (allowed.indexOf(file.type) === -1) {
      if (window.Toast) Toast.error("Invalid File", "Please upload a JPG, PNG, or WebP image.");
      return;
    }

    // Validate size (10MB)
    if (file.size > 10 * 1024 * 1024) {
      if (window.Toast) Toast.error("File Too Large", "Maximum file size is 10MB.");
      return;
    }

    // Clean up old blob URL
    if (screenshotBlobUrls[floorKey]) {
      URL.revokeObjectURL(screenshotBlobUrls[floorKey]);
    }

    screenshotFiles[floorKey] = file;
    screenshotBlobUrls[floorKey] = URL.createObjectURL(file);
    analysisResults[floorKey] = null;
    screenshotSkipped = false;
    costEstimate = null;

    renderUploadZones();
    refresh();
  }

  function removeScreenshot(floorKey) {
    if (screenshotBlobUrls[floorKey]) {
      URL.revokeObjectURL(screenshotBlobUrls[floorKey]);
    }
    screenshotFiles[floorKey] = null;
    screenshotBlobUrls[floorKey] = null;
    analysisResults[floorKey] = null;
    analysisLoading[floorKey] = false;
    costEstimate = null;

    renderUploadZones();
    refresh();
  }

  // ------------------------------------------
  // GPT SCREENSHOT ANALYSIS
  // ------------------------------------------

  function analyzeScreenshot(floorKey) {
    var file = screenshotFiles[floorKey];
    if (!file) return Promise.resolve(null);

    var apiBase = getApiBase();
    if (!apiBase) {
      if (window.Toast) Toast.error("Error", "API not configured.");
      return Promise.resolve(null);
    }

    analysisLoading[floorKey] = true;
    renderUploadZones();
    refresh();

    var formData = new FormData();
    formData.append("file", file);
    formData.append("floor_label", floorKey === "floor1" ? "Floor 1" : "Floor 2");

    return fetch(apiBase + "/adu-calculator/analyze-screenshot", {
      method: "POST",
      headers: getAuthHeaders(),
      body: formData
    })
    .then(function (response) {
      if (!response.ok) {
        return response.text().then(function (txt) {
          var msg = "Analysis failed";
          try { msg = JSON.parse(txt).detail || msg; } catch (e) { /* ignore */ }
          throw new Error(msg);
        });
      }
      return response.json();
    })
    .then(function (result) {
      analysisResults[floorKey] = result.data;
      analysisLoading[floorKey] = false;

      if (result.warning && window.Toast) {
        Toast.warning("Low Confidence", result.warning);
      } else if (window.Toast) {
        Toast.success("Analysis Complete", floorKey === "floor1" ? "Floor 1 analyzed" : "Floor 2 analyzed");
      }

      renderUploadZones();
      refresh();
      return result.data;
    })
    .catch(function (err) {
      analysisLoading[floorKey] = false;
      analysisResults[floorKey] = null;
      if (window.Toast) Toast.error("Analysis Failed", err.message || "Could not analyze screenshot");
      renderUploadZones();
      refresh();
      return null;
    });
  }

  function analyzeAllScreenshots() {
    var promises = [];
    if (screenshotFiles.floor1 && !analysisResults.floor1) {
      promises.push(analyzeScreenshot("floor1"));
    }
    if (screenshotFiles.floor2 && !analysisResults.floor2) {
      promises.push(analyzeScreenshot("floor2"));
    }

    if (promises.length === 0) return;

    Promise.all(promises).then(function () {
      // Auto-calculate after analysis if all done
      var allDone = true;
      if (screenshotFiles.floor1 && !analysisResults.floor1) allDone = false;
      if (screenshotFiles.floor2 && !analysisResults.floor2) allDone = false;

      if (allDone) {
        calculateCost();
      }
    });
  }

  // ------------------------------------------
  // ANALYSIS RESULTS RENDERING
  // ------------------------------------------

  function renderAnalysisResults() {
    var hasResults = analysisResults.floor1 || analysisResults.floor2;
    if (!hasResults) {
      analysisResultsDiv.classList.add("hidden");
      analysisResultsDiv.innerHTML = "";
      return;
    }

    analysisResultsDiv.classList.remove("hidden");
    var html = "";

    ["floor1", "floor2"].forEach(function (key) {
      var data = analysisResults[key];
      if (!data) return;

      var confClass = data.confidence >= 0.7 ? "high" : (data.confidence >= 0.5 ? "medium" : "low");
      var confPct = Math.round(data.confidence * 100);

      html += '<div class="adu-analysis-card">'
            + '<div class="adu-analysis-card-title">'
            + data.floor_label + ' Analysis '
            + '<span class="adu-confidence-badge ' + confClass + '">' + confPct + '% confidence</span>'
            + '</div>'
            + '<div class="adu-analysis-grid">';

      html += renderAnalysisItem("Bedrooms", data.bedrooms);
      html += renderAnalysisItem("Full Baths", data.bathrooms);
      html += renderAnalysisItem("Half Baths", data.half_baths);
      html += renderAnalysisItem("Kitchen", data.kitchen_type ? data.kitchen_type.replace(/_/g, " ") : "None");
      html += renderAnalysisItem("Living Areas", data.living_areas);
      html += renderAnalysisItem("Dining Area", data.dining_area ? "Yes" : "No");
      html += renderAnalysisItem("Laundry", data.laundry_area ? "Yes" : "No");
      html += renderAnalysisItem("Doors", data.estimated_doors);
      html += renderAnalysisItem("Windows", data.estimated_windows);
      html += renderAnalysisItem("Walk-in Closets", data.walk_in_closets);
      html += renderAnalysisItem("Plumbing Fixtures", data.plumbing_fixtures_estimate);
      html += renderAnalysisItem("Electrical", data.electrical_complexity);

      html += '</div>';

      // Special features
      if (data.special_features && data.special_features.length > 0) {
        html += '<div class="adu-analysis-features">';
        data.special_features.forEach(function (f) {
          html += '<span class="adu-feature-tag">' + f.replace(/_/g, " ") + '</span>';
        });
        html += '</div>';
      }

      // Structural notes
      if (data.structural_notes && data.structural_notes.length > 0) {
        html += '<div class="adu-analysis-features" style="margin-top: 4px;">';
        data.structural_notes.forEach(function (n) {
          html += '<span class="adu-feature-tag">' + n.replace(/_/g, " ") + '</span>';
        });
        html += '</div>';
      }

      html += '</div>';
    });

    analysisResultsDiv.innerHTML = html;
  }

  function renderAnalysisItem(label, value) {
    return '<div class="adu-analysis-item">'
         + '<span class="item-label">' + label + '</span>'
         + '<span class="item-value">' + value + '</span>'
         + '</div>';
  }

  // ------------------------------------------
  // COST CALCULATION (Local with PRICING_MATRIX)
  // ------------------------------------------

  /**
   * Calculate SQFT modifier based on curve (penalty/discount outside optimal range)
   */
  function getSqftModifier(aduType, sqft) {
    var curve = PRICING_MATRIX.sqft_curves[aduType];
    var mods = PRICING_MATRIX.sqft_modifiers;

    if (!curve) return { modifier: 1.0, zone: "optimal", label: "Standard" };

    var zone, modifier, label;

    if (sqft < curve.min) {
      zone = "below_min";
      modifier = mods.below_min_penalty;
      label = "Below minimum (+25%)";
    } else if (sqft < curve.optimal_min) {
      zone = "below_optimal";
      // Interpolate between below_min_penalty and optimal
      var ratio = (sqft - curve.min) / (curve.optimal_min - curve.min);
      modifier = mods.below_min_penalty - (ratio * (mods.below_min_penalty - mods.below_optimal_penalty));
      label = "Below optimal (+" + Math.round((modifier - 1) * 100) + "%)";
    } else if (sqft <= curve.optimal_max) {
      zone = "optimal";
      modifier = mods.optimal;
      label = "Optimal range";
    } else if (sqft <= curve.max) {
      zone = "above_optimal";
      // Interpolate between optimal and above_optimal_discount
      var ratio2 = (sqft - curve.optimal_max) / (curve.max - curve.optimal_max);
      modifier = mods.optimal - (ratio2 * (mods.optimal - mods.above_optimal_discount));
      label = "Above optimal (" + Math.round((modifier - 1) * 100) + "%)";
    } else {
      zone = "above_max";
      modifier = mods.above_max_floor;
      label = "Economy of scale (-15%)";
    }

    return { modifier: modifier, zone: zone, label: label, curve: curve };
  }

  /**
   * Check compatibility rules and return warnings/adjustments
   */
  function checkCompatibilityRules(params) {
    var results = { warnings: [], adjustments: [], invalids: [], totalAdjustment: 1.0 };

    PRICING_MATRIX.compatibility_rules.forEach(function (rule) {
      var matches = true;

      // Check each condition in the rule
      Object.keys(rule.conditions).forEach(function (key) {
        var expected = rule.conditions[key];
        var actual = params[key];
        if (actual !== expected) {
          matches = false;
        }
      });

      if (matches) {
        if (rule.type === "invalid") {
          results.invalids.push(rule);
        } else if (rule.type === "warning") {
          results.warnings.push(rule);
          if (rule.cost_adjustment) {
            results.totalAdjustment *= rule.cost_adjustment;
          }
        } else if (rule.type === "adjustment") {
          results.adjustments.push(rule);
          if (rule.cost_adjustment) {
            results.totalAdjustment *= rule.cost_adjustment;
          }
        }
      }
    });

    return results;
  }

  /**
   * Calculate density modifier based on bedrooms/bathrooms per sqft
   * Returns penalty if layout is too cramped or info if spacious
   */
  function getDensityModifier(sqft, bedrooms, bathrooms) {
    var config = PRICING_MATRIX.density_config;
    var result = { modifier: 1.0, status: "optimal", label: "Balanced layout", details: [] };

    // Handle studio (0 bedrooms)
    if (bedrooms === 0) {
      var studio = config.studio_optimal_sqft;
      if (sqft < studio.min) {
        result.modifier = 1.12;
        result.status = "cramped";
        result.label = "Studio too small (+12%)";
        result.details.push("Studio under " + studio.min + " sqft is very tight");
      } else if (sqft > studio.max) {
        result.modifier = 0.97;
        result.status = "spacious";
        result.label = "Large studio (-3%)";
        result.details.push("Spacious studio layout");
      }
      return result;
    }

    // Calculate sqft per bedroom
    var sqftPerBed = sqft / bedrooms;
    var bedConfig = config.sqft_per_bedroom;

    if (sqftPerBed < bedConfig.cramped_threshold) {
      result.modifier *= 1.20;
      result.status = "severely_cramped";
      result.label = "Severely cramped (+20%)";
      result.details.push(Math.round(sqftPerBed) + " sqft/bed is very tight (min: " + bedConfig.cramped_threshold + ")");
    } else if (sqftPerBed < bedConfig.optimal_min) {
      // Interpolate penalty
      var ratio = (sqftPerBed - bedConfig.cramped_threshold) / (bedConfig.optimal_min - bedConfig.cramped_threshold);
      var penalty = 1.20 - (ratio * 0.08); // 20% down to 12%
      result.modifier *= penalty;
      result.status = "cramped";
      result.label = "Cramped layout (+" + Math.round((penalty - 1) * 100) + "%)";
      result.details.push(Math.round(sqftPerBed) + " sqft/bed below optimal " + bedConfig.optimal_min);
    } else if (sqftPerBed > bedConfig.optimal_max) {
      result.modifier *= 0.97;
      result.status = "spacious";
      result.label = "Spacious layout (-3%)";
      result.details.push(Math.round(sqftPerBed) + " sqft/bed is generous");
    }

    // Check bathroom density
    if (bathrooms > 0) {
      var sqftPerBath = sqft / bathrooms;
      var bathConfig = config.sqft_per_bathroom;

      if (sqftPerBath < bathConfig.cramped_threshold) {
        result.modifier *= 1.08;
        result.status = "cramped";
        result.details.push("High bathroom density: " + Math.round(sqftPerBath) + " sqft/bath adds plumbing complexity");
      }
    }

    // Final label update
    if (result.modifier > 1.15) {
      result.label = "Layout penalty (+" + Math.round((result.modifier - 1) * 100) + "%)";
    } else if (result.modifier > 1) {
      result.label = "Tight layout (+" + Math.round((result.modifier - 1) * 100) + "%)";
    } else if (result.modifier < 1) {
      result.label = "Efficient layout (" + Math.round((result.modifier - 1) * 100) + "%)";
    }

    return result;
  }

  /**
   * Get design multiplier using non-linear curve
   * Higher quality tiers have exponential cost increase
   */
  function getDesignCurveMultiplier(designPackage) {
    var curves = PRICING_MATRIX.design_curves;
    var curve = curves[designPackage];

    if (!curve) return { modifier: 1.0, label: "Standard" };

    // Use quality index for non-linear scaling
    // Formula: base + (quality_index^1.4 - 1) * 0.12
    var nonLinearBonus = Math.pow(curve.quality_index, 1.4) - 1;
    var modifier = curve.base + (nonLinearBonus * 0.08);

    var label = DESIGN_PACKAGE_LABELS[designPackage];
    if (modifier !== 1) {
      label += " (" + (modifier > 1 ? "+" : "") + Math.round((modifier - 1) * 100) + "%)";
    }

    return { modifier: modifier, label: label, quality_index: curve.quality_index };
  }

  /**
   * Calculate cross-variable interaction adjustments
   * When certain combinations occur, apply additional modifier
   */
  function getCrossInteractionMultiplier(params) {
    var interactions = PRICING_MATRIX.cross_interactions;
    var result = { modifier: 1.0, applied: [], total_adjustment: 0 };

    interactions.forEach(function(interaction) {
      var matches = true;

      // Check each variable in this interaction
      Object.keys(interaction.vars).forEach(function(key) {
        var expected = interaction.vars[key];
        var actual = params[key];
        if (actual !== expected) {
          matches = false;
        }
      });

      if (matches) {
        result.modifier *= interaction.adjustment;
        result.applied.push({
          id: interaction.id,
          adjustment: interaction.adjustment,
          reason: interaction.reason
        });
        result.total_adjustment += (interaction.adjustment - 1);
      }
    });

    return result;
  }

  /**
   * Get conversion/renovation efficiency factor
   * Accounts for reuse of existing structure
   */
  function getConversionEfficiency(aduType, sqft, constructionType) {
    var effConfig = PRICING_MATRIX.conversion_efficiency;
    var result = { modifier: 1.0, label: "New construction", efficiency_pct: 0 };

    // Garage conversion efficiency based on size
    if (aduType === "garage_conversion") {
      var gcConfig = effConfig.garage_conversion;
      if (sqft <= gcConfig.excellent.max_sqft) {
        result.modifier = gcConfig.excellent.modifier;
        result.label = gcConfig.excellent.label;
        result.efficiency_pct = Math.round((1 - gcConfig.excellent.modifier) * 100);
      } else if (sqft <= gcConfig.good.max_sqft) {
        result.modifier = gcConfig.good.modifier;
        result.label = gcConfig.good.label;
        result.efficiency_pct = Math.round((1 - gcConfig.good.modifier) * 100);
      } else if (sqft <= gcConfig.moderate.max_sqft) {
        result.modifier = gcConfig.moderate.modifier;
        result.label = gcConfig.moderate.label;
        result.efficiency_pct = Math.round((1 - gcConfig.moderate.modifier) * 100);
      } else {
        result.modifier = gcConfig.poor.modifier;
        result.label = gcConfig.poor.label;
        result.efficiency_pct = -Math.round((gcConfig.poor.modifier - 1) * 100);
      }
    }
    // Above garage gets partial benefit
    else if (aduType === "above_garage") {
      var agEff = effConfig.above_garage.base_efficiency;
      result.modifier = agEff;
      result.label = "Existing garage structure";
      result.efficiency_pct = Math.round((1 - agEff) * 100);
    }
    // Renovation construction type
    else if (constructionType === "renovation") {
      result.modifier = effConfig.renovation_base_efficiency;
      result.label = "Renovation efficiency";
      result.efficiency_pct = Math.round((1 - effConfig.renovation_base_efficiency) * 100);
    }

    return result;
  }

  /**
   * Calculate bedroom cost with diminishing returns
   * First bedroom costs more (new walls), additional are cheaper
   */
  function calculateBedroomCost(bedrooms) {
    if (bedrooms <= 0) return { cost: 0, breakdown: "Studio (no bedrooms)" };

    var adds = PRICING_MATRIX.additions;
    var firstCost = adds.bedroom_cost_first;
    var additionalCost = adds.bedroom_cost_additional;

    var totalCost = firstCost + Math.max(0, bedrooms - 1) * additionalCost;
    var breakdown = bedrooms === 1
      ? "1 bedroom x $" + firstCost.toLocaleString()
      : "1st: $" + firstCost.toLocaleString() + " + " + (bedrooms - 1) + " x $" + additionalCost.toLocaleString();

    return { cost: totalCost, breakdown: breakdown };
  }

  /**
   * Calculate bathroom cost with diminishing returns
   * First bathroom has full plumbing run cost, additional share infrastructure
   */
  function calculateBathroomCost(bathrooms) {
    if (bathrooms <= 0) return { cost: 0, breakdown: "No bathrooms" };

    var adds = PRICING_MATRIX.additions;
    var firstCost = adds.bathroom_cost_first;
    var additionalCost = adds.bathroom_cost_additional;

    var totalCost = firstCost + Math.max(0, bathrooms - 1) * additionalCost;
    var breakdown = bathrooms === 1
      ? "1 bathroom x $" + firstCost.toLocaleString()
      : "1st: $" + firstCost.toLocaleString() + " + " + (bathrooms - 1) + " x $" + additionalCost.toLocaleString();

    return { cost: totalCost, breakdown: breakdown };
  }

  /**
   * Calculate cost of optional measurable features
   * Returns breakdown with itemized costs
   */
  function calculateOptionalFeaturesCost(features, designPackage) {
    var config = PRICING_MATRIX.optional_features;
    var result = {
      total: 0,
      items: [],
      has_features: false
    };

    // 1. Retaining Wall
    if (features.retaining_wall.enabled && features.retaining_wall.linear_ft > 0) {
      var rwConfig = config.retaining_wall;
      var rwLinearFt = features.retaining_wall.linear_ft;
      var rwHeight = features.retaining_wall.height;
      var heightMultiplier = 1.0;

      // Find height multiplier
      var heights = rwConfig.height_multiplier;
      if (heights[rwHeight]) {
        heightMultiplier = heights[rwHeight].multiplier;
      }

      var rwCost = rwLinearFt * rwConfig.cost_per_linear_ft * heightMultiplier;
      result.total += rwCost;
      result.items.push({
        feature: "Retaining Wall",
        description: rwLinearFt + " linear ft (" + rwHeight + " height)",
        cost: rwCost,
        breakdown: rwLinearFt + " ft x $" + rwConfig.cost_per_linear_ft + " x " + heightMultiplier.toFixed(2)
      });
      result.has_features = true;
    }

    // 2. Kitchen Linear (uses design package tier)
    if (features.kitchen_linear.enabled && features.kitchen_linear.linear_ft > 0) {
      var klConfig = config.kitchen_linear;
      var klLinearFt = Math.min(Math.max(features.kitchen_linear.linear_ft, klConfig.min_linear_ft), klConfig.max_linear_ft);
      var klTier = designPackage || "standard";
      var klCostPerFt = klConfig.cost_per_linear_ft[klTier] || klConfig.cost_per_linear_ft.standard;

      var klCost = klLinearFt * klCostPerFt;
      result.total += klCost;
      result.items.push({
        feature: "Kitchen Counters/Cabinets",
        description: klLinearFt + " linear ft (" + DESIGN_PACKAGE_LABELS[klTier] + " tier)",
        cost: klCost,
        breakdown: klLinearFt + " ft x $" + klCostPerFt
      });
      result.has_features = true;
    }

    // 3. Kitchen Island
    if (features.kitchen_island.enabled && features.kitchen_island.size !== "none") {
      var kiConfig = config.kitchen_island;
      var kiSize = features.kitchen_island.size;
      var kiBaseCost = kiConfig.base_cost[kiSize] || 0;
      var kiTotalCost = kiBaseCost;
      var kiExtras = [];

      if (features.kitchen_island.has_plumbing) {
        kiTotalCost += kiConfig.has_plumbing_addon;
        kiExtras.push("+sink");
      }
      if (features.kitchen_island.has_seating) {
        kiTotalCost += kiConfig.has_seating_addon;
        kiExtras.push("+seating");
      }

      if (kiTotalCost > 0) {
        result.total += kiTotalCost;
        var kiDesc = kiSize.charAt(0).toUpperCase() + kiSize.slice(1) + " island";
        if (kiExtras.length > 0) kiDesc += " (" + kiExtras.join(", ") + ")";

        result.items.push({
          feature: "Kitchen Island",
          description: kiDesc,
          cost: kiTotalCost,
          breakdown: "$" + kiBaseCost.toLocaleString() + " base" + (kiExtras.length > 0 ? " + extras" : "")
        });
        result.has_features = true;
      }
    }

    // 4. Rooftop Deck
    if (features.rooftop_deck.enabled && features.rooftop_deck.sqft > 0) {
      var rtConfig = config.rooftop_deck;
      var rtSqft = Math.max(features.rooftop_deck.sqft, rtConfig.min_sqft);
      var rtTier = features.rooftop_deck.tier || "standard";
      var rtCostPerSqft = rtConfig.cost_per_sqft[rtTier] || rtConfig.cost_per_sqft.standard;

      var rtCost = rtSqft * rtCostPerSqft;
      if (features.rooftop_deck.needs_structural) {
        rtCost += rtConfig.structural_addon;
      }

      result.total += rtCost;
      result.items.push({
        feature: "Rooftop Deck",
        description: rtSqft + " sqft (" + rtTier + ")" + (features.rooftop_deck.needs_structural ? " + structural" : ""),
        cost: rtCost,
        breakdown: rtSqft + " sqft x $" + rtCostPerSqft + (features.rooftop_deck.needs_structural ? " + $" + rtConfig.structural_addon.toLocaleString() : "")
      });
      result.has_features = true;
    }

    // 5. Exterior Deck
    if (features.exterior_deck.enabled && features.exterior_deck.sqft > 0) {
      var edConfig = config.exterior_deck;
      var edSqft = features.exterior_deck.sqft;
      var edMaterial = features.exterior_deck.material || "composite";
      var edCostPerSqft = edConfig.cost_per_sqft[edMaterial] || edConfig.cost_per_sqft.composite;

      var edCost = edSqft * edCostPerSqft;
      var edExtras = [];

      if (features.exterior_deck.railing_linear_ft > 0) {
        edCost += features.exterior_deck.railing_linear_ft * edConfig.railing_per_linear_ft;
        edExtras.push(features.exterior_deck.railing_linear_ft + "ft railing");
      }
      if (features.exterior_deck.stairs_steps > 0) {
        edCost += features.exterior_deck.stairs_steps * edConfig.stairs_per_step;
        edExtras.push(features.exterior_deck.stairs_steps + " steps");
      }
      if (features.exterior_deck.is_covered) {
        edCost += edSqft * edConfig.covered_addon_per_sqft;
        edExtras.push("covered");
      }

      result.total += edCost;
      result.items.push({
        feature: "Exterior Deck",
        description: edSqft + " sqft " + edMaterial + (edExtras.length > 0 ? " (" + edExtras.join(", ") + ")" : ""),
        cost: edCost,
        breakdown: edSqft + " sqft x $" + edCostPerSqft + (edExtras.length > 0 ? " + extras" : "")
      });
      result.has_features = true;
    }

    // 6. Landscape
    if (features.landscape.enabled && features.landscape.sqft > 0) {
      var lsConfig = config.landscape;
      var lsSqft = features.landscape.sqft;
      var lsTier = features.landscape.tier || "standard";
      var lsCostPerSqft = lsConfig.cost_per_sqft[lsTier] || lsConfig.cost_per_sqft.standard;

      var lsCost = lsSqft * lsCostPerSqft;
      var lsExtras = [];

      if (features.landscape.hardscape_sqft > 0) {
        lsCost += features.landscape.hardscape_sqft * lsConfig.hardscape_per_sqft;
        lsExtras.push(features.landscape.hardscape_sqft + " sqft hardscape");
      }
      if (features.landscape.has_irrigation) {
        lsCost += lsSqft * lsConfig.irrigation_per_sqft;
        lsExtras.push("irrigation");
      }
      if (features.landscape.fence_linear_ft > 0) {
        lsCost += features.landscape.fence_linear_ft * lsConfig.fence_per_linear_ft;
        lsExtras.push(features.landscape.fence_linear_ft + "ft fence");
      }

      result.total += lsCost;
      result.items.push({
        feature: "Landscaping",
        description: lsSqft + " sqft (" + lsTier + ")" + (lsExtras.length > 0 ? " + " + lsExtras.join(", ") : ""),
        cost: lsCost,
        breakdown: lsSqft + " sqft x $" + lsCostPerSqft + (lsExtras.length > 0 ? " + extras" : "")
      });
      result.has_features = true;
    }

    return result;
  }

  /**
   * Main local calculation function (v2.0)
   * Now with density, cross-interactions, design curves, and efficiency factors
   */
  function calculateLocalEstimate() {
    // Validate required fields
    if (!selectedType || !selectedStories || !selectedConstruction || !enteredSqft ||
        !selectedDesignPackage || enteredBedrooms === null || enteredBathrooms === null ||
        !selectedFoundation || !selectedLandSurface) {
      return null;
    }

    var PM = PRICING_MATRIX;
    var breakdown = { items: [], warnings: [], adjustments: [], cross_interactions: [] };

    // 1. Get base rate from matrix
    var baseRateTable = PM.base_rates[selectedType];
    if (!baseRateTable) return null;

    var baseRate = baseRateTable[selectedConstruction];
    if (baseRate === null || baseRate === undefined) {
      return { error: "This construction type is not available for " + TYPE_LABELS[selectedType] };
    }

    breakdown.items.push({
      category: "Base Rate",
      description: TYPE_LABELS[selectedType] + " + " + CONSTRUCTION_LABELS[selectedConstruction],
      rate: baseRate,
      note: "$" + baseRate + "/sqft base"
    });

    // 2. Apply SQFT curve modifier
    var sqftMod = getSqftModifier(selectedType, enteredSqft);
    var adjustedRate = baseRate * sqftMod.modifier;

    breakdown.items.push({
      category: "Size Adjustment",
      description: enteredSqft.toLocaleString() + " sqft (" + sqftMod.label + ")",
      modifier: sqftMod.modifier,
      note: sqftMod.zone === "optimal" ? "No adjustment" : (sqftMod.modifier > 1 ? "+" : "") + Math.round((sqftMod.modifier - 1) * 100) + "%"
    });

    // 3. Apply conversion/renovation efficiency
    var efficiencyMod = getConversionEfficiency(selectedType, enteredSqft, selectedConstruction);
    if (efficiencyMod.modifier !== 1.0) {
      adjustedRate *= efficiencyMod.modifier;
      breakdown.items.push({
        category: "Efficiency Factor",
        description: efficiencyMod.label,
        modifier: efficiencyMod.modifier,
        note: efficiencyMod.efficiency_pct > 0
          ? "-" + efficiencyMod.efficiency_pct + "% (structure reuse)"
          : "+" + Math.abs(efficiencyMod.efficiency_pct) + "% (expansion needed)"
      });
    }

    // 4. Calculate base cost
    var baseCost = adjustedRate * enteredSqft;

    breakdown.items.push({
      category: "Subtotal (Base)",
      description: "$" + adjustedRate.toFixed(2) + " x " + enteredSqft.toLocaleString() + " sqft",
      cost: baseCost,
      note: "Before multipliers"
    });

    // 5. Apply standard multipliers
    var storiesMult = PM.stories_multipliers[selectedStories] || 1.0;
    var foundationMult = PM.foundation_multipliers[selectedFoundation] || 1.0;
    var landMult = PM.land_multipliers[selectedLandSurface] || 1.0;

    // 6. Use non-linear design curve instead of simple multiplier
    var designCurve = getDesignCurveMultiplier(selectedDesignPackage);

    breakdown.items.push({
      category: "Stories",
      description: selectedStories + " " + (selectedStories === 1 ? "story" : "stories"),
      modifier: storiesMult,
      note: storiesMult === 1 ? "No adjustment" : "x" + storiesMult.toFixed(2)
    });

    breakdown.items.push({
      category: "Design Package",
      description: designCurve.label,
      modifier: designCurve.modifier,
      note: "Quality index: " + designCurve.quality_index + " (non-linear curve)"
    });

    breakdown.items.push({
      category: "Foundation",
      description: FOUNDATION_LABELS[selectedFoundation],
      modifier: foundationMult,
      note: foundationMult === 1 ? "Standard" : "+" + Math.round((foundationMult - 1) * 100) + "%"
    });

    breakdown.items.push({
      category: "Land Surface",
      description: LAND_SURFACE_LABELS[selectedLandSurface],
      modifier: landMult,
      note: landMult === 1 ? "Flat terrain" : "+" + Math.round((landMult - 1) * 100) + "% (grading/engineering)"
    });

    // 7. Calculate density modifier (bed/bath per sqft)
    var densityMod = getDensityModifier(enteredSqft, enteredBedrooms, enteredBathrooms);
    if (densityMod.modifier !== 1.0) {
      breakdown.items.push({
        category: "Density Factor",
        description: densityMod.label,
        modifier: densityMod.modifier,
        note: densityMod.details.length > 0 ? densityMod.details[0] : ""
      });
    }

    // Combined multiplier (before cross-interactions and rules)
    var combinedMultiplier = storiesMult * designCurve.modifier * foundationMult * landMult * densityMod.modifier;

    // 8. Check cross-variable interactions
    var crossMod = getCrossInteractionMultiplier({
      adu_type: selectedType,
      construction: selectedConstruction,
      stories: selectedStories,
      design: selectedDesignPackage,
      foundation: selectedFoundation,
      land_surface: selectedLandSurface
    });

    if (crossMod.applied.length > 0) {
      breakdown.cross_interactions = crossMod.applied;
      breakdown.items.push({
        category: "Cross Interactions",
        description: crossMod.applied.map(function(i) { return i.reason; }).join("; "),
        modifier: crossMod.modifier,
        note: "+" + Math.round((crossMod.modifier - 1) * 100) + "% (" + crossMod.applied.length + " interactions)"
      });
      combinedMultiplier *= crossMod.modifier;
    }

    // 9. Check compatibility rules
    var ruleCheck = checkCompatibilityRules({
      adu_type: selectedType,
      construction: selectedConstruction,
      stories: selectedStories,
      foundation: selectedFoundation,
      land_surface: selectedLandSurface
    });

    if (ruleCheck.invalids.length > 0) {
      return { error: ruleCheck.invalids[0].message };
    }

    breakdown.warnings = ruleCheck.warnings;
    breakdown.adjustments = ruleCheck.adjustments;

    if (ruleCheck.totalAdjustment !== 1.0) {
      breakdown.items.push({
        category: "Rule Adjustments",
        description: ruleCheck.warnings.concat(ruleCheck.adjustments).map(function(r) { return r.message; }).join("; "),
        modifier: ruleCheck.totalAdjustment,
        note: "+" + Math.round((ruleCheck.totalAdjustment - 1) * 100) + "% (compatibility)"
      });
      combinedMultiplier *= ruleCheck.totalAdjustment;
    }

    // Multiplied subtotal
    var multipliedCost = baseCost * combinedMultiplier;

    breakdown.items.push({
      category: "Subtotal (Multiplied)",
      description: "Base x " + combinedMultiplier.toFixed(3),
      cost: multipliedCost,
      note: "After all multipliers"
    });

    // 10. Add fixed/variable additions with non-linear bedroom/bathroom costs
    var additionsCost = 0;
    var adds = PM.additions;

    // Bedrooms (non-linear: first costs more)
    var bedroomCalc = calculateBedroomCost(enteredBedrooms);
    if (bedroomCalc.cost > 0) {
      additionsCost += bedroomCalc.cost;
      breakdown.items.push({
        category: "Bedrooms",
        description: bedroomCalc.breakdown,
        cost: bedroomCalc.cost,
        note: enteredBedrooms === 0 ? "Studio layout" : "Framing/finishing"
      });
    }

    // Bathrooms (non-linear: first costs more for main plumbing)
    var bathroomCalc = calculateBathroomCost(enteredBathrooms);
    if (bathroomCalc.cost > 0) {
      additionsCost += bathroomCalc.cost;
      breakdown.items.push({
        category: "Bathrooms",
        description: bathroomCalc.breakdown,
        cost: bathroomCalc.cost,
        note: "Plumbing/fixtures"
      });
    }

    // Additional options
    if (additionalOptions.plans_permits) {
      additionsCost += adds.plans_permits;
      breakdown.items.push({
        category: "Plans & Permits",
        description: "Architecture + city permits",
        cost: adds.plans_permits,
        note: "Fixed cost"
      });
    }

    if (additionalOptions.solar_panels) {
      var solarCost = enteredSqft * adds.solar_panels_per_sqft;
      additionsCost += solarCost;
      breakdown.items.push({
        category: "Solar Panels",
        description: enteredSqft.toLocaleString() + " sqft x $" + adds.solar_panels_per_sqft,
        cost: solarCost,
        note: "Proportional to size"
      });
    }

    if (additionalOptions.fire_sprinklers) {
      var sprinklerCost = enteredSqft * adds.fire_sprinklers_per_sqft;
      additionsCost += sprinklerCost;
      breakdown.items.push({
        category: "Fire Sprinklers",
        description: enteredSqft.toLocaleString() + " sqft x $" + adds.fire_sprinklers_per_sqft,
        cost: sprinklerCost,
        note: "Required in some areas"
      });
    }

    if (additionalOptions.appliances) {
      additionsCost += adds.appliances;
      breakdown.items.push({
        category: "Appliances",
        description: "Basic appliance package",
        cost: adds.appliances,
        note: "Refrigerator, range, etc."
      });
    }

    // 10b. Optional measurable features
    var optionalFeaturesCost = calculateOptionalFeaturesCost(optionalFeatures, selectedDesignPackage);
    if (optionalFeaturesCost.has_features) {
      additionsCost += optionalFeaturesCost.total;

      // Add each optional feature to breakdown
      optionalFeaturesCost.items.forEach(function(item) {
        breakdown.items.push({
          category: item.feature,
          description: item.description,
          cost: item.cost,
          note: item.breakdown
        });
      });
    }

    // 11. Calculate total
    var totalCost = multipliedCost + additionsCost;
    var costPerSqft = totalCost / enteredSqft;

    // Build final estimate object with enhanced metadata
    var estimate = {
      total_estimated_cost: Math.round(totalCost),
      cost_per_sqft: Math.round(costPerSqft),
      base_rate: baseRate,
      adjusted_rate: adjustedRate,
      sqft: enteredSqft,
      combined_multiplier: combinedMultiplier,
      efficiency_factor: efficiencyMod.modifier,
      density_factor: densityMod.modifier,
      cross_interaction_factor: crossMod.modifier,
      optional_features_total: optionalFeaturesCost.total,
      optional_features_count: optionalFeaturesCost.items.length,
      breakdown: breakdown,
      assumptions: [
        "Prices based on Los Angeles County averages (2024-2025)",
        "Optional features (deck, landscape, etc.) included if specified",
        "Actual costs may vary based on site conditions and material choices",
        "Permit timeline and fees vary by jurisdiction",
        "Density and cross-interaction factors applied for layout complexity"
      ],
      disclaimer: "This is an estimate for planning purposes only. Actual construction costs may vary significantly based on site conditions, material selections, labor availability, and market conditions. Always obtain multiple contractor bids before proceeding."
    };

    return estimate;
  }

  /**
   * Main calculate function (now uses local calculation)
   */
  function calculateCost() {
    // Validate minimum required fields
    if (!selectedType || !selectedStories || !selectedConstruction || !enteredSqft ||
        !selectedDesignPackage || enteredBedrooms === null || enteredBathrooms === null ||
        !selectedFoundation || !selectedLandSurface) {
      if (window.Toast) Toast.error("Missing Parameters", "Please complete all steps before calculating.");
      return;
    }

    costLoading = true;
    resultsContainer.innerHTML = '<div style="padding: 24px; text-align: center; color: rgba(255,255,255,0.4);">'
      + '<span class="adu-analysis-spinner" style="width: 24px; height: 24px; border-width: 3px;"></span>'
      + '<p style="margin-top: 12px; font-size: 13px;">Calculating estimate...</p>'
      + '</div>';
    sectionResults.classList.remove("locked");

    // Small delay for UX (shows loading state)
    setTimeout(function() {
      var estimate = calculateLocalEstimate();

      costLoading = false;

      if (!estimate) {
        resultsContainer.innerHTML = '<div style="padding: 24px; text-align: center; color: #ef4444; font-size: 13px;">'
          + 'Unable to calculate. Please check all fields.'
          + '</div>';
        return;
      }

      if (estimate.error) {
        resultsContainer.innerHTML = '<div style="padding: 24px; text-align: center; color: #ef4444; font-size: 13px;">'
          + estimate.error
          + '</div>';
        if (window.Toast) Toast.error("Invalid Configuration", estimate.error);
        return;
      }

      costEstimate = estimate;
      renderCostResults();
      refresh();

      if (window.Toast) Toast.success("Estimate Ready", "$" + estimate.total_estimated_cost.toLocaleString() + " total");
    }, 300);
  }

  // ------------------------------------------
  // COST RESULTS RENDERING
  // ------------------------------------------

  function renderCostResults() {
    if (!costEstimate) {
      resultsContainer.innerHTML = "";
      return;
    }

    var d = costEstimate;
    var html = '';

    // Header with total
    html += '<div class="adu-cost-header">'
          + '<span class="adu-cost-total">$' + d.total_estimated_cost.toLocaleString() + '</span>'
          + '<span class="adu-cost-per-sqft">$' + d.cost_per_sqft.toLocaleString() + ' / sq ft</span>'
          + '</div>';

    // Warnings (if any)
    if (d.breakdown && d.breakdown.warnings && d.breakdown.warnings.length > 0) {
      html += '<div class="adu-cost-warnings">';
      d.breakdown.warnings.forEach(function (w) {
        html += '<div class="adu-warning-item">'
              + '<span class="warning-icon">!</span>'
              + '<span class="warning-text">' + w.message + '</span>'
              + '</div>';
      });
      html += '</div>';
    }

    // Breakdown table
    if (d.breakdown && d.breakdown.items && d.breakdown.items.length > 0) {
      html += '<div class="adu-breakdown-section">'
            + '<div class="adu-breakdown-title">Cost Breakdown</div>'
            + '<table class="adu-cost-table">'
            + '<thead><tr>'
            + '<th>Category</th>'
            + '<th>Description</th>'
            + '<th style="text-align: right;">Value</th>'
            + '<th>Notes</th>'
            + '</tr></thead>'
            + '<tbody>';

      d.breakdown.items.forEach(function (item) {
        var valueStr = "";
        var rowClass = "";

        if (item.cost !== undefined) {
          valueStr = '$' + Math.round(item.cost).toLocaleString();
          if (item.category.indexOf("Subtotal") !== -1) {
            rowClass = " class=\"row-subtotal\"";
          }
        } else if (item.modifier !== undefined) {
          if (item.modifier === 1) {
            valueStr = "x1.00";
          } else if (item.modifier > 1) {
            valueStr = '<span class="val-penalty">x' + item.modifier.toFixed(2) + '</span>';
          } else {
            valueStr = '<span class="val-discount">x' + item.modifier.toFixed(2) + '</span>';
          }
        } else if (item.rate !== undefined) {
          valueStr = '$' + item.rate + '/sqft';
        }

        html += '<tr' + rowClass + '>'
              + '<td>' + item.category + '</td>'
              + '<td>' + item.description + '</td>'
              + '<td class="col-cost">' + valueStr + '</td>'
              + '<td class="col-notes">' + (item.note || "") + '</td>'
              + '</tr>';
      });

      html += '</tbody></table>';
      html += '</div>';
    }

    // Visual breakdown bars
    html += '<div class="adu-breakdown-visual">'
          + '<div class="adu-breakdown-title">Visual Breakdown</div>'
          + '<div class="adu-breakdown-bars">';

    // Calculate components for visual
    var baseComponent = d.base_rate * d.sqft;
    var multiplierEffect = (d.combined_multiplier - 1) * baseComponent;
    var additionsTotal = d.total_estimated_cost - (baseComponent * d.combined_multiplier);

    var maxVal = d.total_estimated_cost;

    // Base cost bar
    var baseWidth = Math.round((baseComponent / maxVal) * 100);
    html += '<div class="breakdown-bar-row">'
          + '<span class="bar-label">Base Cost</span>'
          + '<div class="bar-track"><div class="bar-fill bar-base" style="width:' + baseWidth + '%"></div></div>'
          + '<span class="bar-value">$' + Math.round(baseComponent).toLocaleString() + '</span>'
          + '</div>';

    // Multipliers effect bar
    if (multiplierEffect !== 0) {
      var multWidth = Math.round((Math.abs(multiplierEffect) / maxVal) * 100);
      var multClass = multiplierEffect > 0 ? "bar-penalty" : "bar-discount";
      html += '<div class="breakdown-bar-row">'
            + '<span class="bar-label">Multipliers</span>'
            + '<div class="bar-track"><div class="bar-fill ' + multClass + '" style="width:' + multWidth + '%"></div></div>'
            + '<span class="bar-value">' + (multiplierEffect > 0 ? '+' : '') + '$' + Math.round(multiplierEffect).toLocaleString() + '</span>'
            + '</div>';
    }

    // Additions bar
    if (additionsTotal > 0) {
      var addWidth = Math.round((additionsTotal / maxVal) * 100);
      html += '<div class="breakdown-bar-row">'
            + '<span class="bar-label">Additions</span>'
            + '<div class="bar-track"><div class="bar-fill bar-additions" style="width:' + addWidth + '%"></div></div>'
            + '<span class="bar-value">+$' + Math.round(additionsTotal).toLocaleString() + '</span>'
            + '</div>';
    }

    // Total bar
    html += '<div class="breakdown-bar-row row-total">'
          + '<span class="bar-label">Total</span>'
          + '<div class="bar-track"><div class="bar-fill bar-total" style="width:100%"></div></div>'
          + '<span class="bar-value">$' + d.total_estimated_cost.toLocaleString() + '</span>'
          + '</div>';

    html += '</div></div>';

    // Assumptions
    if (d.assumptions && d.assumptions.length > 0) {
      html += '<div class="adu-cost-assumptions">'
            + '<div class="adu-cost-assumptions-title">Assumptions</div>'
            + '<ul>';
      d.assumptions.forEach(function (a) {
        html += '<li>' + a + '</li>';
      });
      html += '</ul></div>';
    }

    // Disclaimer
    if (d.disclaimer) {
      html += '<div class="adu-cost-disclaimer">' + d.disclaimer + '</div>';
    }

    resultsContainer.innerHTML = html;
  }

  // ------------------------------------------
  // ALGORITHM VISUALIZATION
  // ------------------------------------------

  var algoGraphExpanded = false;

  // Node definitions for the graph
  var ALGO_NODES = [
    { id: "adu_type", label: "ADU Type", x: 400, y: 40, layer: 0, type: "input" },
    { id: "construction", label: "Construction", x: 250, y: 120, layer: 1, type: "input" },
    { id: "sqft", label: "Square Feet", x: 550, y: 120, layer: 1, type: "input" },
    { id: "base_rate", label: "Base Rate", x: 400, y: 200, layer: 2, type: "calc" },
    { id: "sqft_curve", label: "Size Curve", x: 550, y: 200, layer: 2, type: "modifier" },
    { id: "efficiency", label: "Efficiency", x: 700, y: 200, layer: 2, type: "modifier" },
    { id: "stories", label: "Stories", x: 100, y: 280, layer: 3, type: "input" },
    { id: "design", label: "Design Pkg", x: 230, y: 280, layer: 3, type: "input" },
    { id: "foundation", label: "Foundation", x: 360, y: 280, layer: 3, type: "input" },
    { id: "land", label: "Land Surface", x: 490, y: 280, layer: 3, type: "input" },
    { id: "density", label: "Density", x: 620, y: 280, layer: 3, type: "modifier" },
    { id: "multiplier", label: "Multiplier", x: 300, y: 370, layer: 4, type: "calc" },
    { id: "rules", label: "Rules Check", x: 450, y: 370, layer: 4, type: "modifier" },
    { id: "cross", label: "Cross Adj", x: 600, y: 370, layer: 4, type: "modifier" },
    { id: "config", label: "Bed/Bath", x: 150, y: 460, layer: 5, type: "input" },
    { id: "options", label: "Add-ons", x: 300, y: 460, layer: 5, type: "input" },
    { id: "opt_features", label: "Site Features", x: 470, y: 460, layer: 5, type: "input" },
    { id: "additions", label: "Additions", x: 300, y: 530, layer: 6, type: "calc" },
    { id: "total", label: "TOTAL", x: 400, y: 610, layer: 7, type: "output" }
  ];

  // Edge definitions (connections between nodes)
  var ALGO_EDGES = [
    // Layer 0-1: Inputs to base calculations
    { from: "adu_type", to: "base_rate", label: "rate lookup" },
    { from: "adu_type", to: "sqft_curve", label: "curve select" },
    { from: "adu_type", to: "efficiency", label: "type check" },
    { from: "construction", to: "base_rate", label: "rate lookup" },
    { from: "construction", to: "efficiency", label: "reno check" },
    { from: "sqft", to: "sqft_curve", label: "apply curve" },
    { from: "sqft", to: "efficiency", label: "size check" },
    { from: "sqft", to: "density", label: "sqft input" },

    // Layer 2-3: Modifiers feed into multiplier
    { from: "base_rate", to: "multiplier", label: "base cost" },
    { from: "sqft_curve", to: "multiplier", label: "size adj" },
    { from: "efficiency", to: "multiplier", label: "reuse adj" },
    { from: "stories", to: "multiplier", label: "x factor" },
    { from: "design", to: "multiplier", label: "curve" },
    { from: "foundation", to: "multiplier", label: "x factor" },
    { from: "land", to: "multiplier", label: "x factor" },
    { from: "density", to: "multiplier", label: "layout adj" },
    { from: "config", to: "density", label: "bed/bath" },

    // Rules & Cross interactions
    { from: "foundation", to: "rules", label: "check" },
    { from: "land", to: "rules", label: "check" },
    { from: "stories", to: "rules", label: "check" },
    { from: "adu_type", to: "rules", label: "check" },
    { from: "rules", to: "multiplier", label: "adj" },

    // Cross-variable interactions
    { from: "design", to: "cross", label: "combo" },
    { from: "stories", to: "cross", label: "combo" },
    { from: "foundation", to: "cross", label: "combo" },
    { from: "land", to: "cross", label: "combo" },
    { from: "adu_type", to: "cross", label: "combo" },
    { from: "construction", to: "cross", label: "combo" },
    { from: "cross", to: "multiplier", label: "cross adj" },

    // Additions
    { from: "config", to: "additions", label: "costs" },
    { from: "options", to: "additions", label: "costs" },
    { from: "opt_features", to: "additions", label: "site costs" },
    { from: "sqft", to: "additions", label: "sqft costs" },

    // Final total
    { from: "multiplier", to: "total", label: "subtotal" },
    { from: "additions", to: "total", label: "+ add" }
  ];

  function getNodeStatus(nodeId) {
    // Returns: { active, value, modifier, status }
    var PM = PRICING_MATRIX;
    var status = { active: false, value: null, modifier: null, status: "neutral" };

    switch (nodeId) {
      case "adu_type":
        status.active = !!selectedType;
        status.value = selectedType ? TYPE_LABELS[selectedType] : null;
        break;
      case "construction":
        status.active = !!selectedConstruction;
        status.value = selectedConstruction ? CONSTRUCTION_LABELS[selectedConstruction] : null;
        break;
      case "sqft":
        status.active = !!enteredSqft;
        status.value = enteredSqft ? enteredSqft.toLocaleString() + " sqft" : null;
        break;
      case "base_rate":
        if (selectedType && selectedConstruction) {
          var rate = PM.base_rates[selectedType] ? PM.base_rates[selectedType][selectedConstruction] : null;
          status.active = rate !== null;
          status.value = rate ? "$" + rate + "/sqft" : null;
        }
        break;
      case "sqft_curve":
        if (selectedType && enteredSqft) {
          var mod = getSqftModifier(selectedType, enteredSqft);
          status.active = true;
          status.value = mod.label;
          status.modifier = mod.modifier;
          status.status = mod.modifier > 1 ? "penalty" : (mod.modifier < 1 ? "discount" : "neutral");
        }
        break;
      case "stories":
        status.active = !!selectedStories;
        status.value = selectedStories ? selectedStories + " story" : null;
        status.modifier = selectedStories ? PM.stories_multipliers[selectedStories] : null;
        if (status.modifier && status.modifier > 1) status.status = "penalty";
        break;
      case "design":
        if (selectedDesignPackage) {
          var designCurve = getDesignCurveMultiplier(selectedDesignPackage);
          status.active = true;
          status.value = designCurve.label;
          status.modifier = designCurve.modifier;
          status.status = designCurve.modifier > 1 ? "penalty" : (designCurve.modifier < 1 ? "discount" : "neutral");
        }
        break;
      case "efficiency":
        if (selectedType && enteredSqft) {
          var effMod = getConversionEfficiency(selectedType, enteredSqft, selectedConstruction);
          status.active = effMod.modifier !== 1.0;
          status.value = effMod.label;
          status.modifier = effMod.modifier;
          if (effMod.efficiency_pct > 0) {
            status.value += " (-" + effMod.efficiency_pct + "%)";
            status.status = "discount";
          } else if (effMod.efficiency_pct < 0) {
            status.status = "penalty";
          } else {
            status.status = "neutral";
          }
        }
        break;
      case "density":
        if (enteredSqft && enteredBedrooms !== null && enteredBathrooms !== null) {
          var densMod = getDensityModifier(enteredSqft, enteredBedrooms, enteredBathrooms);
          status.active = true;
          status.value = densMod.label;
          status.modifier = densMod.modifier;
          status.status = densMod.modifier > 1 ? "penalty" : (densMod.modifier < 1 ? "discount" : "neutral");
        }
        break;
      case "cross":
        if (selectedType && selectedDesignPackage && selectedStories && selectedFoundation && selectedLandSurface) {
          var crossMod = getCrossInteractionMultiplier({
            adu_type: selectedType,
            construction: selectedConstruction,
            design: selectedDesignPackage,
            stories: selectedStories,
            foundation: selectedFoundation,
            land_surface: selectedLandSurface
          });
          status.active = crossMod.applied.length > 0;
          if (crossMod.applied.length > 0) {
            status.value = crossMod.applied.length + " active (+" + Math.round((crossMod.modifier - 1) * 100) + "%)";
            status.modifier = crossMod.modifier;
            status.status = "penalty";
          } else {
            status.value = "No combos";
            status.status = "neutral";
          }
        }
        break;
      case "foundation":
        status.active = !!selectedFoundation;
        status.value = selectedFoundation ? FOUNDATION_LABELS[selectedFoundation] : null;
        status.modifier = selectedFoundation ? PM.foundation_multipliers[selectedFoundation] : null;
        if (status.modifier && status.modifier > 1) status.status = "penalty";
        break;
      case "land":
        status.active = !!selectedLandSurface;
        status.value = selectedLandSurface ? LAND_SURFACE_LABELS[selectedLandSurface] : null;
        status.modifier = selectedLandSurface ? PM.land_multipliers[selectedLandSurface] : null;
        if (status.modifier && status.modifier > 1) status.status = "penalty";
        break;
      case "multiplier":
        if (costEstimate) {
          status.active = true;
          status.value = "x" + costEstimate.combined_multiplier.toFixed(2);
          status.modifier = costEstimate.combined_multiplier;
          status.status = costEstimate.combined_multiplier > 1 ? "penalty" : "discount";
        }
        break;
      case "rules":
        if (selectedType && selectedFoundation && selectedLandSurface) {
          var check = checkCompatibilityRules({
            adu_type: selectedType,
            construction: selectedConstruction,
            stories: selectedStories,
            foundation: selectedFoundation,
            land_surface: selectedLandSurface
          });
          status.active = true;
          if (check.warnings.length > 0 || check.adjustments.length > 0) {
            status.value = (check.warnings.length + check.adjustments.length) + " rules";
            status.status = "warning";
          } else {
            status.value = "OK";
            status.status = "neutral";
          }
        }
        break;
      case "config":
        status.active = enteredBedrooms !== null && enteredBathrooms !== null;
        status.value = status.active ? enteredBedrooms + "bd/" + enteredBathrooms + "ba" : null;
        break;
      case "options":
        var count = 0;
        if (additionalOptions.plans_permits) count++;
        if (additionalOptions.solar_panels) count++;
        if (additionalOptions.fire_sprinklers) count++;
        if (additionalOptions.appliances) count++;
        status.active = count > 0;
        status.value = count > 0 ? count + " selected" : "None";
        break;
      case "opt_features":
        var optFeatCost = calculateOptionalFeaturesCost(optionalFeatures, selectedDesignPackage);
        status.active = optFeatCost.has_features;
        if (optFeatCost.has_features) {
          status.value = optFeatCost.items.length + " features (+$" + Math.round(optFeatCost.total).toLocaleString() + ")";
        } else {
          status.value = "None";
        }
        break;
      case "additions":
        if (costEstimate) {
          var addTotal = costEstimate.total_estimated_cost - (costEstimate.base_rate * costEstimate.sqft * costEstimate.combined_multiplier);
          status.active = addTotal > 0;
          status.value = addTotal > 0 ? "+$" + Math.round(addTotal).toLocaleString() : "$0";
        }
        break;
      case "total":
        if (costEstimate) {
          status.active = true;
          status.value = "$" + costEstimate.total_estimated_cost.toLocaleString();
          status.status = "output";
        }
        break;
    }

    return status;
  }

  function renderAlgorithmGraph() {
    if (!algoGraphContainer) return;

    var width = 800;
    var height = 680;

    var svg = '<svg class="algo-graph-svg" viewBox="0 0 ' + width + ' ' + height + '" preserveAspectRatio="xMidYMid meet">';

    // Draw edges first (behind nodes)
    svg += '<g class="algo-edges">';
    ALGO_EDGES.forEach(function (edge) {
      var fromNode = ALGO_NODES.find(function (n) { return n.id === edge.from; });
      var toNode = ALGO_NODES.find(function (n) { return n.id === edge.to; });
      if (!fromNode || !toNode) return;

      var fromStatus = getNodeStatus(edge.from);
      var toStatus = getNodeStatus(edge.to);
      var edgeActive = fromStatus.active && toStatus.active;

      var x1 = fromNode.x;
      var y1 = fromNode.y + 20;
      var x2 = toNode.x;
      var y2 = toNode.y - 20;

      // Curved path
      var midY = (y1 + y2) / 2;
      var path = "M" + x1 + "," + y1 + " Q" + x1 + "," + midY + " " + ((x1 + x2) / 2) + "," + midY + " T" + x2 + "," + y2;

      var edgeClass = "algo-edge" + (edgeActive ? " active" : "");

      svg += '<path class="' + edgeClass + '" d="' + path + '" data-from="' + edge.from + '" data-to="' + edge.to + '"/>';
    });
    svg += '</g>';

    // Draw nodes
    svg += '<g class="algo-nodes">';
    ALGO_NODES.forEach(function (node) {
      var status = getNodeStatus(node.id);
      var nodeClass = "algo-node";
      nodeClass += " node-" + node.type;
      if (status.active) nodeClass += " active";
      if (status.status === "penalty") nodeClass += " status-penalty";
      if (status.status === "discount") nodeClass += " status-discount";
      if (status.status === "warning") nodeClass += " status-warning";
      if (status.status === "output") nodeClass += " status-output";

      var rx = node.type === "output" ? 25 : (node.type === "calc" ? 8 : 12);
      var nodeWidth = node.type === "output" ? 100 : 80;
      var nodeHeight = node.type === "output" ? 50 : 40;

      svg += '<g class="' + nodeClass + '" data-node="' + node.id + '" transform="translate(' + node.x + ',' + node.y + ')">';
      svg += '<rect x="' + (-nodeWidth / 2) + '" y="' + (-nodeHeight / 2) + '" width="' + nodeWidth + '" height="' + nodeHeight + '" rx="' + rx + '"/>';
      svg += '<text class="node-label" y="-2">' + node.label + '</text>';
      if (status.value) {
        svg += '<text class="node-value" y="12">' + status.value + '</text>';
      }
      if (status.modifier && status.modifier !== 1) {
        var modStr = status.modifier > 1 ? "+" + Math.round((status.modifier - 1) * 100) + "%" : Math.round((status.modifier - 1) * 100) + "%";
        svg += '<text class="node-modifier" y="' + (nodeHeight / 2 + 14) + '">' + modStr + '</text>';
      }
      svg += '</g>';
    });
    svg += '</g>';

    svg += '</svg>';

    algoGraphContainer.innerHTML = svg;

    // Render legend
    renderAlgoLegend();

    // Bind node click events
    bindAlgoNodeEvents();
  }

  function renderAlgoLegend() {
    if (!algoLegend) return;

    var html = '<div class="legend-title">Legend</div>'
             + '<div class="legend-items">'
             + '<div class="legend-item"><span class="legend-dot dot-input"></span>Input</div>'
             + '<div class="legend-item"><span class="legend-dot dot-calc"></span>Calculation</div>'
             + '<div class="legend-item"><span class="legend-dot dot-modifier"></span>Modifier</div>'
             + '<div class="legend-item"><span class="legend-dot dot-output"></span>Output</div>'
             + '<div class="legend-item"><span class="legend-dot dot-penalty"></span>+ Cost</div>'
             + '<div class="legend-item"><span class="legend-dot dot-discount"></span>- Cost</div>'
             + '<div class="legend-item"><span class="legend-dot dot-warning"></span>Warning</div>'
             + '</div>';

    algoLegend.innerHTML = html;
  }

  function bindAlgoNodeEvents() {
    if (!algoGraphContainer) return;

    algoGraphContainer.querySelectorAll(".algo-node").forEach(function (nodeEl) {
      nodeEl.addEventListener("click", function () {
        var nodeId = nodeEl.getAttribute("data-node");
        showNodeDetails(nodeId);
      });
    });
  }

  function showNodeDetails(nodeId) {
    if (!algoNodeDetails) return;

    var node = ALGO_NODES.find(function (n) { return n.id === nodeId; });
    if (!node) return;

    var status = getNodeStatus(nodeId);
    var PM = PRICING_MATRIX;

    var html = '<div class="node-details-header">'
             + '<span class="details-title">' + node.label + '</span>'
             + '<button class="details-close" id="closeNodeDetails">x</button>'
             + '</div>';

    html += '<div class="node-details-body">';

    // Show current value
    if (status.value) {
      html += '<div class="details-row"><span class="details-label">Current:</span><span class="details-value">' + status.value + '</span></div>';
    }

    // Show modifier if applicable
    if (status.modifier) {
      var modClass = status.modifier > 1 ? "val-penalty" : (status.modifier < 1 ? "val-discount" : "");
      html += '<div class="details-row"><span class="details-label">Modifier:</span><span class="details-value ' + modClass + '">x' + status.modifier.toFixed(2) + '</span></div>';
    }

    // Show relevant config based on node
    switch (nodeId) {
      case "sqft_curve":
        if (selectedType) {
          var curve = PM.sqft_curves[selectedType];
          html += '<div class="details-section">Optimal Range</div>';
          html += '<div class="details-row"><span class="details-label">Min:</span><span class="details-value">' + curve.min + ' sqft</span></div>';
          html += '<div class="details-row"><span class="details-label">Optimal:</span><span class="details-value">' + curve.optimal_min + ' - ' + curve.optimal_max + ' sqft</span></div>';
          html += '<div class="details-row"><span class="details-label">Max:</span><span class="details-value">' + curve.max + ' sqft</span></div>';
        }
        break;
      case "base_rate":
        if (selectedType) {
          html += '<div class="details-section">Rates for ' + TYPE_LABELS[selectedType] + '</div>';
          var rates = PM.base_rates[selectedType];
          Object.keys(rates).forEach(function (k) {
            if (rates[k] !== null) {
              var highlight = k === selectedConstruction ? " class=\"highlight\"" : "";
              html += '<div class="details-row"' + highlight + '><span class="details-label">' + CONSTRUCTION_LABELS[k] + ':</span><span class="details-value">$' + rates[k] + '/sqft</span></div>';
            }
          });
        }
        break;
      case "rules":
        html += '<div class="details-section">Active Rules</div>';
        if (selectedType && selectedFoundation && selectedLandSurface) {
          var check = checkCompatibilityRules({
            adu_type: selectedType,
            construction: selectedConstruction,
            stories: selectedStories,
            foundation: selectedFoundation,
            land_surface: selectedLandSurface
          });
          if (check.warnings.length === 0 && check.adjustments.length === 0) {
            html += '<div class="details-row"><span class="details-value">No warnings or adjustments</span></div>';
          } else {
            check.warnings.concat(check.adjustments).forEach(function (r) {
              html += '<div class="details-row rule-warning"><span class="details-value">' + r.message + '</span></div>';
            });
          }
        }
        break;
    }

    html += '</div>';

    algoNodeDetails.innerHTML = html;
    algoNodeDetails.classList.remove("hidden");

    // Bind close button
    document.getElementById("closeNodeDetails").addEventListener("click", function () {
      algoNodeDetails.classList.add("hidden");
    });
  }

  function toggleAlgoPanel() {
    if (!algoPanelContent || !algoPanelArrow || !algoPanel) return;

    algoGraphExpanded = !algoGraphExpanded;
    algoPanel.classList.toggle("is-open", algoGraphExpanded);
    algoPanelContent.classList.toggle("hidden", !algoGraphExpanded);

    if (algoGraphExpanded) {
      renderAlgorithmGraph();
    }
  }

  // Bind panel toggle
  if (algoPanelToggle) {
    algoPanelToggle.addEventListener("click", toggleAlgoPanel);
  }

  // ------------------------------------------
  // RESET ALL SCREENSHOT/ANALYSIS STATE
  // ------------------------------------------

  function resetScreenshotState() {
    if (screenshotBlobUrls.floor1) URL.revokeObjectURL(screenshotBlobUrls.floor1);
    if (screenshotBlobUrls.floor2) URL.revokeObjectURL(screenshotBlobUrls.floor2);

    screenshotFiles   = { floor1: null, floor2: null };
    screenshotBlobUrls = { floor1: null, floor2: null };
    analysisResults   = { floor1: null, floor2: null };
    analysisLoading   = { floor1: false, floor2: false };
    screenshotSkipped = false;
    costEstimate      = null;
    costLoading       = false;

    screenshotUploads.innerHTML = "";
    analysisResultsDiv.classList.add("hidden");
    analysisResultsDiv.innerHTML = "";
    resultsContainer.innerHTML = "";
  }

  // ------------------------------------------
  // EVENT: ADU Type selection
  // ------------------------------------------
  gridType.addEventListener("click", function (e) {
    var card = e.target.closest(".adu-option-card");
    if (!card || !card.dataset.type) return;

    var prevType = selectedType;
    selectedType = card.dataset.type;

    selectCard(gridType, "type", selectedType);

    // Reset downstream selections when type changes
    if (prevType !== selectedType) {
      selectedStories = null;
      selectedConstruction = null;
      enteredSqft = null;
      gridStories.querySelectorAll(".adu-option-card").forEach(function (c) {
        c.classList.remove("selected");
      });
      gridConstruction.querySelectorAll(".adu-option-card").forEach(function (c) {
        c.classList.remove("selected");
      });
      inputSqft.value = "";
      resetScreenshotState();
    }

    refresh();
  });

  // ------------------------------------------
  // EVENT: Story selection
  // ------------------------------------------
  gridStories.addEventListener("click", function (e) {
    var card = e.target.closest(".adu-option-card");
    if (!card || card.classList.contains("disabled") || !card.dataset.stories) return;

    var prevStories = selectedStories;
    selectedStories = parseInt(card.dataset.stories, 10);
    selectCard(gridStories, "stories", String(selectedStories));

    // Reset screenshot state if stories changed (different upload zone count)
    if (prevStories !== selectedStories) {
      resetScreenshotState();
    }

    refresh();
  });

  // ------------------------------------------
  // EVENT: Construction Type selection
  // ------------------------------------------
  gridConstruction.addEventListener("click", function (e) {
    var card = e.target.closest(".adu-option-card");
    if (!card || card.classList.contains("disabled") || !card.dataset.construction) return;

    selectedConstruction = card.dataset.construction;
    selectCard(gridConstruction, "construction", selectedConstruction);

    refresh();
  });

  // ------------------------------------------
  // EVENT: Square Footage input
  // ------------------------------------------
  inputSqft.addEventListener("input", function () {
    var val = parseInt(inputSqft.value, 10);
    enteredSqft = (val > 0) ? val : null;
    refresh();
  });

  // ------------------------------------------
  // EVENT: Design Package selection
  // ------------------------------------------
  if (selectDesignPackage) {
    selectDesignPackage.addEventListener("change", function () {
      selectedDesignPackage = selectDesignPackage.value || null;
      refresh();
    });
  }

  // ------------------------------------------
  // EVENT: Configuration (Bedrooms & Bathrooms)
  // ------------------------------------------
  if (inputBedrooms) {
    inputBedrooms.addEventListener("input", function () {
      var val = parseInt(inputBedrooms.value, 10);
      enteredBedrooms = (!isNaN(val) && val >= 0) ? val : null;
      refresh();
    });
  }

  if (inputBathrooms) {
    inputBathrooms.addEventListener("input", function () {
      var val = parseInt(inputBathrooms.value, 10);
      enteredBathrooms = (!isNaN(val) && val >= 0) ? val : null;
      refresh();
    });
  }

  // ------------------------------------------
  // EVENT: Foundation Type selection
  // ------------------------------------------
  if (selectFoundation) {
    selectFoundation.addEventListener("change", function () {
      selectedFoundation = selectFoundation.value || null;
      refresh();
    });
  }

  // ------------------------------------------
  // EVENT: Land Surface selection
  // ------------------------------------------
  if (selectLandSurface) {
    selectLandSurface.addEventListener("change", function () {
      selectedLandSurface = selectLandSurface.value || null;
      refresh();
    });
  }

  // ------------------------------------------
  // EVENT: Additional Options checkboxes
  // ------------------------------------------
  if (chkPlansPermits) {
    chkPlansPermits.addEventListener("change", function () {
      additionalOptions.plans_permits = chkPlansPermits.checked;
      refresh();
    });
  }

  if (chkSolarPanels) {
    chkSolarPanels.addEventListener("change", function () {
      additionalOptions.solar_panels = chkSolarPanels.checked;
      refresh();
    });
  }

  if (chkFireSprinklers) {
    chkFireSprinklers.addEventListener("change", function () {
      additionalOptions.fire_sprinklers = chkFireSprinklers.checked;
      refresh();
    });
  }

  if (chkAppliances) {
    chkAppliances.addEventListener("change", function () {
      additionalOptions.appliances = chkAppliances.checked;
      refresh();
    });
  }

  // ------------------------------------------
  // EVENT: Optional Measurable Features
  // ------------------------------------------

  // Helper to toggle feature card and inputs visibility
  function setupFeatureToggle(checkbox, featureKey, inputsId, cardId) {
    if (!checkbox) return;
    var inputsDiv = document.getElementById(inputsId);
    var cardDiv = document.getElementById(cardId);

    checkbox.addEventListener("change", function () {
      optionalFeatures[featureKey].enabled = checkbox.checked;
      if (inputsDiv) inputsDiv.classList.toggle("hidden", !checkbox.checked);
      if (cardDiv) cardDiv.classList.toggle("is-enabled", checkbox.checked);
      refresh();
    });
  }

  // Retaining Wall
  setupFeatureToggle(chkRetainingWall, "retaining_wall", "inputsRetainingWall", "featureRetainingWall");
  if (inputRetainingWallFt) {
    inputRetainingWallFt.addEventListener("input", function () {
      optionalFeatures.retaining_wall.linear_ft = parseFloat(inputRetainingWallFt.value) || 0;
      refresh();
    });
  }
  if (selectRetainingWallHeight) {
    selectRetainingWallHeight.addEventListener("change", function () {
      optionalFeatures.retaining_wall.height = selectRetainingWallHeight.value;
      refresh();
    });
  }

  // Kitchen Linear
  setupFeatureToggle(chkKitchenLinear, "kitchen_linear", "inputsKitchenLinear", "featureKitchenLinear");
  if (inputKitchenLinearFt) {
    inputKitchenLinearFt.addEventListener("input", function () {
      optionalFeatures.kitchen_linear.linear_ft = parseFloat(inputKitchenLinearFt.value) || 0;
      refresh();
    });
  }

  // Kitchen Island
  setupFeatureToggle(chkKitchenIsland, "kitchen_island", "inputsKitchenIsland", "featureKitchenIsland");
  if (selectKitchenIslandSize) {
    selectKitchenIslandSize.addEventListener("change", function () {
      optionalFeatures.kitchen_island.size = selectKitchenIslandSize.value;
      refresh();
    });
  }
  if (chkIslandPlumbing) {
    chkIslandPlumbing.addEventListener("change", function () {
      optionalFeatures.kitchen_island.has_plumbing = chkIslandPlumbing.checked;
      refresh();
    });
  }
  if (chkIslandSeating) {
    chkIslandSeating.addEventListener("change", function () {
      optionalFeatures.kitchen_island.has_seating = chkIslandSeating.checked;
      refresh();
    });
  }

  // Rooftop Deck
  setupFeatureToggle(chkRooftopDeck, "rooftop_deck", "inputsRooftopDeck", "featureRooftopDeck");
  if (inputRooftopDeckSqft) {
    inputRooftopDeckSqft.addEventListener("input", function () {
      optionalFeatures.rooftop_deck.sqft = parseFloat(inputRooftopDeckSqft.value) || 0;
      refresh();
    });
  }
  if (selectRooftopDeckTier) {
    selectRooftopDeckTier.addEventListener("change", function () {
      optionalFeatures.rooftop_deck.tier = selectRooftopDeckTier.value;
      refresh();
    });
  }
  if (chkRooftopStructural) {
    chkRooftopStructural.addEventListener("change", function () {
      optionalFeatures.rooftop_deck.needs_structural = chkRooftopStructural.checked;
      refresh();
    });
  }

  // Exterior Deck
  setupFeatureToggle(chkExteriorDeck, "exterior_deck", "inputsExteriorDeck", "featureExteriorDeck");
  if (inputExteriorDeckSqft) {
    inputExteriorDeckSqft.addEventListener("input", function () {
      optionalFeatures.exterior_deck.sqft = parseFloat(inputExteriorDeckSqft.value) || 0;
      refresh();
    });
  }
  if (selectExteriorDeckMaterial) {
    selectExteriorDeckMaterial.addEventListener("change", function () {
      optionalFeatures.exterior_deck.material = selectExteriorDeckMaterial.value;
      refresh();
    });
  }
  if (inputDeckRailingFt) {
    inputDeckRailingFt.addEventListener("input", function () {
      optionalFeatures.exterior_deck.railing_linear_ft = parseFloat(inputDeckRailingFt.value) || 0;
      refresh();
    });
  }
  if (inputDeckStairs) {
    inputDeckStairs.addEventListener("input", function () {
      optionalFeatures.exterior_deck.stairs_steps = parseInt(inputDeckStairs.value) || 0;
      refresh();
    });
  }
  if (chkDeckCovered) {
    chkDeckCovered.addEventListener("change", function () {
      optionalFeatures.exterior_deck.is_covered = chkDeckCovered.checked;
      refresh();
    });
  }

  // Landscaping
  setupFeatureToggle(chkLandscape, "landscape", "inputsLandscape", "featureLandscape");
  if (inputLandscapeSqft) {
    inputLandscapeSqft.addEventListener("input", function () {
      optionalFeatures.landscape.sqft = parseFloat(inputLandscapeSqft.value) || 0;
      refresh();
    });
  }
  if (selectLandscapeTier) {
    selectLandscapeTier.addEventListener("change", function () {
      optionalFeatures.landscape.tier = selectLandscapeTier.value;
      refresh();
    });
  }
  if (inputHardscapeSqft) {
    inputHardscapeSqft.addEventListener("input", function () {
      optionalFeatures.landscape.hardscape_sqft = parseFloat(inputHardscapeSqft.value) || 0;
      refresh();
    });
  }
  if (inputFenceFt) {
    inputFenceFt.addEventListener("input", function () {
      optionalFeatures.landscape.fence_linear_ft = parseFloat(inputFenceFt.value) || 0;
      refresh();
    });
  }
  if (chkIrrigation) {
    chkIrrigation.addEventListener("change", function () {
      optionalFeatures.landscape.has_irrigation = chkIrrigation.checked;
      refresh();
    });
  }

  // ------------------------------------------
  // EVENT: Skip Screenshot
  // ------------------------------------------
  if (btnSkipScreenshot) {
    btnSkipScreenshot.addEventListener("click", function () {
      screenshotSkipped = true;
      calculateCost();
      refresh();
    });
  }

  // ------------------------------------------
  // EVENT: Analyze All Screenshots
  // ------------------------------------------
  if (btnAnalyzeAll) {
    btnAnalyzeAll.addEventListener("click", function () {
      analyzeAllScreenshots();
    });
  }

  // ------------------------------------------
  // EVENT: Reset
  // ------------------------------------------
  if (btnReset) {
    btnReset.addEventListener("click", function () {
      selectedType = null;
      selectedStories = null;
      selectedConstruction = null;
      enteredSqft = null;
      selectedDesignPackage = null;
      enteredBedrooms = null;
      enteredBathrooms = null;
      selectedFoundation = null;
      selectedLandSurface = null;
      additionalOptions = {
        plans_permits:   false,
        solar_panels:    false,
        fire_sprinklers: false,
        appliances:      false,
      };

      gridType.querySelectorAll(".adu-option-card").forEach(function (c) {
        c.classList.remove("selected");
      });
      gridStories.querySelectorAll(".adu-option-card").forEach(function (c) {
        c.classList.remove("selected");
      });
      gridConstruction.querySelectorAll(".adu-option-card").forEach(function (c) {
        c.classList.remove("selected");
      });
      inputSqft.value = "";

      // Reset new fields
      if (selectDesignPackage) selectDesignPackage.value = "";
      if (inputBedrooms) inputBedrooms.value = "";
      if (inputBathrooms) inputBathrooms.value = "";
      if (selectFoundation) selectFoundation.value = "";
      if (selectLandSurface) selectLandSurface.value = "";
      if (chkPlansPermits) chkPlansPermits.checked = false;
      if (chkSolarPanels) chkSolarPanels.checked = false;
      if (chkFireSprinklers) chkFireSprinklers.checked = false;
      if (chkAppliances) chkAppliances.checked = false;

      // Reset optional features
      optionalFeatures = {
        retaining_wall: { enabled: false, linear_ft: 0, height: "medium" },
        kitchen_linear: { enabled: false, linear_ft: 0 },
        kitchen_island: { enabled: false, size: "none", has_plumbing: false, has_seating: false },
        rooftop_deck: { enabled: false, sqft: 0, tier: "standard", needs_structural: false },
        exterior_deck: { enabled: false, sqft: 0, material: "composite", railing_linear_ft: 0, stairs_steps: 0, is_covered: false },
        landscape: { enabled: false, sqft: 0, tier: "standard", hardscape_sqft: 0, has_irrigation: false, fence_linear_ft: 0 }
      };

      // Reset optional feature UI elements
      var featureCheckboxes = [
        chkRetainingWall, chkKitchenLinear, chkKitchenIsland,
        chkRooftopDeck, chkExteriorDeck, chkLandscape
      ];
      featureCheckboxes.forEach(function (chk) { if (chk) chk.checked = false; });

      var featureInputDivs = [
        "inputsRetainingWall", "inputsKitchenLinear", "inputsKitchenIsland",
        "inputsRooftopDeck", "inputsExteriorDeck", "inputsLandscape"
      ];
      featureInputDivs.forEach(function (id) {
        var div = document.getElementById(id);
        if (div) div.classList.add("hidden");
      });

      var featureCards = [
        "featureRetainingWall", "featureKitchenLinear", "featureKitchenIsland",
        "featureRooftopDeck", "featureExteriorDeck", "featureLandscape"
      ];
      featureCards.forEach(function (id) {
        var card = document.getElementById(id);
        if (card) card.classList.remove("is-enabled");
      });

      // Reset all optional feature inputs
      if (inputRetainingWallFt) inputRetainingWallFt.value = "";
      if (selectRetainingWallHeight) selectRetainingWallHeight.value = "medium";
      if (inputKitchenLinearFt) inputKitchenLinearFt.value = "";
      if (selectKitchenIslandSize) selectKitchenIslandSize.value = "medium";
      if (chkIslandPlumbing) chkIslandPlumbing.checked = false;
      if (chkIslandSeating) chkIslandSeating.checked = false;
      if (inputRooftopDeckSqft) inputRooftopDeckSqft.value = "";
      if (selectRooftopDeckTier) selectRooftopDeckTier.value = "standard";
      if (chkRooftopStructural) chkRooftopStructural.checked = false;
      if (inputExteriorDeckSqft) inputExteriorDeckSqft.value = "";
      if (selectExteriorDeckMaterial) selectExteriorDeckMaterial.value = "composite";
      if (inputDeckRailingFt) inputDeckRailingFt.value = "";
      if (inputDeckStairs) inputDeckStairs.value = "";
      if (chkDeckCovered) chkDeckCovered.checked = false;
      if (inputLandscapeSqft) inputLandscapeSqft.value = "";
      if (selectLandscapeTier) selectLandscapeTier.value = "standard";
      if (inputHardscapeSqft) inputHardscapeSqft.value = "";
      if (inputFenceFt) inputFenceFt.value = "";
      if (chkIrrigation) chkIrrigation.checked = false;

      resetScreenshotState();
      refresh();
    });
  }

  // ------------------------------------------
  // EXPOSE state getter for future modules
  // ------------------------------------------
  window.ADUCalculator = {
    getSelection: function () {
      return {
        type: selectedType,
        stories: selectedStories,
        construction: selectedConstruction,
        sqft: enteredSqft,
        design_package: selectedDesignPackage,
        bedrooms: enteredBedrooms,
        bathrooms: enteredBathrooms,
        foundation: selectedFoundation,
        land_surface: selectedLandSurface,
        additional_options: additionalOptions,
        screenshotAnalysis: [analysisResults.floor1, analysisResults.floor2].filter(Boolean),
        estimate: costEstimate,
      };
    },
    getStoryRules: function () {
      return STORY_RULES;
    },
    calculate: calculateCost,
  };

  // Initial render
  refresh();

  // Hide loading overlay
  document.body.classList.remove('page-loading');
  var overlay = document.getElementById('pageLoadingOverlay');
  if (overlay) overlay.classList.add('hidden');
})();
