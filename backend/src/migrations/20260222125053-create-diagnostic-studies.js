'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('diagnostic_studies', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('uuid_generate_v4()'),
        primaryKey: true
      },
      patient_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'patients', key: 'id' },
        onDelete: 'CASCADE'
      },
      study_type: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      body_region: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      study_date: {
        type: Sequelize.DATEONLY,
        allowNull: false
      },
      ordering_physician_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'doctors', key: 'id' },
        onDelete: 'SET NULL'
      },
      performing_physician_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'doctors', key: 'id' },
        onDelete: 'SET NULL'
      },
      institution_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'institutions', key: 'id' },
        onDelete: 'SET NULL'
      },
      clinical_indication: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      findings: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      conclusion: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      attachment_path: {
        type: Sequelize.STRING(500),
        allowNull: true
      },
      attachment_original_name: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      attachment_mime_type: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    await queryInterface.addIndex('diagnostic_studies', ['patient_id']);
    await queryInterface.addIndex('diagnostic_studies', ['study_date']);
    await queryInterface.addIndex('diagnostic_studies', ['study_type']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('diagnostic_studies');
  }
};
