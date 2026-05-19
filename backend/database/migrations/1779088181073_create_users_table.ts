import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    /**
     * Table des familles.
     *
     * Elle est créée avant t_user car chaque utilisateur est rattaché
     * à une famille courante via current_family_fk.
     *
     * owner_user_id reste nullable à la création pour éviter une dépendance
     * circulaire. La FK vers t_user est ajoutée après la création de t_user.
     */
    this.schema.createTable('t_family', (table) => {
      table.increments('family_id')
      table.integer('owner_user_id').unsigned().nullable()
      table.string('name', 200).notNullable()
      table.string('status', 50).notNullable()
      table.dateTime('created_at').notNullable()
      table.dateTime('updated_at').nullable()
    })

    /**
     * Table des utilisateurs Kiddo.
     *
     * On utilise :
     * - t_user au lieu de users ;
     * - user_id au lieu de id ;
     * - username au lieu de email ;
     * - password_hash au lieu de password ;
     * - current_family_fk pour représenter la famille courante.
     */
    this.schema.createTable('t_user', (table) => {
      table.increments('user_id')
      table.string('username', 50).notNullable().unique()
      table.string('password_hash', 255).notNullable()
      table.string('name', 200).notNullable()
      table.string('role', 50).notNullable()
      table.dateTime('created_at').notNullable()
      table.dateTime('updated_at').nullable()

      table
        .integer('current_family_fk')
        .unsigned()
        .notNullable()
        .references('family_id')
        .inTable('t_family')
    })

    /**
     * Ajout de la relation propriétaire de famille après création de t_user.
     *
     * Cela évite une dépendance circulaire au moment de la création initiale
     * des tables, tout en gardant une vraie contrainte de clé étrangère.
     */
    this.schema.alterTable('t_family', (table) => {
      table.unique(['owner_user_id'], {
        indexName: 'uq_family_owner',
      })

      table.foreign('owner_user_id', 'fk_family_owner').references('user_id').inTable('t_user')
    })

    /**
     * Contraintes de cohérence.
     * Les mêmes valeurs seront aussi validées côté backend.
     */
    this.schema.raw(`
      ALTER TABLE t_family
      ADD CONSTRAINT chk_family_status
      CHECK (status IN ('active', 'archived'))
    `)

    this.schema.raw(`
      ALTER TABLE t_user
      ADD CONSTRAINT chk_user_role
      CHECK (role IN ('parent', 'child'))
    `)
  }

  async down() {
    this.schema.alterTable('t_family', (table) => {
      table.dropForeign(['owner_user_id'], 'fk_family_owner')
      table.dropUnique(['owner_user_id'], 'uq_family_owner')
    })

    this.schema.dropTable('t_user')
    this.schema.dropTable('t_family')
  }
}
