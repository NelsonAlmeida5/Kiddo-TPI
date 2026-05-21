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
     * Ancien fonctionnement : un même niveau d'accès pour tous les autres parents.
     * Conservé pour compatibilité avec les tests existants.
     */
    accessLevelForOtherParents: vine.enum(['none', 'read', 'write']).optional(),

    /**
     * Nouveau fonctionnement : droits définis individuellement par co-parent.
     * Le parent créateur ne doit pas être inclus ici, car il reçoit automatiquement write.
     */
    parentAccesses: vine
      .array(
        vine.object({
          parentId: vine.number(),
          accessLevel: vine.enum(['none', 'read', 'write']),
        })
      )
      .optional(),

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
