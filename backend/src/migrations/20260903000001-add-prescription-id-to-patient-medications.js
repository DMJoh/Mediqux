'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Additive only — existing rows keep prescription_id NULL. There's no way
    // to retroactively know which specific prescription created a given
    // patient_medications row (the app used to collapse every prescription of
    // the same medication for a patient onto one shared row), so no backfill
    // is attempted. Legacy rows keep working via the pair-based fallback join
    // the route code applies for rows where prescription_id IS NULL; they
    // become prescription-specific automatically the first time that
    // prescription is edited (see prescriptions.js PUT /:id).
    await queryInterface.addColumn('patient_medications', 'prescription_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'prescriptions', key: 'id' },
      onDelete: 'CASCADE'
    });

    await queryInterface.addIndex('patient_medications', ['prescription_id']);
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('patient_medications', 'prescription_id');
  }
};
