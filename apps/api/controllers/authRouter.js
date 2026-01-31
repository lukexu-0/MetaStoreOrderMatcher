import express from 'express'
import * as oidc from 'openid-client'
import {
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  BACKEND_URL,
  FRONTEND_URL
} from '../utils/config.js'
import { syncGmailOrderEmails } from '../db/gmailOrders.js'
import { upsertUser } from '../db/users.js'

const authRouter = express.Router()
const REDIRECT_URI = `${BACKEND_URL}/auth/google/callback`

// console.log("GOOGLE_CLIENT_ID:", GOOGLE_CLIENT_ID);
// console.log("GOOGLE_CLIENT_SECRET exists:", Boolean(GOOGLE_CLIENT_SECRET));


const config = await oidc.discovery(
  new URL('https://accounts.google.com'),
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET
)

authRouter.get('/google', async (request, response, next) => {
  try {
    const code_verifier = oidc.randomPKCECodeVerifier()
    const code_challenge = await oidc.calculatePKCECodeChallenge(code_verifier)

    const state = oidc.randomState()
    const nonce = oidc.randomNonce()

    request.session.pkceVerifier = code_verifier
    request.session.oauthState = state
    request.session.oauthNonce = nonce

    const params = {
      redirect_uri: REDIRECT_URI,
      scope: 'openid email profile https://www.googleapis.com/auth/gmail.readonly',
      code_challenge,
      code_challenge_method: "S256",
      state,
      nonce,
      
      access_type: 'offline',
      prompt: 'consent'
    }
    
    const authUrl = oidc.buildAuthorizationUrl(config, params)
    response.redirect(authUrl.href)
  } catch (error) {
    next(error)
  }
})

authRouter.get('/google/callback', async (request, response, next) => {
  try {
    if (!request.session.pkceVerifier || !request.session.oauthState) {
      return response.status(400).send("Missing session state (cookie not set?)");
    }


    const currentUrl = new URL(`${BACKEND_URL}${request.originalUrl}`)

    const tokens = await oidc.authorizationCodeGrant(config, currentUrl, {
      pkceCodeVerifier: request.session.pkceVerifier,
      expectedState: request.session.oauthState,
      expectedNonce: request.session.oauthNonce
    })

    request.session.google = {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,     
      expiresAt: tokens.expires_at,
      scope: tokens.scope,
    }

    delete request.session.pkceVerifier
    delete request.session.oauthState
    delete request.session.oauthNonce;

    const idTokenClaims = tokens.claims()
    const claims = await oidc.fetchUserInfo(config, tokens.access_token, idTokenClaims.sub)

    request.session.user = {
      id: claims.sub,
      email: claims.email,
      name: claims.name,
      picture: claims.picture
    }

    try {
      await upsertUser({
        id: request.session.user.id,
        email: request.session.user.email,
        name: request.session.user.name,
        picture: request.session.user.picture
      })
    } catch (error) {
      console.error('Failed to upsert user', error)
    }

    try {
      const syncResult = await syncGmailOrderEmails({
        userId: request.session.user.id,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: tokens.expires_at
      })
      if (syncResult.refreshed) {
        request.session.google.accessToken = syncResult.accessToken
        request.session.google.expiresAt = syncResult.expiresAt
      }
    } catch (error) {
      console.error('Failed to sync Gmail order emails', error)
    }

    response.redirect(`${FRONTEND_URL}/home`)
  } catch (error) {
    next(error)
  }
})

authRouter.post('/logout', (request, response) => {
  request.session.destroy((error) => {
    if (error){
      response.status(500).json({error: 'logout failed'})
    }
    response.status(204).end()
  })
})

export default authRouter
