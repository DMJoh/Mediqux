'use strict';
const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class PatientMedication extends Model {
    static associate(models) {
      PatientMedication.belongsTo(models.Patient, {
        foreignKey: 'patient_id',
        as: 'patient'
      });
    }
  }

  PatientMedication.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    patient_id: {
      type: DataTypes.UUID,
      allowNull: false
    },
    medication_id: {
      type: DataTypes.UUID,
      allowNull: false
    },
    status: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'active'
    },
    start_date: {
      type: DataTypes.DATEONLY,
      allowNull: true
    },
    end_date: {
      type: DataTypes.DATEONLY,
      allowNull: true
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  }, {
    sequelize,
    modelName: 'PatientMedication',
    tableName: 'patient_medications',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  });

  return PatientMedication;
};