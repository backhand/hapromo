var Hapromo    = require('./hapromo');

// Hapromo config
var conf = {
  user : 'username',
  pass : 'password',
  host : 'somehost.com',
  path : '/pathtostats;csv',
  interval : 5000
};

var hapromo = new Hapromo(conf);

/* Setup events
 *
 * The parameter to the callback function is an object with 
 * properties map and raw.
 * 
 */
hapromo.on('server_ok', function(data) {
  // Could be used to determine that a server was back up
  // and then send a notification
});

hapromo.on('server_down', function(data) {
  // Server is down, do something
});

hapromo.on('error', function(err) {
  // Handle it?
});

hapromo.on('update', function(data) {
  // Do something
});

/*
 * Example of a filter
 * 
 * This checks that:
 * servername is not FRONTEND nor BACKEND
 * current sessions are greater than 70% of the max
 */
hapromo.addFilter({ criteria : [
    { header : 'svname', op : 'ne', value : 'FRONTEND' },
    { header : 'svname', op : 'ne', value : 'BACKEND' },
    { header : 'scur', op : 'gt', value : function(data) { return 0.70 * data.slim; } }
  ], handler : function(data) {
    console.log('High load on server %s!', data.svname);
    // Handle it
}});