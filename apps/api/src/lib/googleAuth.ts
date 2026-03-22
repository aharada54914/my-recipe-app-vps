import { google } from 'googleapis'
import { prisma } from '../db/client.js'
import { normalizeUserPreferences } from './userPreferences.js'

const GOOGLE_TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000

type GoogleProfile = {
  id: string
  email: string
  name: string | null
  picture?: string | null
}

type StoredGoogleUser = {
  id: string
  email: string
  name: string | null
  googleAccessToken: string | null
  googleAccessTokenExpiresAt: Date | null
  googleRefreshToken: string | null
  preferences: unknown
}

export type GoogleConnectionState = {
  hasGoogleAccessToken: boolean
  hasRefreshToken: boolean
  accessTokenExpiresAt?: string
  canRefresh: boolean
  familyCalendarConfigured: boolean
}

function getStrictOAuth2Client() {
  const clientId = process.env['GOOGLE_CLIENT_ID']
  const clientSecret = process.env['GOOGLE_CLIENT_SECRET']
  const redirectUri = process.env['GOOGLE_REDIRECT_URI']

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error('Google OAuth environment variables are not configured')
  }

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri)
}

export function buildLooseOAuth2Client() {
  const clientId = process.env['GOOGLE_CLIENT_ID']
  const clientSecret = process.env['GOOGLE_CLIENT_SECRET']
  const redirectUri = process.env['GOOGLE_REDIRECT_URI']

  return clientId && clientSecret && redirectUri
    ? new google.auth.OAuth2(clientId, clientSecret, redirectUri)
    : new google.auth.OAuth2()
}

export async function exchangeGoogleCodeForTokens(code: string) {
  const oauth2Client = getStrictOAuth2Client()
  const { tokens } = await oauth2Client.getToken(code)
  return tokens
}

export async function getGoogleProfileFromAccessToken(accessToken: string): Promise<GoogleProfile> {
  const oauth2Client = new google.auth.OAuth2()
  oauth2Client.setCredentials({ access_token: accessToken })

  const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client })
  const { data: userInfo } = await oauth2.userinfo.get()

  if (!userInfo.id || !userInfo.email) {
    throw new Error('Failed to retrieve user information from Google')
  }

  return {
    id: userInfo.id,
    email: userInfo.email,
    name: userInfo.name ?? null,
    picture: userInfo.picture ?? null,
  }
}

function toExpiryDate(input: { expiresIn?: number; expiryDate?: number | null }): Date | undefined {
  if (typeof input.expiryDate === 'number' && Number.isFinite(input.expiryDate)) {
    return new Date(input.expiryDate)
  }
  if (typeof input.expiresIn === 'number' && Number.isFinite(input.expiresIn) && input.expiresIn > 0) {
    return new Date(Date.now() + input.expiresIn * 1000)
  }
  return undefined
}

export async function upsertGoogleUserSession(input: {
  profile: GoogleProfile
  accessToken?: string
  refreshToken?: string
  expiresIn?: number
  expiryDate?: number | null
}) {
  const { profile, accessToken, refreshToken, expiresIn, expiryDate } = input
  const accessTokenExpiresAt = toExpiryDate({ expiresIn, expiryDate })

  return prisma.user.upsert({
    where: { id: profile.id },
    update: {
      email: profile.email,
      name: profile.name ?? undefined,
      googleAccessToken: accessToken ?? undefined,
      googleRefreshToken: refreshToken ?? undefined,
      googleAccessTokenExpiresAt: accessTokenExpiresAt,
    },
    create: {
      id: profile.id,
      email: profile.email,
      name: profile.name ?? undefined,
      googleAccessToken: accessToken ?? undefined,
      googleRefreshToken: refreshToken ?? undefined,
      googleAccessTokenExpiresAt: accessTokenExpiresAt,
    },
  })
}

export function buildGoogleConnectionState(user: {
  googleAccessToken: string | null
  googleAccessTokenExpiresAt?: Date | null
  googleRefreshToken: string | null
  preferences: unknown
}): GoogleConnectionState {
  const preferences = normalizeUserPreferences(user.preferences)
  return {
    hasGoogleAccessToken: Boolean(user.googleAccessToken),
    hasRefreshToken: Boolean(user.googleRefreshToken),
    ...(user.googleAccessTokenExpiresAt
      ? { accessTokenExpiresAt: user.googleAccessTokenExpiresAt.toISOString() }
      : {}),
    canRefresh: Boolean(user.googleRefreshToken),
    familyCalendarConfigured: Boolean(preferences.familyCalendarId?.trim()),
  }
}

function isTokenStillUsable(expiresAt: Date | null | undefined): boolean {
  if (!expiresAt) return false
  return expiresAt.getTime() - Date.now() > GOOGLE_TOKEN_REFRESH_BUFFER_MS
}

export async function loadStoredGoogleUser(userId: string): Promise<StoredGoogleUser | null> {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      googleAccessToken: true,
      googleAccessTokenExpiresAt: true,
      googleRefreshToken: true,
      preferences: true,
    },
  })
}

export async function ensureFreshGoogleAccessTokenForUser(userId: string): Promise<{
  userId: string
  accessToken: string
  accessTokenExpiresAt?: string
  connection: GoogleConnectionState
}> {
  const user = await loadStoredGoogleUser(userId)
  if (!user) {
    throw new Error('User not found')
  }

  if (user.googleAccessToken && isTokenStillUsable(user.googleAccessTokenExpiresAt)) {
    return {
      userId: user.id,
      accessToken: user.googleAccessToken,
      ...(user.googleAccessTokenExpiresAt
        ? { accessTokenExpiresAt: user.googleAccessTokenExpiresAt.toISOString() }
        : {}),
      connection: buildGoogleConnectionState(user),
    }
  }

  if (!user.googleRefreshToken) {
    throw new Error('Google token has expired and no refresh token is available. Please sign in again.')
  }

  const oauth2Client = getStrictOAuth2Client()
  oauth2Client.setCredentials({
    refresh_token: user.googleRefreshToken,
  })

  const refreshed = await oauth2Client.refreshAccessToken()
  const credentials = refreshed.credentials
  const nextAccessToken = credentials.access_token
  if (!nextAccessToken) {
    throw new Error('Failed to refresh Google access token.')
  }

  const updatedUser = await prisma.user.update({
    where: { id: user.id },
    data: {
      googleAccessToken: nextAccessToken,
      googleRefreshToken: credentials.refresh_token ?? user.googleRefreshToken,
      googleAccessTokenExpiresAt: toExpiryDate({ expiryDate: credentials.expiry_date }) ?? null,
    },
    select: {
      id: true,
      email: true,
      name: true,
      googleAccessToken: true,
      googleAccessTokenExpiresAt: true,
      googleRefreshToken: true,
      preferences: true,
    },
  })

  return {
    userId: updatedUser.id,
    accessToken: updatedUser.googleAccessToken ?? nextAccessToken,
    ...(updatedUser.googleAccessTokenExpiresAt
      ? { accessTokenExpiresAt: updatedUser.googleAccessTokenExpiresAt.toISOString() }
      : {}),
    connection: buildGoogleConnectionState(updatedUser),
  }
}
