'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('user_patient_access', {
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE'
      },
      patient_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'patients', key: 'id' },
        onDelete: 'CASCADE'
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    await queryInterface.addConstraint('user_patient_access', {
      fields: ['user_id', 'patient_id'],
      type: 'primary key',
      name: 'pk_user_patient_access'
    });

    // Preserve every existing single link — nothing is lost, just relocated.
    await queryInterface.sequelize.query(`
      INSERT INTO user_patient_access (user_id, patient_id)
      SELECT id, patient_id FROM users WHERE patient_id IS NOT NULL
    `);

    await queryInterface.removeConstraint('users', 'fk_users_patient_id');
    await queryInterface.removeColumn('users', 'patient_id');
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.addColumn('users', 'patient_id', {
      type: Sequelize.UUID,
      allowNull: true
    });

    await queryInterface.addConstraint('users', {
      fields: ['patient_id'],
      type: 'foreign key',
      name: 'fk_users_patient_id',
      references: { table: 'patients', field: 'id' }
    });

    // Lossy by nature (expand-to-many can't cleanly invert) — restores one
    // arbitrary linked patient per user rather than dropping the link entirely.
    await queryInterface.sequelize.query(`
      UPDATE users u
      SET patient_id = sub.patient_id
      FROM (
        SELECT DISTINCT ON (user_id) user_id, patient_id
        FROM user_patient_access
        ORDER BY user_id, patient_id
      ) sub
      WHERE u.id = sub.user_id
    `);

    await queryInterface.dropTable('user_patient_access');
  }
};
