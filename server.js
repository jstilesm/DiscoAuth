import Fastify from 'fastify'
import fastifyOauth2 from '@fastify/oauth2'
import fastifyCookie from '@fastify/cookie'
import fastifyHttpProxy from '@fastify/http-proxy'
import fastifySession from '@fastify/session'
import { Socks5ProxyAgent } from 'undici';


const fastify = Fastify({
  logger: true
})
const socksDispatcher = process.env.ALL_PROXY ? new Socks5ProxyAgent('socks5h://batchmate-tailnet-proxy:1055') : undefined


// Declare a route
fastify.get('/', function (request, reply) {
  reply.send({ hello: 'world' })
})

// Run the server!
fastify.listen({ host: '0.0.0.0', port: 3000 }, function (err, address) {
  if (err) {
    fastify.log.error(err)
    process.exit(1)
  }
  // Server is now listening on ${address}
})

fastify.register(fastifyCookie);
fastify.register(fastifySession, {
    secret: process.env.SESSION_SECRET,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        sameSite: 'lax'
    },
})


fastify.register(fastifyOauth2, {
  name: 'batchmateOAuth2',
  credentials: {
    client: {
      id: process.env.OAUTH_ID,
      secret: process.env.OAUTH_SECRET
    },
    auth: { tokenHost: 'https://batchmate.id', tokenPath: '/oauth/token', 
            authorizeHost: 'https://batchmate.id', authorizePath: '/oauth/authorize'}
  },
  // register a fastify url to start the redirect flow to the service provider's OAuth2 login
  startRedirectPath: '/login',
  // service provider redirects here after user login
  callbackUri: process.env.SESSION_URL
  // You can also define callbackUri as a function that takes a FastifyRequest and returns a string
  // callbackUri: req => `${req.protocol}://${req.hostname}/login/facebook/callback`,
})

// The service provider redirect the user here after successful login
fastify.get('/login/callback', async function (request, reply) {
  const { token } = await this.batchmateOAuth2.getAccessTokenFromAuthorizationCodeFlow(request, reply)

  request.session.authenticated = true
  request.session.accessToken = token.access_token

  // if later need to refresh the token this can be used
  // const { token: newToken } = await this.getNewAccessTokenUsingRefreshToken(token)

  return reply.redirect('/')
})

fastify.register(function protectedProxyScope(instance) {
    // Enforce session check on all routes inside this scope
    instance.addHook('preHandler', async (request, reply) => {
        if (!request.session.authenticated) {
            return reply.code(401).send({error: 'Unauthorized'});
        }
    })
    instance.register(fastifyHttpProxy, {
        upstream: 'http://plotpi.ts.batchmate.cloud:8889/cam',
        prefix: '/cam',
        undici: socksDispatcher
    })
});
