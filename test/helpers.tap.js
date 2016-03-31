'use strict'

var tap = require('tap')
var _ = require('lodash')

var fixture = require('./fixture')
var fixtureNetwork = require('./fixture-network')
var helpers = require('../lib/helpers')

var mockOS = {
  networkInterfaces: function () {
    return fixtureNetwork
  }
}

tap.test('Helpers', function (t) {
  tap.test('parses a header message into an object', function (t) {
    var data = helpers.parseResponseHeaderString(fixture.headers.join('\r\n'))
    t.equal(data.status, 200)
    t.equal(data.statusText, 'OK')
    t.equal(data.version, 'HTTP/1.1')
    t.ok(_.isArray(data.headersArr))
    t.ok(_.isObject(data.headersObj))
    t.equal(data.headersObj['Content-Type'], 'application/json; charset=utf-8')
    t.equal(_.filter(data.headersArr, {name: 'Content-Type'})[0].value, 'application/json; charset=utf-8')
    t.end()
  })
  tap.test('fails at parsing invalid header message into an object', function (t) {
    var headers = helpers.parseResponseHeaderString(null)
    t.equal(headers.status, undefined)
    t.equal(headers.statusText, '')
    t.equal(headers.version, 'HTTP/1.1')
    t.equal(headers.headersArr, undefined)
    t.equal(headers.headersObj, undefined)
    t.end()
  })
  tap.test('converts an object to a name:value pair array', function (t) {
    var data = helpers.objectToArray({foo: 'bar'})
    t.deepEqual(data, [{name: 'foo', value: 'bar'}])
    t.end()
  })
  tap.test('returns empty array on non-object input', function (t) {
    var data = helpers.objectToArray(27)
    t.deepEqual(data, [])
    t.end()
  })
  tap.test('returns multiple entries for array sub-objects', function (t) {
    var data = helpers.objectToArray({foo: ['a', 'b', 'c']})
    t.deepEqual(data, [{name: 'foo', value: 'a'}, {name: 'foo', value: 'b'}, {name: 'foo', value: 'c'}])
    t.end()
  })
  tap.test('grabs header value regardless of case, with default fallback', function (t) {
    var data = helpers.parseResponseHeaderString(fixture.headers.join('\r\n'))
    t.equal(helpers.getHeaderValue(data.headersArr, 'content-length', false), '144')
    t.equal(helpers.getHeaderValue(null, 'foo', -1), -1)
    t.equal(helpers.getHeaderValue([], 'foo', -1), -1)
    t.equal(helpers.getHeaderValue({}, 'foo', -1), -1)
    t.equal(helpers.getHeaderValue({}, 'foo'), false)
    t.end()
  })
  tap.test('measures header message byte size', function (t) {
    var data = helpers.parseResponseHeaderString(fixture.headers.join('\r\n'))
    t.equal(helpers.getReqHeaderSize({headers: data.headersObj }), 675)
    t.end()
  })
  tap.test('should create a new array with only unique values', function (t) {
    var data = helpers.uniq([1, 1, 5, 4, 'this', 'this', 'that'])
    t.deepEqual(data, [1, 5, 4, 'this', 'that'])
    t.end()
  })
  tap.test('should get server address from network interfaces', function (t) {
    var data = helpers.getServerAddress(mockOS)
    t.equal(data, '10.3.22.176')
    t.end()
  })
  tap.test('should get client address from forwarded header', function (t) {
    var fwdHdrFixture = _.cloneDeep(fixture)
    fwdHdrFixture.headers.forwarded = '255.255.255.255'
    var data = helpers.getClientAddress(fwdHdrFixture)
    t.equal(data, '255.255.255.255')
    t.end()
  })
  tap.test('should get client address from connection.remoteAddress', function (t) {
    var cnnRmtFixture = _.cloneDeep(fixture)
    cnnRmtFixture.connection = {
      remoteAddress: '255.255.255.255'
    }
    var data = helpers.getClientAddress(cnnRmtFixture)
    t.equal(data, '255.255.255.255')
    t.end()
  })
  tap.test('should get client address from connection.socket.remoteAddress', function (t) {
    var cnnSktRmtFixture = _.cloneDeep(fixture)
    cnnSktRmtFixture.connection = {
      socket: {
        remoteAddress: '255.255.255.255'
      }
    }
    var data = helpers.getClientAddress(cnnSktRmtFixture)
    t.equal(data, '255.255.255.255')
    t.end()
  })
  tap.test('should get client address from socket.remoteAddress', function (t) {
    var sktRmtFicture = _.cloneDeep(fixture)
    sktRmtFicture.socket = {
      remoteAddress: '255.255.255.255'
    }
    var data = helpers.getClientAddress(sktRmtFicture)
    t.equal(data, '255.255.255.255')
    t.end()
  })
  tap.test('should default client address to empty string', function (t) {
    var data = helpers.getClientAddress(fixture)
    t.equal(data, '')
    t.end()
  })
  t.end()
})
