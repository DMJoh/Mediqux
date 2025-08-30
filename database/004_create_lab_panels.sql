-- Migration: Create lab panels and panel parameters tables

-- Create lab_panels table
CREATE TABLE IF NOT EXISTS lab_panels (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    category VARCHAR(100) DEFAULT 'Blood',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create lab_panel_parameters table
CREATE TABLE IF NOT EXISTS lab_panel_parameters (
    id SERIAL PRIMARY KEY,
    panel_id INTEGER NOT NULL REFERENCES lab_panels(id) ON DELETE CASCADE,
    parameter_name VARCHAR(255) NOT NULL,
    unit VARCHAR(50),
    reference_min DECIMAL(10,3),
    reference_max DECIMAL(10,3),
    gender_specific VARCHAR(1), -- 'M' for male only, 'F' for female only, NULL for both
    aliases TEXT, -- comma-separated alternative names
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(panel_id, parameter_name)
);

-- Create indexes for better performance
CREATE INDEX idx_lab_panels_name ON lab_panels(name);
CREATE INDEX idx_lab_panels_category ON lab_panels(category);
CREATE INDEX idx_lab_panel_parameters_panel_id ON lab_panel_parameters(panel_id);
CREATE INDEX idx_lab_panel_parameters_name ON lab_panel_parameters(parameter_name);

-- Insert some default lab panels with common parameters
INSERT INTO lab_panels (name, description, category) VALUES 
    ('Complete Blood Count (CBC)', 'Basic blood test measuring various blood components', 'Blood'),
    ('Basic Metabolic Panel (BMP)', 'Basic chemistry panel for kidney and metabolic function', 'Chemistry'),
    ('Comprehensive Metabolic Panel (CMP)', 'Extended chemistry panel including liver function', 'Chemistry'),
    ('Lipid Panel', 'Cholesterol and lipid measurements', 'Chemistry'),
    ('Liver Function Tests (LFT)', 'Tests to assess liver health and function', 'Chemistry'),
    ('Thyroid Function Tests', 'Tests to evaluate thyroid hormone levels', 'Endocrine'),
    ('Kidney Function Tests (KFT)', 'Tests to assess kidney health and function', 'Chemistry')
ON CONFLICT (name) DO NOTHING;

-- CBC Parameters
INSERT INTO lab_panel_parameters (panel_id, parameter_name, unit, reference_min, reference_max, gender_specific, aliases) 
SELECT p.id, param_name, unit, ref_min, ref_max, gender, aliases
FROM lab_panels p
CROSS JOIN (VALUES 
    ('Hemoglobin', 'g/dL', 12.0, 15.5, 'F', 'HGB,HB,Haemoglobin'),
    ('Hemoglobin', 'g/dL', 14.0, 17.5, 'M', 'HGB,HB,Haemoglobin'),
    ('White Blood Cell Count', '/µL', 4000, 11000, NULL, 'WBC,Total WBC,WBC Count'),
    ('Red Blood Cell Count', 'million/µL', 4.2, 5.4, 'F', 'RBC,RBC Count'),
    ('Red Blood Cell Count', 'million/µL', 4.7, 6.1, 'M', 'RBC,RBC Count'),
    ('Platelet Count', '/µL', 150000, 450000, NULL, 'PLT,Platelets'),
    ('Hematocrit', '%', 36.0, 46.0, 'F', 'HCT,Packed Cell Volume,PCV'),
    ('Hematocrit', '%', 41.0, 50.0, 'M', 'HCT,Packed Cell Volume,PCV'),
    ('Mean Corpuscular Volume', 'fL', 82.0, 98.0, NULL, 'MCV'),
    ('Mean Corpuscular Hemoglobin', 'pg', 27.0, 32.0, NULL, 'MCH'),
    ('Mean Corpuscular Hemoglobin Concentration', 'g/dL', 32.0, 36.0, NULL, 'MCHC'),
    ('Red Cell Distribution Width', '%', 11.5, 14.5, NULL, 'RDW')
) AS params(param_name, unit, ref_min, ref_max, gender, aliases)
WHERE p.name = 'Complete Blood Count (CBC)'
ON CONFLICT (panel_id, parameter_name) DO NOTHING;

-- BMP Parameters
INSERT INTO lab_panel_parameters (panel_id, parameter_name, unit, reference_min, reference_max, gender_specific, aliases) 
SELECT p.id, param_name, unit, ref_min, ref_max, gender, aliases
FROM lab_panels p
CROSS JOIN (VALUES 
    ('Glucose', 'mg/dL', 70.0, 100.0, NULL, 'Blood Sugar,BS'),
    ('Blood Urea Nitrogen', 'mg/dL', 7.0, 20.0, NULL, 'BUN'),
    ('Creatinine', 'mg/dL', 0.7, 1.3, NULL, NULL),
    ('Sodium', 'mEq/L', 136.0, 145.0, NULL, 'Na'),
    ('Potassium', 'mEq/L', 3.5, 5.1, NULL, 'K'),
    ('Chloride', 'mEq/L', 98.0, 107.0, NULL, 'Cl'),
    ('Carbon Dioxide', 'mEq/L', 22.0, 29.0, NULL, 'CO2'),
    ('Anion Gap', 'mEq/L', 8.0, 16.0, NULL, NULL)
) AS params(param_name, unit, ref_min, ref_max, gender, aliases)
WHERE p.name = 'Basic Metabolic Panel (BMP)'
ON CONFLICT (panel_id, parameter_name) DO NOTHING;

-- Lipid Panel Parameters
INSERT INTO lab_panel_parameters (panel_id, parameter_name, unit, reference_min, reference_max, gender_specific, aliases) 
SELECT p.id, param_name, unit, ref_min, ref_max, gender, aliases
FROM lab_panels p
CROSS JOIN (VALUES 
    ('Total Cholesterol', 'mg/dL', NULL, 200.0, NULL, NULL),
    ('HDL Cholesterol', 'mg/dL', 40.0, NULL, NULL, 'HDL,Good Cholesterol'),
    ('LDL Cholesterol', 'mg/dL', NULL, 100.0, NULL, 'LDL,Bad Cholesterol'),
    ('Triglycerides', 'mg/dL', NULL, 150.0, NULL, NULL)
) AS params(param_name, unit, ref_min, ref_max, gender, aliases)
WHERE p.name = 'Lipid Panel'
ON CONFLICT (panel_id, parameter_name) DO NOTHING;

-- Liver Function Tests Parameters
INSERT INTO lab_panel_parameters (panel_id, parameter_name, unit, reference_min, reference_max, gender_specific, aliases) 
SELECT p.id, param_name, unit, ref_min, ref_max, gender, aliases
FROM lab_panels p
CROSS JOIN (VALUES 
    ('Alanine Aminotransferase', 'U/L', 7.0, 56.0, NULL, 'ALT,SGPT'),
    ('Aspartate Aminotransferase', 'U/L', 10.0, 40.0, NULL, 'AST,SGOT'),
    ('Alkaline Phosphatase', 'U/L', 44.0, 147.0, NULL, 'ALP'),
    ('Total Bilirubin', 'mg/dL', 0.2, 1.2, NULL, NULL),
    ('Direct Bilirubin', 'mg/dL', 0.0, 0.3, NULL, NULL),
    ('Albumin', 'g/dL', 3.5, 5.0, NULL, NULL),
    ('Total Protein', 'g/dL', 6.3, 8.2, NULL, NULL)
) AS params(param_name, unit, ref_min, ref_max, gender, aliases)
WHERE p.name = 'Liver Function Tests (LFT)'
ON CONFLICT (panel_id, parameter_name) DO NOTHING;

-- Thyroid Function Tests Parameters  
INSERT INTO lab_panel_parameters (panel_id, parameter_name, unit, reference_min, reference_max, gender_specific, aliases) 
SELECT p.id, param_name, unit, ref_min, ref_max, gender, aliases
FROM lab_panels p
CROSS JOIN (VALUES 
    ('Thyroid Stimulating Hormone', 'mIU/L', 0.4, 4.0, NULL, 'TSH'),
    ('Free T4', 'ng/dL', 0.8, 1.8, NULL, 'FT4'),
    ('Free T3', 'pg/mL', 2.3, 4.2, NULL, 'FT3'),
    ('Total T4', 'µg/dL', 4.5, 12.0, NULL, 'T4'),
    ('Total T3', 'ng/dL', 80.0, 200.0, NULL, 'T3')
) AS params(param_name, unit, ref_min, ref_max, gender, aliases)
WHERE p.name = 'Thyroid Function Tests'
ON CONFLICT (panel_id, parameter_name) DO NOTHING;

-- Add update trigger for lab_panels
CREATE OR REPLACE FUNCTION update_lab_panels_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_lab_panels_updated_at
    BEFORE UPDATE ON lab_panels
    FOR EACH ROW
    EXECUTE FUNCTION update_lab_panels_updated_at();

-- Add update trigger for lab_panel_parameters
CREATE OR REPLACE FUNCTION update_lab_panel_parameters_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_lab_panel_parameters_updated_at
    BEFORE UPDATE ON lab_panel_parameters
    FOR EACH ROW
    EXECUTE FUNCTION update_lab_panel_parameters_updated_at();