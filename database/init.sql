-- Medical Management System Database Schema
-- Run this on your existing PostgreSQL server

-- Create database (if needed)
-- CREATE DATABASE medical_app;

-- Use the database
-- \c medical_app;

-- Enable UUID extension for unique IDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Patients table
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
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Institutions table
CREATE TABLE institutions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(100), -- Hospital, Clinic, Lab, etc.
    address TEXT,
    phone VARCHAR(20),
    email VARCHAR(255),
    website VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Doctors table
CREATE TABLE doctors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    specialty VARCHAR(200),
    license_number VARCHAR(100),
    phone VARCHAR(20),
    email VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Doctor-Institution relationships (many-to-many)
CREATE TABLE doctor_institutions (
    doctor_id UUID REFERENCES doctors(id) ON DELETE CASCADE,
    institution_id UUID REFERENCES institutions(id) ON DELETE CASCADE,
    PRIMARY KEY (doctor_id, institution_id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Medical conditions/diseases catalog
CREATE TABLE medical_conditions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    icd_code VARCHAR(20), -- ICD-10 codes if needed
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Medical conditions/diseases catalog
CREATE TABLE medical_conditions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    icd_code VARCHAR(20) UNIQUE, -- ICD-10 codes
    category VARCHAR(100), -- Cardiovascular, Respiratory, etc.
    severity VARCHAR(20), -- Low, Medium, High
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Appointments/Visits
CREATE TABLE appointments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
    doctor_id UUID REFERENCES doctors(id),
    institution_id UUID REFERENCES institutions(id),
    appointment_date TIMESTAMP NOT NULL,
    type VARCHAR(100), -- Consultation, Follow-up, Emergency, etc.
    status VARCHAR(50) DEFAULT 'scheduled', -- scheduled, completed, cancelled
    notes TEXT,
    diagnosis TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Medications catalog
CREATE TABLE medications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    generic_name VARCHAR(255),
    dosage_forms TEXT[], -- tablets, capsules, syrup, etc.
    strengths TEXT[], -- 500mg, 10mg/ml, etc.
    manufacturer VARCHAR(255),
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Prescribed medications (linked to appointments)
CREATE TABLE prescriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    appointment_id UUID REFERENCES appointments(id) ON DELETE CASCADE,
    medication_id UUID REFERENCES medications(id),
    dosage VARCHAR(100), -- 500mg twice daily
    frequency VARCHAR(100),
    duration VARCHAR(100), -- 7 days, 2 weeks, etc.
    instructions TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Patient's current and past medications
CREATE TABLE patient_medications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
    medication_id UUID REFERENCES medications(id),
    status VARCHAR(50) DEFAULT 'active', -- active, discontinued, completed
    start_date DATE,
    end_date DATE,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Test results and lab reports
CREATE TABLE test_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
    appointment_id UUID REFERENCES appointments(id),
    test_name VARCHAR(255),
    test_type VARCHAR(100), -- Blood, Urine, X-Ray, MRI, etc.
    test_date DATE,
    pdf_file_path VARCHAR(500),
    extracted_text TEXT, -- AI-extracted text from PDF
    structured_data JSONB, -- Parsed lab values in JSON format
    institution_id UUID REFERENCES institutions(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Lab values extracted from test results
CREATE TABLE lab_values (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    test_result_id UUID REFERENCES test_results(id) ON DELETE CASCADE,
    parameter_name VARCHAR(255), -- Glucose, Cholesterol, etc.
    value DECIMAL(10,3),
    unit VARCHAR(50), -- mg/dL, g/L, etc.
    reference_range VARCHAR(100), -- Normal range
    status VARCHAR(50), -- Normal, High, Low, Critical
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX idx_patients_name ON patients(last_name, first_name);
CREATE INDEX idx_appointments_patient ON appointments(patient_id);
CREATE INDEX idx_appointments_date ON appointments(appointment_date);
CREATE INDEX idx_prescriptions_appointment ON prescriptions(appointment_id);
CREATE INDEX idx_test_results_patient ON test_results(patient_id);
CREATE INDEX idx_lab_values_test ON lab_values(test_result_id);
CREATE INDEX idx_medical_conditions_name ON medical_conditions(name);
CREATE INDEX idx_medical_conditions_category ON medical_conditions(category);
CREATE INDEX idx_medical_conditions_icd ON medical_conditions(icd_code);