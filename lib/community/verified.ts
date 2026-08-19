export function isVerifiedTellwiseUser(userId: string) {
  const ownerId = process.env.STORYTUNER_OWNER_USER_ID?.trim()
  return Boolean(ownerId && userId === ownerId)
}
