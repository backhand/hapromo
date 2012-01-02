/**
 * Monitors the statistics from a haproxy instance, and emits event at predefined
 * alerts
 * 
 */

var http    = require('http');
var request = require('request');
var sys     = require('sys');
var events  = require('events');

/*
 * 
 * Lifecycle:
 * 
 * Every <interval> seconds: Fetch statistics data (csv) Run filters Handle
 * filter results
 * 
 */

var Hapromo = module.exports = function(conf) {
  
  // Config object
  this.conf = conf;
  
  // Keep track of stot - for detecting proxy instance reloads
  this.totalSessions = 0;
  
  this.quiet = true;
  
  // Event conditions
  this.filters = new Array(
     { criteria : [
         { header : 'svname', op : 'ne', value : 'BACKEND' },
         { header : 'svname', op : 'ne', value : 'FRONTEND' },
         { header : 'check_status', op : 'eq', value : 'L4OK' }
       ], event : 'server_ok' },
     { criteria : [
         { header : 'svname', op : 'ne', value : 'BACKEND' },
         { header : 'svname', op : 'ne', value : 'FRONTEND' },
         { header : 'check_status', op : 'ne', value : 'L4OK' }
       ], event : 'server_down' },
     { criteria : [
         { header : 'svname', op : 'eq', value : 'FRONTEND' },
         { header : 'stot', op : 'lt', value : function(data) { return this.totalSessions; } },
       ], event : 'proxy_restart' }
   );
};
sys.inherits(Hapromo, events.EventEmitter);

/**
 * addFilter
 * 
 * @param definition Filter definition containing properties:
 *  criteria : array of { header : <headername>, op : <lt|lte|eq|ne|gt|gte>, value : <int|string> }
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
  request(url, function (error, response, body) {
    cb.call(self, error, error ? response.statusCode : body);
  });
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
      // Headers - should be first line, so after this we'll assume headers is
      // defined
      headers = lines[i].substring(2).split(',');
    } else {
      var data = lines[i].split(',');
      var section = data[0];
      var svname  = data[1];
      
      // Init object
      if(null == stats[section]) stats[section] = {};
      stats[section][svname] = {};

      // Fill in pairs of key from headers, value from data
      var rawStats = {};
      for(var j = 0, dataLen = data.length; j < dataLen; j++) {
        if(j >= 2)
          stats[section][svname][headers[j]] = data[j];
        
        rawStats[headers[j]] = data[j];
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
    var parsedStats = this.parseStats(data);
    
    // Apply filters - loop through all response lines
    for(var i in parsedStats.raw) {
      var row = parsedStats.raw[i];
      
      // Iterate through all filters
      for(var f in this.filters) {
        var filter = this.filters[f];
        var passed = true;
        this.log('Applying filter: %s', filter.event);
        
        // ... and each criteria in filter
        for(var c in filter.criteria) {
          var criteria = filter.criteria[c];
          var header   = criteria.header;
          var value    = typeof(criteria.value) == 'function' ? criteria.value.call(this, row) : criteria.value;
          
          this.log('\tCriteria: %s %s %s', header, criteria.op, value);
          this.log('\tData: %s %s %s', row[header], criteria.op, value);
          
          // Do compare operation
          switch(criteria.op) {
            case 'lt'  : passed = row[header]  <  value; break;
            case 'lte' : passed = row[header]  <= value; break;
            case 'eq'  : passed = row[header] === value; break;
            case 'ne'  : passed = row[header] !== value; break;
            case 'gt'  : passed = row[header]  >  value; break;
            case 'gte' : passed = row[header]  >= value; break;
            default    : passed = false; break;
          }
          
          this.log('\tPassed: %s', passed);
          
          // Drop out of loop, if any condition fails
          if(false == passed)
            break;
        }
        
        // Notify listeners
        if(passed) {
          if(null != filter.event)
            this.emit(filter.event, row);
          if(null != filter.handler && typeof filter.handler == 'function')
            filter.handler.call(this, row);
        }
      }
    }
    
    // Update total sessions
    this.totalSessions = parsedStats.map['http-in']['FRONTEND']['stot'];
    
    // Emit update event
    this.emit('update', parsedStats);
    
    var self = this;
    setTimeout(function() { self.run(); }, this.conf.interval);
  });
};

Hapromo.prototype.log = function(msg, arg1, arg2, arg3, arg4, arg5, arg6, arg7, arg8, arg9, arg10) {
  
  if(!this.quiet)
    console.log(msg, arg1, arg2, arg3, arg4, arg5, arg6, arg7, arg8, arg9, arg10);
};