// Ce fichier regroupe des petites règles métier de Kiddo.
// Elles sont séparées des contrôleurs afin de pouvoir être testées
// sans requête HTTP et sans accès à la base de données.

export type UserRole = 'parent' | 'child'
export type TaskStatus = 'todo' | 'submitted' | 'validated' | 'refused'
export type AccessLevel = 'none' | 'read' | 'write'

export type MinimalUser = {
  userId: number
  role: UserRole
}

export type MinimalTask = {
  createdByFk: number
  assignedChildFk: number
}

// Vérifie si un utilisateur peut effectuer une action réservée aux parents.
export const canUseParentAction = (user: MinimalUser) => {
  return user.role === 'parent'
}

// Une tâche ne peut être modifiée que si elle est encore ouverte
// ou si elle a été refusée.
export const canEditTaskStatus = (status: TaskStatus) => {
  return ['todo', 'refused'].includes(status)
}

// Vérifie qu'un champ obligatoire contient autre chose que des espaces.
export const isRequiredTextValid = (value?: string | null) => {
  return Boolean(value?.trim())
}

// Vérifie qu'un statut de tâche fait partie des valeurs autorisées.
export const isValidTaskStatus = (status: string) => {
  return ['todo', 'submitted', 'validated', 'refused'].includes(status)
}

// Empêche les changements de statut incohérents.
// Vérifie les transitions de statut principales.
// Une tâche refusée doit repasser par une nouvelle soumission avant une nouvelle décision parentale.
export const canChangeTaskStatus = (currentStatus: TaskStatus, nextStatus: TaskStatus) => {
  if (currentStatus === 'todo') {
    return nextStatus === 'submitted'
  }

  if (currentStatus === 'refused') {
    return nextStatus === 'submitted'
  }

  if (currentStatus === 'submitted') {
    return ['validated', 'refused'].includes(nextStatus)
  }

  return false
}

// Vérifie qu'un co-parent possède bien le droit de modification.
export const hasWriteAccess = (accessLevel: AccessLevel) => {
  return accessLevel === 'write'
}

// Une tâche est considérée comme personnelle à l'enfant uniquement
// si elle a été créée par cet enfant et assignée à ce même enfant.
export const isOwnChildTask = (task: MinimalTask, user: MinimalUser) => {
  return (
    user.role === 'child' &&
    task.createdByFk === user.userId &&
    task.assignedChildFk === user.userId
  )
}

// Message générique pour éviter d'indiquer si l'erreur vient
// du nom d'utilisateur ou du mot de passe.
export const getInvalidLoginMessage = () => {
  return 'Nom d’utilisateur ou mot de passe incorrect.'
}

// Vérifie qu'un rôle manipulé manuellement côté API reste refusé.
// Le frontend ne propose que parent/enfant, mais l'API doit aussi se protéger.
export const isValidUserRole = (role: string) => {
  return ['parent', 'child'].includes(role)
}
