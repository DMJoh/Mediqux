'use strict';
const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class Institution extends Model {
    static associate(models) {
      Institution.hasMany(models.Appointment, {
        foreignKey: 'institution_id',
        as: 'appointments'
      });
      Institution.hasMany(models.TestResult, {
        foreignKey: 'institution_id',
        as: 'testResults'
      });
      Institution.belongsToMany(models.Doctor, {
        through: 'doctor_institutions',
        foreignKey: 'institution_id',
        otherKey: 'doctor_id',
        as: 'doctors'
      });
    }
  }

  Institution.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    type: {
      type: DataTypes.STRING(100),
      allowNull: false,
      defaultValue: 'Hospital',
      validate: {
        isIn: [['Hospital', 'Clinic', 'Laboratory', 'Pharmacy', 'Other']]
      }
    },
    address: {
      type: DataTypes.TEXT,
      allowNull: true
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
    website: {
      type: DataTypes.STRING(255),
      allowNull: true
    }
  }, {
    sequelize,
    modelName: 'Institution',
    tableName: 'institutions',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  });

  return Institution;
};