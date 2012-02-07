/*
	wot.js
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

var wot = {

	debug: true,

	WOT_MSG: "wotMessaging",

	// ID string for distinguish logging messages (injections vs ratingwindow)
	source: "",

	// Other Constants will be obtained from main.js through Messaging

	/* logging */

	// For DEBUG: Output whole object recursively
	var_dump: function (obj, level)
	{
		console.log("(" + (typeof obj) + ") : ");
		var level_nbsp = "";

		level = level || 1;

		for (i = 0; i < 2*level; i++)
		{
			level_nbsp += "..";
		}

		switch(typeof obj) {
			case "string":
				console.log(obj);
				break;
			case "boolean":
				console.log((obj ? "true" : "false"));
				break;
			case "number":
			case "function":
				console.log(obj.toString());
				break;
			default:
				for(var key in obj)
				{
					console.log(level_nbsp + key + " = ");
					this.var_dump(obj[key], level + 1);
				}
				break;
		}
	},

	log: function(s)
	{
		if (wot.debug) {
			var logstr = [];
			for(var i = 0; i < arguments.length; ++i) {
				var par = arguments[i];
				if (typeof par != "string") {
					logstr.push(JSON.stringify(par));
				} else {
					logstr.push(par);
				}
			}
			console.log(this.source + " # " + logstr.join("\n"));
		}
	},

	/* internal events handling */

	events: {},

	trigger: function(name, params, once)
	{
		wot.log(" ... wot.triggered ", name);
		if (this.events[name]) {
			wot.log("trigger: event " + name + ", once = " + once);

			this.events[name].forEach(function(obj) {
				try {
					obj.func.apply(null, [].concat(params).concat(obj.params));
				} catch (e) {
					console.error("trigger: event " + name + " failed with " + e);
					console.error(e.stack);
				}
			});

			if (once) { /* these events happen only once per bind */
				delete(this.events[name]);
			}
		}
	},

	bind: function(name, func, params)
	{
		if (typeof(func) == "function") {
			this.events[name] = this.events[name] || [];
			this.events[name].push({ func: func, params: params || [] });

			wot.log("bind: event " + name);
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
				wot.trigger(name + ":ready", [], true);
			}
		};

		obj.isready = false;

		this.bind("bind:" + name + ":ready", function() {
			obj.ready();
		});
	},

	/* Messaging between Core and Content Scripts/Panels */

	triggeronmessage: function(data)
	{
		wot.log("- wot.triggeronmessage / data.message: " + data.message);
		wot.trigger("message:" + data.message, data);
	},

	listen: function()
	{
		wot.log("- wot.listen");
		self.port.on(wot.WOT_MSG, function(data) {
			wot.triggeronmessage(data);
		});
	},

	post: function(name, message, data)
	{
		data = data || {};
		data.message = name + ":" + message;
		wot.log("- wot.post: " + JSON.stringify(data));
		self.port.emit(wot.WOT_MSG, data);
	},

    /* i18n */

    alllocales: {},

    i18n: function(category, id, shorter, language)
    {
        language = language || this.language;

        var locale = this.alllocales[language] || {};

        var msg = category;

        if (shorter) {
            msg += "__short";
        }

        if (id != null) {
            msg += "_" + id;
        }

        var result = (locale[msg] || {}).message;

        if (result != null) {
            return result;
        }

        if (language != "en") {
            return this.i18n(category, id, shorter, "en");
        }

        return (this.debug ? "!?" : "");
    },

	/* helpers */

	getuniques: function(list)
	{
		var seen = {};

		return list.filter(function(item) {
					if (seen[item]) {
						return false;
					} else {
						seen[item] = true;
						return true;
					}
				});
	},

	/* rules */

	matchruleurl: function(rule, url)
	{
		try {
			return (RegExp(rule.url).test(url) &&
						(!rule.urlign || !RegExp(rule.urlign).test(url)));
		} catch (e) {
			console.log("matchurl: failed with " + e + "\n");
		}

		return false;
	},

	/* reputation and confidence */

	getlevel: function(levels, n)
	{
		for (var i = levels.length - 1; i >= 0; --i) {
			if (n >= levels[i].min) {
				return levels[i];
			}
		}

		return levels[1];
	},

	getwarningtypeforcomponent: function(comp, data, prefs)
	{
		var type = prefs["warning_type_" + comp] || this.warningtypes.none;

		if (!prefs["show_application_" + comp] ||
				type == this.warningtypes.none) {
			return null;
		}

		var r = -1, c = -1, t = -1;

		if (data[comp]) {
			r = data[comp].r;
			c = data[comp].c;
			t = data[comp].t;
		}

		var warninglevel = prefs["warning_level_" + comp] || 0;
		var minconfidence = prefs["min_confidence_level"] || 0;
		var forunknown = prefs["warning_unknown_" + comp];

		var rr = (r < -1) ? 0 : r;
		var cc = (c < -1) ? warninglevel : c;

		if (((rr >= 0 && rr <= warninglevel && /* poor reputation */
			  			/* and sufficient confidence */
						(cc >= minconfidence || forunknown)) ||
			 		/* or no reputation and warnings for unknown sites */
					(rr < 0 && forunknown)) &&
				/* and no rating that overrides the reputation */
				(t < 0 || t <= warninglevel)) {
			if (r < 0) {
				return {
					type: type,
					reason: this.warningreasons.unknown
				};
			} else {
				return {
					type: type,
					reason: this.warningreasons.reputation
				};
			}
		}

		/* or if the user has rated the site poorly */
		if (t >= 0 && t <= warninglevel) {
			return {
				type: type,
				reason: this.warningreasons.rating
			};
		}

		return null;
	},

	getwarningtype: function(data, prefs)
	{
		var warning = {
			type: this.warningtypes.none,
			reason: this.warningreasons.none
		};

		this.components.forEach(function(item) {
			var comp = wot.getwarningtypeforcomponent(item.name, data, prefs);

			if (comp) {
				warning.type   = Math.max(warning.type, comp.type);
				warning.reason = Math.max(warning.reason, comp.reason);
			}
		});

		return warning;
	},

	/* paths */

	getlocalepath: function(file)
	{
		return "_locales/" + this.i18n("locale") + "/" + file;
	},


	getincludepath: function(file)
	{
		return "skin/include/" + file;
	},

	geticon: function(r, size, accessible, plain)
	{
		var name = "/";
		
		if (typeof(r) == "number")
		{
			name += this.getlevel(this.reputationlevels, r).name;
		} else {
			name += r;
		}

		if (plain) {
			name = "/plain" + name;
		}

		var path = "skin/fusion/";

		if ((typeof(r) != "number" || r >= -1) && accessible)
		{
			path += "accessible/";
		}

		return path + size + "_" + size + name + ".png";
	},

	initialize: function(on_success)
	{
		wot.bind("message:constants", function(data) {
			$.extend(true, wot, data.constants); // we use deep extending

			wot.prefs_data = {};
			$.extend(true, wot.prefs_data, data.prefs); // we use deep extending

			on_success();
		});

		wot.listen();

	}
};
