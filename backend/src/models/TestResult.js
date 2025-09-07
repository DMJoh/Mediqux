'use strict';
const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class TestResult extends Model {
    static associate(models) {
      TestResult.belongsTo(models.Patient, {
        foreignKey: 'patient_id',
        as: 'patient'
      });
      TestResult.belongsTo(models.Appointment, {
        foreignKey: 'appointment_id',
        as: 'appointment'
      });
      TestResult.belongsTo(models.Institution, {
        foreignKey: 'institution_id',
        as: 'institution'
      });
      TestResult.hasMany(models.LabValue, {
        foreignKey: 'test_result_id',
        as: 'labValues'
      });
    }
  }

  TestResult.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    patient_id: {
      type: DataTypes.UUID,
      allowNull: false
    },
    appointment_id: {
      type: DataTypes.UUID,
      allowNull: true
    },
    test_name: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    test_type: {
      type: DataTypes.STRING(100),
      allowNull: false,
      defaultValue: 'Blood',
      validate: {
        isIn: [['Blood', 'Urine', 'X-Ray', 'MRI', 'CT', 'Ultrasound', 'ECG', 'Other']]
      }
    },
    test_date: {
      type: DataTypes.DATEONLY,
      allowNull: false
    },
    pdf_file_path: {
      type: DataTypes.STRING(500),
      allowNull: true
    },
    extracted_text: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    structured_data: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {}
    },
    institution_id: {
      type: DataTypes.UUID,
      allowNull: true
    }
  }, {
    sequelize,
    modelName: 'TestResult',
    tableName: 'test_results',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  });

  return TestResult;
};