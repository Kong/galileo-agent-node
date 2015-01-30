var helpers = require('../lib/helpers');
var fixture = require('./fixture.json');

require('should');

describe('Helpers', function () {
  it('parses a header message into an object', function () {
    var data = helpers.parseResponseHeaderString(fixture.headers.join('\r\n'));

    data.should.have.property('status').and.equal(200);
    data.should.have.property('statusText').and.equal('OK');
    data.should.have.property('version').and.equal('HTTP/1.1');
    data.should.have.property('headersArr').and.be.an.Array;
    data.should.have.property('headersObj').and.be.an.Object;

    data.headersObj.should.have.property('Content-Type').and.equal('application/json; charset=utf-8');

    data.headersArr.should.containEql({
      name: 'Content-Type',
      value: 'application/json; charset=utf-8'
    });
  });

  it('fails at parsing invalid header message into an object', function () {
    var headers = helpers.parseResponseHeaderString(null);

    headers.should.have.property('statusText').and.equal('');
    headers.should.have.property('version').and.equal('HTTP/1.1');
    headers.should.not.have.property('status');
    headers.should.not.have.property('headersArr');
    headers.should.not.have.property('headersObj');
  });

  it('converts an object to a name:value pair array', function () {
    helpers.objectToArray({foo: 'bar'}).should.be.an.Array.and.containEql({
      name: 'foo',
      value: 'bar'
    });
  });

  it('grabs header value regardless of case, with default fallback', function () {
    var data = helpers.parseResponseHeaderString(fixture.headers.join('\r\n'));

    helpers.getHeaderValue(data.headersArr, 'content-length', false).should.be.a.String.and.equal('144');
    helpers.getHeaderValue(null, 'foo', -1).should.be.a.Number.and.equal(-1);
    helpers.getHeaderValue([], 'foo', -1).should.be.a.Number.and.equal(-1);
    helpers.getHeaderValue({}, 'foo', -1).should.be.a.Number.and.equal(-1);
  });

  it('measures header message byte size', function () {
    var data = helpers.parseResponseHeaderString(fixture.headers.join('\r\n'));

    helpers.getReqHeaderSize({headers: data.headersObj }).should.be.a.Number.and.equal(675);
  });
});
