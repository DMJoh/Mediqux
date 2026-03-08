'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const now = new Date();

    // -------------------------------------------------------------------------
    // Institutions (Grey's Anatomy — Seattle)
    // -------------------------------------------------------------------------
    await queryInterface.bulkInsert('institutions', [
      {
        id: 'a1000000-0000-0000-0000-000000000001',
        name: 'Grey Sloan Memorial Hospital',
        type: 'Hospital',
        address: '1234 Ellis Grey Drive, Seattle, WA 98101',
        phone: '+1 206 555 0100',
        email: 'info@greysloanmemorial.org',
        website: 'https://greysloanmemorial.org',
        created_at: now,
        updated_at: now
      },
      {
        id: 'a1000000-0000-0000-0000-000000000002',
        name: 'Dillard Medical Center',
        type: 'Clinic',
        address: '88 Emerald City Way, Seattle, WA 98102',
        phone: '+1 206 555 0200',
        email: 'contact@dillardmedical.org',
        website: null,
        created_at: now,
        updated_at: now
      },
      {
        id: 'a1000000-0000-0000-0000-000000000003',
        name: 'Pacific Northwest Diagnostics',
        type: 'Laboratory',
        address: '300 Meredith Lane, Seattle, WA 98103',
        phone: '+1 206 555 0300',
        email: 'lab@pnwdiagnostics.org',
        website: null,
        created_at: now,
        updated_at: now
      }
    ]);

    // -------------------------------------------------------------------------
    // Doctors (Grey's Anatomy characters)
    // -------------------------------------------------------------------------
    await queryInterface.bulkInsert('doctors', [
      {
        id: 'b1000000-0000-0000-0000-000000000001',
        first_name: 'Miranda',
        last_name: 'Bailey',
        specialty: 'General Practitioner',
        license_number: 'WA-MD-100214',
        phone: '+1 206 555 1001',
        email: 'm.bailey@greysloanmemorial.org',
        created_at: now,
        updated_at: now
      },
      {
        id: 'b1000000-0000-0000-0000-000000000002',
        first_name: 'Cristina',
        last_name: 'Yang',
        specialty: 'Cardiologist',
        license_number: 'WA-MD-200345',
        phone: '+1 206 555 1002',
        email: 'c.yang@greysloanmemorial.org',
        created_at: now,
        updated_at: now
      },
      {
        id: 'b1000000-0000-0000-0000-000000000003',
        first_name: 'Derek',
        last_name: 'Shepherd',
        specialty: 'Radiologist',
        license_number: 'WA-MD-300478',
        phone: '+1 206 555 1003',
        email: 'd.shepherd@pnwdiagnostics.org',
        created_at: now,
        updated_at: now
      },
      {
        id: 'b1000000-0000-0000-0000-000000000004',
        first_name: 'Meredith',
        last_name: 'Grey',
        specialty: 'Endocrinologist',
        license_number: 'WA-MD-400501',
        phone: '+1 206 555 1004',
        email: 'm.grey@dillardmedical.org',
        created_at: now,
        updated_at: now
      }
    ]);

    // -------------------------------------------------------------------------
    // Doctor-Institution links
    // -------------------------------------------------------------------------
    await queryInterface.bulkInsert('doctor_institutions', [
      { doctor_id: 'b1000000-0000-0000-0000-000000000001', institution_id: 'a1000000-0000-0000-0000-000000000001', created_at: now },
      { doctor_id: 'b1000000-0000-0000-0000-000000000002', institution_id: 'a1000000-0000-0000-0000-000000000001', created_at: now },
      { doctor_id: 'b1000000-0000-0000-0000-000000000003', institution_id: 'a1000000-0000-0000-0000-000000000003', created_at: now },
      { doctor_id: 'b1000000-0000-0000-0000-000000000004', institution_id: 'a1000000-0000-0000-0000-000000000002', created_at: now }
    ]);

    // -------------------------------------------------------------------------
    // Patients (Grey's Anatomy patient characters)
    // -------------------------------------------------------------------------
    await queryInterface.bulkInsert('patients', [
      {
        id: 'c1000000-0000-0000-0000-000000000001',
        first_name: 'Denny',
        last_name: 'Duquette',
        date_of_birth: '1975-08-20',
        gender: 'Male',
        phone: '+1 206 555 2001',
        email: 'denny.duquette@email.com',
        address: '42 Pike Street, Seattle, WA 98101',
        emergency_contact_name: 'Charles Duquette',
        emergency_contact_phone: '+1 206 555 2002',
        created_at: now,
        updated_at: now
      },
      {
        id: 'c1000000-0000-0000-0000-000000000002',
        first_name: 'Rebecca',
        last_name: 'Pope',
        date_of_birth: '1983-02-14',
        gender: 'Female',
        phone: '+1 206 555 2003',
        email: 'r.pope@email.com',
        address: '17 Queen Anne Ave, Seattle, WA 98109',
        emergency_contact_name: 'Jeff Pope',
        emergency_contact_phone: '+1 206 555 2004',
        created_at: now,
        updated_at: now
      },
      {
        id: 'c1000000-0000-0000-0000-000000000003',
        first_name: 'Mary',
        last_name: 'Portman',
        date_of_birth: '1960-05-03',
        gender: 'Female',
        phone: '+1 206 555 2005',
        email: 'm.portman@email.com',
        address: '9 Capitol Hill Blvd, Seattle, WA 98122',
        emergency_contact_name: 'Bill Portman',
        emergency_contact_phone: '+1 206 555 2006',
        created_at: now,
        updated_at: now
      }
    ]);

    // -------------------------------------------------------------------------
    // Medical conditions
    // -------------------------------------------------------------------------
    await queryInterface.bulkInsert('medical_conditions', [
      {
        id: 'd1000000-0000-0000-0000-000000000001',
        name: 'Type 2 Diabetes Mellitus',
        description: 'Chronic condition affecting blood sugar regulation',
        icd_code: 'E11',
        category: 'Endocrine',
        severity: 'High',
        created_at: now,
        updated_at: now
      },
      {
        id: 'd1000000-0000-0000-0000-000000000002',
        name: 'Essential Hypertension',
        description: 'Persistently elevated blood pressure without identifiable cause',
        icd_code: 'I10',
        category: 'Cardiovascular',
        severity: 'Medium',
        created_at: now,
        updated_at: now
      },
      {
        id: 'd1000000-0000-0000-0000-000000000003',
        name: 'Hypothyroidism',
        description: 'Underactive thyroid gland producing insufficient thyroid hormone',
        icd_code: 'E03.9',
        category: 'Endocrine',
        severity: 'Medium',
        created_at: now,
        updated_at: now
      },
      {
        id: 'd1000000-0000-0000-0000-000000000004',
        name: 'Dyslipidemia',
        description: 'Abnormal levels of lipids in the bloodstream',
        icd_code: 'E78.5',
        category: 'Metabolic',
        severity: 'Medium',
        created_at: now,
        updated_at: now
      }
    ]);

    // -------------------------------------------------------------------------
    // Medications
    // -------------------------------------------------------------------------
    await queryInterface.bulkInsert('medications', [
      {
        id: 'e1000000-0000-0000-0000-000000000001',
        name: 'Metformin',
        generic_name: 'Metformin Hydrochloride',
        dosage_forms: ['Tablet'],
        strengths: ['500mg', '850mg', '1000mg'],
        active_ingredients: JSON.stringify([{ name: 'Metformin Hydrochloride', concentration: '500mg' }]),
        manufacturer: 'Generic',
        description: 'First-line medication for type 2 diabetes',
        created_at: now,
        updated_at: now
      },
      {
        id: 'e1000000-0000-0000-0000-000000000002',
        name: 'Amlodipine',
        generic_name: 'Amlodipine Besylate',
        dosage_forms: ['Tablet'],
        strengths: ['5mg', '10mg'],
        active_ingredients: JSON.stringify([{ name: 'Amlodipine Besylate', concentration: '5mg' }]),
        manufacturer: 'Generic',
        description: 'Calcium channel blocker for hypertension',
        created_at: now,
        updated_at: now
      },
      {
        id: 'e1000000-0000-0000-0000-000000000003',
        name: 'Levothyroxine',
        generic_name: 'Levothyroxine Sodium',
        dosage_forms: ['Tablet'],
        strengths: ['25mcg', '50mcg', '100mcg'],
        active_ingredients: JSON.stringify([{ name: 'Levothyroxine Sodium', concentration: '50mcg' }]),
        manufacturer: 'Generic',
        description: 'Thyroid hormone replacement therapy',
        created_at: now,
        updated_at: now
      },
      {
        id: 'e1000000-0000-0000-0000-000000000004',
        name: 'Atorvastatin',
        generic_name: 'Atorvastatin Calcium',
        dosage_forms: ['Tablet'],
        strengths: ['10mg', '20mg', '40mg'],
        active_ingredients: JSON.stringify([{ name: 'Atorvastatin Calcium', concentration: '20mg' }]),
        manufacturer: 'Generic',
        description: 'Statin for lowering cholesterol',
        created_at: now,
        updated_at: now
      }
    ]);

    // -------------------------------------------------------------------------
    // Appointments
    // -------------------------------------------------------------------------
    await queryInterface.bulkInsert('appointments', [
      {
        id: 'f1000000-0000-0000-0000-000000000001',
        patient_id: 'c1000000-0000-0000-0000-000000000001',
        doctor_id: 'b1000000-0000-0000-0000-000000000001',
        institution_id: 'a1000000-0000-0000-0000-000000000001',
        appointment_date: new Date('2026-01-10T09:00:00Z'),
        type: 'Consultation',
        status: 'completed',
        notes: 'Follow-up for diabetes management',
        diagnosis: 'Type 2 Diabetes — well controlled',
        created_at: now,
        updated_at: now
      },
      {
        id: 'f1000000-0000-0000-0000-000000000002',
        patient_id: 'c1000000-0000-0000-0000-000000000001',
        doctor_id: 'b1000000-0000-0000-0000-000000000002',
        institution_id: 'a1000000-0000-0000-0000-000000000001',
        appointment_date: new Date('2026-02-14T10:30:00Z'),
        type: 'Specialist Consultation',
        status: 'completed',
        notes: 'Cardiac review, ECG performed',
        diagnosis: 'Mild hypertension, no structural abnormality',
        created_at: now,
        updated_at: now
      },
      {
        id: 'f1000000-0000-0000-0000-000000000003',
        patient_id: 'c1000000-0000-0000-0000-000000000002',
        doctor_id: 'b1000000-0000-0000-0000-000000000004',
        institution_id: 'a1000000-0000-0000-0000-000000000002',
        appointment_date: new Date('2026-01-22T08:00:00Z'),
        type: 'Consultation',
        status: 'completed',
        notes: 'Hypothyroidism management, TSH check ordered',
        diagnosis: 'Hypothyroidism — dosage adjustment required',
        created_at: now,
        updated_at: now
      },
      {
        id: 'f1000000-0000-0000-0000-000000000004',
        patient_id: 'c1000000-0000-0000-0000-000000000003',
        doctor_id: 'b1000000-0000-0000-0000-000000000001',
        institution_id: 'a1000000-0000-0000-0000-000000000001',
        appointment_date: new Date('2026-03-15T11:00:00Z'),
        type: 'Consultation',
        status: 'scheduled',
        notes: 'Routine annual checkup',
        diagnosis: null,
        created_at: now,
        updated_at: now
      }
    ]);

    // -------------------------------------------------------------------------
    // Prescriptions
    // -------------------------------------------------------------------------
    await queryInterface.bulkInsert('prescriptions', [
      {
        id: '17000000-0000-0000-0000-000000000001',
        appointment_id: 'f1000000-0000-0000-0000-000000000001',
        medication_id: 'e1000000-0000-0000-0000-000000000001',
        dosage: '500mg',
        frequency: 'Twice daily',
        duration: '3 months',
        instructions: 'Take with meals',
        created_at: now
      },
      {
        id: '17000000-0000-0000-0000-000000000002',
        appointment_id: 'f1000000-0000-0000-0000-000000000002',
        medication_id: 'e1000000-0000-0000-0000-000000000002',
        dosage: '5mg',
        frequency: 'Once daily',
        duration: 'Ongoing',
        instructions: 'Take in the morning',
        created_at: now
      },
      {
        id: '17000000-0000-0000-0000-000000000003',
        appointment_id: 'f1000000-0000-0000-0000-000000000002',
        medication_id: 'e1000000-0000-0000-0000-000000000004',
        dosage: '20mg',
        frequency: 'Once daily at night',
        duration: 'Ongoing',
        instructions: 'Avoid grapefruit juice',
        created_at: now
      },
      {
        id: '17000000-0000-0000-0000-000000000004',
        appointment_id: 'f1000000-0000-0000-0000-000000000003',
        medication_id: 'e1000000-0000-0000-0000-000000000003',
        dosage: '75mcg',
        frequency: 'Once daily',
        duration: 'Ongoing',
        instructions: 'Take on an empty stomach 30 minutes before breakfast',
        created_at: now
      }
    ]);

    // -------------------------------------------------------------------------
    // Lab Reports (manual entry, no PDF)
    // -------------------------------------------------------------------------
    await queryInterface.bulkInsert('test_results', [
      {
        id: '18000000-0000-0000-0000-000000000001',
        patient_id: 'c1000000-0000-0000-0000-000000000001',
        appointment_id: 'f1000000-0000-0000-0000-000000000001',
        test_name: 'Complete Blood Count',
        test_type: 'Blood',
        test_date: '2026-01-10',
        pdf_file_path: null,
        extracted_text: null,
        structured_data: JSON.stringify({}),
        institution_id: 'a1000000-0000-0000-0000-000000000003',
        created_at: now,
        updated_at: now
      },
      {
        id: '18000000-0000-0000-0000-000000000002',
        patient_id: 'c1000000-0000-0000-0000-000000000001',
        appointment_id: 'f1000000-0000-0000-0000-000000000002',
        test_name: 'Lipid Panel',
        test_type: 'Blood',
        test_date: '2026-02-14',
        pdf_file_path: null,
        extracted_text: null,
        structured_data: JSON.stringify({}),
        institution_id: 'a1000000-0000-0000-0000-000000000003',
        created_at: now,
        updated_at: now
      },
      {
        id: '18000000-0000-0000-0000-000000000003',
        patient_id: 'c1000000-0000-0000-0000-000000000002',
        appointment_id: 'f1000000-0000-0000-0000-000000000003',
        test_name: 'Thyroid Function Test',
        test_type: 'Blood',
        test_date: '2026-01-22',
        pdf_file_path: null,
        extracted_text: null,
        structured_data: JSON.stringify({}),
        institution_id: 'a1000000-0000-0000-0000-000000000003',
        created_at: now,
        updated_at: now
      }
    ]);

    // -------------------------------------------------------------------------
    // Lab Values
    // -------------------------------------------------------------------------
    await queryInterface.bulkInsert('lab_values', [
      // CBC — Denny Duquette
      { id: '19000000-0000-0000-0000-000000000001', test_result_id: '18000000-0000-0000-0000-000000000001', parameter_name: 'Haemoglobin', value: 14.2, unit: 'g/dL', reference_range: '13.5–17.5', status: 'Normal', created_at: now },
      { id: '19000000-0000-0000-0000-000000000002', test_result_id: '18000000-0000-0000-0000-000000000001', parameter_name: 'WBC', value: 7.8, unit: '10³/µL', reference_range: '4.5–11.0', status: 'Normal', created_at: now },
      { id: '19000000-0000-0000-0000-000000000003', test_result_id: '18000000-0000-0000-0000-000000000001', parameter_name: 'Platelets', value: 210, unit: '10³/µL', reference_range: '150–400', status: 'Normal', created_at: now },
      { id: '19000000-0000-0000-0000-000000000004', test_result_id: '18000000-0000-0000-0000-000000000001', parameter_name: 'HbA1c', value: 7.1, unit: '%', reference_range: '<7.0', status: 'High', created_at: now },

      // Lipid Panel — Denny Duquette
      { id: '19000000-0000-0000-0000-000000000005', test_result_id: '18000000-0000-0000-0000-000000000002', parameter_name: 'Total Cholesterol', value: 215, unit: 'mg/dL', reference_range: '<200', status: 'High', created_at: now },
      { id: '19000000-0000-0000-0000-000000000006', test_result_id: '18000000-0000-0000-0000-000000000002', parameter_name: 'LDL Cholesterol', value: 138, unit: 'mg/dL', reference_range: '<130', status: 'High', created_at: now },
      { id: '19000000-0000-0000-0000-000000000007', test_result_id: '18000000-0000-0000-0000-000000000002', parameter_name: 'HDL Cholesterol', value: 52, unit: 'mg/dL', reference_range: '>40', status: 'Normal', created_at: now },
      { id: '19000000-0000-0000-0000-000000000008', test_result_id: '18000000-0000-0000-0000-000000000002', parameter_name: 'Triglycerides', value: 168, unit: 'mg/dL', reference_range: '<150', status: 'High', created_at: now },

      // TFT — Rebecca Pope
      { id: '19000000-0000-0000-0000-000000000009', test_result_id: '18000000-0000-0000-0000-000000000003', parameter_name: 'TSH', value: 6.8, unit: 'mIU/L', reference_range: '0.4–4.0', status: 'High', created_at: now },
      { id: '19000000-0000-0000-0000-000000000010', test_result_id: '18000000-0000-0000-0000-000000000003', parameter_name: 'Free T4', value: 0.72, unit: 'ng/dL', reference_range: '0.8–1.8', status: 'Low', created_at: now },
      { id: '19000000-0000-0000-0000-000000000011', test_result_id: '18000000-0000-0000-0000-000000000003', parameter_name: 'Free T3', value: 2.9, unit: 'pg/mL', reference_range: '2.3–4.2', status: 'Normal', created_at: now }
    ]);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('lab_values', {
      test_result_id: [
        '18000000-0000-0000-0000-000000000001',
        '18000000-0000-0000-0000-000000000002',
        '18000000-0000-0000-0000-000000000003'
      ]
    });
    await queryInterface.bulkDelete('test_results', {
      id: [
        '18000000-0000-0000-0000-000000000001',
        '18000000-0000-0000-0000-000000000002',
        '18000000-0000-0000-0000-000000000003'
      ]
    });
    await queryInterface.bulkDelete('prescriptions', {
      id: [
        '17000000-0000-0000-0000-000000000001',
        '17000000-0000-0000-0000-000000000002',
        '17000000-0000-0000-0000-000000000003',
        '17000000-0000-0000-0000-000000000004'
      ]
    });
    await queryInterface.bulkDelete('appointments', {
      id: [
        'f1000000-0000-0000-0000-000000000001',
        'f1000000-0000-0000-0000-000000000002',
        'f1000000-0000-0000-0000-000000000003',
        'f1000000-0000-0000-0000-000000000004'
      ]
    });
    await queryInterface.bulkDelete('medications', {
      id: [
        'e1000000-0000-0000-0000-000000000001',
        'e1000000-0000-0000-0000-000000000002',
        'e1000000-0000-0000-0000-000000000003',
        'e1000000-0000-0000-0000-000000000004'
      ]
    });
    await queryInterface.bulkDelete('medical_conditions', {
      id: [
        'd1000000-0000-0000-0000-000000000001',
        'd1000000-0000-0000-0000-000000000002',
        'd1000000-0000-0000-0000-000000000003',
        'd1000000-0000-0000-0000-000000000004'
      ]
    });
    await queryInterface.bulkDelete('patients', {
      id: [
        'c1000000-0000-0000-0000-000000000001',
        'c1000000-0000-0000-0000-000000000002',
        'c1000000-0000-0000-0000-000000000003'
      ]
    });
    await queryInterface.bulkDelete('doctor_institutions', {
      doctor_id: [
        'b1000000-0000-0000-0000-000000000001',
        'b1000000-0000-0000-0000-000000000002',
        'b1000000-0000-0000-0000-000000000003',
        'b1000000-0000-0000-0000-000000000004'
      ]
    });
    await queryInterface.bulkDelete('doctors', {
      id: [
        'b1000000-0000-0000-0000-000000000001',
        'b1000000-0000-0000-0000-000000000002',
        'b1000000-0000-0000-0000-000000000003',
        'b1000000-0000-0000-0000-000000000004'
      ]
    });
    await queryInterface.bulkDelete('institutions', {
      id: [
        'a1000000-0000-0000-0000-000000000001',
        'a1000000-0000-0000-0000-000000000002',
        'a1000000-0000-0000-0000-000000000003'
      ]
    });
  }
};
