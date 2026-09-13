'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    // Partial unique index — enforces at most one patient_medications row per
    // prescription_id, while still allowing unlimited rows with
    // prescription_id NULL (legacy/unclaimed rows, unaffected by this
    // constraint). This closes a race in prescriptions.js PUT /:id where two
    // concurrent edits of the same never-before-touched prescription could
    // otherwise both insert a row for it; the route now relies on this index
    // via `INSERT ... ON CONFLICT (prescription_id) DO UPDATE ...`.
    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX idx_patient_medications_prescription_id_unique
      ON patient_medications (prescription_id)
      WHERE prescription_id IS NOT NULL
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS idx_patient_medications_prescription_id_unique
    `);
  }
};
