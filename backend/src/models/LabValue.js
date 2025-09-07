'use strict';
const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class LabValue extends Model {
    static associate(models) {
      LabValue.belongsTo(models.TestResult, {
        foreignKey: 'test_result_id',
        as: 'testResult'
      });
    }
  }

  LabValue.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    test_result_id: {
      type: DataTypes.UUID,
      allowNull: false
    },
    parameter_name: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    value: {
      type: DataTypes.DECIMAL(10, 3),
      allowNull: true
    },
    unit: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    reference_range: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    status: {
      type: DataTypes.STRING(50),
      allowNull: true,
      defaultValue: 'Normal'
    }
  }, {
    sequelize,
    modelName: 'LabValue',
    tableName: 'lab_values',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false
  });

  return LabValue;
};