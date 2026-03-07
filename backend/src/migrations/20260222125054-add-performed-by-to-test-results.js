'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('test_results', 'performed_by_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'doctors', key: 'id' },
      onDelete: 'SET NULL'
    });

    await queryInterface.addIndex('test_results', ['performed_by_id']);
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('test_results', ['performed_by_id']);
    await queryInterface.removeColumn('test_results', 'performed_by_id');
  }
};
