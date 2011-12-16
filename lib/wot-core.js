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

	const api = require("api");
	const urls = require("urls");
	const prefs = require("prefs").prefs;
	const messaging = require("messaging");
	const constants = require("constants").constants;
	const cache = require("cache");

	const logger = require("logger");

	const tabs = require("tabs");
	const self = require("self");
	const winutils = require("window-utils");

	var widget = null;



	var loadratings = exports.loadratings = function (hosts, onupdate) {
		logger.log("- core.loadratings / " + hosts);

		if (typeof(hosts) == "string") {
			var target = urls.gethostname(hosts);

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
		logger.log("- core.update");

		try {
//			chrome.windows.getAll({}, function(windows) {
//				windows.forEach(function(view) {
//					chrome.tabs.getSelected(view.id, function(tab) {
//						wot.core.updatetab(tab.id);
//					});
//				});
//			});

			updatetab(tabs.activeTab);

		} catch (e) {
			logger.fail("core.update: failed with " + e);
		}
	};


	var updatetab = exports.updatetab = function (tab) {

		logger.log("- core.updatetab: " + tab.url);

		if (api.isregistered()) {
			loadratings(tab.url, function (hosts) {
				updatetabstate(tab, {
					target:        hosts[0],
					decodedtarget: urls.decodehostname(hosts[0]),
					cached:        cache.get(hosts[0]) || { value: {} }
				});
			});
		} else {
			updatetabstate(tab, { status: "notready" });
		}
	};

	// TODO: remove this duplication (see the same func in data/wot.js)
	var getlevel = function(levels, n)
	{
		for (var i = levels.length - 1; i >= 0; --i) {
			if (n >= levels[i].min) {
				return levels[i];
			}
		}

		return levels[1];
	};



	var determicon = function (data) {
		logger.log("- core.determicon");

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
					if (unseenmessage()) {
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
			logger.fail("core.determicon: failed with " + e);
		}

		return "error";
	};


	var ask_icon = exports.ask_icon = function (tab, data) {
		logger.log("- core.ask_icon");

		try {
			/* push data to Panel for selecting proper WOT Icon to widget */
			widget.panel.port.emit(messaging.WOT_MSG, {
				message: "geticon",
				accessible: prefs.get("accessible"),
				r: determicon(data),
				size: 19
			});
		} catch (e) {
			logger.fail("core.ask_icon: failed with ", e);
		}
	};

	var set_icon = function(data) {
		logger.log("- core.set_icon(" + JSON.stringify(data) + ")");
		if(data.path) {
			var view = widget.getView(tabs.activeTab.window);   // TODO: remove Browser specific property usage
			view.contentURL = self.data.url(data.path);
		}
	};

	var updatetabstate = exports.updatetabstate = function (tab, data) {
		logger.log("- core.updatetabstate / data=" + JSON.stringify(data));

		try {
			if (tab == tabs.activeTab) {
				/* update the browser action */
				ask_icon(tab, data);

				/* update the rating window */
				// TODO: FIX IT
				//var views = chrome.extension.getViews();

				/*
				for (var i in views) {
					if (views[i].wot.ratingwindow) {
						views[i].wot.ratingwindow.update(tab, data);
					}

				} */
			}

			/* update content scripts */
			updatetabwarning(tab, data);
		} catch (e) {
			logger.fail("core.updatetabstate: failed with " + e);
		}
	};


	var updatetabwarning = exports.updatetabwarning = function (tab, data) {
		try {
			if (data.cached.status != constants.cachestatus.ok ||
				data.cached.flags.warned) {
				return;
				/* don't change the current status */
			}

			var preferences = [
				"accessible",
				"min_confidence_level",
				"warning_opacity"
			];

			constants.components.forEach(function (item) {
				preferences.push("show_application_" + item.name);
				preferences.push("warning_level_" + item.name);
				preferences.push("warning_type_" + item.name);
				preferences.push("warning_unknown_" + item.name);
			});

			var settings = {};

			preferences.forEach(function (item) {
				settings[item] = prefs.get(item);
			});

//			var type = getwarningtype(data.cached.value, settings);
//
//			if (type && type.type == constants.warningtypes.overlay) {

				// TODO: Fix it!
//				var port = chrome.tabs.connect(tab.id, { name: "warning" });
//
//				if (port) {
//					port.postMessage({
//						message:  "warning:show",
//						data:     data,
//						type:     type,
//						settings: settings
//					});
//				}
//			}
		} catch (e) {
			logger.fail("core.updatetabwarning: failed with " + e);
		}
	};


	var setusermessage = exports.setusermessage = function (data) {
		try {
			usermessage = {};

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
					usermessage = obj;
					break;
				}
			}
		} catch (e) {
			logger.fail("core.setusermessage: failed with " + e);
		}
	};


	var unseenmessage = function () {
		return (usermessage.text &&
			usermessage.id &&
			usermessage.id != prefs.get("last_message") &&
			usermessage.id != "downtime");
	};

/*
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


	var run = exports.run = function (_widget) {

		// Detect browser's language and store it in preferences
		var language = "en";

		widget = _widget;

		for(var w in winutils.windowIterator()) {
			if(w.navigator.language) {
				language = w.navigator.language;
				prefs.set("language", language);
				break;
			}
		}

		/* push constants and preferences to widget's panel */
		widget.panel.port.emit(messaging.WOT_MSG, {
			message: "constants",
			constants: constants,
			prefs: prefs.getall()
		});

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
					url: constants.scorecard + encodeURIComponent(data.target),
					inNewWindow: true
				});
			});

			messaging.bind("message:my:update", function (port, data) {
				port.post("setcookies", {
					cookies: api.processcookies(data.cookies) || []
				});
			});

			messaging.bind("message:seticon", set_icon);

			messaging.listen(widget.panel.port); // listen to Widget's messages
			//messaging.listen(); // TODO: listen to each PageMod's ports

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
					logger.log("cache.set: " + name + " = " +
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
			logger.fail("core.onload: FAILED with " + e);
		}
	};


})();

