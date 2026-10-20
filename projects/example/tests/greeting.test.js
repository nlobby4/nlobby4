import assert from 'node:assert/strict'
import test from 'node:test'
import { greeting } from '../src/greeting.js'

test('greeting is deterministic', () => {
    assert.equal(greeting('organization'), 'Hello, organization')
})
