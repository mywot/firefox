/*
 main.js
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

/*jshint passfail: true */

'use strict';

const { Widget } = require("widget");
const { Panel } = require("panel");
const { PageMod } = require('page-mod');
const { data } = require("self");
const tabs = require("tabs");

const core = require("wot-core.js");
const logger = require("logger");

const constants = require("constants.js").constants;
const prefs = require("prefs.js").prefs;

const jQueryUrl = "jquery-1.6.4.js"; // you have to change it only here


var panel = exports.panel = Panel({
	width:             332,
	height:            400,
	contentURL:        data.url("ratingwindow.html"),
	contentScriptFile: [
		data.url(jQueryUrl), // TODO: replace to minified version
		data.url("wot.js"),
		data.url("panel.js"),
		data.url("firefox.js"),
		data.url("prefs.js"),
		data.url("locale.js"),
		data.url("ratingwindow.js")
	]
});


panel.port.on("wotMessaging", function (data) {
	logger.log("Panel said: ", data);
});


var widget = Widget({
	id:         "wot-rating",
	label:      "WOT reputation",   // TODO: Need l10n here
	contentURL: data.url("skin/fusion/icons/32.png"),
	panel:      panel
});

function changeIcon() {
	logger.log("- main.changeIcon");
}

tabs.on("activate", function (tab) {
	logger.log("* main/tabs/activate");
	logger.log(tab.url);
});

/* Setup injection to every loaded page */

var workers = [];

PageMod({
	'include':           [
		"http://*", // only http and https are processed
		"https://*"
	],
	'contentScriptWhen': 'ready',
	'contentScriptFile': [
		data.url(jQueryUrl),
		data.url("wot.js"),
		data.url("injection.js"),
		data.url("common.js"),
		data.url("warning.js"),
		data.url("url.js"),
		data.url("popup.js"),
		data.url("search.js")
	],

	'onAttach': function (worker) {

		logger.log("* main/PageMod/onAttach");

		worker.on('detach', function (message) {
			var index = workers.indexOf(worker);
			if (index != -1) {
				workers.splice(index, 1);
			}
		});

		workers.push(worker);
		//reloadPreferences(worker, true);
	}
});

/* Init  */

core.run(widget);