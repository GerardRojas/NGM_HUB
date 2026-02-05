-- =====================================================
-- ADU Pricing Configuration Table
-- Single-row table to store editable pricing variables
-- =====================================================

-- Drop existing table if needed (be careful in production)
-- DROP TABLE IF EXISTS adu_pricing_config;

CREATE TABLE IF NOT EXISTS adu_pricing_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    config_key VARCHAR(50) UNIQUE NOT NULL DEFAULT 'main',  -- Always 'main', ensures single row

    -- Core pricing configuration as JSON
    pricing_data JSONB NOT NULL DEFAULT '{}'::jsonb,

    -- Metadata
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_by UUID REFERENCES users(id)
);

-- Create unique constraint to ensure only one config row
CREATE UNIQUE INDEX IF NOT EXISTS adu_pricing_config_single_row
ON adu_pricing_config ((true));

-- Insert default configuration row
INSERT INTO adu_pricing_config (config_key, pricing_data)
VALUES ('main', '{
    "base_rates": {
        "studio": { "stick_build": 165, "energy_efficient": 200, "renovation": 140, "manufactured": 130 },
        "attached": { "stick_build": 175, "energy_efficient": 215, "renovation": 145, "manufactured": 135 },
        "detached": { "stick_build": 195, "energy_efficient": 240, "renovation": 160, "manufactured": 150 },
        "above_garage": { "stick_build": 210, "energy_efficient": 255, "renovation": 180, "manufactured": null },
        "garage_conversion": { "stick_build": 140, "energy_efficient": 175, "renovation": 120, "manufactured": null },
        "multifamily": { "stick_build": 165, "energy_efficient": 200, "renovation": 140, "manufactured": 130 }
    },
    "stories_multipliers": { "1": 1.0, "2": 1.35, "3": 1.50, "4": 1.65, "5": 1.80 },
    "foundation_multipliers": {
        "slab_on_grade": 1.0,
        "raised_foundation": 1.18,
        "reinforced_foundation": 1.32
    },
    "land_multipliers": { "flat_land": 1.0, "hill_side": 1.28 },
    "design_curves": {
        "basic": { "base": 0.85, "quality_index": 1 },
        "standard": { "base": 1.00, "quality_index": 2 },
        "high_end": { "base": 1.28, "quality_index": 3 },
        "custom": { "base": 1.65, "quality_index": 4 }
    },
    "additions": {
        "bedroom_cost_first": 2500,
        "bedroom_cost_additional": 2000,
        "bathroom_cost_first": 8500,
        "bathroom_cost_additional": 6000,
        "plans_permits": 18000,
        "solar_panels_per_sqft": 14,
        "fire_sprinklers_per_sqft": 7,
        "appliances": 6500
    },
    "price_range": {
        "low_percentage": 15,
        "high_percentage": 15
    },
    "optional_features": {
        "retaining_wall": {
            "cost_per_linear_ft": 185,
            "height_multiplier": {
                "low": 0.75,
                "medium": 1.0,
                "high": 1.45,
                "extreme": 2.1
            }
        },
        "kitchen_linear": {
            "basic": 280,
            "standard": 420,
            "high_end": 680,
            "custom": 950
        },
        "kitchen_island": {
            "small": 3500,
            "medium": 6500,
            "large": 12000,
            "custom": 18000,
            "plumbing_addon": 2800,
            "seating_addon": 1200
        },
        "rooftop_deck": {
            "basic": 55,
            "standard": 85,
            "premium": 140,
            "structural_addon": 8500
        },
        "exterior_deck": {
            "wood": 35,
            "composite": 55,
            "premium": 85,
            "railing_per_ft": 65,
            "stairs_per_step": 180,
            "covered_addon_per_sqft": 45
        },
        "landscape": {
            "minimal": 8,
            "standard": 18,
            "enhanced": 35,
            "premium": 65,
            "hardscape_per_sqft": 25,
            "irrigation_per_sqft": 4,
            "fence_per_ft": 45
        }
    }
}'::jsonb)
ON CONFLICT (config_key) DO NOTHING;

-- RLS Policies
ALTER TABLE adu_pricing_config ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read pricing config
CREATE POLICY "Authenticated users can read adu_pricing_config"
ON adu_pricing_config
FOR SELECT
TO authenticated
USING (true);

-- Allow authenticated users to update pricing config (you may want to restrict this to admins)
CREATE POLICY "Authenticated users can update adu_pricing_config"
ON adu_pricing_config
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Comment for reference
COMMENT ON TABLE adu_pricing_config IS 'Stores editable pricing configuration for ADU Calculator. Single-row table with JSON config.';
