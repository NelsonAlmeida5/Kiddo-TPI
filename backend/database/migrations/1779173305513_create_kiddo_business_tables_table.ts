import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    /**
     * Table des tâches.
     *
     * Une tâche appartient à une famille, est créée par un utilisateur
     * et est assignée à un enfant.
     */
    this.schema.createTable('t_task', (table) => {
      table.increments('task_id')
      table.string('title', 200).notNullable()
      table.string('description', 1000).nullable()
      table.dateTime('due_date').notNullable()
      table.string('status', 50).notNullable()
      table.integer('version').notNullable()
      table.dateTime('created_at').notNullable()
      table.dateTime('updated_at').nullable()
      table.dateTime('deleted_at').nullable()

      table
        .integer('assigned_child_fk')
        .unsigned()
        .notNullable()
        .references('user_id')
        .inTable('t_user')

      table
        .integer('created_by_fk')
        .unsigned()
        .notNullable()
        .references('user_id')
        .inTable('t_user')

      table
        .integer('family_fk')
        .unsigned()
        .notNullable()
        .references('family_id')
        .inTable('t_family')
    })

    /**
     * Table des preuves.
     *
     * Une preuve est envoyée par un enfant pour une tâche.
     * Elle peut ensuite être validée ou refusée par un parent.
     */
    this.schema.createTable('t_proof', (table) => {
      table.increments('proof_id')
      table.string('proof_type', 50).notNullable()
      table.string('text_content', 1000).nullable()
      table.string('photo_path', 400).nullable()
      table.string('status', 50).notNullable()
      table.integer('task_version_at_submit').notNullable()
      table.string('decision_comment', 1000).nullable()
      table.dateTime('submitted_at').notNullable()
      table.dateTime('decided_at').nullable()

      table.integer('decided_by_fk').unsigned().nullable().references('user_id').inTable('t_user')

      table
        .integer('submitted_by_fk')
        .unsigned()
        .notNullable()
        .references('user_id')
        .inTable('t_user')

      table.integer('task_fk').unsigned().notNullable().references('task_id').inTable('t_task')
    })

    /**
     * Table des invitations.
     *
     * Une invitation permet à un parent d'inviter un autre utilisateur
     * à rejoindre une famille.
     */
    this.schema.createTable('t_invitation', (table) => {
      table.increments('invitation_id')
      table.string('status', 50).notNullable()
      table.dateTime('created_at').notNullable()
      table.dateTime('responded_at').nullable()

      table
        .integer('invited_user_fk')
        .unsigned()
        .notNullable()
        .references('user_id')
        .inTable('t_user')

      table.integer('inviter_fk').unsigned().notNullable().references('user_id').inTable('t_user')

      table
        .integer('family_fk')
        .unsigned()
        .notNullable()
        .references('family_id')
        .inTable('t_family')
    })

    /**
     * Table associative des droits d'accès aux tâches.
     *
     * Elle représente l'association :
     * parent 0,n --- accéder --- 0,n tâche
     */
    this.schema.createTable('t_task_access', (table) => {
      table.integer('parent_fk').unsigned().notNullable()
      table.integer('task_fk').unsigned().notNullable()
      table.string('access_level', 50).notNullable()
      table.dateTime('created_at').notNullable()
      table.dateTime('updated_at').nullable()

      table.primary(['parent_fk', 'task_fk'])

      table.foreign('parent_fk').references('user_id').inTable('t_user')
      table.foreign('task_fk').references('task_id').inTable('t_task')
    })

    /**
     * Contraintes CHECK.
     * Elles renforcent la cohérence côté base de données.
     * Le backend devra aussi valider ces valeurs avant insertion.
     */
    this.schema.raw(`
      ALTER TABLE t_task
      ADD CONSTRAINT chk_task_status
      CHECK (status IN ('todo', 'submitted', 'validated', 'refused'))
    `)

    this.schema.raw(`
      ALTER TABLE t_task
      ADD CONSTRAINT chk_task_version
      CHECK (version >= 1)
    `)

    this.schema.raw(`
      ALTER TABLE t_proof
      ADD CONSTRAINT chk_proof_type
      CHECK (proof_type IN ('text', 'photo', 'text_photo'))
    `)

    this.schema.raw(`
      ALTER TABLE t_proof
      ADD CONSTRAINT chk_proof_status
      CHECK (status IN ('pending', 'validated', 'refused'))
    `)

    this.schema.raw(`
      ALTER TABLE t_proof
      ADD CONSTRAINT chk_proof_task_version
      CHECK (task_version_at_submit >= 1)
    `)

    this.schema.raw(`
      ALTER TABLE t_proof
      ADD CONSTRAINT chk_proof_content
      CHECK (text_content IS NOT NULL OR photo_path IS NOT NULL)
    `)

    this.schema.raw(`
      ALTER TABLE t_proof
      ADD CONSTRAINT chk_proof_decision_state
      CHECK (
        (
          status = 'pending'
          AND decided_by_fk IS NULL
          AND decided_at IS NULL
        )
        OR
        (
          status IN ('validated', 'refused')
          AND decided_by_fk IS NOT NULL
          AND decided_at IS NOT NULL
        )
      )
    `)

    this.schema.raw(`
      ALTER TABLE t_invitation
      ADD CONSTRAINT chk_invitation_status
      CHECK (status IN ('pending', 'accepted', 'refused', 'cancelled'))
    `)

    this.schema.raw(`
      ALTER TABLE t_invitation
      ADD CONSTRAINT chk_invitation_response
      CHECK (
        (
          status = 'pending'
          AND responded_at IS NULL
        )
        OR
        (
          status IN ('accepted', 'refused', 'cancelled')
          AND responded_at IS NOT NULL
        )
      )
    `)

    this.schema.raw(`
      ALTER TABLE t_task_access
      ADD CONSTRAINT chk_task_access_level
      CHECK (access_level IN ('none', 'read', 'write'))
    `)

    /**
     * Index métier composés.
     * Les FK sont déjà indexées automatiquement par InnoDB.
     * Ici, on ajoute seulement les index utiles aux recherches prévues.
     */
    this.schema.raw(`
      CREATE INDEX idx_task_family_status
      ON t_task(family_fk, status)
    `)

    this.schema.raw(`
      CREATE INDEX idx_task_family_due_date
      ON t_task(family_fk, due_date)
    `)

    this.schema.raw(`
      CREATE INDEX idx_proof_task_status
      ON t_proof(task_fk, status)
    `)

    this.schema.raw(`
      CREATE INDEX idx_invitation_invited_user_status
      ON t_invitation(invited_user_fk, status)
    `)
  }

  async down() {
    this.schema.dropTable('t_task_access')
    this.schema.dropTable('t_invitation')
    this.schema.dropTable('t_proof')
    this.schema.dropTable('t_task')
  }
}
