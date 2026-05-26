import vine from '@vinejs/vine'

export const createTaskValidator = vine.compile(
  vine.object({
    title: vine.string().trim().minLength(2).maxLength(200),
    description: vine.string().trim().maxLength(1000).optional(),
    dueDate: vine.string().trim(),

    // Parent uniquement : enfant assigné à la tâche
    assignedChildFk: vine.number().optional(),

    // Parent uniquement : niveau d'accès global des co-parents
    accessLevelForOtherParents: vine.enum(['none', 'read', 'write']).optional(),

    // Enfant uniquement : parents qui peuvent voir / traiter la tâche personnelle
    visibleParentIds: vine.array(vine.number()).optional(),
  })
)

export const updateTaskValidator = vine.compile(
  vine.object({
    title: vine.string().trim().minLength(2).maxLength(200).optional(),
    description: vine.string().trim().maxLength(1000).optional(),
    dueDate: vine.string().trim().optional(),
    assignedChildFk: vine.number().optional(),
    accessLevelForOtherParents: vine.enum(['none', 'read', 'write']).optional(),
    visibleParentIds: vine.array(vine.number()).optional(),
  })
)
