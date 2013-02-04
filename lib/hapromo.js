/**
 * Monitors the statistics from a haproxy instance, and emits event at predefined
 * alerts
 * 
 */

var http    = require('http');
var request = require('request');
var util    = require('util');
var events  = require('events');

/*
 * Haproxy check_status values

UNK     -> unknown
INI     -> initializing
SOCKERR -> socket error
L4OK    -> check passed on layer 4, no upper layers testing enabled
L4TMOUT -> layer 1-4 timeout
L4CON   -> layer 1-4 connection problem, for example "Connection refused" (tcp rst) or "No route to host" (icmp)
L6OK    -> check passed on layer 6
L6TOUT  -> layer 6 (SSL) timeout
L6RSP   -> layer 6 invalid response - protocol error
L7OK    -> check passed on layer 7
L7OKC   -> check conditionally passed on layer 7, for example 404 with disable-on-404
L7TOUT  -> layer 7 (HTTP/SMTP) timeout
L7RSP   -> layer 7 invalid response - protocol error
L7STS   -> layer 7 response error, for example HTTP 5xx
*/

/*
 * 
 * Lifecycle:
 * 
 * Every <interval> seconds: 
 *  Fetch statistics data (csv) 
 *  Run filters
 *  Handle filter callbacks/Emit events
 * 
 */

var Hapromo = module.exports = function(conf) {
  
  // Config object
  this.conf = conf;
  
  // Name of main frontend - for detecting proxy instance reloads
  this.mainFrontendName = typeof this.conf.frontend !== 'undefined' ? this.conf.frontend : null;
  
  // Keep track of stot - for detecting proxy instance reloads
  this.totalSessions = 0;
  
  this.quiet = typeof this.conf.quiet !== 'undefined' ? this.conf.quiet : true;
  
  // Event conditions
  this.filters = new Array(
     { criteria : [
         { header : 'svname', op : 'ne', value : 'BACKEND' },
         { header : 'svname', op : 'ne', value : 'FRONTEND' },
         { header : 'check_status', op : 'in', value : ['L4OK','L6OK','L7OK','L7OKC','INI'] }
       ], event : 'server_ok' },
     { criteria : [
         { header : 'svname', op : 'ne', value : 'BACKEND' },
         { header : 'svname', op : 'ne', value : 'FRONTEND' },
         { header : 'check_status', op : 'in', value : ['UNK','SOCKERR','L4TMOUT','L4CON','L6TOUT','L6RSP','L7TOUT','L7RSP','L7STS'] },
       ], event : 'server_down' },
     { criteria : [
         { header : 'svname', op : 'eq', value : 'FRONTEND' },
         { header : 'stot', op : 'lt', value : function(data) { return this.totalSessions; } },
       ], event : 'proxy_restart' }
   );
};
util.inherits(Hapromo, events.EventEmitter);

/**
 * addFilter
 * 
 * @param definition Filter definition containing properties:
 *  criteria : array of { header : <headername>, op : <lt|lte|eq|ne|gt|gte>, value : <int|string|function> }
 *  event : <eventname to emit>
 *  handler : <function(data)>
 */
Hapromo.prototype.addFilter = function(definition) {
  this.filters.push(definition);
};

/**
 * getStats
 * 
 * Fetches stats from haproxy
 */
Hapromo.prototype.getStats = function(cb) {
  var url = 'http://' + this.conf.user + ':' + this.conf.pass + '@' + this.conf.host + this.conf.path;
  var self = this;
  //try {
    request(url, function (error, response, body) {
      cb.call(self, error, body);
    });
  /*} catch(error) {
    this.emit('error',error);
  }*/
};

/**
 * Parses CSV data from a Haproxy instance
 * 
 * @param input Haproxy CSV data
 * @returns object with properties raw (array of key/val pairs) and map (pxname => svname => keys/values) 
 */
Hapromo.prototype.parseStats = function(input) {
  // Return object
  var stats = {};
  var statsArray = new Array();
  
  var headers;
  var lines = input.split('\n');
  
  for(var i = 0, linesLen = lines.length; i < linesLen; i++) {
    
    // Skip empty lines
    if('' == lines[i]) continue; 
    
    // Handle line
    if(lines[i][0] == '#') {
      // Parse headers line
      headers = lines[i].substring(2).split(',');
    } else {
      
      // Check that headers is defined - they need to be at this point
      if(typeof headers == 'undefined') {
        return;
      }
      
      var data = lines[i].split(',');
      var section = data[0];
      var svname  = data[1];
      
      // Init object
      if(null == stats[section]) stats[section] = {};
      stats[section][svname] = {};

      // Fill in pairs of key from headers, value from data
      var rawStats = {};
      for(var j = 0, dataLen = data.length; j < dataLen; j++) {
        // Convert to integer if applicable
        var value = data[j].match(/^\d+$/) ? parseInt(data[j]) : data[j];
        
        if(j >= 2)
          stats[section][svname][headers[j]] = value;
        
        rawStats[headers[j]] = value;
      }
      
      // Add element to raw stats
      statsArray.push(rawStats);
    }
  }
    
  return { raw : statsArray, map : stats };
};

/**
 * 
 * Main loop function
 * 
 */
Hapromo.prototype.run = function() {
  this.getStats(function(err, data) {
    
    if(err) {
      this.emit('error', err);
      return;
    }
    
    var parsedStats = this.parseStats(data);
    
    // Check parsed data
    if(null == parsedStats) {
      this.emit('error', 'Parse error');
    } else {
      // Apply filters - loop through all response lines
      for(var i in parsedStats.raw) {
        var row = parsedStats.raw[i];
        
        // Iterate through all filters
        var passedFilters = this.applyFilters(row);
        
        // Notify listeners
        var self = this;
        passedFilters.forEach(function(filter) {
          if(null != filter.event)
            self.emit(filter.event, row);
          if(null != filter.handler && typeof filter.handler == 'function')
            filter.handler.call(this, row);
        });
      }
      
      // Update total sessions
      if(null !== this.mainFrontendName)
        this.totalSessions = parsedStats.map[this.mainFrontendName]['FRONTEND']['stot'];
      
      // Emit update event
      this.emit('update', parsedStats);
    }    
    
    var self = this;
    setTimeout(function() { self.run(); }, this.conf.interval);
  });
};

Hapromo.prototype.applyFilters = function(input) {
  
  var passedFilters = [];
  
  // Iterate through all filters, checking if they pass
  for(var f in this.filters) {
    var filter = this.filters[f];
    this.log('Applying filter: %s', typeof filter.event !== 'undefined' ? filter.event : "Callback filter");
    var passed = this.applyFilter(filter, input);
   
    // Add filter to filters passed if that is the case
    if(passed)
      passedFilters.push(filter);
  }
  
  return passedFilters;
};

Hapromo.prototype.applyFilter = function(filter, input) {
  this.log('Applying filter: %s', filter.event);
  
  // Check each criteria for whether it holds or not
  for(var c in filter.criteria) {
    var passed   = true;
    var criteria = filter.criteria[c];
    var header   = criteria.header;
    var value    = typeof(criteria.value) == 'function' ? criteria.value.call(this, input) : criteria.value;
    
    this.log('\tCriteria: %s %s %s', header, criteria.op, value);
    this.log('\tData: %s %s %s', input[header], criteria.op, value);
    
    // Do compare operation
    switch(criteria.op) {
      case 'lt'   : passed = input[header]  <  value; break;
      case 'lte'  : passed = input[header]  <= value; break;
      case 'eq'   : passed = input[header] === value; break;
      case 'ne'   : passed = input[header] !== value; break;
      case 'in'   : passed = value.indexOf(input[header]) !== -1; break;
      case 'nin'  : passed = value.indexOf(input[header]) === -1; break;
      case 'gt'   : passed = input[header]  >  value; break;
      case 'gte'  : passed = input[header]  >= value; break;
      default     : passed = false; break;
    }
    
    this.log('\tPassed: %s', passed);
    
    // Drop out of loop if any condition fails
    if(false == passed)
      return false;
  }
  
  return filter;
};

Hapromo.prototype.log = function() {
  
  if(!this.quiet)
    console.log.apply(this, arguments);
};