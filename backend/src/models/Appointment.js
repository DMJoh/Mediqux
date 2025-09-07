'use strict';
const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class Appointment extends Model {
    static associate(models) {
      Appointment.belongsTo(models.Patient, {
        foreignKey: 'patient_id',
        as: 'patient'
      });
      Appointment.belongsTo(models.Doctor, {
        foreignKey: 'doctor_id',
        as: 'doctor'
      });
      Appointment.belongsTo(models.Institution, {
        foreignKey: 'institution_id',
        as: 'institution'
      });
    }
  }

  Appointment.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    patient_id: {
      type: DataTypes.UUID,
      allowNull: false
    },
    doctor_id: {
      type: DataTypes.UUID,
      allowNull: true
    },
    institution_id: {
      type: DataTypes.UUID,
      allowNull: true
    },
    appointment_date: {
      type: DataTypes.DATE,
      allowNull: false
    },
    type: {
      type: DataTypes.STRING(100),
      allowNull: true,
      defaultValue: 'Consultation'
    },
    status: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'scheduled'
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    diagnosis: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  }, {
    sequelize,
    modelName: 'Appointment',
    tableName: 'appointments',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  });

  return Appointment;
};