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


var host = {
	re: /^(\w+):\/\/((\w+)(:(\w+))?@)?([^:\/\?&=#\[\]]+|\[[^\/\?&=#\[\]]+\])\.?(:(\d+))?(.*)$/,
	host: 6,
	path: 9
};

var priv = {
	/* This isn't meant to be a comprehensive check, just notice the most
		common local and private addresses */
	re: /^(localhost|((10|127)\.\d+|(172\.(1[6-9]|2[0-9]|3[01])|192\.168))\.\d+\.\d+)$/i
};

function getparent(host)
{
	var p = host.replace(/^[^\.]*\./, "");

	if (p && p != host) {
		return p;
	}

	return null;
}


function issupportedscheme(url)
{
	return /^(https?|ftp|mms|rtsp)\:\/\//i.test(url);
}


function isequivalent(host)
{
	try {
		if (/^www(\d[^\.]*)?\..+\..+$/i.test(host)) {
			return !this.isetld(this.getparent(host));
		}
	} catch (e) {
		console.log("url.isequivalent: failed with " + e + "\n");
	}

	return false;
}


function isprivate(name)
{
	return this.priv.re.test(name);
}


function gethostname(url)
{
	try {
		url = url.replace(/^\s*/, "").replace(/\s*$/, "");

		if (this.issupportedscheme(url)) {
			var match = this.host.re.exec(url);

			if (match && match[this.host.host]) {
				var host = wot.idn.toascii(match[this.host.host]);

				while (this.isequivalent(host)) {
					host = this.getparent(host);
				}

				if (!this.isprivate(host)) {
					return this.encodehostname(host, match[this.host.path]);
				}
			}
		}
	} catch (e) {
		console.log("url.gethostname: failed with " + e + "\n");
	}

	return null;
}


function getuniquehostnames(urls)
{
	return wot.getuniques(urls.map(function(url) {
					return wot.url.gethostname(url);
				}));
}

	/* shared hosts */

var sharedhosts = {};


function getsharedlevel(host)
{
	return sharedhosts[host] || 0;
}


function encodehostname(host, path)
{
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
			level = this.getsharedlevel(host + c.slice(0, i).join("/"));
		}

		if (!level) {
			return host;
		}

		var p = c.slice(0, level + 1).join("/").replace(/^\//, "");

		if (!p || !p.length) {
			return host;
		}

		var encoded = this.base32.encode(p);

		if (encoded == null) {
			return host;
		}

		return "_p_" + encoded + "." + host;
	} catch (e) {
		console.log("url.encodehostname: failed with " + e + "\n");
	}

	return host;
}


function decodehostname(host)
{
	try {
		var m = /^_p_([a-z2-7]+)\.(.+)$/.exec(host);

		if (!m || !m[1] || !m[2]) {
			return wot.idn.tounicode(host); // TODO import IDN as module
		}

		var decoded = this.base32.decode(m[1]);

		if (decoded == null) {
			return wot.idn.tounicode(host); // TODO import IDN as module
		}

		return wot.idn.tounicode(m[2]) + "/" + decoded;  // TODO import IDN as module
	} catch (e) {
		console.log("url.decodehostname: failed with " + e + "\n");
	}

	return host;
}


function isencodedhostname(host)
{
	try {
		return /^_p_[a-z2-7]+\..+$/.test(host);
	} catch (e) {
		console.log("url.isencodedhostname: failed with " + e + "\n");
	}

	return false;
}


var base32 = {
	set: "abcdefghijklmnopqrstuvwxyz234567",

	encode: function(s)
	{
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
			console.log("base32.encode: failed with " + e + "\n");
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
			console.log("base32.decode: failed with " + e + "\n");
		}

		return null;
	}
};

/* eTLDs */

var etlds = {
	effectives: {},
	exceptions: {}
};

function isetld(host)
{
	try {
		if (etlds.effectives[host] != null) {
			return true;
		}

		if (etlds.exceptions[host]) {
			return false;
		}

		var p = getparent(host);

		if (p && etlds.effectives[p] == 1) {
			return true;
		}
	} catch (e) {
		console.log("url.isetld: failed with " + e + "\n");
	}

	return false;
}

/* state */

function updatestate(state)
{
	sharedhosts = {};

	etlds.effectives = {};
	etlds.exceptions = {};

	(state.shared || []).forEach(function(shared) {
		if (shared.level > 0 && shared.domains) {
			var hosts = shared.domains.replace(/\s*/g, "");

			hosts.split(",").forEach(function(host) {
				if (host.length) {
					sharedhosts[host] = Number(shared.level);
				}
			});
		}
	});

	if (state.etlds && state.etlds.length) {
		(state.etlds[0].effective || []).forEach(function(item) {
			etlds.effectives[item.name] = parseInt(item.value);
		});

		(state.etlds[0].exception || []).forEach(function(item) {
			etlds.exceptions[item.name] = true;
		});
	}
}

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
