HAProxy monitor library
=======================

[![Build Status](https://secure.travis-ci.org/backhand/hapromo.png?branch=master)](https://travis-ci.org/backhand/hapromo)

Usage:
------

    require('hapromo');

    var hapromo = new Hapromo({  
      user : 'username',  
      pass : 'password',  
      host : 'somehost.com',  
      path : '/pathtostats;csv',  
      interval : 5000  
    });  

    hapromo.on(server_event, function(data) {  
    	// Handle event  
    });  

Installation:
------------------------
npm install hapromo

List of built-in events:
------------------------
server_up  
server_down  
error  
update  

Creating a custom filter with a handler function:
-------------------------------------------------
    hapromo.addFilter({ criteria : [  
        { header : 'svname', op : 'ne', value : 'FRONTEND' },  
        { header : 'svname', op : 'ne', value : 'BACKEND' },  
        { header : 'scur', op : 'gt', value : function(data) { return 0.70 * data.slim; } }  
      ], handler : function(data) {  
        	console.log('High load on server %s!', data.svname);  
        	// Handle it  
    	}  
    });  

Same, but register as event instead:
------------------------------------
    hapromo.addFilter({ criteria : [  
        { header : 'svname', op : 'ne', value : 'FRONTEND' },  
        { header : 'svname', op : 'ne', value : 'BACKEND' },  
        { header : 'scur', op : 'gt', value : function(data) { return 0.70 * data.slim; } }  
      ], event : 'high_load'  
    });
 
