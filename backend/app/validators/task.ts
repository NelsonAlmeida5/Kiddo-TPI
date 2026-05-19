import vine from '@vinejs/vine'

export const createTaskValidator = vine.compile(
  vine.object({
    title: vine.string().trim().minLength(2).maxLength(200),
    description: vine.string().trim().maxLength(1000).optional(),
    dueDate: vine.string().trim(),
    assignedChildFk: vine.number(),
    accessLevelForOtherParents: vine.enum(['none', 'read', 'write']).optional(),
  })
)
