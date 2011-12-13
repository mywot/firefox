/*
	url.js
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

const idn = require("idn");
const logger = require("logger");


(function() {

	var _this = this;

	this.host = {
		re: /^(\w+):\/\/((\w+)(:(\w+))?@)?([^:\/\?&=#\[\]]+|\[[^\/\?&=#\[\]]+\])\.?(:(\d+))?(.*)$/,
		host: 6,
		path: 9
	};

	this.priv = {
		/* This isn't meant to be a comprehensive check, just notice the most
		 common local and private addresses */
		re: /^(localhost|((10|127)\.\d+|(172\.(1[6-9]|2[0-9]|3[01])|192\.168))\.\d+\.\d+)$/i
	};


	this.getparent = function(host) {
		var p = host.replace(/^[^\.]*\./, "");

		return (p && p != host) ? p : null;

//		if (p && p != host) {
//			return p;
//		}
//		return null;

	};


	this.issupportedscheme = function (url) {
		return /^(https?|ftp|mms|rtsp)\:\/\//i.test(url);
	};


	this.isequivalent = function (host) {
		try {
			if (/^www(\d[^\.]*)?\..+\..+$/i.test(host)) {
				return !this.isetld(this.getparent(host));
			}
		} catch (e) {
			logger.fail("url.isequivalent: failed with " + e);
		}

		return false;
	};


	this.isprivate = function (name) {
		return _this.priv.re.test(name);
	};


	exports.gethostname = this.gethostname = function(url_value) {

		try {
			var cleaned_url = url_value.replace(/^\s*/, "").replace(/\s*$/, "");

			if (_this.issupportedscheme(cleaned_url)) {
				var match = _this.host.re.exec(cleaned_url);

				if (match && match[_this.host.host]) {

					var host = idn.toascii(match[_this.host.host]);
					while (isequivalent(host)) {
						host = _this.getparent(host);
					}

					if (!_this.isprivate(host)) {
						return _this.encodehostname(host, match[_this.host.path]);
					}
				}
			}
		} catch (e) {
			logger.fail("url.gethostname: failed with " + e);
		}

		return null;
	};


	this.getuniquehostnames = function (urls) {
		// TODO: Resolve this call
		return wot.getuniques(urls.map(function(url) {
						return _this.gethostname(url);
					}));
	};

		/* shared hosts */

	this.sharedhosts = {};


	this.getsharedlevel = function (host) {
		return _this.sharedhosts[host] || 0;
	};


	this.encodehostname = function (host, path) {
		try {
			if (!host || !path) {
				return host;
			}

			/* Clean up the path, drop query string and hash */
			path = path.replace(/^\s*/g, "").replace(/\s*$/, "")
					.replace(/[\?#].*$/, "").replace(/\/$/, "");

			if (path.length < 2 || path[0] != "/") {
				return host;
			}

			var c = path.split("/");

			if (!c || !c.length) {
				return host;
			}

			/* Drop a suspected filename from the end */
			if (path[path.length - 1] != "/" &&
					/\.[^\.]{1,6}$/.test(c[c.length - 1])) {
				c.pop();
			}

			var level = 0;

			for (var i = c.length; !level && i > 0; --i) {
				level = _this.getsharedlevel(host + c.slice(0, i).join("/"));
			}

			if (!level) {
				return host;
			}

			var p = c.slice(0, level + 1).join("/").replace(/^\//, "");

			if (!p || !p.length) {
				return host;
			}

			var encoded = _this.base32.encode(p);

			if (encoded == null) {
				return host;
			}

			return "_p_" + encoded + "." + host;
		} catch (e) {
			logger.fail("url.encodehostname: failed with " + e);
		}

		return host;
	};


	exports.decodehostname = this.decodehostname = function (host) {
		try {
			var m = /^_p_([a-z2-7]+)\.(.+)$/.exec(host);

			if (!m || !m[1] || !m[2]) {
				return idn.tounicode(host);
			}

			var decoded = _this.base32.decode(m[1]);

			if (decoded == null) {
				return idn.tounicode(host);
			}

			return idn.tounicode(m[2]) + "/" + decoded;
		} catch (e) {
			logger.fail("url.decodehostname: failed with " + e);
		}

		return host;
	};


	exports.isencodedhostname = this.isencodedhostname = function(host) {
		try {
			return /^_p_[a-z2-7]+\..+$/.test(host);
		} catch (e) {
			logger.fail("url.isencodedhostname: failed with " + e);
		}

		return false;
	};


	this.base32 = {
		set: "abcdefghijklmnopqrstuvwxyz234567",

		encode: function(s) {
			try {
				/* Unicode to UTF-8 */
				s = unescape(encodeURIComponent(decodeURIComponent(s)));

				var r = "";
				var b = 0;
				var l = 0;

				for (var i = 0; i < s.length; ++i) {
					var n = s.charCodeAt(i);

					if (n > 255) {
						return null; /* Invalid input */
					}

					b = (b << 8) + n;
					l += 8;

					do {
						l -= 5;
						r += this.set[(b >> l) & 0x1F];
					} while (l >= 5);
				}

				if (l > 0) {
					r += this.set[(b << (5 - l)) & 0x1F];
				}

				return r;
			} catch (e) {
				logger.fail("base32.encode: failed with " + e);
			}

			return null;
		},

		decode: function(s)
		{
			try {
				/* Build a reverse lookup table */
				if (!this.rev) {
					this.rev = {};

					for (var i = 0; i < this.set.length; ++i) {
						this.rev[this.set.charAt(i)] = i;
					}
				}

				var r = "";
				var b = 0;
				var l = 0;

				for (var i = 0; i < s.length; ++i) {
					var n = this.rev[s.charAt(i)];

					if (n == null) {
						return null; /* Invalid input */
					}

					b = (b << 5) + n;
					l += 5;

					while (l >= 8) {
						l -= 8;
						r += String.fromCharCode((b >> l) & 0xFF);
					}
				}

				if (l >= 5) {
					return null; /* Invalid input */
				}

				/* UTF-8 to Unicode */
				return decodeURIComponent(escape(r));
			} catch (e) {
				logger.fail("base32.decode: failed with " + e);
			}

			return null;
		}
	};

	/* eTLDs */

	this.etlds = {
		effectives: {},
		exceptions: {}
	};

	this.isetld = function(host) {
		try {
			if (_this.etlds.effectives[host] != null) {
				return true;
			}

			if (_this.etlds.exceptions[host]) {
				return false;
			}

			var p = _this.getparent(host);

			if (p && _this.etlds.effectives[p] == 1) {
				return true;
			}
		} catch (e) {
			logger.fail("url.isetld: failed with " + e);
		}

		return false;
	};

	/* state */

	exports.updatestate = this.updatestate = function(state) {

		_this.sharedhosts = {};

		_this.etlds.effectives = {};
		_this.etlds.exceptions = {};

		(state.shared || []).forEach(function(shared) {
			if (shared.level > 0 && shared.domains) {
				var hosts = shared.domains.replace(/\s*/g, "");

				hosts.split(",").forEach(function(host) {
					if (host.length) {
						_this.sharedhosts[host] = Number(shared.level);
					}
				});
			}
		});

		if (state.etlds && state.etlds.length) {
			(state.etlds[0].effective || []).forEach(function(item) {
				_this.etlds.effectives[item.name] = parseInt(item.value);
			});

			(state.etlds[0].exception || []).forEach(function(item) {
				_this.etlds.exceptions[item.name] = true;
			});
		}
	};


	// TODO Decide what to do with code below
	//function onload()
	//{
	//	wot.bind("message:url:gethostname", function(port, data) {
	//		port.post("puthostname", {
	//			url: data.url,
	//			target: wot.url.gethostname(data.url)
	//		});
	//	});
	//
	//	wot.listen("url");
	//}
	//
	//wot.url.onload();

})();