/*
	cache.js
	Copyright © 2009 - 2011  WOT Services Oy <info@mywot.com>

	This file is part of WOT.

	WOT is free software: you can redistribute it and/or modify it
	under the terms of the GNU General Public License as published by
	the Free Software Foundation, either version 3 of the License, or
	(at your option) any later version.

	WOT is distributed in the hope that it will be useful, but WITHOUT
	ANY WARRANTY; without even the implied warranty of MERCHANTABILITY
	or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public
	License for more details.

	You should have received a copy of the GNU General Public License
	along with WOT. If not, see <http://www.gnu.org/licenses/>.
*/

const timers = require("timers");

const constants = require("constants").constants;
const logger = require("logger");
const messaging = require("messaging");
const utils = require("utils");

(function(){

	var cache = {},
		flags = {},
		maxage = exports.maxage = 30 * 60 * 1000; /* 30min */

	var _this = this;

	var hasexpired = function(obj)
	{
		return ((Date.now() - obj.updated) > maxage);
	};

	var isok = function(name)
	{
		return ((get(name) || {}).status == constants.cachestatus.ok);
	};

	var setflags = function(name, newflags)
	{
		logger.log("- cache.setflags");
		try {
			flags[name] = flags[name] || {};
			utils.extend(flags[name], newflags || {});
		} catch (e) {
			logger.fail("cache.setflags: failed with ", e);
		}
	};

	var set = exports.set = function(name, status, value)
	{
		try {
			cache[name] = {
				updated: Date.now(),
				status: status || constants.cachestatus.error,
				value: value || {}
			};

			messaging.trigger("cache:set", [ name, cache[name]]);
			return true;
		} catch (e) {
			logger.fail("cache.set: failed with ", e);
		}

		return false;
	};

	var get = exports.get = function(name)
	{
		try {
			var obj = cache[name];

			if (obj) {
				if (hasexpired(obj)) {
					clear(name);
				} else {
					obj = utils.extend({}, obj, { flags: flags[name] || {} });
					messaging.trigger("cache:get", [ name, obj ]);
					return obj;
				}
			}
		} catch (e) {
			logger.fail("cache.get: failed with ", e);
		}

		return null;
	};

	var clear = function(name)
	{
		logger.log("- cache.clear");
		try {
			if (cache[name]) {
				delete(cache[name]);
				messaging.trigger("cache:clear", [ name ]);
				return true;
			}
		} catch (e) {
			logger.fail("cache.clear: failed with ", e);
		}

		return false;
	};

	var clearall = exports.clearall = function()
	{
		logger.log("- cache.clearall");
		cache = {};
	};

	var each = function(func, params)
	{
		logger.log("- cache.each");

		if (typeof(func) != "function") {
			return;
		}

		params = params || [];

		for (var i in cache) {
			var rv = func.apply(null,
						[ i, get(i) ].concat(params));

			if (rv) {
				return;
			}
		}
	};

	var purge = exports.purge = function()
	{
		logger.log("- cache.purge");

		/* clear all expired items by going through them */
		each(function() {});

		// set new timeout for auto-expiring cache
		timers.setTimeout(purge, maxage);
	};

	var cacheratingstate = function(name, state)
	{
		try {
			state = state || {};

			var obj = get(name);

			if (obj && obj.status == constants.cachestatus.ok) {
				var changed = false;

				constants.components.forEach(function(item) {
					if (state[item.name]) {
						obj.value[item.name] = obj.value[item.name] || {};

						if (obj.value[item.name].t != state[item.name].t) {
							obj.value[item.name].t  = state[item.name].t;
							changed = true;
						}
					}
				});

				if (changed) {
					set(name, obj.status, obj.value);
				}

				return changed;
			}
		} catch (e) {
			logger.fail("cache.cacheratingstate: failed with ", e);
		}

		return false;
	};

	// TODO: #19 Move xml-response parsing code from cache.js to api.js
	var cacheresponse = exports.cacheresponse = function(hosts, data, status)
	{
		var processed = 0;

		try {
			status = status || constants.cachestatus.ok;

			var targets = data.getElementsByTagName("target");

			for(var ti = 0; ti < targets.length; ti++) {

				var target = targets[ti],
					index = target.getAttribute("index");

				var obj = {
					target: hosts[index || 0]
				};

				if (!obj.target) {
					return;
				}

				var applications = target.getElementsByTagName("application");

				for(var ai = 0; ai < applications.length; ai++) {

					var app = applications[ai],
						name = parseInt(app.getAttribute("name"), 10);

					if (name >= 0) {
						var attrs = [ "r", "c", "t" ];
						var res  = {};

						for (var i = 0; i < attrs.length; ++i) {

							var value = parseInt(app.getAttribute(attrs[i]), 10);

							res[attrs[i]] = (value >= 0) ? value : -1;

						}

						if (app.getAttribute("excluded")) {
							res.r = -2;
							res.c = -2;
						}

						obj[name] = res;
					}

				}

				set(obj.target, status, obj);
				++processed;

			}

		} catch (e) {
			logger.fail("cache.cacheresponse: failed with ", e);
		}

		return processed;
	};

	messaging.bind("message:cache:setflags", function(port, data) {
		setflags(data.target, data.flags);
	});

	messaging.bind("message:cache:clear", function(port, data) {
		clear(data.target);
	});

	messaging.bind("message:cache:get", function(port, data) {

		// TODO: Make this piece working
		port.emit("put", {
			target: data.target,
			data: get(data.target)
		});
	});

})();