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


const tabs = require("tabs");
const self = require("self");
const winutils = require("window-utils");
const windows = require("windows").browserWindows;

const api = require("api");
const urls = require("urls");
const prefs = require("prefs");
const messaging = require("messaging");
const constants = require("constants").constants;
const cache = require("cache");
const logger = require("logger");

(function(){

	var widget = null,
		user_message = {},
		usercontent = [];


	function loadratings(hosts, onupdate) {
		logger.log("- core.loadratings / " + hosts);

		if (typeof(hosts) == "string") {

			var target = urls.gethostname(hosts);

			if (target) {
				return api.query(target, function(targets, user_data) {
					// it is possible to have data == undefined in case of error
					if(user_data) {
						logger.log("CORE USER DATA: " + JSON.stringify(user_data));
						// TODO: implement passing this data to RatingWindow
						//setusermessage(data.data);
						//setusercontent(data.data);
						//setuserlevel(data);
					}
					onupdate(targets);
				});

			}
		} else if (typeof(hosts) == "object" && hosts.length > 0) {
			return api.link(hosts, onupdate);
		}

		(onupdate || function () {})([]);
		return false;
	}


	 function update_tab(tab) {

		tab = tab || tabs.activeTab;

		logger.log("- core.update_tab: " + tab.url);

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
	}

	// TODO: remove this duplication (see the same func in data/wot.js)
	function getlevel(levels, n)
	{
		for (var i = levels.length - 1; i >= 0; --i) {
			if (n >= levels[i].min) {
				return levels[i];
			}
		}

		return levels[1];
	}


	function determ_icon(data) {
		logger.log("- core.determ_icon");

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
					if (is_unseen_message()) {
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
			logger.fail("core.determ_icon: failed with ", e);
		}

		return "error";
	}


	function ask_icon(tab, data) {
		logger.log("- core.ask_icon");

		try {
			/* push data to Panel for selecting proper WOT Icon to widget */
			widget.panel.port.emit(messaging.WOT_MSG, {
				message: "geticon",
				accessible: prefs.get("accessible"),
				r: determ_icon(data),
				size: 19
			});
		} catch (e) {
			logger.fail("core.ask_icon: failed with ", e);
		}
	}

	function set_icon(data) {
		logger.log("- core.set_icon(" + JSON.stringify(data) + ")");
		if(data.path) {
			var view = widget.getView(tabs.activeTab.window);   // TODO: remove Browser specific property usage
			view.contentURL = self.data.url(data.path);
		}
	}


	function updatetabstate(tab, data) {
		logger.log("- core.updatetabstate / data=" + JSON.stringify(data));

		try {
			if (tab == tabs.activeTab) {
				/* update the browser action */
				ask_icon(tab, data);

				/* update the rating window */
				widget.panel.port.emit(messaging.WOT_MSG, {
					"message": "status:update",
					data: data
				});
			}

			/* update content scripts */
			updatetabwarning(tab, data);
		} catch (e) {
			logger.fail("core.updatetabstate: failed with ", e);
		}
	}


	function updatetabwarning(tab, data) {
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
			logger.fail("core.updatetabwarning: failed with ", e);
		}
	}




	function is_unseen_message(msg) {
		logger.log("- core.is_unseen_message");

		var msg = msg || user_message;

		return (msg.text &&
			msg.id &&
			msg.id != prefs.get("last_message") &&
			msg.id != "downtime");
	}

	function unsee_message(port, data) {
		logger.log("- core.unsee_message");
		var msg = data.data.user_message;

		if (is_unseen_message(msg)) {  // TODO: fix it
			prefs.set("last_message", msg.id);
		}

	}

	// browser specific function: open URL in the new tab
	function navigate (obj) {
		if(obj.url)
			tabs.open(obj.url);
	}

	function hide_ratingswindow () {
		logger.log("- core.hide_ratingswindow");
		widget.panel.hide();
	}


	function processrules(url, onmatch) {
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

	function search_hello(port, data) {
		processrules(data.url, function (rule) {
			port.post("process", { url: data.url, rule: rule });
		});
	}

	function search_get(port, data) {
		loadratings(data.targets, function (hosts) {
			var ratings = {};

			// TODO: probably won't work (forEach)
			hosts.forEach(function (target) {
				var obj = cache.get(target) || {};

				if (obj.status == constants.cachestatus.ok ||
					obj.status == constants.cachestatus.link) {
					ratings[target] = obj.value;
				}
			});

			port.post("update", { rule: data.rule, ratings: ratings });
		});
	}

	/* Open site's Scorecard in new Tab */
	function open_scorecard(port, data) {
		var url = constants.scorecard + encodeURIComponent(data.target);
		tabs.open(url);
	}

	function my_update(port, data) {
		port.post("setcookies", {
			cookies: api.processcookies(data.cookies) || []
		});
	}

	function detect_lang() {
		// Detect browser's language and store it in preferences
		var language = "en";

		for(var w in winutils.windowIterator()) {
			if(w.navigator.language) {
				language = w.navigator.language;
				break;
			}
		}

		return language;
	}


	function run(_widget) {

		widget = _widget;

		var language = detect_lang();

		prefs.set("language", language);

		/* push constants and preferences to widget's panel */
		widget.panel.port.emit(messaging.WOT_MSG, {
			message: "constants",
			constants: constants,
			prefs: prefs.getall()
		});

		/* messages */
		messaging.bind("message:search:hello", search_hello);
		messaging.bind("message:search:get", search_get);
		messaging.bind("message:search:openscorecard", open_scorecard);
		messaging.bind("message:my:update", my_update);
		messaging.bind("message:seticon", set_icon);
		messaging.bind("message:navigate", navigate);
		messaging.bind("message:hidewindow", hide_ratingswindow);
		messaging.bind("message:update_tab", update_tab);
		messaging.bind("message:unseen_message", unsee_message);

		messaging.listen(widget.panel.port); // listen to Widget's messages
		//messaging.listen(); // TODO: listen to each PageMod's ports


		/* event handlers */

		tabs.on("ready", function (tab) {
			update_tab(tab);
		});

		tabs.on("activate", function (tab) {
			update_tab(tab);
		});


		if (constants.debug) {
			prefs.clear("update:state");

			messaging.bind("cache:set", function (name, value) {
				logger.log("cache.set: " + name + " = " +
					JSON.stringify(value));
			});
		}

		try {
			/* initialize */

			api.register(function () {
				update_tab();

				if (api.isregistered()) {
					api.setcookies();
					api.update();
					api.processpending();
				}
			});

			cache.purge();

		} catch (e) {
			logger.fail("core.onload: FAILED with ", e);
		}
	}

	exports.run = run;

})();

