var har = require('../lib/har');

describe('HAR', function() {
  it.skip('should convert express 4 req, res to HAR', function() {
    var now = new Date();
    //var event = har(req, res, now);

    // TODO validate HAR
    // event.should.have.property('version').and.equal(1.2); // HAR 1.2
    // event.should.have.property('creator')
    // event.creator.should.have.property('name').and.equal(package.name);
    // event.creator.should.have.property('version').and.equal(package.version);

    // event.should.have.property('request');
    // event.request.should.have.property('receivedAt').and.be.a.Number;
    // event.request.should.have.property('method').and.equal('GET');
    // event.request.should.have.a.property('protocol').and.equal('http');
    // event.request.should.have.a.property('path').and.equal('/');
    // event.request.should.have.property('queries');
    // event.request.should.have.property('headers');
    // event.request.headers.should.have.a.property('host').and.match(/127.0.0.1/);

    // event.should.have.property('response');
    // event.response.should.have.property('receivedAt').and.be.a.Number;
    // event.response.should.have.property('status').and.equal(200);

    // event.response.should.have.property('headers');
    // event.response.headers.should.have.property('content-type').and.match(/html/);

  });
})
