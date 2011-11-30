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

var events = {};

const logger = require("logger");

var messaging = {
	trigger: function(name, params, once)
	{
		logger.log("+ Triggered " + name);
		if (events[name]) {
			logger.log("trigger: event " + name + ", once = " + once);

			events[name].forEach(function(obj) {
				try {
					obj.func.apply(null, [].concat(params).concat(obj.params));
				} catch (e) {
					console.error("trigger: event " + name + " failed with " + e);
					console.error(e.stack);
				}
			});

			if (once) { /* these events happen only once per bind */
				delete(events[name]);
			}
		}
	},

	bind: function(name, func, params)
	{
		if (typeof(func) == "function") {
			events[name] = events[name] || [];
			events[name].push({ func: func, params: params || [] });

			logger.log("bind: event " + name);
			this.trigger("bind:" + name);
		}
	},

	addready: function(name, obj, func)
	{
		obj.ready = function(setready)
		{
			if (typeof(func) == "function") {
				this.isready = setready || func.apply(this);
			} else {
				this.isready = setready || this.isready;
			}
			if (this.isready) {
				trigger(name + ":ready", [], true);
			}
		};

		obj.isready = false;

		this.bind("bind:" + name + ":ready", function() {
			obj.ready();
		});
	},

	/* Messaging between main.js/background.js and Content Scripts/Panels */

	triggeronmessage: function(data)
	{
		logger.log("- messaging.triggeronmessage / data.message: " + data.message);
		trigger("message:" + data.message, data);
	},

	listen: function()
	{
		logger.log("- messaging.listen");
		/*
		self.port.on("wotMessaging", function(data) {
			this.triggeronmessage(data);
		});
		*/
	},

	post: function(name, message, data)
	{
		logger.log("!!!! messaging.js <post> method is called !!!!!!");
		data = data || {};
		data.message = name + ":" + message;
		logger.log("- messaging.post: " + data.message);
		//self.port.emit("wotMessaging", data);
	}

};

exports.messaging = messaging;