-- =============================================================================
-- Mediqux - Medical Management System Database Schema
-- Complete Database Initialization Script
-- =============================================================================
-- This script creates a clean, standardized database schema for the Mediqux
-- medical management system with proper naming conventions, constraints,
-- indexes, and sample data.
-- =============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- For fuzzy text search

-- =============================================================================
-- CORE ENTITY TABLES
-- =============================================================================

-- Users table for authentication and authorization
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(100) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    role VARCHAR(50) NOT NULL DEFAULT 'user', -- admin, user, doctor
    patient_id UUID, -- Link user to patient record (for patient users)
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_login TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT chk_users_role CHECK (role IN ('admin', 'user', 'doctor'))
);

-- Patients table - Core patient demographics and information
CREATE TABLE patients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    date_of_birth DATE,
    gender VARCHAR(10),
    phone VARCHAR(20),
    email VARCHAR(255),
    address TEXT,
    emergency_contact_name VARCHAR(200),
    emergency_contact_phone VARCHAR(20),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT chk_patients_gender CHECK (gender IN ('Male', 'Female', 'Other', NULL)),
    CONSTRAINT chk_patients_email CHECK (email ~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' OR email IS NULL)
);

-- Medical institutions - Hospitals, clinics, laboratories
CREATE TABLE institutions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(100) NOT NULL DEFAULT 'Hospital',
    address TEXT,
    phone VARCHAR(20),
    email VARCHAR(255),
    website VARCHAR(255),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT chk_institutions_type CHECK (type IN ('Hospital', 'Clinic', 'Laboratory', 'Pharmacy', 'Other')),
    CONSTRAINT chk_institutions_email CHECK (email ~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' OR email IS NULL)
);

-- Doctors table - Healthcare providers
CREATE TABLE doctors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    specialty VARCHAR(200),
    license_number VARCHAR(100) UNIQUE,
    phone VARCHAR(20),
    email VARCHAR(255),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT chk_doctors_email CHECK (email ~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' OR email IS NULL)
);

-- Doctor-Institution relationships (many-to-many)
CREATE TABLE doctor_institutions (
    doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
    institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    PRIMARY KEY (doctor_id, institution_id)
);

-- Medical conditions catalog with ICD coding
CREATE TABLE medical_conditions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    icd_code VARCHAR(20) UNIQUE,
    category VARCHAR(100),
    severity VARCHAR(20) DEFAULT 'Medium',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT chk_conditions_severity CHECK (severity IN ('Low', 'Medium', 'High', 'Critical'))
);

-- Medications catalog with comprehensive drug information
CREATE TABLE medications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL UNIQUE,
    generic_name VARCHAR(255),
    dosage_forms TEXT[] DEFAULT '{}', -- Array of available forms
    strengths TEXT[] DEFAULT '{}', -- Legacy field for backward compatibility
    active_ingredients JSONB DEFAULT '[]', -- Structured ingredient data
    manufacturer VARCHAR(255),
    description TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- CLINICAL DATA TABLES
-- =============================================================================

-- Appointments and visits
CREATE TABLE appointments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    doctor_id UUID REFERENCES doctors(id),
    institution_id UUID REFERENCES institutions(id),
    appointment_date TIMESTAMP NOT NULL,
    type VARCHAR(100) DEFAULT 'Consultation',
    status VARCHAR(50) NOT NULL DEFAULT 'scheduled',
    notes TEXT,
    diagnosis TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT chk_appointments_type CHECK (type IN ('Consultation', 'Follow-up', 'Emergency', 'Surgery', 'Therapy', 'Other')),
    CONSTRAINT chk_appointments_status CHECK (status IN ('scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show'))
);

-- Prescribed medications during appointments
CREATE TABLE prescriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    appointment_id UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
    medication_id UUID NOT NULL REFERENCES medications(id),
    dosage VARCHAR(100) NOT NULL,
    frequency VARCHAR(100) NOT NULL,
    duration VARCHAR(100),
    instructions TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Patient medication history and current medications
CREATE TABLE patient_medications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    medication_id UUID NOT NULL REFERENCES medications(id),
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    start_date DATE,
    end_date DATE,
    notes TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT chk_patient_medications_status CHECK (status IN ('active', 'discontinued', 'completed', 'paused'))
);

-- =============================================================================
-- LAB AND TEST RESULTS TABLES
-- =============================================================================

-- Test results and lab reports with PDF support
CREATE TABLE test_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    appointment_id UUID REFERENCES appointments(id),
    test_name VARCHAR(255) NOT NULL,
    test_type VARCHAR(100) NOT NULL DEFAULT 'Blood',
    test_date DATE NOT NULL,
    pdf_file_path VARCHAR(500),
    extracted_text TEXT,
    structured_data JSONB DEFAULT '{}',
    institution_id UUID REFERENCES institutions(id),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT chk_test_results_type CHECK (test_type IN ('Blood', 'Urine', 'X-Ray', 'MRI', 'CT', 'Ultrasound', 'ECG', 'Other'))
);

-- Lab value parameters extracted from test results
CREATE TABLE lab_values (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    test_result_id UUID NOT NULL REFERENCES test_results(id) ON DELETE CASCADE,
    parameter_name VARCHAR(255) NOT NULL,
    value DECIMAL(10,3),
    unit VARCHAR(50),
    reference_range VARCHAR(100),
    status VARCHAR(50) DEFAULT 'Normal',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT chk_lab_values_status CHECK (status IN ('Normal', 'High', 'Low', 'Critical', 'Abnormal'))
);

-- Lab panels for standardized test groupings
CREATE TABLE lab_panels (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    category VARCHAR(100) NOT NULL DEFAULT 'Blood',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT chk_lab_panels_category CHECK (category IN ('Blood', 'Chemistry', 'Endocrine', 'Immunology', 'Other'))
);

-- Parameters within lab panels with reference ranges
CREATE TABLE lab_panel_parameters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    panel_id UUID NOT NULL REFERENCES lab_panels(id) ON DELETE CASCADE,
    parameter_name VARCHAR(255) NOT NULL,
    unit VARCHAR(50),
    reference_min DECIMAL(10,3),
    reference_max DECIMAL(10,3),
    gender_specific VARCHAR(1), -- 'M', 'F', or NULL for both
    aliases TEXT, -- Comma-separated alternative names
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(panel_id, parameter_name),
    CONSTRAINT chk_lab_panel_parameters_gender CHECK (gender_specific IN ('M', 'F', NULL))
);

-- =============================================================================
-- FOREIGN KEY CONSTRAINTS
-- =============================================================================

-- Add foreign key constraint for users.patient_id
ALTER TABLE users ADD CONSTRAINT fk_users_patient_id 
    FOREIGN KEY (patient_id) REFERENCES patients(id);

-- =============================================================================
-- INDEXES FOR PERFORMANCE OPTIMIZATION
-- =============================================================================

-- Users indexes
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_active ON users(is_active);
CREATE INDEX idx_users_patient_id ON users(patient_id);

-- Patients indexes
CREATE INDEX idx_patients_name ON patients(last_name, first_name);
CREATE INDEX idx_patients_dob ON patients(date_of_birth);
CREATE INDEX idx_patients_email ON patients(email);

-- Doctors indexes
CREATE INDEX idx_doctors_name ON doctors(last_name, first_name);
CREATE INDEX idx_doctors_specialty ON doctors(specialty);
CREATE INDEX idx_doctors_license ON doctors(license_number);
CREATE INDEX idx_doctors_email ON doctors(email);

-- Institutions indexes
CREATE INDEX idx_institutions_name ON institutions(name);
CREATE INDEX idx_institutions_type ON institutions(type);

-- Appointments indexes
CREATE INDEX idx_appointments_patient_id ON appointments(patient_id);
CREATE INDEX idx_appointments_doctor_id ON appointments(doctor_id);
CREATE INDEX idx_appointments_institution_id ON appointments(institution_id);
CREATE INDEX idx_appointments_date ON appointments(appointment_date);
CREATE INDEX idx_appointments_status ON appointments(status);

-- Prescriptions indexes
CREATE INDEX idx_prescriptions_appointment_id ON prescriptions(appointment_id);
CREATE INDEX idx_prescriptions_medication_id ON prescriptions(medication_id);

-- Patient medications indexes
CREATE INDEX idx_patient_medications_patient_id ON patient_medications(patient_id);
CREATE INDEX idx_patient_medications_medication_id ON patient_medications(medication_id);
CREATE INDEX idx_patient_medications_status ON patient_medications(status);

-- Medical conditions indexes
CREATE INDEX idx_medical_conditions_name ON medical_conditions(name);
CREATE INDEX idx_medical_conditions_category ON medical_conditions(category);
CREATE INDEX idx_medical_conditions_icd_code ON medical_conditions(icd_code);

-- Medications indexes
CREATE INDEX idx_medications_name ON medications(name);
CREATE INDEX idx_medications_generic_name ON medications(generic_name);
CREATE INDEX idx_medications_manufacturer ON medications(manufacturer);
CREATE INDEX idx_medications_active_ingredients ON medications USING GIN(active_ingredients);

-- Test results indexes
CREATE INDEX idx_test_results_patient_id ON test_results(patient_id);
CREATE INDEX idx_test_results_appointment_id ON test_results(appointment_id);
CREATE INDEX idx_test_results_test_date ON test_results(test_date);
CREATE INDEX idx_test_results_test_type ON test_results(test_type);
CREATE INDEX idx_test_results_institution_id ON test_results(institution_id);

-- Lab values indexes
CREATE INDEX idx_lab_values_test_result_id ON lab_values(test_result_id);
CREATE INDEX idx_lab_values_parameter_name ON lab_values(parameter_name);
CREATE INDEX idx_lab_values_status ON lab_values(status);

-- Lab panels indexes
CREATE INDEX idx_lab_panels_name ON lab_panels(name);
CREATE INDEX idx_lab_panels_category ON lab_panels(category);

-- Lab panel parameters indexes
CREATE INDEX idx_lab_panel_parameters_panel_id ON lab_panel_parameters(panel_id);
CREATE INDEX idx_lab_panel_parameters_parameter_name ON lab_panel_parameters(parameter_name);

-- =============================================================================
-- TRIGGER FUNCTIONS FOR AUTOMATIC TIMESTAMP UPDATES
-- =============================================================================

-- Generic update timestamp function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply update triggers to all tables with updated_at columns
CREATE TRIGGER trigger_users_updated_at 
    BEFORE UPDATE ON users 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_patients_updated_at 
    BEFORE UPDATE ON patients 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_institutions_updated_at 
    BEFORE UPDATE ON institutions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_doctors_updated_at 
    BEFORE UPDATE ON doctors 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_medical_conditions_updated_at 
    BEFORE UPDATE ON medical_conditions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_medications_updated_at 
    BEFORE UPDATE ON medications 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_appointments_updated_at 
    BEFORE UPDATE ON appointments 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_patient_medications_updated_at 
    BEFORE UPDATE ON patient_medications 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_test_results_updated_at 
    BEFORE UPDATE ON test_results 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_lab_panels_updated_at 
    BEFORE UPDATE ON lab_panels 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_lab_panel_parameters_updated_at 
    BEFORE UPDATE ON lab_panel_parameters 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- SAMPLE DATA FOR TESTING AND DEMONSTRATION
-- =============================================================================

-- Insert default lab panels with standard parameters
INSERT INTO lab_panels (name, description, category) VALUES 
    ('Complete Blood Count (CBC)', 'Comprehensive blood test measuring various blood components and counts', 'Blood'),
    ('Basic Metabolic Panel (BMP)', 'Basic chemistry panel testing kidney function and blood glucose', 'Chemistry'),
    ('Comprehensive Metabolic Panel (CMP)', 'Extended chemistry panel including liver function tests', 'Chemistry'),
    ('Lipid Panel', 'Cholesterol and triglyceride measurements for cardiovascular health', 'Chemistry'),
    ('Liver Function Tests (LFT)', 'Tests to assess liver health and enzymatic function', 'Chemistry'),
    ('Thyroid Function Tests', 'Tests to evaluate thyroid hormone levels and TSH', 'Endocrine'),
    ('Kidney Function Tests (KFT)', 'Tests to assess kidney health and filtration capacity', 'Chemistry')
ON CONFLICT (name) DO NOTHING;

-- CBC Parameters with gender-specific ranges
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
    ('Glucose', 'mg/dL', 70.0, 100.0, NULL, 'Blood Sugar,BS,Blood Glucose'),
    ('Blood Urea Nitrogen', 'mg/dL', 7.0, 20.0, NULL, 'BUN'),
    ('Creatinine', 'mg/dL', 0.7, 1.3, NULL, 'Creat'),
    ('Sodium', 'mEq/L', 136.0, 145.0, NULL, 'Na'),
    ('Potassium', 'mEq/L', 3.5, 5.1, NULL, 'K'),
    ('Chloride', 'mEq/L', 98.0, 107.0, NULL, 'Cl'),
    ('Carbon Dioxide', 'mEq/L', 22.0, 29.0, NULL, 'CO2'),
    ('Anion Gap', 'mEq/L', 8.0, 16.0, NULL, 'AG')
) AS params(param_name, unit, ref_min, ref_max, gender, aliases)
WHERE p.name = 'Basic Metabolic Panel (BMP)'
ON CONFLICT (panel_id, parameter_name) DO NOTHING;

-- Lipid Panel Parameters
INSERT INTO lab_panel_parameters (panel_id, parameter_name, unit, reference_min, reference_max, gender_specific, aliases) 
SELECT p.id, param_name, unit, ref_min, ref_max, gender, aliases
FROM lab_panels p
CROSS JOIN (VALUES 
    ('Total Cholesterol', 'mg/dL', NULL, 200.0, NULL, 'Total Chol'),
    ('HDL Cholesterol', 'mg/dL', 40.0, NULL, NULL, 'HDL,Good Cholesterol'),
    ('LDL Cholesterol', 'mg/dL', NULL, 100.0, NULL, 'LDL,Bad Cholesterol'),
    ('Triglycerides', 'mg/dL', NULL, 150.0, NULL, 'TG')
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
    ('Total Bilirubin', 'mg/dL', 0.2, 1.2, NULL, 'T.Bil'),
    ('Direct Bilirubin', 'mg/dL', 0.0, 0.3, NULL, 'D.Bil'),
    ('Albumin', 'g/dL', 3.5, 5.0, NULL, 'Alb'),
    ('Total Protein', 'g/dL', 6.3, 8.2, NULL, 'TP')
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


-- =============================================================================
-- COMPLETION MESSAGE
-- =============================================================================

-- Display completion message
DO $$
BEGIN
    RAISE NOTICE '================================================================';
    RAISE NOTICE 'Mediqux Database Initialization Complete!';
    RAISE NOTICE '================================================================';
    RAISE NOTICE 'Tables created: 14';
    RAISE NOTICE 'Indexes created: 35+';
    RAISE NOTICE 'Triggers created: 11';
    RAISE NOTICE 'Sample data inserted: Lab panels only';
    RAISE NOTICE '';
    RAISE NOTICE 'Next steps:';
    RAISE NOTICE '1. Create admin user via application';
    RAISE NOTICE '2. Configure authentication settings';
    RAISE NOTICE '3. Add institution and doctor data';
    RAISE NOTICE '================================================================';
END $$;