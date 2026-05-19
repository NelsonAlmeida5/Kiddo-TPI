import vine from '@vinejs/vine'

export const createInvitationValidator = vine.compile(
  vine.object({
    invitedUsername: vine.string().trim().minLength(3).maxLength(50),
  })
)

export const respondInvitationValidator = vine.compile(
  vine.object({
    decision: vine.enum(['accepted', 'refused']),
  })
)
