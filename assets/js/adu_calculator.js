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

  // ------------------------------------------
  // STATE
  // ------------------------------------------
  var selectedType         = null;
  var selectedStories      = null;
  var selectedConstruction = null;
  var enteredSqft          = null;

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
    sectionScreenshot.classList.toggle("locked", !sqftDone);

    // Step 5: Screenshot
    var hasAnyAnalysis = analysisResults.floor1 || analysisResults.floor2;
    var screenshotDone = screenshotSkipped || hasAnyAnalysis;
    stepScreenshot.classList.toggle("completed", !!screenshotDone);

    // Step 6: Results
    sectionResults.classList.toggle("locked", !costEstimate);
    stepResults.classList.toggle("completed", !!costEstimate);

    // Render upload zones when screenshot section is unlocked
    if (sqftDone) {
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
  // COST CALCULATION
  // ------------------------------------------

  function calculateCost() {
    var apiBase = getApiBase();
    if (!apiBase) {
      if (window.Toast) Toast.error("Error", "API not configured.");
      return;
    }

    if (!selectedType || !selectedStories || !selectedConstruction || !enteredSqft) {
      if (window.Toast) Toast.error("Missing Parameters", "Please complete all steps before calculating.");
      return;
    }

    costLoading = true;
    resultsContainer.innerHTML = '<div style="padding: 24px; text-align: center; color: rgba(255,255,255,0.4);">'
      + '<span class="adu-analysis-spinner" style="width: 24px; height: 24px; border-width: 3px;"></span>'
      + '<p style="margin-top: 12px; font-size: 13px;">Calculating estimate...</p>'
      + '</div>';
    sectionResults.classList.remove("locked");

    var payload = {
      adu_type: selectedType,
      stories: selectedStories,
      construction_type: selectedConstruction,
      sqft: enteredSqft,
      screenshot_analysis: null
    };

    // Include analysis results if available
    var analyses = [];
    if (analysisResults.floor1) analyses.push(analysisResults.floor1);
    if (analysisResults.floor2) analyses.push(analysisResults.floor2);
    if (analyses.length > 0) payload.screenshot_analysis = analyses;

    fetch(apiBase + "/adu-calculator/calculate", {
      method: "POST",
      headers: Object.assign({ "Content-Type": "application/json" }, getAuthHeaders()),
      body: JSON.stringify(payload)
    })
    .then(function (response) {
      if (!response.ok) {
        return response.text().then(function (txt) {
          var msg = "Calculation failed";
          try { msg = JSON.parse(txt).detail || msg; } catch (e) { /* ignore */ }
          throw new Error(msg);
        });
      }
      return response.json();
    })
    .then(function (result) {
      costLoading = false;
      costEstimate = result.data;
      renderCostResults();
      refresh();

      if (window.Toast) Toast.success("Estimate Ready", "Cost estimate calculated successfully.");
    })
    .catch(function (err) {
      costLoading = false;
      costEstimate = null;
      resultsContainer.innerHTML = '<div style="padding: 24px; text-align: center; color: #ef4444; font-size: 13px;">'
        + 'Calculation failed: ' + (err.message || "Unknown error")
        + '</div>';
      if (window.Toast) Toast.error("Calculation Error", err.message || "Could not calculate estimate.");
    });
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

    // Line items table
    if (d.line_items && d.line_items.length > 0) {
      html += '<table class="adu-cost-table">'
            + '<thead><tr>'
            + '<th>Category</th>'
            + '<th>Description</th>'
            + '<th style="text-align: right;">Cost</th>'
            + '<th>Notes</th>'
            + '</tr></thead>'
            + '<tbody>';

      d.line_items.forEach(function (item) {
        html += '<tr>'
              + '<td>' + item.category + '</td>'
              + '<td>' + item.description + '</td>'
              + '<td class="col-cost">$' + item.estimated_cost.toLocaleString() + '</td>'
              + '<td class="col-notes">' + (item.notes || "") + '</td>'
              + '</tr>';
      });

      html += '</tbody></table>';
    }

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
})();
