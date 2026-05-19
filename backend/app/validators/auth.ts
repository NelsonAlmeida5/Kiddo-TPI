import vine from '@vinejs/vine'

export const registerValidator = vine.compile(
  vine.object({
    username: vine.string().trim().minLength(3).maxLength(50),
    password: vine.string().minLength(8).maxLength(100),
    name: vine.string().trim().minLength(2).maxLength(200),
    role: vine.enum(['parent', 'child']),
  })
)

export const loginValidator = vine.compile(
  vine.object({
    username: vine.string().trim().minLength(3).maxLength(50),
    password: vine.string().minLength(8).maxLength(100),
  })
)
