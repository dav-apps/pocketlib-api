import { afterAll, afterEach } from "vitest"
import nock from "nock"

// Never load the developer's .env. Unexpected external HTTP calls fail tests.
process.env.ENV = "test"
process.env.CACHING = "false"
// Dummy credentials allow the real DAV Auth value object to construct its token.
process.env.DAV_API_KEY = "test-api-key"
process.env.DAV_SECRET_KEY = "test-secret"
process.env.DAV_UUID = "00000000-0000-4000-8000-000000000042"
nock.disableNetConnect()
nock.enableNetConnect(/^(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/)

afterEach(() => nock.cleanAll())
afterAll(() => nock.enableNetConnect())
