import vine from '@vinejs/vine'

export const createTaskValidator = vine.compile(
  vine.object({
    title: vine.string().trim().minLength(2).maxLength(200),
    description: vine.string().trim().maxLength(1000).optional(),
    dueDate: vine.string().trim(),

    /**
     * Utilisé par un parent lorsqu'il crée une tâche pour un enfant.
     * Pour une tâche créée par un enfant, ce champ n'est pas nécessaire :
     * la tâche est automatiquement assignée à l'enfant connecté.
     */
    assignedChildFk: vine.number().optional(),

    /**
     * Utilisé par un parent pour définir le niveau d'accès des autres parents
     * présents dans la famille au moment de la création.
     */
    accessLevelForOtherParents: vine.enum(['none', 'read', 'write']).optional(),

    /**
     * Utilisé par un enfant lorsqu'il crée une tâche personnelle.
     * Les parents sélectionnés pourront voir la tâche en lecture seule.
     */
    visibleParentIds: vine.array(vine.number()).optional(),
  })
)

export const updateTaskValidator = vine.compile(
  vine.object({
    title: vine.string().trim().minLength(2).maxLength(200).optional(),
    description: vine.string().trim().maxLength(1000).optional(),
    dueDate: vine.string().trim().optional(),

    /**
     * Utilisé uniquement par les parents.
     * Un enfant ne peut pas réassigner une tâche.
     */
    assignedChildFk: vine.number().optional(),

    accessLevelForOtherParents: vine.enum(['none', 'read', 'write']).optional(),

    /**
     * Utilisé uniquement par les enfants pour modifier la visibilité
     * d'une tâche personnelle.
     */
    visibleParentIds: vine.array(vine.number()).optional(),
  })
)
