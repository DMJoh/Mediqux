'use strict';
const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class Patient extends Model {
    static associate(models) {
      Patient.hasMany(models.User, {
        foreignKey: 'patient_id',
        as: 'users'
      });
      Patient.hasMany(models.Appointment, {
        foreignKey: 'patient_id',
        as: 'appointments'
      });
      Patient.hasMany(models.TestResult, {
        foreignKey: 'patient_id',
        as: 'testResults'
      });
      Patient.hasMany(models.PatientMedication, {
        foreignKey: 'patient_id',
        as: 'medications'
      });
    }
  }

  Patient.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    first_name: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    last_name: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    date_of_birth: {
      type: DataTypes.DATEONLY,
      allowNull: true
    },
    gender: {
      type: DataTypes.STRING(10),
      allowNull: true,
      validate: {
        isIn: [['Male', 'Female', 'Other']]
      }
    },
    phone: {
      type: DataTypes.STRING(20),
      allowNull: true
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: true,
      validate: {
        isEmail: true
      }
    },
    address: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    emergency_contact_name: {
      type: DataTypes.STRING(200),
      allowNull: true
    },
    emergency_contact_phone: {
      type: DataTypes.STRING(20),
      allowNull: true
    }
  }, {
    sequelize,
    modelName: 'Patient',
    tableName: 'patients',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  });

  return Patient;
};