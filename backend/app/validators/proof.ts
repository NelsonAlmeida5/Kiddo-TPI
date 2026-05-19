import vine from '@vinejs/vine'

export const submitProofValidator = vine.compile(
  vine.object({
    textContent: vine.string().trim().maxLength(1000).optional(),
    photoPath: vine.string().trim().maxLength(400).optional(),
  })
)

export const decideProofValidator = vine.compile(
  vine.object({
    decision: vine.enum(['validated', 'refused']),
    decisionComment: vine.string().trim().maxLength(1000).optional(),
  })
)
