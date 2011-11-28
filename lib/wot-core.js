/*
 wot-core.js
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

(function(undefined){

	var usermessage = {},
		usercontent = [];

	const api = require("api").api;
	const url = require("url").url;
	const prefs = require("prefs").prefs;
	const messaging = require("messaging").messaging;
	const constants = require("constants").constants;

	const logger = require("log");

	const tabs = require("tabs");


	var loadratings = exports.loadratings = function (hosts, onupdate) {
		if (typeof(hosts) == "string") {
			var target = url.gethostname(hosts);

			if (target) {
				return api.query(target, onupdate);
			}
		} else if (typeof(hosts) == "object" && hosts.length > 0) {
			return api.link(hosts, onupdate);
		}

		(onupdate || function () {
		})([]);
		return false;
	};


	var update = exports.update = function () {
		try {
//			chrome.windows.getAll({}, function(windows) {
//				windows.forEach(function(view) {
//					chrome.tabs.getSelected(view.id, function(tab) {
//						wot.core.updatetab(tab.id);
//					});
//				});
//			});

			//wot.browser.enumaratetabs(wot.core.updatetab);
		} catch (e) {
			console.log("core.update: failed with " + e + "\n");
		}
	};


	var updatetab = exports.updatetab = function (id) {
		// TODO: fix it
		chrome.tabs.get(id, function (tab) {
			logger.log("core.updatetab: " + id + " = " + tab.url + "\n");

			if (api.isregistered()) {
				loadratings(tab.url, function (hosts) {
					core.updatetabstate(tab, {
						target:        hosts[0],
						decodedtarget: url.decodehostname(hosts[0]),
						cached:        cache.get(hosts[0]) || { value: {} }
					});
				});
			} else {
				updatetabstate(tab, { status: "notready" });
			}
		});
	};


	var geticon = exports.geticon = function (data) {
		try {
			if (data.status == "notready") {
				return "loading";
			}

			var cached = data.cached || {};

			if (cached.status == constants.cachestatus.ok) {
				/* reputation */
				var result = getlevel(constants.reputationlevels,
					cached.value[constants.default_component] ?
						cached.value[constants.default_component].r :
						-1).name;

				/* additional classes */
				if (result != "rx") {
					if (this.unseenmessage()) {
						result = "message_" + result;
					} else if (result != "r0" &&
						!constants.components.some(function (item) {
							return (cached.value[item.name] &&
								cached.value[item.name].t >= 0);
						})) {
						result = "new_" + result;
					}
				}

				return result;
			} else if (cached.status == constants.cachestatus.busy) {
				return "loading";
			} else if (cached.status == constants.cachestatus.error) {
				return "error";
			}

			return "default";
		} catch (e) {
			console.log("core.geticon: failed with " + e + "\n");
		}

		return "error";
	};


	var seticon = exports.seticon = function (tab, data) {
		try {
			var canvas = document.getElementById("wot-icon");
			var context = canvas.getContext("2d");
			var icon = new Image();

			icon.onload = function () {
				context.clearRect(0, 0, canvas.width, canvas.height);
				context.drawImage(icon, 0, 0, 19, 19);

				// TODO: FIX IT
				chrome.browserAction.setIcon({
					tabId:     tab.id,
					imageData: context.getImageData(0, 0, canvas.width,
						canvas.height)
				});
			};

			icon.src = geticon(this.geticon(data), 19,
				prefs.get("accessible"));
		} catch (e) {
			console.log("core.seticon: failed with " + e + "\n");
		}
	};


	var updatetabstate = exports.updatetabstate = function (tab, data) {
		try {
			if (tab.selected) {
				/* update the browser action */
				this.seticon(tab, data);

				/* update the rating window */
				// TODO: FIX IT
				var views = chrome.extension.getViews();

				/*
				for (var i in views) {
					if (views[i].wot.ratingwindow) {
						views[i].wot.ratingwindow.update(tab, data);
					}

				} */
			}

			/* update content scripts */
			this.updatetabwarning(tab, data);
		} catch (e) {
			console.log("core.updatetabstate: failed with " + e + "\n");
		}
	};


	var updatetabwarning = exports.updatetabwarning = function (tab, data) {
		try {
			if (data.cached.status != constants.cachestatus.ok ||
				data.cached.flags.warned) {
				return;
				/* don't change the current status */
			}

			var prefs = [
				"accessible",
				"min_confidence_level",
				"warning_opacity"
			];

			constants.components.forEach(function (item) {
				prefs.push("show_application_" + item.name);
				prefs.push("warning_level_" + item.name);
				prefs.push("warning_type_" + item.name);
				prefs.push("warning_unknown_" + item.name);
			});

			var settings = {};

			prefs.forEach(function (item) {
				settings[item] = prefs.get(item);
			});

			var type = getwarningtype(data.cached.value, settings);

			if (type && type.type == constants.warningtypes.overlay) {
				var port = chrome.tabs.connect(tab.id, { name: "warning" });

				if (port) {
					port.postMessage({
						message:  "warning:show",
						data:     data,
						type:     type,
						settings: settings
					});
				}
			}
		} catch (e) {
			logger.log("core.updatetabwarning: failed with " + e + "\n");
		}
	};


	var setusermessage = exports.setusermessage = function (data) {
		try {
			this.usermessage = {};

			var elems = data.getElementsByTagName("message");

			for (var i = 0; elems && i < elems.length; ++i) {
				var elem = $(elems[i]);

				var obj = {
					text: elem.text()
				};

				[ "id", "type", "url", "target", "version", "than" ]
					.forEach(function (name) {
					obj[name] = elem.attr(name);
				});

				if (obj.id && obj.type &&
					(obj.target == "all" || obj.target == "firefox") &&
					(!obj.version || !obj.than ||
						(obj.version == "eq" && constants.version == obj.than) ||
						(obj.version == "le" && constants.version <= obj.than) ||
						(obj.version == "ge" && constants.version >= obj.than))) {
					this.usermessage = obj;
					break;
				}
			}
		} catch (e) {
			console.log("core.setusermessage: failed with " + e + "\n");
		}
	};

/*
	wot.core.unseenmessage = function () {
		return (this.usermessage.text &&
			this.usermessage.id &&
			this.usermessage.id != wot.prefs.get("last_message") &&
			this.usermessage.id != "downtime");
	};

	exports.unseenmessage = wot.core.unseenmessage;

	wot.core.setusercontent = function (data) {
		try {
			this.usercontent = [];

			var elems = data.getElementsByTagName("user");

			for (var i = 0; elems && i < elems.length &&
				this.usercontent.length < 4; ++i) {
				var elem = $(elems[i]);
				var obj = {};

				[ "icon", "bar", "length", "label", "url", "text", "notice" ]
					.forEach(function (name) {
					obj[name] = elem.attr(name);
				});

				if (obj.text && (!obj.bar ||
					(obj.length != null && obj.label))) {
					this.usercontent.push(obj);
				}
			}
		} catch (e) {
			console.log("core.setusercontent: failed with " + e + "\n");
		}
	};

	exports.setusercontent = wot.core.setusercontent;

	wot.core.setuserlevel = function (data) {
		try {
			var elems = data.getElementsByTagName("status");

			if (elems && elems.length > 0) {
				wot.prefs.set("status_level", $(elems[0]).attr("level") || "");
			} else {
				wot.prefs.clear("status_level");
			}
		} catch (e) {
			console.log("core.setuserlevel: failed with " + e + "\n");
		}
	};

	exports.setuserlevel = wot.core.setuserlevel;

	*/

	var processrules = exports.processrules= function (url, onmatch) {
		onmatch = onmatch || function () {
		};

		if (!api.state || !api.state.search) {
			return false;
		}

		var state = prefs.get("search:state") || {};

		for (var i = 0; i < api.state.search.length; ++i) {
			var rule = api.state.search[i];

			if (state[rule.name]) {
				continue;
				/* disabled */
			}

			if (matchruleurl(rule, url)) {
				onmatch(rule);
				return true;
			}
		}

		return false;
	};


	var onload = exports.onload = function () {
		try {

			/* messages */

			messaging.bind("message:search:hello", function (port, data) {
				processrules(data.url, function (rule) {
					port.post("process", { url: data.url, rule: rule });
				});
			});

			messaging.bind("message:search:get", function (port, data) {
				loadratings(data.targets, function (hosts) {
					var ratings = {};

					hosts.forEach(function (target) {
						var obj = cache.get(target) || {};

						if (obj.status == constants.cachestatus.ok ||
							obj.status == constants.cachestatus.link) {
							ratings[target] = obj.value;
						}
					});

					port.post("update", { rule: data.rule, ratings: ratings });
				});
			});

			messaging.bind("message:search:openscorecard", function (port, data) {
				tabs.open({
					url: urls.scorecard + encodeURIComponent(data.target),
					inNewWindow: true
				});
			});

			messaging.bind("message:my:update", function (port, data) {
				port.post("setcookies", {
					cookies: api.processcookies(data.cookies) || []
				});
			});

			//wot.listen([ "search", "my" ]);

			/* event handlers */

			tabs.on("ready", function (tab) {
				updatetab(tab);
			});

			tabs.on("activate", function (tab) {
				updatetab(tab);
			});

			if (constants.debug) {
				prefs.clear("update:state");

				messaging.bind("cache:set", function (name, value) {
					console.log("cache.set: " + name + " = " +
						JSON.stringify(value) + "\n");
				});

				messaging.bind("prefs:set", function (name, value) {
					console.log("prefs.set: " + name + " = " +
						JSON.stringify(value) + "\n");
				});
			}

			/* initialize */

			api.register(function () {
				update();

				if (api.isregistered()) {
					api.setcookies();
					api.update();
					api.processpending();
				}
			});

			cache.purge();
		} catch (e) {
			console.log("core.onload: failed with " + e + "\n");
		}
	};


})();

