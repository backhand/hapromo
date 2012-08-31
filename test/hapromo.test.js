var fs = require('fs');
var Hapromo = require('..');
var assert = require('assert');

var testReply = fs.readFileSync('test/lbstats.csv','UTF-8');

var hapromo = new Hapromo({
  user : 'user',
  pass : 'pass',
  host : 'someaddress.com',
  path : '/lbstats;csv',
  interval : 5000
});

exports.testParsing = function(test) {
  var parsedReply = hapromo.parseStats(testReply);
  test.equal(parsedReply.map['blog-servers']['blog2'].qcur,0);
  test.equal(parsedReply.map['http-in']['FRONTEND'].qmax,'');
  test.equal(parsedReply.map['http-in']['FRONTEND'].scur,6);
  test.equal(parsedReply.map['http-in']['FRONTEND'].smax,150);
  test.equal(parsedReply.map['http-in']['FRONTEND'].slim,15000);
  test.equal(parsedReply.map['http-in']['FRONTEND'].stot,1162881);
  test.equal(parsedReply.map['http-in']['FRONTEND'].bin,500121285);
  test.equal(parsedReply.map['http-in']['FRONTEND'].bout,12528836701);
  test.equal(parsedReply.map['http-in']['FRONTEND'].dreq,0);
  test.equal(parsedReply.map['http-in']['FRONTEND'].dresp,0);
  test.equal(parsedReply.map['http-in']['FRONTEND'].ereq,108117);
  test.equal(parsedReply.map['http-in']['FRONTEND'].econ,'');
  test.equal(parsedReply.map['http-in']['FRONTEND'].eresp,'');
  test.equal(parsedReply.map['http-in']['FRONTEND'].wretr,'');
  test.equal(parsedReply.map['http-in']['FRONTEND'].wredis,'');
  test.equal(parsedReply.map['http-in']['FRONTEND'].status,'OPEN');
  test.equal(parsedReply.map['http-in']['FRONTEND'].weight,'');
  test.equal(parsedReply.map['http-in']['FRONTEND'].act,'');
  test.equal(parsedReply.map['http-in']['FRONTEND'].bck,'');
  test.equal(parsedReply.map['http-in']['FRONTEND'].chkfail,'');
  test.equal(parsedReply.map['http-in']['FRONTEND'].chkdown,'');
  test.equal(parsedReply.map['http-in']['FRONTEND'].lastchg,'');
  test.equal(parsedReply.map['http-in']['FRONTEND'].downtime,'');
  test.equal(parsedReply.map['http-in']['FRONTEND'].qlimit,'');
  test.equal(parsedReply.map['http-in']['FRONTEND'].pid,1);
  test.equal(parsedReply.map['http-in']['FRONTEND'].iid,1);
  test.equal(parsedReply.map['http-in']['FRONTEND'].sid,0);
  test.equal(parsedReply.map['http-in']['FRONTEND'].throttle,'');
  test.equal(parsedReply.map['http-in']['FRONTEND'].lbtot,'');
  test.equal(parsedReply.map['http-in']['FRONTEND'].tracked,'');
  test.equal(parsedReply.map['http-in']['FRONTEND'].type,0);
  test.equal(parsedReply.map['http-in']['FRONTEND'].rate,13);
  test.equal(parsedReply.map['http-in']['FRONTEND'].rate_lim,0);
  test.equal(parsedReply.map['http-in']['FRONTEND'].rate_max,112);
  test.equal(parsedReply.map['http-in']['FRONTEND'].check_status,'');
  test.equal(parsedReply.map['http-in']['FRONTEND'].check_code,'');
  test.equal(parsedReply.map['http-in']['FRONTEND'].check_duration,'');
  test.equal(parsedReply.map['http-in']['FRONTEND'].hrsp_1xx,0);
  test.equal(parsedReply.map['http-in']['FRONTEND'].hrsp_2xx,916509);
  test.equal(parsedReply.map['http-in']['FRONTEND'].hrsp_3xx,35298);
  test.equal(parsedReply.map['http-in']['FRONTEND'].hrsp_4xx,205898);
  test.equal(parsedReply.map['http-in']['FRONTEND'].hrsp_5xx,4092);
  test.equal(parsedReply.map['http-in']['FRONTEND'].hrsp_other,1078);
  test.equal(parsedReply.map['http-in']['FRONTEND'].hanafail,'');
  test.equal(parsedReply.map['http-in']['FRONTEND'].req_rate,13);
  test.equal(parsedReply.map['http-in']['FRONTEND'].req_rate_max,106);
  test.equal(parsedReply.map['http-in']['FRONTEND'].req_tot,1162879);
  test.equal(parsedReply.map['http-in']['FRONTEND'].cli_abrt,'');
  test.equal(parsedReply.map['http-in']['FRONTEND'].srv_abrt,'');
  test.done();
};