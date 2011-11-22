/*
	locale.js
	Copyright © 2009  WOT Services Oy <info@mywot.com>

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

$.extend(wot, { locale: {
	languages: {
		"cs": "cs",
		"de": "de",
		"en": "en",
	  	"es": "es",
	  	"fi": "fi",
	  	"fr": "fr",
	  	"it": "it",
	  	"ja": "ja",
	  	"pl": "pl",
		"pt": "pt_BR",
	  	"pt_BR": "pt_BR",
	  	"ru": "ru",
	  	"sv": "sv",
	  	"zh_CN": "zh_CN",
	  	"zh_TW": "zh_TW"
	},

	loadlocale: function(ondone)
	{
		var xhr = new XMLHttpRequest();

		xhr.onreadystatechange = function() {
			if (this.readyState == 4) {
				wot.alllocales[wot.language] =
					JSON.parse(this.responseText) || {};
				(ondone || function() {})();
			}
		};

		xhr.open("GET", "_locales/" + wot.language + "/messages.json");
		xhr.send();
	},

	setlocale: function()
	{
		var lang = (window.navigator.language || "en").replace(/-/g, "_");

        wot.log("lang detect: " + lang );

		if (!this.languages[lang]) {
			lang = lang.replace(/_.*$/, "");
		}

		wot.language = this.languages[lang] || "en";
		wot.log("wot.locale.setlocale: selected " + wot.language + "\n");

		this.loadlocale(function() {
			wot.locale.ready(true);
            wot.log("Locale loaded");
		});
	},

	onload: function()
	{
		wot.addready("locale", this);

		wot.bind("message:locale:get", function(port, data) {
			wot.bind("locale:ready", function() {
                wot.log('send locale:ready:put signal');
				port.post("put", {
					language: wot.language,
					locale: wot.alllocales[wot.language] || {}
				});
			});
		});

		wot.listen("locale");
		this.setlocale();
	}
}});

wot.locale.onload();
