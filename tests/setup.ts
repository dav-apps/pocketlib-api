import { afterAll, afterEach } from "vitest"
import nock from "nock"

// Never load the developer's .env. Unexpected external HTTP calls fail tests.
process.env.ENV = "test"
process.env.CACHING = "false"
nock.disableNetConnect()
nock.enableNetConnect(/^(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/)

afterEach(() => nock.cleanAll())
afterAll(() => nock.enableNetConnect())
