import { prisma } from '../../db/client.js'

interface EnsureDiscordAppUserInput {
  discordUserId: string
  guildId: string
}

function buildSyntheticUserId(input: EnsureDiscordAppUserInput): string {
  return `discord:${input.guildId}:${input.discordUserId}`
}

function buildSyntheticEmail(input: EnsureDiscordAppUserInput): string {
  return `${input.discordUserId}@discord.local`
}

export async function ensureDiscordAppUser(input: EnsureDiscordAppUserInput): Promise<{
  userId: string
}> {
  const existingLink = await prisma.discordUserLink.findUnique({
    where: {
      discordUserId: input.discordUserId,
    },
    select: { id: true, userId: true, guildId: true },
  })

  if (existingLink) {
    if (existingLink.guildId !== input.guildId) {
      await prisma.discordUserLink.update({
        where: { id: existingLink.id },
        data: { guildId: input.guildId },
      })
    }
    return { userId: existingLink.userId }
  }

  const userId = buildSyntheticUserId(input)
  const email = buildSyntheticEmail(input)

  await prisma.user.upsert({
    where: { id: userId },
    update: {},
    create: {
      id: userId,
      email,
      name: `Discord ${input.discordUserId.slice(-4)}`,
      preferences: {},
    },
  })

  await prisma.discordUserLink.create({
    data: {
      discordUserId: input.discordUserId,
      guildId: input.guildId,
      userId,
    },
  })

  return { userId }
}
