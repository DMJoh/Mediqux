'use strict';
const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class Doctor extends Model {
    static associate(models) {
      Doctor.hasMany(models.Appointment, {
        foreignKey: 'doctor_id',
        as: 'appointments'
      });
      Doctor.belongsToMany(models.Institution, {
        through: 'doctor_institutions',
        foreignKey: 'doctor_id',
        otherKey: 'institution_id',
        as: 'institutions'
      });
    }
  }

  Doctor.init({
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
    specialty: {
      type: DataTypes.STRING(200),
      allowNull: true
    },
    license_number: {
      type: DataTypes.STRING(100),
      allowNull: true,
      unique: true
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
    }
  }, {
    sequelize,
    modelName: 'Doctor',
    tableName: 'doctors',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  });

  return Doctor;
};