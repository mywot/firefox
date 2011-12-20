/*
 api.js
 Copyright © 2009, 2010, 2011  WOT Services Oy <info@mywot.com>

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

const logger = require("logger");
const utils = require("utils");
const timers = require("timers");

const prefs = require("prefs");
const crypto = require("crypto");
const cache = require("cache");
const urls = require("urls");
const constants = require("constants").constants;

const ajaxmod = require("ajax");



(function(){

	var state = {},
	cookieupdated = 0;

	var wot = {
		i18n: function(v) {
			logger.log("ARRGH!! wot.i18n was called from api.js // " + v);
		}
	};

	var info = {
		maxhosts:       100,
		maxparamlength: 4096,
		server:         prefs.get("server_api"), // production server
		secure:         true,
		updateformat:   4,
		updateinterval: 3 * 3600 * 1000,
		cookieinterval: 86340 * 1000,
		version:        "0.4",
		timeout:        15 * 1000,
		errortimeout:   60 * 1000,
		retrytimeout:   {
			link:       2 * 1000,
			query:      60 * 1000,
			register:   30 * 1000,
			reload:     5 * 60 * 1000,
			submit:     5 * 60 * 1000,
			update:     15 * 60 * 1000
		},
		maxlinkretries: 3
	};

	var _this = this;


	var call = function (apiname, options, params, onerror, onsuccess) {
		logger.log("- api.call / " + JSON.stringify(arguments));

		try {
			var nonce = crypto.getnonce(apiname);

			params = params || {};

			utils.extend(params, {
				id:      prefs.get("witness_id"),
				nonce:   nonce,
				partner: constants.partner,
				//lang:    wot.i18n("lang"),    // TODO: Fix this
				version: constants.platform + "-" + constants.version
			});

			options = options || {};

			if (options.encryption) {
				utils.extend(params, {
					target: crypto.encrypt(params.target, nonce),
					hosts:  crypto.encrypt(params.hosts, nonce)
				});
			}

			var components = [];

			for (var i in params) {
				if (params[i] != null) {
					components.push(i + "=" + encodeURIComponent(params[i]));
				}
			}

			var path = "/" + info.version + "/" + apiname + "?" +
				components.join("&");

			if (options.authentication) {
				var auth = crypto.authenticate(path);

				logger.log(auth, JSON.stringify(components));

				if (!auth || !components.length) {
					return false;
				}

				path += "&auth=" + auth;
			}

			var url = ((info.secure && options.secure) ?
				"https://" : "http://") + info.server + path;

			logger.log("api.call: url = " + url);

			ajaxmod.ajax({
				dataType: "xml",
				timeout:  info.timeout,
				url:      url,

				error: function (request, status, error) {
					console.log("api.call.error: url = " + url +
						", status = " + status);

					if (typeof(onerror) == "function") {
						onerror(request, status, error);
					}
				},

				success: function (data, status) {
					logger.log("api.call.success: url = " + url +
						", status = " + status);

					if (typeof(onsuccess) == "function") {
						onsuccess(data, status, nonce);
					}
				}
			});

			return true;
		} catch (e) {
			logger.fail("api.call: FAILED with " + e);
		}

		return false;
	};

	var isregistered = exports.isregistered = function () {
		logger.log("- api.isregistered");
		var id = prefs.get("witness_id");
		var key = prefs.get("witness_key");
		var re = /^[a-f0-9]{40}$/;

		var rv = (re.test(id) && re.test(key));
		logger.log("api.isregistered: " + rv + ", id = " + id);
		return rv;
	};

	var retry = function (apiname, params, customtimeout) {
		logger.log("- api.retry");
		var timeout = customtimeout || info.retrytimeout[apiname];

		if (timeout) {
			timers.setTimeout(function () {
				_this[apiname].apply(api, params || []);
			}, timeout);
		}
	};

	/* Parse witness <Id, Key> pair from XML-response and save it in preferences  */
	var setids = function (tag, data) {
		logger.log("- api.setids | tag =" + tag + " | data = " + JSON.stringify(data));

		try {
			var elems = data.getElementsByTagName(tag);

			if (!elems || !elems.length) {
				return false;
			}

			var id = elems[0].getAttribute("id");

			if (!id || id.length != 40) {
				return false;
			}

			var key = elems[0].getAttribute("key");

			if (!key || key.length != 40) {
				return false;
			}

			prefs.set("witness_id", id);
			prefs.set("witness_key", key);

			logger.log("api.setids: id = " + id);

			return true;
		} catch (e) {
			logger.fail("api.setids: failed with " + e);
		}

		return false;
	};

	var processpending = exports.processpending = function () {
		logger.log("- api.processpending");

		prefs.each(function (name, value) {
			if (/^pending\:/.test(name)) {
				submit(name.replace(/^pending\:/, ""));
			}
			return false;
		});
	};

	var processcookies = exports.processcookies = function (current) {
		logger.log("- api.processcookies");

		if (!isregistered() || !prefs.get("my_cookies")) {
			return null;
		}

		current = current || "";

		var id = prefs.get("witness_id");
		var match = /reload=([0-9a-f]{40})/.exec(current);

		if (match && match[1] != id) {
			reload(match[1], function () {
				cookieupdated = 0;
			});
		}

		var now = Date.now();

		/* these are set every time */
		var setcookies = [
			"accessible=" + (prefs.get("accessible") ? "true" : "false"),
			"partner=" + (constants.partner || "")
		];

		if (cookieupdated > 0 &&
			(now - cookieupdated) < info.cookieinterval &&
			/authid=[0-9a-f]{40}/.test(current)) {
			return setcookies;
		}

		cookieupdated = now;

		/* authentication cookies only when needed */
		var cookies = {
			id:    id,
			nonce: crypto.getnonce("cookies")
		};

		cookies.auth = crypto.authenticate("id=" + cookies.id +
			"&nonce=" + cookies.nonce);

		for (var i in cookies) {
			setcookies.push(i + "=" + /* if null, set to an empty value */
				encodeURIComponent(cookies[i] || ""));
		}

		return setcookies;
	};

	var showupdatepage = function () {
		logger.log("- api.showupdatepage");

		var update = prefs.get("firstrun:update") || 0;

		if (update < constants.firstrunupdate) {
			prefs.set("firstrun:update", constants.firstrunupdate);

			// TODO: Move method showupdatepage() from api.js to browser-specific module | http://people.mywot.com/issuetracker/issues/view/525
//            chrome.tabs.create({
//				url: wot.urls.update + "/" + wot.i18n("lang") + "/" +
//						wot.platform + "/" + wot.version
//			});

			var url = urls.update + "/" + wot.i18n("lang") + "/" + constants.platform + "/" + constants.version;
			//wot.browser.opentab(url, function () {
			//});
		}
	};

	var setcookies = exports.setcookies = function (onready) {
		logger.log("- api.setcookies");

		onready = onready || function () {
		};

		if (prefs.get("firstrun:welcome")) {
			showupdatepage();

			var cookies = processcookies();

			if (cookies) {
				/* this sets our authentication cookies (and only them) if
				 they haven't been set already */
				ajaxmod.ajax({
					url:      urls.setcookies + "?" + cookies.join("&"),
					complete: onready
				});
			} else {
				onready();
			}
		} else {
			/* use the welcome page to set the cookies on the first run */
			prefs.set("firstrun:welcome", true);
			prefs.set("firstrun:update", constants.firstrunupdate);

//			TODO: move it away
//            chrome.tabs.create({
//					url: wot.urls.settings + "/welcome"
//				}, onready);

			//wot.browser.opentab(urls.settings + "/welcome", onready);
		}
	};

	var link = exports.link = function (hosts, onupdate, retrycount) {
		logger.log("- wot.api.link");

		onupdate = onupdate || function () {
		};

		var cached = [], fetch = [];
		var now = Date.now();

		hosts.forEach(function (h) {
			var obj = cache.get(h);

			if (obj) {
				if (obj.status == constants.cachestatus.ok ||
					obj.status == constants.cachestatus.link) {
					cached.push(h);
					return;
				}

				if ((obj.status == constants.cachestatus.error ||
					obj.status == constants.cachestatus.busy) &&
					(now - obj.updated) < info.errortimeout) {
					cached.push(h);
					return;
				}
			}

			fetch.push(h);
		});

		onupdate(cached);

		while (fetch.length > 0) {
			var batch = fetch.splice(0, info.maxhosts);

			batch.forEach(function (h) {
				cache.set(h, constants.cachestatus.busy);
			});

			/* no need to call onupdate here for link requests */

			linkcall(batch, onupdate, retrycount);
		}

		return true;
	};

	var linkcall = function (batch, onupdate, retrycount) {
		logger.log("- wot.api.linkall");

		if (batch.length == 0) {
			return;
		}

		var hosts = batch.join("/") + "/";

		/* split into two requests if the parameter is too long */
		if (hosts.length >= info.maxparamlength &&
			batch.length > 1) {
			linkcall(batch.splice(0, batch.length / 2), onupdate,
				retrycount);
			linkcall(batch, onupdate, retrycount);
			return;
		}

		call("link", {
				authentication: true,
				encryption:     true
			}, {
				hosts: hosts
			},
			function (request) {
				batch.forEach(function (h) {
					cache.set(h, constants.cachestatus.retry);
				});

				onupdate(batch);
			},
			function (data) {
				cache.cacheresponse(batch, data, constants.cachestatus.link);

				var retry = [];

				// TODO: probably this code won't work as expected (forEach is not a usual method)
				batch.forEach(function (h) {
					var obj = cache.get(h);

					if (obj &&
						(obj.status != constants.cachestatus.ok &&
							obj.status != constants.cachestatus.link)) {
						if (urls.isencodedhostname(h)) {
							retry.push(h);
							cache.set(h, constants.cachestatus.retry);
						} else {
							cache.set(h, constants.cachestatus.error);
						}
					}
				});

				onupdate(batch);

				retrycount = retrycount || 0;

				if (retry.length > 0 &&
					++retrycount <= info.maxlinkretries) {
					retry("link", [ retry, onupdate, retrycount ],
						retrycount * info.retrytimeout.link);
				}
			});
	};

	var query = exports.query = function (target, onupdate) {
		logger.log("- api.query / " + JSON.stringify(target));

		onupdate = onupdate || function () {};

		var obj = cache.get(target);

		if (obj && (obj.status == constants.cachestatus.ok ||
			((obj.status == constants.cachestatus.error ||
				obj.status == constants.cachestatus.busy) &&
				(Date.now() - obj.updated) < info.errortimeout))) {
			logger.log("* api.query: target data is not expired yet. Using from cache / obj = " + JSON.stringify(obj));
			onupdate([ target ]);
			return true;
		}

		cache.set(target, constants.cachestatus.busy);
		onupdate([ target ]);

		return call("query", {
				authentication: true,
				encryption:     true
			}, {
				target: target
			},
			function (request) {
				cache.set(target, constants.cachestatus.error);

				if (request.status != 403) {
					retry("query", [ target, onupdate ]);
				}

				onupdate([ target ]);
			},
			function (data) {
				if (cache.cacheresponse([ target ], data) != 1) {
					cache.set(target, constants.cachestatus.error);
				}

				logger.log("**** after cache.cacheresponse / data =" + data);

				var result = {
					'user_message': parse_user_message(data),
					'user_content': parse_user_content(data),
					'user_level': parse_user_level(data)
				};

				onupdate([ target ], result);
			});
	};

	var register = exports.register = function (onsuccess) {
		logger.log("- api.register");

		onsuccess = onsuccess || function () {
		};

		if (isregistered()) {
			onsuccess();
			return true;
		}

		call("register", {
				secure: true
			}, {
			},
			function (request) {
				if (request.status != 403) {
					retry("register", [ onsuccess ]);
				}
			},
			function (data) {
				if (setids("register", data)) {
					onsuccess();
				} else {
					retry("register", [ onsuccess ]);
				}
			});
	};

	var reload = function (toid, onsuccess, isretry) {
		logger.log("- api.reload");

		onsuccess = onsuccess || function () {};

		if (!/^[a-f0-9]{40}$/.test(toid) ||
			toid == prefs.get("witness_id") ||
			(!isretry && reloadpending)) {
			return;
		}

		reloadpending = true;

		call("reload", {
				authentication: true,
				secure:         true
			}, {
				reload: toid
			},
			function (request) {
				if (request.status != 403) {
					retry("reload", [ toid, onsuccess, true ]);
				}
			},
			function (data) {
				if (setids("reload", data)) {
					cache.clearall();
					reloadpending = false;
					onsuccess(toid);
				} else {
					retry("reload", [ toid, onsuccess, true ]);
				}
			});
	};

	var submit = function (target, testimonies) {
		logger.log("- api.submit");

		var state = prefs.get("pending:" + target) || {
			target:      target,
			testimonies: {},
			tries:       0
		};

		if (testimonies) {
			utils.extend(state.testimonies, testimonies);
			state.tries = 0;
		}

		if (++state.tries > 30) {
			logger.log("api.submit: failed " + target + " (tries)");
			prefs.clear("pending:" + target);
			return;
		}

		prefs.set("pending:" + target, state);

		call("submit", {
				authentication: true,
				encryption:     true
			},
			utils.extend({ target: target }, state.testimonies),
			function (request) {
				if (request.status != 403) {
					retry("submit", [ target ]);
				} else {
					logger.log("api.submit: failed " + target + " (403)")
					prefs.clear("pending:" + target);
				}
			},
			function (data) {
				var elems = data.getElementsByTagName("submit");

				if (elems && elems.length > 0) {
					logger.log("api.submit: submitted " + target);
					prefs.clear("pending:" + target);
				} else {
					retry("submit", [ target ]);
				}
			});
	};

	var parse = function (elem) {
		logger.log("- api.parse");

		return utils.xml2jso(elem);
	};

	var parse_user_message = function(xml_data) {
			logger.log("- api.parse_user_message / data = " + xml_data);

		var usermessage = {};
		try {

			var elems = xml_data.getElementsByTagName("message"),
				attrs = [ "id", "type", "url", "target", "version", "than" ];

			for (var i = 0; elems && i < elems.length; ++i) {

				var elem = utils.xml2jso(elems[i]);
				
				var obj = {
					text: elem["#text"]
				};

				for (var a = 0; a < attrs.length; ++a) {
					var name = attrs[a];
					obj[name] = elem["@attributes"][name];
				}

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
			logger.fail("ratingwindow.set_user_message: failed with ", e);
		}

		logger.log("usermessage = " + JSON.stringify(usermessage));
		return usermessage;

	};

	var parse_user_content = function(xml_data) {
		logger.log("- api.parse_user_content / data = " + xml_data);

		var user_content = [];

		try {
			var elems = xml_data.getElementsByTagName("user"),
				attrs = [ "icon", "bar", "length", "label", "url", "text",
					"notice" ];

			for (var i = 0; elems && i < elems.length &&
				user_content.length < 4; ++i) {
				var elem = utils.xml2jso(elems[i]);
				var obj = {};

				for (var a = 0; a < attrs.length; ++a) {
					var name = attrs[a];
					obj[name] = elem["@attributes"][name];
				}

				if (obj.text && (!obj.bar ||
					(obj.length != null && obj.label))) {
					user_content.push(obj);
				}
			}

		} catch (e) {
			logger.fail("api.parse_user_content: failed with ", e);
		}

		logger.log("user_content = " + JSON.stringify(user_content));
		return user_content;

	};

	 var parse_user_level = function (xml_data) {
		 try {
			 var elems = xml_data.getElementsByTagName("status");

			 if (elems && elems.length > 0) {
				 var elem = utils.xml2jso(elems[0]);

				 //logger.log("!!! parse_user_level / " + JSON.stringify(elem));

				 var user_level = elem["@attributes"]["level"] || "";

			    prefs.set("status_level", user_level);

			 } else {
			    prefs.clear("status_level");
			 }

		 } catch (e) {
		    logger.fail("core.setuserlevel: failed with ", e);
		 }
	 };

	var update = exports.update = function () {
		logger.log("- api.update");

		var state = prefs.get("update:state") || {
			last:        0,
			lastversion: constants.version
		};

		var updateinterval = info.updateinterval;

		if (state.interval) {
			updateinterval = state.interval * 1000;
		}

		var age = Date.now() - state.last;

		if (age < updateinterval && state.lastversion == constants.version) {
			//state = state; // TODO: What was here before?
			urls.updatestate(state);
			retry("update", [], updateinterval - age);
			return;
		}

		call("update", {
				secure: true
			}, {
				format: info.updateformat
			},
			function (request) {
				retry("update");
			},
			function (data) {
				try {
					var newstate = {
						last:        Date.now(),
						lastversion: constants.version
					};

					var root = data.getElementsByTagName(constants.platform);

					if (root && root.length > 0) {
						var obj = parse(root[0]);

						if (obj) {
							utils.extend(newstate, obj);

							if (newstate.interval) {
								updateinterval = newstate.interval * 1000;
							}
						}
					}

					prefs.set("update:state", newstate);

					state = newstate;
					urls.updatestate(newstate);

					/* poll for updates regularly */
					retry("update", [], updateinterval);
				} catch (e) {
					logger.fail("api.update.success: failed with " + e);
					retry("update");
				}
			});
	};
})();
