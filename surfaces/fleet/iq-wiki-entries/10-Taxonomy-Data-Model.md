# Taxonomy Data Model & Schema

> **iq.wiki Entry** | Category: Data Architecture, Systems Design
> **Tags:** schema, database, API, data-model, JSON, taxonomy
> **Parent Entry:** 00-MASTER-INDEX
> **Evidence Level:** Design specification [D]

---

## Summary

This document defines the structured data model for the Hemp Product Stream Taxonomy. It provides the database schema, JSON-LD format for iq.wiki blockchain entries, and API specification that powers beehivebiomass.com, bnature.social, and the Intercontinental Commodity Index.

---

## 1. Core Entity Model

```
PRODUCT_STREAM
├── id (UUID)
├── taxonomy_path (e.g., "cannabinoids.isolates.cbd")
├── name (string)
├── category (enum: cannabinoids|fiber|hurd|seed|cellulose|terpenes|energy|wellness)
├── subcategory (string)
├── description (text)
├── input_biomass_grade (FK → BIOMASS_GRADE)
├── processing_method (string)
├── output_specifications (JSON)
│   ├── purity (float)
│   ├── form (enum: solid|liquid|powder|gas|composite)
│   ├── appearance (string)
│   └── key_metrics (JSON array)
├── quality_grades (JSON array of grade definitions)
├── market_data (JSON)
│   ├── market_size_usd (float)
│   ├── growth_rate_pct (float)
│   └── price_range (JSON: {min, max, unit})
├── evidence_level (enum: A|B|C|D)
├── canvas_lm_module_id (FK → COMPREHENSION_MODULE)
├── commodity_index_weight (float)
├── cross_references (JSON array of entry IDs)
├── sources (JSON array)
├── created_at (timestamp)
└── updated_at (timestamp)

BIOMASS_GRADE
├── id (UUID)
├── grade_code (e.g., "A1", "F1", "H2", "S1")
├── category (enum: cannabinoid|fiber|hurd|seed)
├── specification (text)
├── quality_criteria (JSON)
└── commodity_index_tier (FK → INDEX_TIER)

COMPREHENSION_MODULE (Canvas LM)
├── id (UUID)
├── module_name (string)
├── product_stream_id (FK → PRODUCT_STREAM)
├── difficulty_level (enum: basic|intermediate|advanced)
├── assessment_criteria (JSON)
├── unlock_sequence (JSON: prerequisite module IDs)
└── required_for (enum: education|marketplace_access|index_access)
```

---

## 2. JSON-LD Format for iq.wiki Blockchain Entries

```json
{
  "@context": "https://schema.org",
  "@type": "Article",
  "@id": "iqwiki:hemp-product-stream:cannabinoids-cbd-isolate",
  "headline": "CBD Isolate",
  "articleBody": "...",
  "about": {
    "@type": "Thing",
    "name": "CBD Isolate",
    "description": "≥99% pure cannabidiol crystalline powder"
  },
  "category": ["Cannabinoids", "Pharmaceuticals", "Extracts"],
  "keywords": ["CBD", "isolate", "cannabinoid", "extraction"],
  "mainEntity": {
    "@type": "Product",
    "name": "CBD Isolate",
    "additionalProperty": [
      {"name": "purity", "value": "≥99%"},
      {"name": "form", "value": "crystalline powder"},
      {"name": "biomass_grade_input", "value": ["A1", "A2", "B1"]},
      {"name": "commodity_index_weight", "value": 0.25},
      {"name": "evidence_level", "value": "A"}
    ]
  },
  "isPartOf": {
    "@type": "CreativeWork",
    "name": "Hemp Product Stream Taxonomy",
    "@id": "iqwiki:hemp-product-stream-taxonomy"
  }
}
```

---

## 3. API Specification

### 3.1 Endpoints (beehivebiomass.com / bnature.social shared API)

```
GET    /api/v1/taxonomy                    # Full taxonomy tree
GET    /api/v1/taxonomy/{category}          # Single category (e.g., cannabinoids)
GET    /api/v1/taxonomy/{category}/{stream} # Single product stream
GET    /api/v1/streams/{id}                 # Full stream detail by ID
GET    /api/v1/streams/{id}/pricing         # Current pricing for this stream
GET    /api/v1/streams/{id}/comprehension   # Canvas LM module for this stream
POST   /api/v1/index/snapshot               # Commodity Index snapshot
GET    /api/v1/index/tiers                  # All index pricing tiers
GET    /api/v1/grades                       # All biomass grade definitions
```

### 3.2 Canvas LM Integration

```
POST   /api/v1/comprehension/assess
  Body: { user_id, module_id, responses }
  Response: { passed: bool, score: float, unlocked_features: [] }

GET    /api/v1/comprehension/status/{user_id}
  Response: { modules_completed: [], unlocked_products: [], velocity_tier: int }
```

---

## 4. Database Schema (PostgreSQL DDL)

```sql
CREATE TABLE product_streams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    taxonomy_path TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('cannabinoids','fiber','hurd','seed','cellulose','terpenes','energy','wellness')),
    subcategory TEXT,
    description TEXT,
    input_biomass_grade UUID REFERENCES biomass_grades(id),
    processing_method TEXT,
    output_specifications JSONB,
    quality_grades JSONB,
    market_data JSONB,
    evidence_level CHAR(1) CHECK (evidence_level IN ('A','B','C','D')),
    canvas_lm_module_id UUID REFERENCES comprehension_modules(id),
    commodity_index_weight DECIMAL(5,4),
    cross_references JSONB,
    sources JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE biomass_grades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    grade_code TEXT NOT NULL UNIQUE,
    category TEXT NOT NULL,
    specification TEXT NOT NULL,
    quality_criteria JSONB,
    commodity_index_tier TEXT
);

CREATE TABLE comprehension_modules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    module_name TEXT NOT NULL,
    product_stream_id UUID REFERENCES product_streams(id),
    difficulty_level TEXT CHECK (difficulty_level IN ('basic','intermediate','advanced')),
    assessment_criteria JSONB,
    unlock_sequence JSONB,
    required_for TEXT CHECK (required_for IN ('education','marketplace_access','index_access'))
);

CREATE TABLE commodity_index_tiers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tier_name TEXT NOT NULL,
    stream_category TEXT NOT NULL,
    weight_in_index DECIMAL(5,4) NOT NULL,
    last_price_usd DECIMAL(12,2),
    price_updated_at TIMESTAMPTZ
);

CREATE INDEX idx_streams_category ON product_streams(category);
CREATE INDEX idx_streams_taxonomy ON product_streams(taxonomy_path);
CREATE INDEX idx_streams_grade ON product_streams(input_biomass_grade);
```

---

## 5. Commodity Index Weighting Model

Each product stream contributes to the overall Commodity Index based on market significance:

```json
{
  "index_weights_v1": {
    "cannabinoids":     { "weight": 0.40, "rationale": "Largest market value segment" },
    "fiber":            { "weight": 0.15, "rationale": "Industrial materials" },
    "hurd":             { "weight": 0.08, "rationale": "Construction + bedding" },
    "seed_nutrition":   { "weight": 0.12, "rationale": "Food + oil market" },
    "cellulose":        { "weight": 0.07, "rationale": "Emerging advanced materials" },
    "terpenes":         { "weight": 0.05, "rationale": "Specialty market" },
    "energy_biochar":   { "weight": 0.08, "rationale": "Biochar + biofuel" },
    "wellness":         { "weight": 0.05, "rationale": "End-product retail (tracks cannabinoid inputs)" }
  }
}
```

> Weights are versioned and adjustable. See Entry 11 for full methodology.

---

## Cross-References
- **All Entries 01–09:** This data model structures all product stream data
- **Entry 11:** Commodity Index Specification (consumes this model's pricing data)

## Sources
- [D] BN Fleet architecture specification (design document)
