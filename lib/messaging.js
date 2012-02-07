/*
 messaging.js
 Copyright © 2009-2011  WOT Services Oy <info@mywot.com>

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


(function(){

	var _this = this;

	this.events = {};

	const logger = require("logger");
	const self = require("self");

	this.WOT_MSG = exports.WOT_MSG = "wotMessaging";    // ID of common wot's message

	this.trigger = exports.trigger = function(name, params, once)
	{
		logger.log(".... triggered " + name);
		if (_this.events[name]) {
			logger.log("trigger: event " + name + ", once = " + once);

			_this.events[name].forEach(function(obj) {
				try {
					obj.func.apply(null, [].concat(params).concat(obj.params));
				} catch (e) {
					logger.fail("trigger: event " + name + " failed with " + e);
				}
			});

			if (once) { /* these events happen only once per bind */
				delete(_this.events[name]);
			}
		}
	};


	this.bind = exports.bind = function(name, func, params)
	{
		if (typeof(func) == "function") {
			_this.events[name] = _this.events[name] || [];
			_this.events[name].push({ func: func, params: params || [] });

			logger.log("bind: event " + name);
			_this.trigger("bind:" + name);
		}
	};


	this.addready = exports.addready = function(name, obj, func)
	{
		obj.ready = function(setready)
		{
			if (typeof(func) == "function") {
				this.isready = setready || func.apply(this);
			} else {
				this.isready = setready || this.isready;
			}
			if (this.isready) {
				_this.trigger(name + ":ready", [], true);
			}
		};

		obj.isready = false;

		_this.bind("bind:" + name + ":ready", function() {
			obj.ready();
		});
	};

	/* Messaging between main.js/background.js and Content Scripts/Panels */

	this.triggeronmessage = exports.triggeronmessage = function(data)
	{
		logger.log("- messaging.triggeronmessage / data.message: " + data.message);
		_this.trigger("message:" + data.message, data);
	};


	this.listen = exports.listen = function(port)
	{
		logger.log("- messaging.listen / " + JSON.stringify(port));
		port.on(_this.WOT_MSG, function(message) {
			message.port = port;
			_this.triggeronmessage(message);
		});
	};

	this.post = exports.post = function(name, message, data)
	{
		logger.log("!!!! messaging.js <post> method is called !!!!!!");
		data = data || {};
		data.message = name + ":" + message;
		logger.log("- messaging.post: " + data.message);
		//self.port.emit(_this.WOT_MSG, data);
	};


})();
